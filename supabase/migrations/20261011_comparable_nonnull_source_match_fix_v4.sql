-- Applied to Supabase project bwdafrwkimjvwfoqomot on 2026-10-11.
-- Fix null/null citation matching: an empty URL must not permit an unrelated lot reference.
create or replace function public.comparable_source_matches(review_ref text, review_url text, comp_ref text, comp_url text)
returns boolean language sql immutable set search_path=public as $$
select
 (nullif(btrim(review_ref),'') is not null and nullif(btrim(review_ref),'') = nullif(btrim(comp_ref),''))
 or
 (nullif(btrim(review_url),'') is not null and nullif(btrim(review_url),'') = nullif(btrim(comp_url),''))
$$;
create or replace function public.enforce_comparable_promotion()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare e record;
begin
 if new.verification_status='VERIFIED_DIRECT' then
  select * into e from public.comparable_evidence_reviews where comparable_id=new.id and owner_id=new.owner_id order by reviewed_at desc,id desc limit 1;
  if e.id is null or e.decision<>'APPROVED'
    or not ((new.price_type='HAMMER_REALIZED' and e.result_observed='HAMMER')
    or (new.price_type='REALIZED_INCL_BP' and e.result_observed='INCLUSIVE_REALIZED')
    or (new.price_type in ('MARKETPLACE_SOLD','DEALER_SOLD_CONFIRMED') and e.result_observed='CONFIRMED_MARKETPLACE_SOLD'))
    or new.price is distinct from e.reviewed_price or new.currency is distinct from e.reviewed_currency
    or new.price_type is distinct from e.reviewed_price_type or new.price is null or new.price<0
    or not public.comparable_source_matches(e.original_lot_reference,e.original_lot_url,new.source_reference,new.source_url)
  then raise exception 'COMPARABLE_GATE: approved matching lot, amount, currency and sale basis required';
  end if;
 end if;
 return new;
end $$;
create or replace view public.trusted_comparables_v1 with (security_invoker=true) as
select c.* from public.comparables c where c.verification_status='VERIFIED_DIRECT' and c.price is not null and c.price>=0
and exists(select 1 from public.comparable_evidence_reviews e where e.comparable_id=c.id and e.owner_id=c.owner_id and e.decision='APPROVED'
and e.reviewed_price=c.price and e.reviewed_currency=c.currency and e.reviewed_price_type=c.price_type
and ((c.price_type='HAMMER_REALIZED' and e.result_observed='HAMMER')
or (c.price_type='REALIZED_INCL_BP' and e.result_observed='INCLUSIVE_REALIZED')
or (c.price_type in ('MARKETPLACE_SOLD','DEALER_SOLD_CONFIRMED') and e.result_observed='CONFIRMED_MARKETPLACE_SOLD'))
and public.comparable_source_matches(e.original_lot_reference,e.original_lot_url,c.source_reference,c.source_url)
and not exists(select 1 from public.comparable_evidence_reviews later where later.comparable_id=e.comparable_id and (later.reviewed_at,later.id)>(e.reviewed_at,e.id)));
