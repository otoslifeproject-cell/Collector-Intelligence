-- Evidence promotion gate v1: applied to Supabase bwdafrwkimjvwfoqomot on 2026-10-10.
-- Backwards-compatible: historical VERIFIED_DIRECT labels remain unchanged, but are absent from trusted_knowledge_v1 until separately reviewed.
create table if not exists public.evidence_reviews (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 knowledge_record_id uuid not null references public.knowledge_records(id) on delete restrict,
 decision text not null check (decision in ('APPROVED','REJECTED','NEEDS_WORK')),
 evidence_kind text not null check (evidence_kind in ('PRIMARY_DOCUMENT','ORIGINAL_SALE_RESULT','PHYSICAL_OBJECT','RECOGNISED_SPECIALIST','OTHER')),
 original_source_url text,
 original_source_reference text,
 verification_method text not null,
 reviewer_id uuid not null references auth.users(id),
 reviewed_at timestamptz not null default now(),
 notes text,
 check (decision <> 'APPROVED' or (nullif(trim(verification_method),'') is not null and (nullif(trim(coalesce(original_source_url,'')),'') is not null or nullif(trim(coalesce(original_source_reference,'')),'') is not null))),
 unique(id,knowledge_record_id)
);
create index if not exists evidence_reviews_knowledge_idx on public.evidence_reviews(owner_id,knowledge_record_id,reviewed_at desc);
alter table public.evidence_reviews enable row level security;
drop policy if exists evidence_reviews_owner_read on public.evidence_reviews;
create policy evidence_reviews_owner_read on public.evidence_reviews for select to authenticated using(owner_id=(select auth.uid()));
drop policy if exists evidence_reviews_owner_insert on public.evidence_reviews;
create policy evidence_reviews_owner_insert on public.evidence_reviews for insert to authenticated with check(owner_id=(select auth.uid()) and reviewer_id=(select auth.uid()) and exists(select 1 from public.knowledge_records k where k.id=knowledge_record_id and k.owner_id=(select auth.uid())));
create or replace function public.require_evidence_review_for_promotion() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if new.verification_status='VERIFIED_DIRECT' and (tg_op='INSERT' or old.verification_status is distinct from 'VERIFIED_DIRECT') then
   if not exists (select 1 from public.evidence_reviews e where e.knowledge_record_id=new.id and e.owner_id=new.owner_id and e.decision='APPROVED'
     and not exists (select 1 from public.evidence_reviews newer where newer.knowledge_record_id=e.knowledge_record_id and (newer.reviewed_at,newer.id)>(e.reviewed_at,e.id))) then
     raise exception 'EVIDENCE_GATE: independent approved evidence review required before VERIFIED_DIRECT promotion';
   end if;
 end if;
 return new;
end $$;
drop trigger if exists knowledge_require_review_for_promotion on public.knowledge_records;
create trigger knowledge_require_review_for_promotion before insert or update of verification_status on public.knowledge_records for each row execute function public.require_evidence_review_for_promotion();
create or replace view public.trusted_knowledge_v1 with (security_invoker=true) as
select k.* from public.knowledge_records k where k.verification_status='VERIFIED_DIRECT' and exists (
 select 1 from public.evidence_reviews e where e.knowledge_record_id=k.id and e.owner_id=k.owner_id and e.decision='APPROVED'
 and not exists(select 1 from public.evidence_reviews newer where newer.knowledge_record_id=e.knowledge_record_id and (newer.reviewed_at,newer.id)>(e.reviewed_at,e.id))
);
