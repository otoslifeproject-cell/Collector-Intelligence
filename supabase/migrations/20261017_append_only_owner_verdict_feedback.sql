-- Private append-only corrections. Owner evidence overrides provisional AI assumptions in future research.
-- Do not modify initial_ai_result, model object, or previous research outputs.
create table if not exists public.ai_verdict_feedback (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null default auth.uid(),
 source_analysis_run_id uuid not null references public.ai_analysis_runs(id),
 source_object_index integer,
 feedback_type text not null check (feedback_type in ('MATERIAL_CORRECTION','ATTRIBUTION_REJECTION','IDENTIFICATION_CORRECTION','OTHER')),
 corrected_material text,
 owner_statement text not null,
 created_at timestamptz not null default now(),
 constraint ci_feedback_index_nonnegative check (source_object_index is null or source_object_index >= 0),
 constraint ci_feedback_statement_length check (length(btrim(owner_statement)) between 3 and 2000),
 constraint ci_feedback_corrected_material_length check (corrected_material is null or length(btrim(corrected_material)) between 2 and 100),
 constraint ci_feedback_material_required check (feedback_type <> 'MATERIAL_CORRECTION' or corrected_material is not null)
);
create index if not exists ci_verdict_feedback_owner_source
 on public.ai_verdict_feedback(owner_id,source_analysis_run_id,created_at desc,id desc);
alter table public.ai_verdict_feedback enable row level security;
drop policy if exists ci_verdict_feedback_read on public.ai_verdict_feedback;
create policy ci_verdict_feedback_read on public.ai_verdict_feedback for select to authenticated
 using (owner_id=auth.uid());
drop policy if exists ci_verdict_feedback_insert on public.ai_verdict_feedback;
create policy ci_verdict_feedback_insert on public.ai_verdict_feedback for insert to authenticated
 with check (
  owner_id=auth.uid() and exists(
   select 1 from public.ai_analysis_runs r
   where r.id=source_analysis_run_id and r.owner_id=auth.uid()
     and r.mode in ('single','batch') and
     (source_object_index is null or
       (jsonb_typeof(r.result->'objects')='array' and
         source_object_index < jsonb_array_length(r.result->'objects')))
  )
 );
revoke all on public.ai_verdict_feedback from public,anon,authenticated;
grant select,insert on public.ai_verdict_feedback to authenticated;
