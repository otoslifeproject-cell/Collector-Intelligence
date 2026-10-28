-- A verified, non-billable provider refusal may unlock a pre-paid-intake claim.
-- This RPC is server-only. Clients cannot release their own claims.
create or replace function public.ci_release_refused_intake_v1(
 p_run_id uuid, p_http_status integer, p_error_code text
) returns text
language plpgsql security definer set search_path=pg_catalog,public
as $body$
declare
 v_run public.ai_analysis_runs%rowtype;
 v_claim public.ci_paid_intake_claims_v1%rowtype;
begin
 if p_http_status not in (400,401,402,403,404,429) or
    p_error_code is null or length(p_error_code)>64 or
    p_error_code !~ '^[A-Za-z0-9_.-]+$' then
  raise exception 'Release requires a definite provider refusal';
 end if;
 select * into v_claim from public.ci_paid_intake_claims_v1
   where run_id=p_run_id for update;
 if not found then return 'NOT_RELEASED'; end if;
 select * into v_run from public.ai_analysis_runs
   where id=p_run_id and owner_id=v_claim.owner_id for update;
 if not found or v_run.status<>'DRAFT' or v_run.model<>'PENDING'
    or v_run.result->>'analysis_stage'<>'PROCESSING'
    or not (v_run.result ? 'claimed_at')
    or v_run.result ? 'objects'
    or v_run.result ? 'provider_response_id'
    or v_run.result ? 'provider_usage'
    or v_run.result ? 'provider_response_raw'
    or v_run.result->'image_manifest' is distinct from v_claim.original_manifest
    or v_run.user_context is distinct from v_claim.original_context then
    return 'NOT_RELEASED';
 end if;
 insert into public.ci_intake_stop_events_v1(run_id,owner_id,stage,reason)
 values(p_run_id,v_claim.owner_id,'OPENAI_REFUSED',
   left('HTTP_'||p_http_status::text||'_'||p_error_code,120));
 update public.ai_analysis_runs
 set result=(v_run.result - 'claimed_at')
   || jsonb_build_object('analysis_stage','UPLOADED')
 where id=p_run_id and owner_id=v_claim.owner_id;
 delete from public.ci_paid_intake_claims_v1 where run_id=p_run_id;
 return 'RELEASED';
end
$body$;
revoke all on function public.ci_release_refused_intake_v1(uuid,integer,text)
 from public,anon,authenticated;
grant execute on function public.ci_release_refused_intake_v1(uuid,integer,text)
 to service_role;
