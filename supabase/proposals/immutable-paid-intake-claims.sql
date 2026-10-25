-- DEVELOPMENT PROPOSAL ONLY. NEVER APPLY TO PRODUCTION WITHOUT OWNER APPROVAL.
-- Protect a paid photo-intake claim independently of owner-editable ai_analysis_runs.result.
-- Run in the isolated PostgreSQL/Auth/PostgREST fixture before any Vercel release.
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

create or replace function public.ci_claim_intake_paid_v1(p_run_id uuid) returns text
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
revoke all on function public.ci_claim_intake_paid_v1(uuid) from public,anon;
grant execute on function public.ci_claim_intake_paid_v1(uuid) to authenticated;
