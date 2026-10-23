-- PREPRODUCTION / DISPOSABLE ONLY. Unapplied to production.
-- Builds on the append-only owner hold proposal; no browser can approve research.
-- A separate independently authorised reviewer must actually inspect the sources.
-- A digest proves the inspected record has not changed; it does not authenticate it.
do $$begin
 if not exists(select 1 from pg_roles where rolname='ci_item_assessment_reviewer') then
  create role ci_item_assessment_reviewer nologin nosuperuser nobypassrls;
 end if;
 if exists(select 1 from pg_roles where rolname='ci_item_assessment_reviewer' and (rolcanlogin or rolsuper or rolbypassrls)) or pg_has_role('anon','ci_item_assessment_reviewer','MEMBER')
 or pg_has_role('authenticated','ci_item_assessment_reviewer','MEMBER')
 or pg_has_role('service_role','ci_item_assessment_reviewer','MEMBER') then
  raise exception 'Unsafe item reviewer role';
 end if;
end$$;
create schema if not exists ci_private;
revoke all on schema ci_private from public,anon,authenticated,service_role;
grant usage on schema ci_private to ci_item_assessment_reviewer;

-- Hash the complete current owner/item evidence graph, not only the visible summary.
-- Additional same-source research conservatively invalidates a reviewed decision.
create function public.ci_item_review_graph_v1(p_owner uuid,p_item uuid) returns jsonb
language sql stable security invoker set search_path=pg_catalog,public,storage as $$
 select jsonb_build_object(
  'item',(select to_jsonb(i) from public.items i where i.id=p_item and i.owner_id=p_owner),
  'photos',coalesce((select jsonb_agg(to_jsonb(p) order by p.id) from public.item_photos p where p.item_id=p_item and p.owner_id=p_owner),'[]'::jsonb),
  'storedObjects',coalesce((select jsonb_agg((to_jsonb(s)-'last_accessed_at') order by s.id) from storage.objects s where s.bucket_id='item-images' and exists(select 1 from public.item_photos p where p.item_id=p_item and p.owner_id=p_owner and p.storage_path=s.name)),'[]'::jsonb),
  'evidence',coalesce((select jsonb_agg(to_jsonb(e) order by e.id) from public.item_evidence e where e.item_id=p_item and e.owner_id=p_owner),'[]'::jsonb),
  'runs',coalesce((select jsonb_agg(to_jsonb(r) order by r.id) from public.ai_analysis_runs r where r.owner_id=p_owner and (
    r.user_context->>'item_id'=p_item::text or r.id=(select i.source_analysis_run_id from public.items i where i.id=p_item and i.owner_id=p_owner)
    or r.user_context->>'source_analysis_run_id'=(select i.source_analysis_run_id::text from public.items i where i.id=p_item and i.owner_id=p_owner))),'[]'::jsonb),
  'comparableReviews',coalesce((select jsonb_agg(to_jsonb(e) order by e.id) from public.comparable_evidence_reviews e join public.comparables c on c.id=e.comparable_id and c.owner_id=e.owner_id where c.item_id=p_item and c.owner_id=p_owner),'[]'::jsonb),
  'sourceChecks',coalesce((select jsonb_agg(to_jsonb(e) order by e.id) from public.comparable_source_checks e join public.comparables c on c.id=e.comparable_id and c.owner_id=e.owner_id where c.item_id=p_item and c.owner_id=p_owner),'[]'::jsonb),
  'comparables',coalesce((select jsonb_agg(to_jsonb(c) order by c.id) from public.trusted_comparables_v1 c where c.item_id=p_item and c.owner_id=p_owner),'[]'::jsonb)
 )
$$;
revoke all on function public.ci_item_review_graph_v1(uuid,uuid) from public,anon,service_role;
grant execute on function public.ci_item_review_graph_v1(uuid,uuid) to authenticated;

