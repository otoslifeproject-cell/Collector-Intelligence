-- Collector Intelligence, 29 Oct 2026 (HQ TL-0031, owner approval required before applying).
-- Dean re-uploaded the same tureen photographs as One object and the pay-once claim
-- refused them for ever ("overlapping original photograph already claimed"). This keeps
-- the pay-once guard for anything still being analysed, and allows a deliberate new
-- analysis of the same photographs once the earlier run has finished.
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
  -- Re-analysing the same photographs in a NEW upload is the owner's choice (a
  -- new paid run). Only an earlier claim that is still in flight blocks it, so
  -- one request can never be charged twice.
  if exists(select 1 from public.ci_paid_intake_claims_v1 c
    join public.ai_analysis_runs r on r.id=c.run_id
    cross join lateral pg_catalog.jsonb_array_elements_text(c.photo_hashes) as old_hash(value)
    where c.owner_id=v_owner
      and r.result->>'analysis_stage'='PROCESSING'
      and old_hash.value in(select pg_catalog.jsonb_array_elements_text(v_hashes))) then
      raise exception 'The same photographs are being analysed right now; wait for that result';
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
