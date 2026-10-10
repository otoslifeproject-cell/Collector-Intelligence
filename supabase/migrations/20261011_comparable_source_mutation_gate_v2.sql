-- Comparable trust-gate hardening v2. Applied to bwdafrwkimjvwfoqomot on 2026-10-11.
-- Rechecks VERIFIED_DIRECT rows whenever price or citation fields change.
create or replace function public.enforce_comparable_promotion()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare evidence record;
begin
 if new.verification_status='VERIFIED_DIRECT' then
  select e.* into evidence from public.comparable_evidence_reviews e
   where e.comparable_id=new.id and e.owner_id=new.owner_id
   order by e.reviewed_at desc,e.id desc limit 1;
  if evidence.id is null or evidence.decision<>'APPROVED'
   or not ((new.price_type='HAMMER_REALIZED' and evidence.result_observed='HAMMER')
    or (new.price_type='REALIZED_INCL_BP' and evidence.result_observed='INCLUSIVE_REALIZED')
    or (new.price_type in ('MARKETPLACE_SOLD','DEALER_SOLD_CONFIRMED') and evidence.result_observed='CONFIRMED_MARKETPLACE_SOLD'))
   or new.price is null or new.price<0 or nullif(trim(coalesce(new.currency,'')),'') is null
   or nullif(trim(coalesce(new.source_reference,'')),'') is null
   or (nullif(trim(coalesce(evidence.original_lot_reference,'')),'') is distinct from nullif(trim(coalesce(new.source_reference,'')),'')
       and nullif(trim(coalesce(evidence.original_lot_url,'')),'') is distinct from nullif(trim(coalesce(new.source_url,'')),''))
   then raise exception 'COMPARABLE_GATE: latest approved matching source review, sale basis, amount and currency required';
  end if;
 end if;
 return new;
end $$;
drop trigger if exists comparable_require_review_on_promotion on public.comparables;
create trigger comparable_require_review_on_promotion
 before insert or update of verification_status,price_type,price,currency,source_reference,source_url,owner_id on public.comparables
 for each row execute function public.enforce_comparable_promotion();
create or replace view public.trusted_comparables_v1 with (security_invoker=true) as
 select c.* from public.comparables c where c.verification_status='VERIFIED_DIRECT'
 and c.price is not null and c.price>=0 and nullif(trim(coalesce(c.currency,'')),'') is not null
 and c.price_type in ('HAMMER_REALIZED','REALIZED_INCL_BP','MARKETPLACE_SOLD','DEALER_SOLD_CONFIRMED')
 and exists(select 1 from public.comparable_evidence_reviews e
 where e.comparable_id=c.id and e.owner_id=c.owner_id and e.decision='APPROVED'
 and ((c.price_type='HAMMER_REALIZED' and e.result_observed='HAMMER')
 or (c.price_type='REALIZED_INCL_BP' and e.result_observed='INCLUSIVE_REALIZED')
 or (c.price_type in ('MARKETPLACE_SOLD','DEALER_SOLD_CONFIRMED') and e.result_observed='CONFIRMED_MARKETPLACE_SOLD'))
 and (nullif(trim(coalesce(e.original_lot_reference,'')),'')=nullif(trim(coalesce(c.source_reference,'')),'')
 or nullif(trim(coalesce(e.original_lot_url,'')),'')=nullif(trim(coalesce(c.source_url,'')),''))
 and not exists(select 1 from public.comparable_evidence_reviews later
 where later.comparable_id=e.comparable_id and (later.reviewed_at,later.id)>(e.reviewed_at,e.id)));
