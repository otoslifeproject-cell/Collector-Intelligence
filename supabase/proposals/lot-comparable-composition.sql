-- PREPRODUCTION / DISPOSABLE ONLY. Install after reviewed-item-assessments.sql.
-- Reuses existing achieved-sale qualification; composition never promotes a source.
create table public.comparable_lot_composition_reviews (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id),
 comparable_id uuid not null references public.comparables(id) on delete restrict,
 client_event_id uuid not null,
 reviewer_id uuid not null references auth.users(id),
 decision text not null check(decision in ('CONFIRMED','WITHDRAWN')),
 composition jsonb not null,
 rationale text not null,
 source_snapshot jsonb,
 source_snapshot_sha256 text,
 reviewed_at timestamptz not null default clock_timestamp(),
 unique(owner_id,client_event_id),
 check(reviewer_id<>owner_id),
 check(length(btrim(rationale))>=40),
 check(decision<>'CONFIRMED' or (source_snapshot is not null and source_snapshot_sha256~'^[a-f0-9]{64}$'))
);
create index comparable_lot_composition_latest on public.comparable_lot_composition_reviews(owner_id,comparable_id,reviewed_at desc,id desc);
alter table public.comparable_lot_composition_reviews enable row level security;
create policy lot_composition_owner_read on public.comparable_lot_composition_reviews for select to authenticated using(owner_id=(select auth.uid()));
revoke all on public.comparable_lot_composition_reviews from public,anon,authenticated,service_role;
grant select on public.comparable_lot_composition_reviews to authenticated;

create function public.ci_lot_source_snapshot_v1(p_owner uuid,p_comparable uuid) returns jsonb
language sql stable security invoker set search_path=pg_catalog as $$
 select jsonb_build_object('comparable',to_jsonb(c),
  'reviews',coalesce((select jsonb_agg(to_jsonb(e) order by e.id) from public.comparable_evidence_reviews e where e.owner_id=p_owner and e.comparable_id=c.id),'[]'::jsonb),
  'sourceChecks',coalesce((select jsonb_agg(to_jsonb(s) order by s.id) from public.comparable_source_checks s where s.owner_id=p_owner and s.comparable_id=c.id),'[]'::jsonb))
 from public.trusted_comparables_v1 c
 where c.owner_id=p_owner and c.id=p_comparable and c.sale_date<=current_date
  and c.sale_date is not null and c.price is not null and c.price>=0 and c.price<=100000000
  and c.source_url~'^https?://[A-Za-z0-9][A-Za-z0-9.-]*(:[0-9]+)?([/?#][^[:space:]]*)?$'
  and length(btrim(c.source_reference))>0 and length(btrim(c.venue))>0 and c.currency~'^[A-Z]{3}$'
  and c.price_type in ('HAMMER_REALIZED','REALIZED_INCL_BP','MARKETPLACE_SOLD','DEALER_SOLD_CONFIRMED')
  and (p_owner=(select auth.uid()) or current_setting('role',true)='ci_item_assessment_reviewer')
$$;
revoke all on function public.ci_lot_source_snapshot_v1(uuid,uuid) from public,anon,service_role;
grant execute on function public.ci_lot_source_snapshot_v1(uuid,uuid) to authenticated,ci_item_assessment_reviewer;

create function public.ci_lot_composition_payload_valid_v1(p_payload jsonb) returns boolean
language plpgsql immutable security invoker set search_path=pg_catalog as $$
declare member jsonb;
begin
 if jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>120000
  or not(p_payload ?& array['quantity','members','targetItemIds','relationship'])
  or exists(select 1 from jsonb_object_keys(p_payload) k where k not in('quantity','members','targetItemIds','relationship','conversionSource'))
  or jsonb_typeof(p_payload->'quantity') is distinct from 'number'
  or (p_payload->>'quantity')!~'^[1-9][0-9]{0,2}$'
  or (p_payload->>'quantity')::integer>100
  or jsonb_typeof(p_payload->'members') is distinct from 'array'
  or jsonb_array_length(p_payload->'members')<>(p_payload->>'quantity')::integer
  or jsonb_typeof(p_payload->'targetItemIds') is distinct from 'array'
  or jsonb_array_length(p_payload->'targetItemIds')<>(p_payload->>'quantity')::integer
  or (select count(distinct value) from jsonb_array_elements_text(p_payload->'targetItemIds'))<>(p_payload->>'quantity')::integer
  or exists(select 1 from jsonb_array_elements_text(p_payload->'targetItemIds') where value!~*'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$')
  or p_payload->>'relationship' is null or p_payload->>'relationship' not in('SINGLE_OBJECT','MATCHED_ORIGINAL_SET','SAME_MAKER_PATTERN','THEMED_CURATED','MIXED_CLEARANCE')
  or ((p_payload->>'quantity')::integer=1 and p_payload->>'relationship'<>'SINGLE_OBJECT')
  or ((p_payload->>'quantity')::integer>1 and p_payload->>'relationship'='SINGLE_OBJECT') then return false;end if;
 if p_payload ? 'conversionSource' and (jsonb_typeof(p_payload->'conversionSource') is distinct from 'string' or p_payload->>'conversionSource'!~'^https?://[A-Za-z0-9][A-Za-z0-9.-]*(:[0-9]+)?([/?#][^[:space:]]*)?$') then return false;end if;
 for member in select value from jsonb_array_elements(p_payload->'members') loop
  if jsonb_typeof(member) is distinct from 'object' or (select count(*) from jsonb_object_keys(member))<>3
   or not(member ?& array['description','condition','makerConfidence'])
   or jsonb_typeof(member->'description') is distinct from 'string' or length(btrim(member->>'description'))<10 or length(member->>'description')>3000
   or jsonb_typeof(member->'condition') is distinct from 'string' or length(btrim(member->>'condition'))<10 or length(member->>'condition')>3000
   or jsonb_typeof(member->'makerConfidence') is distinct from 'string' or length(btrim(member->>'makerConfidence'))<10 or length(member->>'makerConfidence')>3000 then return false;end if;
 end loop;
 return true;
