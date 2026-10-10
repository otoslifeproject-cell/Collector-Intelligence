-- Append-only recovery ledger for historical conversation sources.
-- Already applied to project bwdafrwkimjvwfoqomot on 2026-10-10.
create extension if not exists pgcrypto;
create table if not exists public.conversation_sources (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 source_title text not null,
 source_format text not null check(source_format in ('PDF','MARKDOWN','TXT','CHAT_EXPORT','OTHER')),
 source_sha256 text not null check(source_sha256 ~ '^[0-9a-f]{64}$'),
 source_uri text,
 source_size_bytes bigint,
 captured_at timestamptz not null default now(),
 extraction_status text not null default 'PENDING' check(extraction_status in ('PENDING','EXTRACTED','PARTIAL','ERROR')),
 verification_status text not null default 'UNVERIFIED',
 notes text,
 unique(owner_id,source_sha256)
);
create table if not exists public.conversation_claims (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 source_id uuid not null references public.conversation_sources(id) on delete restrict,
 source_locator text not null,
 subject_key text not null,
 claim_text text not null,
 claim_type text not null check(claim_type in ('OBSERVATION','ATTRIBUTION','DATE','PRICE','SOURCE_LEAD','ERROR_LESSON','PRODUCT_DECISION','OTHER')),
 certainty text not null default 'UNVERIFIED' check(certainty in ('UNVERIFIED','POSSIBLE','STRONG','VERIFIED_EXTERNAL')),
 authority_type text not null default 'HISTORICAL_CHAT',
 source_url text,
 supersedes_id uuid references public.conversation_claims(id),
 extraction_method text not null default 'MANUAL_REVIEW',
 notes text,
 created_at timestamptz not null default now()
);
alter table public.conversation_sources enable row level security;
alter table public.conversation_claims enable row level security;
drop policy if exists owner_conversation_sources_read on public.conversation_sources;
drop policy if exists owner_conversation_claims_read on public.conversation_claims;
create policy owner_conversation_sources_read on public.conversation_sources for select to authenticated using(owner_id=(select auth.uid()));
create policy owner_conversation_claims_read on public.conversation_claims for select to authenticated using(owner_id=(select auth.uid()));
create index if not exists conversation_claims_source_idx on public.conversation_claims(owner_id,source_id);
create index if not exists conversation_claims_subject_idx on public.conversation_claims(owner_id,lower(subject_key));
create unique index if not exists conversation_claims_dedup_idx on public.conversation_claims(owner_id,source_id,source_locator,md5(claim_text));
create unique index if not exists conversation_claims_one_successor_idx on public.conversation_claims(supersedes_id) where supersedes_id is not null;
