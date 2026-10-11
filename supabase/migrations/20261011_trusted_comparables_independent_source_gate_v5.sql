-- Applied to Supabase project bwdafrwkimjvwfoqomot 2026-10-11.
-- Preserve the exact source-independent trusted-comparable view definition (v5).
-- OWNER APPROVAL ALONE DOES NOT QUALIFY: latest independently fetched archived confirmation required.
create or replace view public.trusted_comparables_v1 with (security_invoker=true) as
select c.* from public.comparables c
where c.verification_status='VERIFIED_DIRECT' and c.price is not null and c.price>=0
and exists(select 1 from public.comparable_evidence_reviews e
 where e.comparable_id=c.id and e.owner_id=c.owner_id and e.decision='APPROVED'
 and e.reviewed_price=c.price and e.reviewed_currency=c.currency and e.reviewed_price_type=c.price_type
 and ((c.price_type='HAMMER_REALIZED' and e.result_observed='HAMMER')
 or (c.price_type='REALIZED_INCL_BP' and e.result_observed='INCLUSIVE_REALIZED')
 or (c.price_type in ('MARKETPLACE_SOLD','DEALER_SOLD_CONFIRMED') and e.result_observed='CONFIRMED_MARKETPLACE_SOLD'))
 and public.comparable_source_matches(e.original_lot_reference,e.original_lot_url,c.source_reference,c.source_url)
 and not exists(select 1 from public.comparable_evidence_reviews later where later.comparable_id=e.comparable_id and (later.reviewed_at,later.id)>(e.reviewed_at,e.id)))
and exists(select 1 from public.comparable_source_checks s
 where s.comparable_id=c.id and s.owner_id=c.owner_id
 and s.verification_decision='SOURCE_CONFIRMED' and s.fetch_status='FETCHED'
 and s.verification_method='INDEPENDENT_FETCH' and s.snapshot_sha256 is not null and s.archive_reference is not null
 and s.observed_amount=c.price and s.observed_currency=c.currency
 and ((c.price_type='HAMMER_REALIZED' and s.observed_result='HAMMER')
 or (c.price_type='REALIZED_INCL_BP' and s.observed_result='INCLUSIVE_REALIZED')
 or (c.price_type in ('MARKETPLACE_SOLD','DEALER_SOLD_CONFIRMED') and s.observed_result='MARKETPLACE_SOLD'))
 and public.comparable_source_matches(s.original_lot_reference,s.source_url,c.source_reference,c.source_url)
 and not exists(select 1 from public.comparable_source_checks newer where newer.comparable_id=s.comparable_id and (newer.checked_at,newer.id)>(s.checked_at,s.id)));
