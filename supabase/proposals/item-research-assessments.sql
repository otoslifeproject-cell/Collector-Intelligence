-- PREPRODUCTION PROPOSAL ONLY — UNAPPLIED TO PRODUCTION.
-- Final owner hold decisions are retained as unverified advice, not source verification.
-- This proposal provides NO client or privileged READY_TO_LIST publication path.
create table public.item_research_assessments (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null default auth.uid(),
 item_id uuid not null references public.items(id),
 client_event_id uuid not null,
 decision text not null check (decision in ('DO_NOT_LIST_YET','SPECIALIST_REVIEW','READY_TO_LIST')),
 review_status text not null default 'OWNER_REPORTED_UNVERIFIED' check (review_status in ('OWNER_REPORTED_UNVERIFIED','SOURCE_REVIEWED')),
 assessment jsonb not null,
 facts_snapshot jsonb not null,
 facts_sha256 text not null check (facts_sha256 ~ '^[0-9a-f]{64}$'),
 request_fingerprint text not null check (request_fingerprint ~ '^[0-9a-f]{64}$'),
 created_at timestamptz not null default clock_timestamp(),
 unique(owner_id,client_event_id)
);
create index item_research_assessments_history_idx on public.item_research_assessments(owner_id,item_id,created_at desc,id desc);
alter table public.item_research_assessments enable row level security;
revoke all on public.item_research_assessments from public,anon,authenticated;
grant select on public.item_research_assessments to authenticated;
grant insert(item_id,client_event_id,decision,assessment,facts_snapshot) on public.item_research_assessments to authenticated;
create policy item_assessment_owner_read on public.item_research_assessments for select to authenticated
 using (owner_id=(select auth.uid()) and exists(select 1 from public.items i where i.id=item_id and i.owner_id=(select auth.uid())));
create policy item_assessment_owner_hold_insert on public.item_research_assessments for insert to authenticated
 with check (owner_id=(select auth.uid()) and review_status='OWNER_REPORTED_UNVERIFIED' and decision in ('DO_NOT_LIST_YET','SPECIALIST_REVIEW')
 and exists(select 1 from public.items i where i.id=item_id and i.owner_id=(select auth.uid())));

create view public.item_assessment_context_v1 with(security_invoker=true) as
 select i.id as item_id,i.owner_id,to_jsonb(i) as facts_snapshot,
 encode(sha256(convert_to(to_jsonb(i)::text,'UTF8')),'hex') as facts_sha256
 from public.items i;
revoke all on public.item_assessment_context_v1 from public,anon;
grant select on public.item_assessment_context_v1 to authenticated;

create function public.ci_validate_item_hold_assessment_v1() returns trigger
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare v_item public.items%rowtype; v_payload jsonb:=new.assessment; v_check jsonb; v_conf jsonb; v_key text;
 v_types text[]:=array['PHOTOGRAPH_EXAM','SIGNATURE_READING','MAKER_ARCHIVE','AUCTION_REALISED','MARKETPLACE_SOLD','CONDITION_REVIEW','SALES_ECONOMICS'];
