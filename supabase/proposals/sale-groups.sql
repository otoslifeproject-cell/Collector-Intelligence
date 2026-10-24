-- PREPRODUCTION / DISPOSABLE ONLY. Never apply to production without approval.
-- Depends on item-research-assessments.sql and reviewed-item-assessments.sql.
-- A group approval reserves objects for an owner plan. It neither publishes a
-- listing nor verifies a bundle valuation. The original objects remain intact.
create schema ci_sale_private;
revoke all on schema ci_sale_private from public,anon,service_role;
grant usage on schema ci_sale_private to authenticated;

create table public.sale_group_revisions(
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
 group_id uuid not null, revision integer not null check(revision>0), client_event_id uuid not null,
 group_data jsonb not null, member_graphs jsonb not null, created_at timestamptz not null default clock_timestamp(),
 unique(owner_id,group_id,revision),unique(owner_id,client_event_id)
);
create table public.sale_group_events(
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id),
 group_id uuid not null,revision_id uuid not null references public.sale_group_revisions(id),
 client_event_id uuid not null,kind text not null check(kind in('APPROVE','RELEASE','SOLD')),
 payload jsonb not null,created_at timestamptz not null default clock_timestamp(),unique(owner_id,client_event_id)
);
create index sale_group_revisions_history on public.sale_group_revisions(owner_id,group_id,revision desc);
create index sale_group_events_history on public.sale_group_events(owner_id,group_id,created_at desc,id desc);
alter table public.sale_group_revisions enable row level security;
alter table public.sale_group_events enable row level security;
revoke all on public.sale_group_revisions,public.sale_group_events from public,anon,authenticated,service_role;
grant select on public.sale_group_revisions,public.sale_group_events to authenticated;
create policy sale_group_revision_owner on public.sale_group_revisions for select to authenticated using(owner_id=(select auth.uid()));
create policy sale_group_event_owner on public.sale_group_events for select to authenticated using(owner_id=(select auth.uid()));

create table ci_sale_private.active_item_sale_claims(
 owner_id uuid not null references auth.users(id),item_id uuid not null references public.items(id),
 source_kind text not null check(source_kind in('GROUP','LISTING','OUTCOME')),source_id uuid not null,
 state text not null check(state in('RESERVED','SOLD')),primary key(owner_id,item_id)
);
alter table ci_sale_private.active_item_sale_claims enable row level security;
revoke all on ci_sale_private.active_item_sale_claims from public,anon,authenticated,service_role;
grant select on ci_sale_private.active_item_sale_claims to authenticated;
create policy sale_claim_owner on ci_sale_private.active_item_sale_claims for select to authenticated using(owner_id=(select auth.uid()));
create view public.active_item_sale_claims_v1 with(security_invoker=true) as select * from ci_sale_private.active_item_sale_claims;
revoke all on public.active_item_sale_claims_v1 from public,anon,service_role;
grant select on public.active_item_sale_claims_v1 to authenticated;
create view public.sale_group_item_context_v1 with(security_invoker=true) as
 select i.id as item_id,i.owner_id,
 encode(sha256(convert_to(public.ci_item_review_graph_v1(i.owner_id,i.id)::text,'UTF8')),'hex') as graph_sha256
 from public.items i where i.owner_id=(select auth.uid());
revoke all on public.sale_group_item_context_v1 from public,anon,service_role;
grant select on public.sale_group_item_context_v1 to authenticated;

create function ci_sale_private.immutable_group_history_v1() returns trigger language plpgsql security invoker set search_path=pg_catalog as $$
begin raise exception 'Sale group history is append-only; release or create a new revision';end$$;
revoke all on function ci_sale_private.immutable_group_history_v1() from public,anon,authenticated,service_role;
create trigger sale_group_revisions_immutable before update or delete on public.sale_group_revisions for each row execute function ci_sale_private.immutable_group_history_v1();
create trigger sale_group_events_immutable before update or delete on public.sale_group_events for each row execute function ci_sale_private.immutable_group_history_v1();