-- Exact source anchors bind review references to real current owned records.
create function public.ci_item_review_anchor_v1(p_owner uuid,p_item uuid,p_kind text,p_id uuid) returns jsonb
language plpgsql stable security invoker set search_path=pg_catalog,public,storage as $$
declare r jsonb; ref text;
begin
 if p_kind='PHOTO' then
  select to_jsonb(p)||jsonb_build_object('storage_object',to_jsonb(s)-'last_accessed_at'),p.storage_path into r,ref
   from public.item_photos p join storage.objects s on s.bucket_id='item-images' and s.name=p.storage_path
   where p.id=p_id and p.item_id=p_item and p.owner_id=p_owner;
 elsif p_kind='EVIDENCE' then
  select to_jsonb(e),coalesce(nullif(btrim(e.source_url),''),nullif(btrim(e.source_reference),'')) into r,ref
   from public.item_evidence e where e.id=p_id and e.item_id=p_item and e.owner_id=p_owner
    and e.provenance not in ('INFERENCE','ACTIVE_ASK');
 elsif p_kind='COMPARABLE' then
  select to_jsonb(c)||jsonb_build_object(
   'sourceChecks',coalesce((select jsonb_agg(to_jsonb(s) order by s.id) from public.comparable_source_checks s where s.comparable_id=c.id and s.owner_id=p_owner),'[]'::jsonb),
   'reviews',coalesce((select jsonb_agg(to_jsonb(e) order by e.id) from public.comparable_evidence_reviews e where e.comparable_id=c.id and e.owner_id=p_owner),'[]'::jsonb)),c.source_url into r,ref from public.trusted_comparables_v1 c
   where c.id=p_id and c.item_id=p_item and c.owner_id=p_owner and c.price>=0 and c.sale_date<=current_date
    and c.price_type in ('HAMMER_REALIZED','REALIZED_INCL_BP','MARKETPLACE_SOLD','DEALER_SOLD_CONFIRMED');
 end if;
 if r is null or ref is null or length(btrim(ref))<1 then return null; end if;
 return jsonb_build_object('kind',p_kind,'id',p_id,'reference',ref,'snapshotSha256',encode(sha256(convert_to(r::text,'UTF8')),'hex'));
end$$;
revoke all on function public.ci_item_review_anchor_v1(uuid,uuid,text,uuid) from public,anon,service_role;
grant execute on function public.ci_item_review_anchor_v1(uuid,uuid,text,uuid) to authenticated;