begin
 if auth.uid() is null or new.owner_id is distinct from auth.uid() or new.review_status<>'OWNER_REPORTED_UNVERIFIED'
 or new.decision not in ('DO_NOT_LIST_YET','SPECIALIST_REVIEW') then raise exception 'Only an owner-reported final hold may be recorded'; end if;
 select * into v_item from public.items where id=new.item_id and owner_id=auth.uid() for update;
 if not found then raise exception 'Owned item is unavailable'; end if;
 if new.facts_snapshot is distinct from to_jsonb(v_item) then raise exception 'Item facts changed; review the current snapshot before a new assessment'; end if;
 -- Reuse exact server numeric/timestamp rendering for the server digest.
 -- convert_to is STABLE in PostgreSQL; compute in this validation trigger,
 -- not an invalid generated-column expression. Clients have no digest grants.
 new.facts_snapshot:=to_jsonb(v_item);
 if jsonb_typeof(v_payload) is distinct from 'object' or (select count(*) from jsonb_object_keys(v_payload))<>8
 or exists(select 1 from jsonb_object_keys(v_payload) k where k not in ('decision','rationale','unresolvedIssues','nextAction','routeGuidance','confidence','sourceRefs','availableChecks'))
 or v_payload->>'decision' is distinct from new.decision then raise exception 'Unsupported final hold assessment shape'; end if;
 foreach v_key in array array['rationale','unresolvedIssues','nextAction','routeGuidance'] loop
  if jsonb_typeof(v_payload->v_key) is distinct from 'string' or length(btrim(v_payload->>v_key))<(case when v_key='rationale' then 40 else 2 end)
   or length(v_payload->>v_key)>6000 then raise exception 'Final hold advice is missing or too long'; end if;
 end loop;
 v_conf:=v_payload->'confidence';
 if jsonb_typeof(v_conf) is distinct from 'object' or (select count(*) from jsonb_object_keys(v_conf))<>3
 or exists(select 1 from jsonb_object_keys(v_conf) k where k not in ('identification','dating','valuation')) then raise exception 'Three separate confidence dimensions required'; end if;
 foreach v_key in array array['identification','dating','valuation'] loop
  if v_conf->v_key is distinct from 'null'::jsonb and (jsonb_typeof(v_conf->v_key) is distinct from 'number') then raise exception 'Confidence must be a finite whole percentage or unknown'; end if;
  if jsonb_typeof(v_conf->v_key)='number' and ((v_conf->>v_key)::numeric<0 or (v_conf->>v_key)::numeric>100 or (v_conf->>v_key)::numeric<>trunc((v_conf->>v_key)::numeric)) then raise exception 'Confidence must be a whole percentage between zero and one hundred'; end if;
 end loop;
 if jsonb_typeof(v_payload->'sourceRefs') is distinct from 'array' or jsonb_array_length(v_payload->'sourceRefs')>100 then raise exception 'Invalid advice source references'; end if;
 if exists(select 1 from jsonb_array_elements(v_payload->'sourceRefs') r where jsonb_typeof(r)<>'string' or length(btrim(r#>>'{}'))<1 or length(r#>>'{}')>1000) then raise exception 'Invalid advice source reference'; end if;
 if jsonb_typeof(v_payload->'availableChecks') is distinct from 'array' or jsonb_array_length(v_payload->'availableChecks')<>7 then raise exception 'All seven research categories must remain in the hold record'; end if;
 if (select count(distinct c->>'id') from jsonb_array_elements(v_payload->'availableChecks') c)<>7 then raise exception 'Duplicate research category'; end if;
 for v_check in select value from jsonb_array_elements(v_payload->'availableChecks') loop
  if jsonb_typeof(v_check) is distinct from 'object' or (select count(*) from jsonb_object_keys(v_check))<>7
   or exists(select 1 from jsonb_object_keys(v_check) k where k not in ('id','status','observedStatus','sourceRefs','executionRef','checkedAt','detail'))
   or not (v_check->>'id'=any(v_types)) or v_check->>'status' is distinct from 'REQUIRES_REVIEW'
   or v_check->>'observedStatus' not in ('NOT_RUN','RUNNING','DONE_EVIDENCED','INCONCLUSIVE','FAILED','BLOCKED','RECEIPT_MISSING')
   or jsonb_typeof(v_check->'observedStatus') is distinct from 'string' then raise exception 'Hold records cannot certify research completion or source verification'; end if;
  if jsonb_typeof(v_check->'sourceRefs') is distinct from 'array' or jsonb_array_length(v_check->'sourceRefs')>100
   or exists(select 1 from jsonb_array_elements(v_check->'sourceRefs') r where jsonb_typeof(r)<>'string' or length(btrim(r#>>'{}'))<1 or length(r#>>'{}')>1000) then raise exception 'Invalid stored research references'; end if;
  foreach v_key in array array['executionRef','checkedAt'] loop
   if v_check->v_key is distinct from 'null'::jsonb and (jsonb_typeof(v_check->v_key) is distinct from 'string' or length(v_check->>v_key)>1000) then raise exception 'Invalid research execution reference'; end if;
  end loop;
  if jsonb_typeof(v_check->'detail') is distinct from 'string' or length(v_check->>'detail')>4000 then raise exception 'Invalid research detail'; end if;
 end loop;
 new.facts_sha256:=encode(sha256(convert_to(new.facts_snapshot::text,'UTF8')),'hex');
 new.request_fingerprint:=encode(sha256(convert_to(new.assessment::text||E'\n'||new.facts_snapshot::text,'UTF8')),'hex');
 return new;
end $$;
revoke all on function public.ci_validate_item_hold_assessment_v1() from public,anon,authenticated;
create trigger item_hold_assessment_validate before insert on public.item_research_assessments for each row execute function public.ci_validate_item_hold_assessment_v1();

create function public.ci_record_item_hold_assessment_v1(p_item_id uuid,p_client_event_id uuid,p_expected_facts_sha256 text,p_assessment jsonb)
returns public.item_research_assessments language plpgsql security invoker set search_path=pg_catalog,public as $$
declare v_item public.items%rowtype; v_old public.item_research_assessments%rowtype; v_new public.item_research_assessments%rowtype; v_snapshot jsonb; v_sha text;
begin
 if auth.uid() is null or p_item_id is null or p_client_event_id is null or p_expected_facts_sha256 !~ '^[0-9a-f]{64}$' or p_expected_facts_sha256 is null
 then raise exception 'Authenticated owner, item, event and snapshot required'; end if;
 select * into v_item from public.items where id=p_item_id and owner_id=auth.uid() for update;
 if not found then raise exception 'Owned item unavailable'; end if;
 select * into v_old from public.item_research_assessments where owner_id=auth.uid() and client_event_id=p_client_event_id;
 if found then
  if v_old.item_id is distinct from p_item_id or v_old.assessment is distinct from p_assessment or v_old.facts_sha256 is distinct from p_expected_facts_sha256
   then raise exception 'Assessment event was already used for different immutable facts'; end if;
  return v_old;
 end if;
 v_snapshot:=to_jsonb(v_item);v_sha:=encode(sha256(convert_to(v_snapshot::text,'UTF8')),'hex');
 if v_sha is distinct from p_expected_facts_sha256 then raise exception 'Item facts changed; review the current snapshot before recording'; end if;
 insert into public.item_research_assessments(item_id,client_event_id,decision,assessment,facts_snapshot)
 values(p_item_id,p_client_event_id,p_assessment->>'decision',p_assessment,v_snapshot) returning * into v_new;
 return v_new;
end $$;
revoke all on function public.ci_record_item_hold_assessment_v1(uuid,uuid,text,jsonb) from public,anon;
grant execute on function public.ci_record_item_hold_assessment_v1(uuid,uuid,text,jsonb) to authenticated;
-- UPDATE and DELETE have neither grants nor policies. Previous rows remain immutable.
-- Notify PostgREST only when this reviewed proposal is deliberately installed in a disposable environment.
