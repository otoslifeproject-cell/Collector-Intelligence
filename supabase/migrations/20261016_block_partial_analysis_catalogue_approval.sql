-- Trust gate: a first-pass AI report remains preserved but cannot be promoted to catalogue
-- until final enrichment/save has committed. Works for RPC and any direct status-update path.
create or replace function public.ci_block_partial_ai_approval()
returns trigger language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
 if new.status='APPROVED' and old.status is distinct from 'APPROVED'
   and new.mode in ('single','batch')
   and new.result->>'analysis_stage' is distinct from 'COMPLETE'
 then
  raise exception 'Cannot approve partial AI analysis; complete saved report required';
 end if;
 return new;
end $$;
drop trigger if exists ci_block_partial_ai_approval_update on public.ai_analysis_runs;
create trigger ci_block_partial_ai_approval_update
 before update of status on public.ai_analysis_runs
 for each row execute function public.ci_block_partial_ai_approval();
revoke all on function public.ci_block_partial_ai_approval() from public,anon,authenticated;
