-- Applied 2026-10-11 to Supabase bwdafrwkimjvwfoqomot. Reject direct verified-price promotion without latest approved matching review.
create or replace function public.enforce_comparable_promotion()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare evidence record;
begin
 if new.verification_status='VERIFIED_DIRECT' and (tg_op='INSERT' or old.verification_status is distinct from 'VERIFIED_DIRECT') then
  select e.* into evidence from public.comparable_evidence_reviews e
   where e.comparable_id=new.id and e.owner_id=new.owner_id
   order by e.reviewed_at desc,e.id desc limit 1;
  if evidence.id is null or evidence.decision<>'APPROVED'
   or not (
    (new.price_type='HAMMER_REALIZED' and evidence.result_observed='HAMMER') or
    (new.price_type='REALIZED_INCL_BP' and evidence.result_observed='INCLUSIVE_REALIZED') or
    (new.price_type in ('MARKETPLACE_SOLD','DEALER_SOLD_CONFIRMED') and evidence.result_observed='CONFIRMED_MARKETPLACE_SOLD')
   )
   or new.price is null or new.price < 0
   or nullif(trim(coalesce(new.currency,'')),'') is null
   or nullif(trim(coalesce(new.source_reference,new.source_url,'')),'') is null
   then raise exception 'COMPARABLE_GATE: latest approved source review, sale basis, amount, currency and citation required';
  end if;
 end if;
 return new;
end $$;
drop trigger if exists comparable_require_review_on_promotion on public.comparables;
create trigger comparable_require_review_on_promotion
 before insert or update of verification_status on public.comparables
 for each row execute function public.enforce_comparable_promotion();
