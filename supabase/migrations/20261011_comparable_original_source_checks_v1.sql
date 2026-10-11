-- Applied 2026-10-11 to project bwdafrwkimjvwfoqomot.
-- Source-check ledger; owner submissions cannot mark records independently confirmed.
create table if not exists public.comparable_source_checks (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 comparable_id uuid not null references public.comparables(id) on delete cascade,
 source_url text not null,
 checked_at timestamptz not null default now(),
 fetch_status text not null check(fetch_status in ('FETCHED','ACCESS_DENIED','NOT_FOUND','UNAVAILABLE','MANUAL_ONLY')),
 source_publisher text,
 original_lot_reference text,
 observed_result text not null check(observed_result in ('HAMMER','INCLUSIVE_REALIZED','MARKETPLACE_SOLD','UNSOLD','ASKING','ESTIMATE','AMBIGUOUS','UNKNOWN')),
 observed_amount numeric,
 observed_currency text,
 evidence_quote text,
 archive_reference text,
 snapshot_sha256 text,
 verification_method text not null check(verification_method in ('OWNER_MANUAL','INDEPENDENT_FETCH','SPECIALIST_REVIEW')),
 verification_decision text not null default 'UNVERIFIED' check(verification_decision in ('UNVERIFIED','REVIEW_REQUIRED','SOURCE_CONFIRMED','REJECTED')),
 notes text,
 constraint comparable_source_checks_hash_format check(snapshot_sha256 is null or snapshot_sha256 ~ '^[a-f0-9]{64}$'),
 constraint comparable_source_checks_no_false_confirmation check(verification_decision <> 'SOURCE_CONFIRMED' or
 (fetch_status='FETCHED' and verification_method='INDEPENDENT_FETCH' and snapshot_sha256 is not null and archive_reference is not null and length(trim(evidence_quote))>=15 and observed_result in ('HAMMER','INCLUSIVE_REALIZED','MARKETPLACE_SOLD') and observed_amount is not null and observed_currency is not null))
);
create index if not exists comparable_source_checks_item_idx on public.comparable_source_checks(owner_id,comparable_id,checked_at desc);
alter table public.comparable_source_checks enable row level security;
drop policy if exists comparable_source_checks_owner_select on public.comparable_source_checks;
create policy comparable_source_checks_owner_select on public.comparable_source_checks for select to authenticated using(owner_id=(select auth.uid()));
drop policy if exists comparable_source_checks_owner_insert on public.comparable_source_checks;
create policy comparable_source_checks_owner_insert on public.comparable_source_checks for insert to authenticated with check(owner_id=(select auth.uid()) and exists(select 1 from public.comparables c where c.id=comparable_id and c.owner_id=(select auth.uid())) and verification_decision in ('UNVERIFIED','REVIEW_REQUIRED'));
revoke update,delete on public.comparable_source_checks from anon,authenticated;
