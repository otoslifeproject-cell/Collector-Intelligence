-- Collector Intelligence, 31 Oct 2026 (HQ TL-0031). Dean: an "Add photos" button
-- for each item, so final photos can go into the follow-up research and the
-- listing; then he chooses which photos to show. Extra photos are kept in their
-- own table so the original analysis, its photo fingerprints and the pay-once
-- ledger are never touched. Photo keys start at 1000 (originals use 0..999).
create table if not exists public.ci_extra_photos_v1 (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  run_id uuid not null references public.ai_analysis_runs(id) on delete cascade,
  object_index integer not null check (object_index between 0 and 999),
  photo_key integer not null check (photo_key between 1000 and 9999),
  storage_path text not null,
  file_name text,
  created_at timestamptz not null default now(),
  unique (run_id, photo_key)
);
alter table public.ci_extra_photos_v1 enable row level security;
drop policy if exists ci_extra_photos_v1_owner on public.ci_extra_photos_v1;
create policy ci_extra_photos_v1_owner on public.ci_extra_photos_v1
  for all to authenticated
  using (owner_id=auth.uid())
  with check (owner_id=auth.uid() and storage_path like auth.uid()::text||'/extra/%'
    and exists(select 1 from public.ai_analysis_runs r where r.id=run_id and r.owner_id=auth.uid()));
revoke all on public.ci_extra_photos_v1 from public,anon,authenticated;
grant select,insert on public.ci_extra_photos_v1 to authenticated;
-- Photos the owner hides from the listing (still used by research).
alter table public.ci_photo_order_v1 add column if not exists hidden integer[] not null default '{}';
