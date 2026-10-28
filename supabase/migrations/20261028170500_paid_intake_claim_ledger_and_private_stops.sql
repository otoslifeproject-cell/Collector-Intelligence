create table if not exists public.ci_paid_intake_claims_v1 (
  run_id uuid primary key,
  owner_id uuid not null,
  photo_hashes jsonb not null,
  original_manifest jsonb not null,
  original_context jsonb not null,
  claimed_at timestamptz not null default now()
);
create index if not exists ci_paid_intake_claims_v1_owner_idx on public.ci_paid_intake_claims_v1(owner_id,claimed_at desc);
alter table public.ci_paid_intake_claims_v1 enable row level security;
drop policy if exists ci_paid_intake_claims_v1_owner_read on public.ci_paid_intake_claims_v1;
create policy ci_paid_intake_claims_v1_owner_read on public.ci_paid_intake_claims_v1
  for select to authenticated using (owner_id=auth.uid());
revoke all on public.ci_paid_intake_claims_v1 from public,anon,authenticated;
grant select on public.ci_paid_intake_claims_v1 to authenticated;

-- The old one-argument RPC permits a TOCTOU race between server preflight and
-- claim. Remove the obsolete overload inside the disposable fixture.
-- Existing five-argument function is replaced in place; obsolete one-argument overload, if present, is not used.
drop function if exists public.ci_claim_intake_paid_v1(uuid);
create or replace function public.ci_claim_intake_paid_v1(
 p_run_id uuid, p_expected_manifest jsonb, p_expected_context jsonb,
 p_expected_mode text, p_expected_photo_count integer
) returns text
language plpgsql security definer set search_path=pg_catalog,public
as $$
declare
  v_owner uuid:=auth.uid();
  v_run public.ai_analysis_runs%rowtype;
  v_hashes jsonb;
  v_count integer;
begin
  if v_owner is null then raise exception 'Owner sign-in required';end if;
  -- Serialize even distinct session IDs with overlapping physical originals.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ci:intake:owner:'||v_owner::text,0));
  select * into v_run from public.ai_analysis_runs
    where id=p_run_id and owner_id=v_owner and mode in ('single','batch') for update;
  if not found then raise exception 'Owned saved intake session unavailable';end if;
  -- Match the exact SERVER-READ scope used to build the model prompt before
  -- locking the paid claim. A concurrent owner edit fails atomically.
  if v_run.result->'image_manifest' is distinct from p_expected_manifest
     or v_run.user_context is distinct from p_expected_context
     or v_run.mode is distinct from p_expected_mode
     or v_run.input_photo_count is distinct from p_expected_photo_count
  then raise exception 'Saved owner photo/context scope changed before paid claim';end if;
  if v_run.status<>'DRAFT' or v_run.result->>'analysis_stage'<>'UPLOADED' or
     v_run.result ? 'objects' then
    raise exception 'Saved intake has already progressed or needs review';
  end if;
  if pg_catalog.jsonb_typeof(v_run.result->'image_manifest') is distinct from 'array' or
     pg_catalog.jsonb_array_length(v_run.result->'image_manifest')<>v_run.input_photo_count or
     v_run.input_photo_count<1 or v_run.input_photo_count>40 then
    raise exception 'Original photo manifest unavailable';
  end if;
  if exists(
    select 1 from pg_catalog.jsonb_array_elements(v_run.result->'image_manifest') as m(photo)
    where m.photo->>'sha256' is null
       or m.photo->>'sha256' !~ '^[0-9a-fA-F]{64}$'
       or (m.photo->>'index') is null
  ) then raise exception 'Original photo hash/index missing';end if;
  select pg_catalog.jsonb_agg(m.photo->>'sha256' order by m.photo->>'sha256') into v_hashes
   from pg_catalog.jsonb_array_elements(v_run.result->'image_manifest') as m(photo);
  if v_hashes is null or pg_catalog.jsonb_array_length(v_hashes)<>v_run.input_photo_count then
    raise exception 'Invalid original photo scope';
  end if;
  if exists(select 1 from public.ci_paid_intake_claims_v1 c
    cross join lateral pg_catalog.jsonb_array_elements_text(c.photo_hashes) as old_hash(value)
    where c.owner_id=v_owner and old_hash.value in(select pg_catalog.jsonb_array_elements_text(v_hashes))) then
      raise exception 'An overlapping original photograph was already claimed for paid analysis; recover its saved session';
  end if;
  insert into public.ci_paid_intake_claims_v1(run_id,owner_id,photo_hashes,original_manifest,original_context)
  values(p_run_id,v_owner,v_hashes,v_run.result->'image_manifest',v_run.user_context);
  update public.ai_analysis_runs
   set result=pg_catalog.jsonb_set(result,'{analysis_stage}','"PROCESSING"'::jsonb,true)
      ||pg_catalog.jsonb_build_object('claimed_at',now())
   where id=p_run_id and owner_id=v_owner;
  get diagnostics v_count=row_count;
  if v_count<>1 then raise exception 'Claim save confirmation failed';end if;
  return 'CLAIMED';
end $$;
revoke all on function public.ci_claim_intake_paid_v1(uuid,jsonb,jsonb,text,integer) from public,anon;
grant execute on function public.ci_claim_intake_paid_v1(uuid,jsonb,jsonb,text,integer) to authenticated;

-- Private preflight and provider-phase stop diagnostics. Never return these to
-- browser views. Append-only records retain each attempted check.
create table if not exists public.ci_intake_stop_events_v1 (
 id bigint generated by default as identity primary key,
 run_id uuid not null references public.ai_analysis_runs(id),
 owner_id uuid not null,
 stage text not null check (length(stage) between 1 and 60),
 reason text not null check (length(reason) between 1 and 120),
 created_at timestamptz not null default now()
);
create index if not exists ci_intake_stop_events_v1_run_idx
 on public.ci_intake_stop_events_v1(run_id,created_at desc);
alter table public.ci_intake_stop_events_v1 enable row level security;
revoke all on public.ci_intake_stop_events_v1 from public,anon,authenticated;
grant insert on public.ci_intake_stop_events_v1 to authenticated;
drop policy if exists ci_intake_stop_insert_v1 on public.ci_intake_stop_events_v1;
create policy ci_intake_stop_insert_v1 on public.ci_intake_stop_events_v1
 for insert to authenticated
 with check (
  owner_id=auth.uid() and exists(
   select 1 from public.ai_analysis_runs a
   where a.id=run_id and a.owner_id=auth.uid()
  )
 );
-- No owner SELECT grant: the server/admin can review diagnostics privately.
