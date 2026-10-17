-- Atomic owner-scoped claim for paid web research. Prevent simultaneous duplicate billing.
-- A paid request must have a private staged run before any model invocation.
create or replace function public.ci_claim_paid_research_v1(p_run_id uuid)
returns text
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare
 v_run public.ai_analysis_runs%rowtype;
 v_stage text;
begin
 if auth.uid() is null then raise exception 'Sign in to use research'; end if;
 select * into v_run from public.ai_analysis_runs
  where id=p_run_id and owner_id=auth.uid() and mode='research'
  for update;
 if not found then raise exception 'Research run unavailable for owner'; end if;
 if v_run.status<>'DRAFT' then raise exception 'Research run is no longer editable'; end if;
 if jsonb_typeof(v_run.result) is distinct from 'object' then
  raise exception 'Malformed research envelope';
 end if;
 v_stage:=v_run.result->>'analysis_stage';
 if v_stage='COMPLETE' then return 'COMPLETE'; end if;
 if v_stage is distinct from 'STAGED' then
  raise exception 'Existing research is already processing or needs review; do not charge again';
 end if;
 if (v_run.user_context->>'item_id') is null and (v_run.user_context->>'source_analysis_run_id') is null then
  raise exception 'Research source object missing';
 end if;
 update public.ai_analysis_runs
  set result=jsonb_set(v_run.result,'{analysis_stage}','"PROCESSING"'::jsonb,false)
       ||jsonb_build_object('claimed_at',now())
  where id=p_run_id and owner_id=auth.uid();
 return 'CLAIMED';
end $$;
revoke all on function public.ci_claim_paid_research_v1(uuid) from public,anon;
grant execute on function public.ci_claim_paid_research_v1(uuid) to authenticated;