exception when others then return false;
end$$;
revoke all on function public.ci_lot_composition_payload_valid_v1(jsonb) from public,anon,service_role;
grant execute on function public.ci_lot_composition_payload_valid_v1(jsonb) to authenticated,ci_item_assessment_reviewer;

-- Source application is independently reviewed for an exact target portfolio,
-- not inferred merely because a foreign lot happens to have the same quantity.
create function public.ci_lot_evidence_snapshot_v1(p_owner uuid,p_comparable uuid,p_composition jsonb) returns jsonb
language plpgsql stable security invoker set search_path=pg_catalog as $$
declare source jsonb; targets jsonb;
begin
 source:=public.ci_lot_source_snapshot_v1(p_owner,p_comparable);
 if source is null then return null;end if;
 if p_composition='{}'::jsonb then return source;end if;
 if not public.ci_lot_composition_payload_valid_v1(p_composition) then return null;end if;
 if not((p_composition->'targetItemIds') ? (source->'comparable'->>'item_id')) then return null;end if;
 select jsonb_agg(jsonb_build_object('itemId',i.id,'graph',public.ci_item_review_graph_v1(p_owner,i.id)) order by i.id) into targets
 from public.items i where i.owner_id=p_owner and i.id in(select value::uuid from jsonb_array_elements_text(p_composition->'targetItemIds'));
 if targets is null or jsonb_array_length(targets)<>(p_composition->>'quantity')::integer then return null;end if;
 return jsonb_build_object('source',source,'targets',targets);
end$$;
revoke all on function public.ci_lot_evidence_snapshot_v1(uuid,uuid,jsonb) from public,anon,service_role;
grant execute on function public.ci_lot_evidence_snapshot_v1(uuid,uuid,jsonb) to authenticated,ci_item_assessment_reviewer;

-- Private controlled reviewer procedure, not an owner-facing approval RPC.
create function ci_private.record_lot_composition_review_v1(p_owner uuid,p_comparable uuid,p_event uuid,p_decision text,p_composition jsonb,p_rationale text,p_expected_source_sha256 text)
returns public.comparable_lot_composition_reviews language plpgsql security definer set search_path=pg_catalog as $$
declare previous public.comparable_lot_composition_reviews%rowtype; saved public.comparable_lot_composition_reviews%rowtype; snapshot jsonb; digest text;
begin
 if current_setting('role',true)<>'ci_item_assessment_reviewer' or auth.uid() is null or auth.uid()=p_owner or not exists(select 1 from auth.users where id=auth.uid()) then raise exception 'Distinct independently authorised reviewer required';end if;
 if p_event is null or p_owner is null or p_comparable is null or p_decision is null or p_decision not in('CONFIRMED','WITHDRAWN') or p_rationale is null or length(btrim(p_rationale))<40 or length(p_rationale)>12000 then raise exception 'Exact source identity and independent composition rationale required';end if;
 perform 1 from public.comparables where id=p_comparable and owner_id=p_owner for update;
 if not found then raise exception 'Owned comparable source unavailable';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text||':'||p_event::text,0));
 select * into previous from public.comparable_lot_composition_reviews where owner_id=p_owner and client_event_id=p_event;
 if found then
  if previous.comparable_id is distinct from p_comparable or previous.reviewer_id is distinct from auth.uid() or previous.decision is distinct from p_decision or previous.composition is distinct from p_composition or previous.rationale is distinct from p_rationale or previous.source_snapshot_sha256 is distinct from p_expected_source_sha256 then raise exception 'Composition event already belongs to different immutable evidence';end if;
  return previous;
 end if;
 snapshot:=public.ci_lot_evidence_snapshot_v1(p_owner,p_comparable,p_composition);
 digest:=case when snapshot is null then null else encode(sha256(convert_to(snapshot::text,'UTF8')),'hex') end;
 if p_decision='CONFIRMED' then
  if snapshot is null or p_expected_source_sha256 is distinct from digest or not public.ci_lot_composition_payload_valid_v1(p_composition) then raise exception 'Current independently fetched achieved source and complete exact composition required';end if;
  if snapshot->'source'->'comparable'->>'price_type'='REALIZED_INCL_BP' and not(p_composition ? 'conversionSource') then raise exception 'Buyer-premium conversion source required; buyer total is not seller gross';end if;
 elsif p_composition is distinct from '{}'::jsonb or p_expected_source_sha256 is distinct from digest then raise exception 'Withdrawal must preserve current source identity and an empty composition';end if;
 insert into public.comparable_lot_composition_reviews(owner_id,comparable_id,client_event_id,reviewer_id,decision,composition,rationale,source_snapshot,source_snapshot_sha256)
 values(p_owner,p_comparable,p_event,auth.uid(),p_decision,p_composition,p_rationale,snapshot,digest) returning * into saved;
 return saved;
