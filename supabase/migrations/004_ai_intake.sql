-- Collector Intelligence AI intake audit layer
-- Apply ONLY to the dedicated Collector Intelligence Supabase project.

create table if not exists public.ai_analysis_runs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  mode text not null check (mode in ('single','batch','research')),
  model text not null,
  status text not null default 'DRAFT' check (status in ('DRAFT','APPROVED','REJECTED','FAILED')),
  input_photo_count integer not null default 0,
  user_context jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  approved_at timestamptz
);

alter table public.ai_analysis_runs enable row level security;
drop policy if exists owner_all on public.ai_analysis_runs;
create policy owner_all on public.ai_analysis_runs
for all to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

alter table public.items
  add column if not exists source_analysis_run_id uuid references public.ai_analysis_runs(id) on delete set null,
  add column if not exists catalogue_review_status text not null default 'MANUAL'
    check (catalogue_review_status in ('MANUAL','AI_DRAFT','OWNER_REVIEWED','RESEARCH_VERIFIED'));

create index if not exists ai_analysis_runs_owner_created_idx
  on public.ai_analysis_runs(owner_id, created_at desc);

create index if not exists items_source_analysis_run_idx
  on public.items(source_analysis_run_id);
