-- Applied to Supabase bwdafrwkimjvwfoqomot, 2026-10-10. Original comparable rows are retained.
create table if not exists public.comparable_evidence_reviews (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 comparable_id uuid not null references public.comparables(id) on delete restrict,
 reviewer_id uuid not null references auth.users(id),
 decision text not null check (decision in ('APPROVED','REJECTED','NEEDS_WORK')),
 result_observed text not null check (result_observed in ('HAMMER','INCLUSIVE_REALIZED','CONFIRMED_MARKETPLACE_SOLD','UNSOLD','ESTIMATE','ASKING','UNKNOWN')),
 original_lot_url text,
 original_lot_reference text,
 sale_date_checked date,
 evidence_explanation text not null,
 reviewed_at timestamptz not null default now(),
 check (decision <> 'APPROVED' or (result_observed in ('HAMMER','INCLUSIVE_REALIZED','CONFIRMED_MARKETPLACE_SOLD') and length(trim(evidence_explanation))>=30 and (nullif(trim(coalesce(original_lot_url,'')),'') is not null or nullif(trim(coalesce(original_lot_reference,'')),'') is not null)))
);
create index if not exists comparable_evidence_reviews_by_object on public.comparable_evidence_reviews(owner_id,comparable_id,reviewed_at desc,id desc);
alter table public.comparable_evidence_reviews enable row level security;
drop policy if exists comparable_review_read on public.comparable_evidence_reviews;
create policy comparable_review_read on public.comparable_evidence_reviews for select to authenticated using(owner_id=(select auth.uid()));
drop policy if exists comparable_review_insert on public.comparable_evidence_reviews;
create policy comparable_review_insert on public.comparable_evidence_reviews for insert to authenticated with check(owner_id=(select auth.uid()) and reviewer_id=(select auth.uid()) and exists(select 1 from public.comparables c where c.id=comparable_id and c.owner_id=(select auth.uid())));
create or replace view public.trusted_comparables_v1 with (security_invoker=true) as
 select c.* from public.comparables c
 where c.verification_status='VERIFIED_DIRECT'
 and c.price_type in ('HAMMER_REALIZED','REALIZED_INCL_BP','MARKETPLACE_SOLD','DEALER_SOLD_CONFIRMED')
 and exists(
 select 1 from public.comparable_evidence_reviews e
 where e.comparable_id=c.id and e.owner_id=c.owner_id and e.decision='APPROVED'
 and ((c.price_type='HAMMER_REALIZED' and e.result_observed='HAMMER')
 or (c.price_type='REALIZED_INCL_BP' and e.result_observed='INCLUSIVE_REALIZED')
 or (c.price_type in ('MARKETPLACE_SOLD','DEALER_SOLD_CONFIRMED') and e.result_observed='CONFIRMED_MARKETPLACE_SOLD'))
 and not exists(select 1 from public.comparable_evidence_reviews later where later.comparable_id=e.comparable_id and (later.reviewed_at,later.id)>(e.reviewed_at,e.id))
 );