end$$;
revoke all on function ci_private.record_lot_composition_review_v1(uuid,uuid,uuid,text,jsonb,text,text) from public,anon,authenticated,service_role;
grant execute on function ci_private.record_lot_composition_review_v1(uuid,uuid,uuid,text,jsonb,text,text) to ci_item_assessment_reviewer;

create function public.ci_preserve_lot_composition_history_v1() returns trigger language plpgsql security invoker set search_path=pg_catalog as $$
begin raise exception 'Composition reviews are immutable; append an independently reviewed correction or withdrawal';end$$;
revoke all on function public.ci_preserve_lot_composition_history_v1() from public,anon,authenticated,service_role;
create trigger preserve_lot_composition_history before update or delete on public.comparable_lot_composition_reviews for each row execute function public.ci_preserve_lot_composition_history_v1();

create view public.trusted_lot_comparables_v1 with(security_invoker=true) as
 select c.id,c.owner_id,c.item_id as source_item_id,c.source_url,c.source_reference,c.venue,c.sale_date,c.currency,c.price as total_price,c.price_type,
  (r.composition->>'quantity')::integer as quantity,r.composition->'members' as members,r.composition->'targetItemIds' as target_item_ids,r.composition->>'relationship' as composition_relationship,
  null::numeric as unit_price,r.id as composition_review_id,r.reviewer_id,r.reviewed_at,r.rationale as composition_rationale,
  r.source_snapshot_sha256,r.composition->>'conversionSource' as conversion_source
 from public.trusted_comparables_v1 c join public.comparable_lot_composition_reviews r on r.comparable_id=c.id and r.owner_id=c.owner_id
 where r.owner_id=(select auth.uid()) and r.decision='CONFIRMED' and r.reviewer_id<>r.owner_id
  and public.ci_lot_composition_payload_valid_v1(r.composition)
  and r.source_snapshot_sha256=encode(sha256(convert_to(public.ci_lot_evidence_snapshot_v1(c.owner_id,c.id,r.composition)::text,'UTF8')),'hex')
  and not exists(select 1 from public.comparable_lot_composition_reviews later where later.owner_id=r.owner_id and later.comparable_id=r.comparable_id and (later.reviewed_at,later.id)>(r.reviewed_at,r.id));
revoke all on public.trusted_lot_comparables_v1 from public,anon,service_role;
grant select on public.trusted_lot_comparables_v1 to authenticated;

-- Server-side source check for a chosen stored plan before commercial approval.
-- It proves current reviewed applicability only; complete economics/member final
-- decisions remain separate gates in the existing group approval transaction.
create function public.ci_lot_plan_sources_current_v1(p_owner uuid,p_plan jsonb) returns boolean
language plpgsql stable security invoker set search_path=pg_catalog as $$
declare line jsonb; source public.trusted_lot_comparables_v1%rowtype;
begin
 if auth.uid() is distinct from p_owner or jsonb_typeof(p_plan) is distinct from 'object' or jsonb_typeof(p_plan->'lines') is distinct from 'array' or jsonb_array_length(p_plan->'lines')<1 or jsonb_array_length(p_plan->'lines')>100 then return false;end if;
 for line in select value from jsonb_array_elements(p_plan->'lines') loop
  if jsonb_typeof(line->'itemIds') is distinct from 'array' or jsonb_array_length(line->'itemIds')<1 or (select count(distinct value) from jsonb_array_elements_text(line->'itemIds'))<>jsonb_array_length(line->'itemIds') then return false;end if;
  select * into source from public.trusted_lot_comparables_v1 where owner_id=p_owner and id=(line->>'comparableId')::uuid and composition_review_id=(line->>'compositionReviewId')::uuid and source_snapshot_sha256=line->>'sourceSnapshotSha256';
  if not found or source.currency is distinct from p_plan->>'currency' or source.quantity<>jsonb_array_length(line->'itemIds')
   or not((source.target_item_ids) @> (line->'itemIds')) or not((line->'itemIds') @> (source.target_item_ids)) then return false;end if;
 end loop;
 return true;
exception when others then return false;
end$$;
revoke all on function public.ci_lot_plan_sources_current_v1(uuid,jsonb) from public,anon,service_role;
grant execute on function public.ci_lot_plan_sources_current_v1(uuid,jsonb) to authenticated;
