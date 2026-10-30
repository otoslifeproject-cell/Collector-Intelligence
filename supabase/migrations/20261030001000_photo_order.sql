-- Collector Intelligence, 30 Oct 2026 (HQ TL-0031). Dean: drag the photos so the
-- right one is always photo 1 (the main eBay photo). The order is kept here, on
-- its own, so the saved analysis, its photo fingerprints and the pay-once ledger
-- are never touched. Owner-only; one row per draft and item.
create table if not exists public.ci_photo_order_v1 (
  run_id uuid not null references public.ai_analysis_runs(id) on delete cascade,
  scope text not null check (scope ~ '^(pair|[0-9]{1,3})$'),
  owner_id uuid not null default auth.uid(),
  photo_order integer[] not null check (cardinality(photo_order) between 1 and 40),
  updated_at timestamptz not null default now(),
  primary key (run_id, scope)
);
alter table public.ci_photo_order_v1 enable row level security;
drop policy if exists ci_photo_order_v1_owner on public.ci_photo_order_v1;
create policy ci_photo_order_v1_owner on public.ci_photo_order_v1
  for all to authenticated
  using (owner_id=auth.uid())
  with check (owner_id=auth.uid() and exists(select 1 from public.ai_analysis_runs r where r.id=run_id and r.owner_id=auth.uid()));
revoke all on public.ci_photo_order_v1 from public,anon,authenticated;
grant select,insert,update on public.ci_photo_order_v1 to authenticated;