create function ci_sale_private.save_group_revision_v1(p_event_id uuid,p_group_id uuid,p_expected_revision integer,p_group jsonb,p_expected_graphs jsonb)
returns public.sale_group_revisions language plpgsql security definer set search_path=pg_catalog as $$
declare v_owner uuid:=auth.uid();v_old public.sale_group_revisions%rowtype;v_new public.sale_group_revisions%rowtype;
 v_latest integer;v_member jsonb;v_photo jsonb;v_item uuid;v_graph text;v_ids uuid[];v_photo_ids uuid[]:='{}';v_last public.sale_group_events%rowtype;
begin
 if v_owner is null or p_event_id is null or p_group_id is null or p_expected_revision is null or p_expected_revision<0 then raise exception 'Authenticated owner, group, immutable event and revision required';end if;
 perform pg_advisory_xact_lock(hashtextextended(v_owner::text||':'||p_group_id::text,0));
 select * into v_old from public.sale_group_revisions where owner_id=v_owner and client_event_id=p_event_id;
 if found then
  if v_old.group_id is distinct from p_group_id or v_old.revision is distinct from p_expected_revision+1 or v_old.group_data is distinct from p_group or v_old.member_graphs is distinct from p_expected_graphs then raise exception 'Revision event already used for different immutable data';end if;return v_old;
 end if;
 if jsonb_typeof(p_group) is distinct from 'object' or p_group->>'format' is distinct from 'collector-sale-group-v1'
 or p_group->>'ownerId' is distinct from v_owner::text or p_group->>'groupId' is distinct from p_group_id::text
 or jsonb_typeof(p_group->'revision') is distinct from 'number' or p_group->>'revision' is distinct from (p_expected_revision+1)::text
 or p_group->>'relation' not in('MATCHED_ORIGINAL_SET','SAME_MAKER_PATTERN','THEMED_CURATED','MIXED_CLEARANCE')
 or p_group->>'relation' is null or jsonb_typeof(p_group->'members') is distinct from 'array'
 or jsonb_array_length(p_group->'members') not between 1 and 100
 or jsonb_typeof(p_group->'plans') is distinct from 'array' or jsonb_array_length(p_group->'plans')>15
 or jsonb_typeof(p_group->'sourceRefs') is distinct from 'array' or jsonb_array_length(p_group->'sourceRefs')>100
 or jsonb_typeof(p_expected_graphs) is distinct from 'object' then raise exception 'Unsupported group shape';end if;
 if length(btrim(coalesce(p_group->>'title',''))) not between 1 and 200 or length(btrim(coalesce(p_group->>'rationale',''))) not between 40 and 6000 or length(btrim(coalesce(p_group->>'uncertainty',''))) not between 1 and 6000 or octet_length(p_group::text)>262144 then raise exception 'Group needs bounded title, relationship reasoning and uncertainty';end if;
 if p_group->>'relation' in('MATCHED_ORIGINAL_SET','SAME_MAKER_PATTERN') and jsonb_array_length(p_group->'sourceRefs')=0 then raise exception 'Matching-set or maker relationship requires documentary references, not colour or UV alone';end if;
 for v_photo in select value from jsonb_array_elements(p_group->'sourceRefs') loop
  if jsonb_typeof(v_photo) is distinct from 'string' or (v_photo#>>'{}') !~ '^https://[^[:space:]]+$' or length(v_photo#>>'{}')>2000 then raise exception 'Invalid relationship source reference';end if;
 end loop;
 select coalesce(max(revision),0) into v_latest from public.sale_group_revisions where owner_id=v_owner and group_id=p_group_id;
 if v_latest<>p_expected_revision then raise exception 'Group revision changed; reload before saving';end if;
 select * into v_last from public.sale_group_events where owner_id=v_owner and group_id=p_group_id order by created_at desc,id desc limit 1;
 if found and v_last.kind in('APPROVE','SOLD') then raise exception 'Release the active group before revising its physical membership';end if;
 select array_agg((m->>'itemId')::uuid order by (m->>'itemId')::uuid) into v_ids from jsonb_array_elements(p_group->'members')m;
 if array_length(v_ids,1) is distinct from (select count(distinct x) from unnest(v_ids)x)::integer or (select count(*) from jsonb_object_keys(p_expected_graphs))<>array_length(v_ids,1) then raise exception 'Each physical member must occur once with one expected evidence graph';end if;
 -- The same sorted physical item locks are taken by individual listing triggers.
 perform 1 from public.items where id=any(v_ids) and owner_id=v_owner order by id for update;
 if (select count(*) from public.items where id=any(v_ids) and owner_id=v_owner)<>array_length(v_ids,1) then raise exception 'A group contains a missing or foreign item';end if;
 for v_member in select value from jsonb_array_elements(p_group->'members') loop
  v_item:=(v_member->>'itemId')::uuid;
  v_graph:=encode(sha256(convert_to(public.ci_item_review_graph_v1(v_owner,v_item)::text,'UTF8')),'hex');
  if p_expected_graphs->>(v_item::text) is distinct from v_graph then raise exception 'Object facts or evidence changed; reload the proposed group';end if;
  if jsonb_typeof(v_member->'photoIds') is distinct from 'array' or jsonb_array_length(v_member->'photoIds') not between 1 and 500 then raise exception 'Each member needs its exact original photo IDs';end if;
  for v_photo in select value from jsonb_array_elements(v_member->'photoIds') loop
   if (v_photo#>>'{}')::uuid=any(v_photo_ids) or not exists(select 1 from public.item_photos p where p.id=(v_photo#>>'{}')::uuid and p.item_id=v_item and p.owner_id=v_owner) then raise exception 'Photo is repeated or not owned by this exact physical member';end if;
   v_photo_ids:=array_append(v_photo_ids,(v_photo#>>'{}')::uuid);
  end loop;
 end loop;
 insert into public.sale_group_revisions(owner_id,group_id,revision,client_event_id,group_data,member_graphs)
 values(v_owner,p_group_id,p_expected_revision+1,p_event_id,p_group,p_expected_graphs) returning * into v_new;
 return v_new;
end$$;
revoke all on function ci_sale_private.save_group_revision_v1(uuid,uuid,integer,jsonb,jsonb) from public,anon,service_role;
grant execute on function ci_sale_private.save_group_revision_v1(uuid,uuid,integer,jsonb,jsonb) to authenticated;
create function public.ci_save_sale_group_revision_v1(p_event_id uuid,p_group_id uuid,p_expected_revision integer,p_group jsonb,p_expected_graphs jsonb)
returns public.sale_group_revisions language sql security invoker set search_path=pg_catalog as $$
 select ci_sale_private.save_group_revision_v1(p_event_id,p_group_id,p_expected_revision,p_group,p_expected_graphs)
$$;
revoke all on function public.ci_save_sale_group_revision_v1(uuid,uuid,integer,jsonb,jsonb) from public,anon,service_role;
grant execute on function public.ci_save_sale_group_revision_v1(uuid,uuid,integer,jsonb,jsonb) to authenticated;

create function ci_sale_private.record_group_event_v1(p_event_id uuid,p_revision_id uuid,p_kind text,p_payload jsonb)
returns public.sale_group_events language plpgsql security definer set search_path=pg_catalog as $$
declare v_owner uuid:=auth.uid();v_revision public.sale_group_revisions%rowtype;v_old public.sale_group_events%rowtype;v_new public.sale_group_events%rowtype;v_last public.sale_group_events%rowtype;v_item uuid;v_ids uuid[];v_graph text;
begin
 if v_owner is null or p_event_id is null or p_revision_id is null or p_kind is null or p_kind not in('APPROVE','RELEASE','SOLD') or jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>20000 then raise exception 'Authenticated owner and bounded group event required';end if;
 select * into v_revision from public.sale_group_revisions where id=p_revision_id and owner_id=v_owner;
 if not found then raise exception 'Owned group revision is unavailable';end if;
 perform pg_advisory_xact_lock(hashtextextended(v_owner::text||':'||v_revision.group_id::text,0));
 select * into v_old from public.sale_group_events where owner_id=v_owner and client_event_id=p_event_id;
 if found then if v_old.revision_id is distinct from p_revision_id or v_old.kind is distinct from p_kind or v_old.payload is distinct from p_payload then raise exception 'Group event already used for different immutable data';end if;return v_old;end if;
 select array_agg((m->>'itemId')::uuid order by (m->>'itemId')::uuid) into v_ids from jsonb_array_elements(v_revision.group_data->'members')m;
 perform 1 from public.items where id=any(v_ids) and owner_id=v_owner order by id for update;
 if (select count(*) from public.items where id=any(v_ids) and owner_id=v_owner)<>array_length(v_ids,1) then raise exception 'Group member unavailable';end if;
 select * into v_last from public.sale_group_events where owner_id=v_owner and group_id=v_revision.group_id order by created_at desc,id desc limit 1;
 if p_kind='APPROVE' then
  if p_payload->'ownerConfirmed' is distinct from 'true'::jsonb or length(btrim(coalesce(p_payload->>'rationale','')))<40 then raise exception 'Explicit owner plan reservation and rationale required; this does not publish';end if;
  if v_revision.revision<>(select max(revision) from public.sale_group_revisions where owner_id=v_owner and group_id=v_revision.group_id) then raise exception 'Approve the latest group revision only';end if;
  if v_last.kind in('APPROVE','SOLD') then raise exception 'The group is already reserved or sold';end if;
  foreach v_item in array v_ids loop
   if exists(select 1 from public.sale_outcomes where item_id=v_item and owner_id=v_owner and gross_sale is not null) then raise exception 'A physical member already has an individual sold outcome';end if;
   if exists(select 1 from public.items where id=v_item and owner_id=v_owner and status='SOLD') then raise exception 'A physical member is already sold';end if;
   v_graph:=encode(sha256(convert_to(public.ci_item_review_graph_v1(v_owner,v_item)::text,'UTF8')),'hex');
   if v_revision.member_graphs->>(v_item::text) is distinct from v_graph then raise exception 'Group member facts or evidence changed; save a current revision';end if;
   if not exists(select 1 from public.item_reviewed_assessments_v1 a where a.owner_id=v_owner and a.item_id=v_item and a.assessment->>'decision'='READY_TO_LIST') then raise exception 'Every member requires its current independent final review before owner reservation';end if;
   if exists(select 1 from public.listings l where l.owner_id=v_owner and l.item_id=v_item and l.listing_status in('READY','PUBLISHED','SOLD')) or exists(select 1 from ci_sale_private.active_item_sale_claims c where c.owner_id=v_owner and c.item_id=v_item) then raise exception 'Physical object already has an active listing or consignment reservation';end if;
  end loop;
  insert into ci_sale_private.active_item_sale_claims(owner_id,item_id,source_kind,source_id,state) select v_owner,x,'GROUP',v_revision.id,'RESERVED' from unnest(v_ids)x;
 elsif p_kind='RELEASE' then
  if v_last.kind is distinct from 'APPROVE' or v_last.revision_id<>v_revision.id or length(btrim(coalesce(p_payload->>'reason','')))<10 then raise exception 'Release requires the current approved revision and an explicit reason';end if;
  delete from ci_sale_private.active_item_sale_claims where owner_id=v_owner and source_kind='GROUP' and source_id=v_revision.id and state='RESERVED';
 else
  if v_last.kind is distinct from 'APPROVE' or v_last.revision_id<>v_revision.id or p_payload->'ownerConfirmed' is distinct from 'true'::jsonb or length(btrim(coalesce(p_payload->>'sourceReference','')))<5 then raise exception 'Record only an owner-confirmed whole-lot sale of the current reserved revision';end if;
  if p_payload->>'currency' !~ '^[A-Z]{3}$' or p_payload->>'currency' is null or jsonb_typeof(p_payload->'grossTotal') is distinct from 'number' or (p_payload->>'grossTotal')::numeric<0 or (p_payload->>'grossTotal')::numeric>100000000 or exists(select 1 from jsonb_object_keys(p_payload) k where k not in('currency','grossTotal','ownerConfirmed','sourceReference','notes')) then raise exception 'Whole-lot currency and achieved total required; component allocation is forbidden';end if;
  foreach v_item in array v_ids loop
   if not exists(select 1 from ci_sale_private.active_item_sale_claims where owner_id=v_owner and item_id=v_item and source_kind='GROUP' and source_id=v_revision.id and state='RESERVED') or exists(select 1 from public.sale_outcomes where owner_id=v_owner and item_id=v_item and gross_sale is not null) or exists(select 1 from public.items where id=v_item and owner_id=v_owner and status='SOLD') then raise exception 'Whole-lot sale requires every exact unsold group claim and no individual outcome';end if;
   if not exists(select 1 from public.items where id=v_item and owner_id=v_owner and currency=p_payload->>'currency') then raise exception 'Sale currency must match all group members; no conversion is assumed';end if;
  end loop;
  update ci_sale_private.active_item_sale_claims set state='SOLD' where owner_id=v_owner and source_kind='GROUP' and source_id=v_revision.id;
  update public.items set status='SOLD' where owner_id=v_owner and id=any(v_ids);
 end if;
 insert into public.sale_group_events(owner_id,group_id,revision_id,client_event_id,kind,payload) values(v_owner,v_revision.group_id,v_revision.id,p_event_id,p_kind,p_payload) returning * into v_new;
 return v_new;
end$$;
revoke all on function ci_sale_private.record_group_event_v1(uuid,uuid,text,jsonb) from public,anon,service_role;
grant execute on function ci_sale_private.record_group_event_v1(uuid,uuid,text,jsonb) to authenticated;
create function public.ci_record_sale_group_event_v1(p_event_id uuid,p_revision_id uuid,p_kind text,p_payload jsonb)
returns public.sale_group_events language sql security invoker set search_path=pg_catalog as $$
 select ci_sale_private.record_group_event_v1(p_event_id,p_revision_id,p_kind,p_payload)
$$;
revoke all on function public.ci_record_sale_group_event_v1(uuid,uuid,text,jsonb) from public,anon,service_role;
grant execute on function public.ci_record_sale_group_event_v1(uuid,uuid,text,jsonb) to authenticated;

-- Individual listings use the same physical-item lock and claim ledger. DRAFT
-- records may overlap hypotheses; READY/PUBLISHED reserve and SOLD keeps the claim.
create function ci_sale_private.guard_individual_listing_v1() returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_owner uuid;v_item uuid;v_claim ci_sale_private.active_item_sale_claims%rowtype;
begin
 if tg_op='DELETE' then v_owner:=old.owner_id;v_item:=old.item_id;else v_owner:=new.owner_id;v_item:=new.item_id;end if;
 if tg_op='UPDATE' and (old.owner_id is distinct from new.owner_id or old.item_id is distinct from new.item_id) then raise exception 'Listing physical owner/item identity is immutable';end if;
 perform 1 from public.items where id=v_item and owner_id=v_owner for update;
 if not found then raise exception 'Listing item does not belong to its owner';end if;
 select * into v_claim from ci_sale_private.active_item_sale_claims where owner_id=v_owner and item_id=v_item;
 if tg_op<>'INSERT' and (old.listing_status='SOLD' or (v_claim.source_kind='LISTING' and v_claim.source_id=old.id and v_claim.state='SOLD')) and (tg_op='DELETE' or new.listing_status<>'SOLD') then raise exception 'A recorded individual sale cannot be reopened or erased; preserve its history';end if;
 if tg_op<>'DELETE' and new.listing_status in('READY','PUBLISHED','SOLD') then
  if exists(select 1 from public.items where id=v_item and status='SOLD') and not coalesce(v_claim.source_kind='LISTING' and v_claim.source_id=new.id and v_claim.state='SOLD' and new.listing_status='SOLD',false) then raise exception 'Physical item is already sold';end if;
  select * into v_claim from ci_sale_private.active_item_sale_claims where owner_id=v_owner and item_id=v_item;
  if found and (v_claim.source_kind<>'LISTING' or v_claim.source_id<>new.id or (v_claim.state='SOLD' and new.listing_status<>'SOLD')) then raise exception 'Physical item already reserved by another listing or consignment';end if;
  if exists(select 1 from public.listings l where l.owner_id=v_owner and l.item_id=v_item and l.id<>new.id and l.listing_status in('READY','PUBLISHED','SOLD')) then raise exception 'Another active individual listing already contains this object';end if;
  insert into ci_sale_private.active_item_sale_claims(owner_id,item_id,source_kind,source_id,state) values(v_owner,v_item,'LISTING',new.id,case when new.listing_status='SOLD' then 'SOLD' else 'RESERVED' end) on conflict(owner_id,item_id) do update set state=excluded.state;
 else
  if tg_op<>'INSERT' then delete from ci_sale_private.active_item_sale_claims where owner_id=v_owner and item_id=v_item and source_kind='LISTING' and source_id=old.id and state='RESERVED';end if;
 end if;
 if tg_op='DELETE' then return old;end if;return new;
end$$;
revoke all on function ci_sale_private.guard_individual_listing_v1() from public,anon,authenticated,service_role;
create trigger individual_listing_sale_claim before insert or update or delete on public.listings for each row execute function ci_sale_private.guard_individual_listing_v1();
-- Existing active rows must be reviewed before an approved rollout. No silent
-- backfill or automatic choice between historical duplicate listings is made.

-- Existing actual-sale RPC and direct sale_outcomes writes share the same lock.
-- A recorded individual outcome cannot coexist with a reserved or sold group.
create function ci_sale_private.guard_individual_outcome_v1() returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_claim ci_sale_private.active_item_sale_claims%rowtype;
begin
 if tg_op='DELETE' then
  if old.gross_sale is not null then raise exception 'Recorded sale history cannot be erased';end if;return old;
 end if;
 if tg_op='UPDATE' and (old.owner_id is distinct from new.owner_id or old.item_id is distinct from new.item_id) then raise exception 'Sale physical identity is immutable';end if;
 if tg_op='UPDATE' and old.gross_sale is not null and old.gross_sale is distinct from new.gross_sale then raise exception 'Recorded achieved amount cannot be erased or replaced';end if;
 if new.gross_sale is null then return new;end if;
 perform 1 from public.items where id=new.item_id and owner_id=new.owner_id for update;
 if not found then raise exception 'Sale item does not belong to this owner';end if;
 select * into v_claim from ci_sale_private.active_item_sale_claims where owner_id=new.owner_id and item_id=new.item_id;
 if found and not (v_claim.source_kind='OUTCOME' and v_claim.source_id=new.id and v_claim.state='SOLD') and not(v_claim.source_kind='LISTING' and v_claim.state='RESERVED') then raise exception 'Physical object is reserved or already sold by another route';end if;
 if exists(select 1 from public.sale_outcomes s where s.owner_id=new.owner_id and s.item_id=new.item_id and s.id<>new.id and s.gross_sale is not null) or exists(select 1 from public.listings l where l.owner_id=new.owner_id and l.item_id=new.item_id and l.listing_status='SOLD') then raise exception 'Physical object already has a recorded individual sale';end if;
 if exists(select 1 from public.items where id=new.item_id and status='SOLD') and not coalesce(v_claim.source_kind='OUTCOME' and v_claim.source_id=new.id,false) then raise exception 'Physical object is already sold';end if;
 insert into ci_sale_private.active_item_sale_claims(owner_id,item_id,source_kind,source_id,state) values(new.owner_id,new.item_id,'OUTCOME',new.id,'SOLD') on conflict(owner_id,item_id) do update set source_kind='OUTCOME',source_id=excluded.source_id,state='SOLD';
 return new;
end$$;
revoke all on function ci_sale_private.guard_individual_outcome_v1() from public,anon,authenticated,service_role;
create trigger individual_outcome_sale_claim before insert or update or delete on public.sale_outcomes for each row execute function ci_sale_private.guard_individual_outcome_v1();