-- Private validation is also used by the owner-readable qualified projection.
create function public.ci_reviewed_item_payload_valid_v1(p_owner uuid,p_item uuid,p_payload jsonb) returns boolean
language plpgsql stable security invoker set search_path=pg_catalog,public as $$
declare c jsonb; a jsonb; v_ref jsonb; v_run public.ai_analysis_runs%rowtype; v_item public.items%rowtype; v_types text[]:=array['PHOTOGRAPH_EXAM','SIGNATURE_READING','MAKER_ARCHIVE','AUCTION_REALISED','MARKETPLACE_SOLD','CONDITION_REVIEW','SALES_ECONOMICS']; v_key text; v_scope jsonb; v_photo uuid; v_kind text;
begin
 select * into v_item from public.items where id=p_item and owner_id=p_owner;
 if not found or jsonb_typeof(p_payload)<>'object' or p_payload->>'decision' not in ('READY_TO_LIST','DO_NOT_LIST_YET','SPECIALIST_REVIEW') then return false; end if;
 -- Pair source review must be represented by separate independently scoped items.
 -- A whole-lot model response cannot certify either member's signature.
 if v_item.source_analysis_run_id is not null then
  if v_item.source_object_index is null then return false; end if;
  select r.result->'owner_review'->'approved_snapshot'->v_item.source_object_index::text into v_scope from public.ai_analysis_runs r where r.id=v_item.source_analysis_run_id and r.owner_id=p_owner;
  if v_scope is null or coalesce(v_scope->'pair_source_indices','null'::jsonb) not in ('null'::jsonb,'[]'::jsonb) then return false; end if;
 end if;
 if p_payload->>'verificationMethod' is distinct from 'INDEPENDENT_SOURCE_REVIEW' or jsonb_typeof(p_payload->'reviewReference') is distinct from 'string' or length(btrim(p_payload->>'reviewReference'))<20
  or (p_payload->>'reviewerId')::uuid=p_owner  then return false; end if;
 foreach v_key in array array['rationale','nextAction','routeGuidance','unresolvedIssues'] loop
  if jsonb_typeof(p_payload->v_key) is distinct from 'string' or length(btrim(p_payload->>v_key))<(case when v_key='rationale' then 80 else 2 end) or length(p_payload->>v_key)>6000 then return false; end if;
 end loop;
 if jsonb_typeof(p_payload->'confidence') is distinct from 'object' or (select count(*) from jsonb_object_keys(p_payload->'confidence'))<>3 then return false; end if;
 foreach v_key in array array['identification','dating','valuation'] loop
  a:=p_payload->'confidence'->v_key;
  if a is null or (a<>'null'::jsonb and (jsonb_typeof(a)<>'number' or (a#>>'{}')::numeric<0 or (a#>>'{}')::numeric>100 or (a#>>'{}')::numeric<>trunc((a#>>'{}')::numeric))) then return false; end if;
 end loop;
 if jsonb_typeof(p_payload->'evidenceSources') is distinct from 'array' or jsonb_array_length(p_payload->'evidenceSources')<3 or jsonb_array_length(p_payload->'evidenceSources')>100 then return false; end if;
 if (select count(distinct ((source_anchor->>'kind')||':'||(source_anchor->>'id'))) from jsonb_array_elements(p_payload->'evidenceSources') source_anchor)<>jsonb_array_length(p_payload->'evidenceSources') then return false; end if;
 for a in select value from jsonb_array_elements(p_payload->'evidenceSources') loop
  if a is distinct from public.ci_item_review_anchor_v1(p_owner,p_item,a->>'kind',(a->>'id')::uuid) then return false; end if;
 end loop;
 if jsonb_typeof(p_payload->'sourceRefs') is distinct from 'array' or jsonb_array_length(p_payload->'sourceRefs')<1 then return false; end if;
 for v_ref in select value from jsonb_array_elements(p_payload->'sourceRefs') loop
  if jsonb_typeof(v_ref)<>'string' or not exists(select 1 from jsonb_array_elements(p_payload->'evidenceSources') source_anchor where source_anchor->'reference'=v_ref) then return false; end if;
 end loop;
 -- A final decision may support generic identification without authenticating a
 -- maker. Affirmative maker copy needs its own reviewer-bound documentary scope.
 if p_payload ? 'makerApproval' then
  a:=p_payload->'makerApproval';
  if jsonb_typeof(a) is distinct from 'object' or jsonb_typeof(a->'maker') is distinct from 'string'
   or nullif(btrim(v_item.maker),'') is null or a->>'maker' is distinct from v_item.maker
   or jsonb_typeof(a->'sourceRefs') is distinct from 'array' or jsonb_array_length(a->'sourceRefs')<1
   or jsonb_array_length(a->'sourceRefs')>100 then return false; end if;
  for v_ref in select value from jsonb_array_elements(a->'sourceRefs') loop
   if jsonb_typeof(v_ref)<>'string' or not (p_payload->'sourceRefs' @> jsonb_build_array(v_ref)) or not exists(
    select 1 from jsonb_array_elements(p_payload->'evidenceSources') src join public.item_evidence e on e.id=(src->>'id')::uuid
     and e.item_id=p_item and e.owner_id=p_owner and e.provenance in ('DOCUMENTARY_SOURCE','DEALER_ARCHIVE')
    where src->>'kind'='EVIDENCE' and src->'reference'=v_ref) then return false; end if;
  end loop;
 end if;
 v_scope:=p_payload->'availabilityScope';
 if jsonb_typeof(v_scope) is distinct from 'object' or jsonb_typeof(v_scope->'rationale') is distinct from 'string' or length(btrim(v_scope->>'rationale'))<80
 or jsonb_typeof(v_scope->'checkIds') is distinct from 'array' or jsonb_array_length(v_scope->'checkIds')<>7
 or (select count(distinct x#>>'{}') from jsonb_array_elements(v_scope->'checkIds') x)<>7
 or not (v_scope->'checkIds' @> to_jsonb(v_types))
 or jsonb_typeof(v_scope->'sourceRefs') is distinct from 'array' or jsonb_array_length(v_scope->'sourceRefs')<1 then return false; end if;
 for v_ref in select value from jsonb_array_elements(v_scope->'sourceRefs') loop
  if not (p_payload->'sourceRefs' @> jsonb_build_array(v_ref)) then return false; end if;
 end loop;
 if jsonb_typeof(p_payload->'availableChecks') is distinct from 'array' or jsonb_array_length(p_payload->'availableChecks')<>7
 or (select count(distinct x->>'id') from jsonb_array_elements(p_payload->'availableChecks') x)<>7 then return false; end if;
 for c in select value from jsonb_array_elements(p_payload->'availableChecks') loop
  if jsonb_typeof(c)<>'object' or not (c->>'id'=any(v_types)) or c->>'status' is distinct from 'COMPLETE'
  or jsonb_typeof(c->'sourceRefs') is distinct from 'array' or jsonb_array_length(c->'sourceRefs')<1
  or jsonb_typeof(c->'detail') is distinct from 'string' or length(btrim(c->>'detail'))<40 or length(c->>'detail')>4000
  or jsonb_typeof(c->'checkedAt') is distinct from 'string' or (c->>'checkedAt')::timestamptz>clock_timestamp() or c->>'checkedAt' is null then return false; end if;
  a:=c->'confidence';if a is null or (a<>'null'::jsonb and (jsonb_typeof(a)<>'number' or (a#>>'{}')::numeric<0 or (a#>>'{}')::numeric>100 or (a#>>'{}')::numeric<>trunc((a#>>'{}')::numeric))) then return false; end if;
  select * into v_run from public.ai_analysis_runs r where r.id=(c->>'executionRef')::uuid and r.owner_id=p_owner
   and r.mode='research' and r.result->>'analysis_stage'='COMPLETE' and r.status in ('DRAFT','APPROVED')
   and r.user_context->>'item_id'=p_item::text and r.user_context->>'research_category'=c->>'id';
  if not found then return false; end if;
  for v_ref in select value from jsonb_array_elements(c->'sourceRefs') loop
   if not (p_payload->'sourceRefs' @> jsonb_build_array(v_ref)) then return false; end if;
  end loop;
  if c->>'id' in ('PHOTOGRAPH_EXAM','SIGNATURE_READING','CONDITION_REVIEW') and not exists(
   select 1 from jsonb_array_elements(p_payload->'evidenceSources') source_anchor where source_anchor->>'kind'='PHOTO' and c->'sourceRefs' @> jsonb_build_array(source_anchor->'reference')) then return false; end if;
  if c->>'id' in ('MAKER_ARCHIVE','SALES_ECONOMICS') and not exists(
   select 1 from jsonb_array_elements(p_payload->'evidenceSources') source_anchor where source_anchor->>'kind'='EVIDENCE' and c->'sourceRefs' @> jsonb_build_array(source_anchor->'reference')) then return false; end if;
  if c->>'id' in ('AUCTION_REALISED','MARKETPLACE_SOLD') and not exists(
   select 1 from jsonb_array_elements(p_payload->'evidenceSources') source_anchor join public.trusted_comparables_v1 comp on comp.id=(source_anchor->>'id')::uuid and comp.item_id=p_item and comp.owner_id=p_owner
   where source_anchor->>'kind'='COMPARABLE' and c->'sourceRefs' @> jsonb_build_array(source_anchor->'reference')
    and ((c->>'id'='AUCTION_REALISED' and comp.price_type in ('HAMMER_REALIZED','REALIZED_INCL_BP')) or (c->>'id'='MARKETPLACE_SOLD' and comp.price_type in ('MARKETPLACE_SOLD','DEALER_SOLD_CONFIRMED')))) then return false; end if;
 end loop;
 return coalesce(p_payload->>'sourceGraphSha256'=encode(sha256(convert_to(public.ci_item_review_graph_v1(p_owner,p_item)::text,'UTF8')),'hex'),false);
exception when others then return false;
end$$;
revoke all on function public.ci_reviewed_item_payload_valid_v1(uuid,uuid,jsonb) from public,anon,service_role;
grant execute on function public.ci_reviewed_item_payload_valid_v1(uuid,uuid,jsonb) to authenticated;

-- Preserve the original owner hold validation intact and route privileged reviews separately.
alter function public.ci_validate_item_hold_assessment_v1() rename to ci_validate_original_owner_hold_v1;
create function public.ci_validate_item_hold_assessment_v1() returns trigger
language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
 if new.review_status='SOURCE_REVIEWED' then
  if current_setting('role',true)<>'ci_item_assessment_reviewer' or auth.uid() is null
   or new.assessment->>'reviewerId' is distinct from auth.uid()::text
   or not public.ci_reviewed_item_payload_valid_v1(new.owner_id,new.item_id,new.assessment)
   or new.assessment->>'decision' is distinct from new.decision
   or new.facts_snapshot is distinct from (select to_jsonb(i) from public.items i where i.id=new.item_id and i.owner_id=new.owner_id)
   then raise exception 'Only an independent authorised source reviewer may append a current qualified assessment'; end if;
  new.facts_sha256:=encode(sha256(convert_to(new.facts_snapshot::text,'UTF8')),'hex');
  new.request_fingerprint:=encode(sha256(convert_to(new.assessment::text||E'\n'||new.facts_snapshot::text,'UTF8')),'hex');
  return new;
 end if;
 -- Calling another trigger function directly is forbidden by PostgreSQL. Existing
 -- owner rows continue through their unchanged original trigger below.
 return new;
end$$;
revoke all on function public.ci_validate_item_hold_assessment_v1() from public,anon,authenticated,service_role;
drop trigger item_hold_assessment_validate on public.item_research_assessments;
create trigger item_hold_assessment_validate before insert on public.item_research_assessments for each row
 when(new.review_status='OWNER_REPORTED_UNVERIFIED') execute function public.ci_validate_original_owner_hold_v1();
create trigger item_reviewed_assessment_validate before insert on public.item_research_assessments for each row
 when(new.review_status<>'OWNER_REPORTED_UNVERIFIED') execute function public.ci_validate_item_hold_assessment_v1();

create function ci_private.record_reviewed_item_assessment_v1(p_owner uuid,p_item uuid,p_event uuid,p_expected_facts_sha256 text,p_payload jsonb)
returns public.item_research_assessments language plpgsql security definer set search_path=pg_catalog,public,ci_private as $$
declare v_item public.items%rowtype; v_old public.item_research_assessments%rowtype; v_new public.item_research_assessments%rowtype; v_payload jsonb; v_snapshot jsonb;
begin
 if current_setting('role',true)<>'ci_item_assessment_reviewer' or auth.uid() is null or auth.uid()=p_owner or p_event is null or not exists(select 1 from auth.users u where u.id=auth.uid()) then raise exception 'Independent authenticated private reviewer required'; end if;
 select * into v_item from public.items where id=p_item and owner_id=p_owner for update;
 if not found then raise exception 'Reviewer item unavailable'; end if;
 v_snapshot:=to_jsonb(v_item);
 v_payload:=p_payload||jsonb_build_object('reviewerId',auth.uid(),'verificationMethod','INDEPENDENT_SOURCE_REVIEW','sourceGraphSha256',encode(sha256(convert_to(public.ci_item_review_graph_v1(p_owner,p_item)::text,'UTF8')),'hex'));
 select * into v_old from public.item_research_assessments where owner_id=p_owner and client_event_id=p_event;
 if found then
  if v_old.item_id is distinct from p_item or v_old.facts_sha256 is distinct from p_expected_facts_sha256
   or v_old.review_status<>'SOURCE_REVIEWED' or v_old.assessment->>'reviewerId' is distinct from auth.uid()::text
   or (v_old.assessment-array['reviewerId','verificationMethod','sourceGraphSha256']) is distinct from (p_payload-array['reviewerId','verificationMethod','sourceGraphSha256'])
   then raise exception 'Reviewed event already used for different immutable evidence'; end if;
  -- A replay returns the old immutable receipt even if later source evidence
  -- changed. The qualified projection separately refuses stale approval.
  return v_old;
 end if;
 if encode(sha256(convert_to(v_snapshot::text,'UTF8')),'hex') is distinct from p_expected_facts_sha256 then raise exception 'Reviewed facts changed'; end if;
 insert into public.item_research_assessments(owner_id,item_id,client_event_id,decision,review_status,assessment,facts_snapshot)
 values(p_owner,p_item,p_event,v_payload->>'decision','SOURCE_REVIEWED',v_payload,v_snapshot) returning * into v_new;
 return v_new;
end$$;
revoke all on function ci_private.record_reviewed_item_assessment_v1(uuid,uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function ci_private.record_reviewed_item_assessment_v1(uuid,uuid,uuid,text,jsonb) to ci_item_assessment_reviewer;

create view public.item_reviewed_assessments_v1 with(security_invoker=true) as
 select a.id,a.owner_id,a.item_id,a.facts_sha256,a.facts_snapshot,a.assessment,a.created_at
 from public.item_research_assessments a join public.items i on i.id=a.item_id and i.owner_id=a.owner_id
 where a.owner_id=(select auth.uid()) and a.review_status='SOURCE_REVIEWED'
 and a.facts_snapshot=to_jsonb(i)
 and not exists(select 1 from public.item_research_assessments newer where newer.item_id=a.item_id and newer.owner_id=a.owner_id and (newer.created_at,newer.id)>(a.created_at,a.id))
 and public.ci_reviewed_item_payload_valid_v1(a.owner_id,a.item_id,a.assessment);
revoke all on public.item_reviewed_assessments_v1 from public,anon,service_role;
grant select on public.item_reviewed_assessments_v1 to authenticated;
