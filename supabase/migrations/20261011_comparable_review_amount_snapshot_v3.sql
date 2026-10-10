-- Applied to bwdafrwkimjvwfoqomot on 2026-10-11. Approved review snapshots original sale's amount/currency/basis.
alter table public.comparable_evidence_reviews add column if not exists reviewed_price numeric;
alter table public.comparable_evidence_reviews add column if not exists reviewed_currency text;
alter table public.comparable_evidence_reviews add column if not exists reviewed_price_type text;
alter table public.comparable_evidence_reviews drop constraint if exists comparable_evidence_reviews_approved_snapshot_check;
alter table public.comparable_evidence_reviews add constraint comparable_evidence_reviews_approved_snapshot_check
check (decision <> 'APPROVED' or (reviewed_price is not null and reviewed_price>=0 and nullif(trim(coalesce(reviewed_currency,'')),'') is not null and nullif(trim(coalesce(reviewed_price_type,'')),'') is not null));
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
    or new.price is distinct from e.reviewed_price
    or new.currency is distinct from e.reviewed_currency
    or new.price_type is distinct from e.reviewed_price_type
    or new.price is null or new.price < 0
    or nullif(trim(coalesce(new.source_reference,'')),'') is null
    or (nullif(trim(coalesce(e.original_lot_reference,'')),'') is distinct from nullif(trim(coalesce(new.source_reference,'')),'')
     and nullif(trim(coalesce(e.original_lot_url,'')),'') is distinct from nullif(trim(coalesce(new.source_url,'')),''))
  then raise exception 'COMPARABLE_GATE: matching approved original lot, price, currency and price basis required';
  end if;
 end if;
 return new;
end $$;
create or replace view public.trusted_comparables_v1 with (security_invoker=true) as
 select c.* from public.comparables c
 where c.verification_status='VERIFIED_DIRECT' and c.price is not null and c.price>=0
 and exists(select 1 from public.comparable_evidence_reviews e where e.comparable_id=c.id and e.owner_id=c.owner_id and e.decision='APPROVED'
 and e.reviewed_price=c.price and e.reviewed_currency=c.currency and e.reviewed_price_type=c.price_type
 and ((c.price_type='HAMMER_REALIZED' and e.result_observed='HAMMER')
 or (c.price_type='REALIZED_INCL_BP' and e.result_observed='INCLUSIVE_REALIZED')
 or (c.price_type in ('MARKETPLACE_SOLD','DEALER_SOLD_CONFIRMED') and e.result_observed='CONFIRMED_MARKETPLACE_SOLD'))
 and (nullif(trim(coalesce(e.original_lot_reference,'')),'')=nullif(trim(coalesce(c.source_reference,'')),'')
 or nullif(trim(coalesce(e.original_lot_url,'')),'')=nullif(trim(coalesce(c.source_url,'')),''))
 and not exists(select 1 from public.comparable_evidence_reviews later where later.comparable_id=e.comparable_id and (later.reviewed_at,later.id)>(e.reviewed_at,e.id)));
