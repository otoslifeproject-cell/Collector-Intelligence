-- Recovery / reviewed schema for changes already deployed to Collector Intelligence.
-- Project bwdafrwkimjvwfoqomot. All source content migration happens separately.
-- Never INSERT user-owned object attributions as FACT during document import.
create extension if not exists pgcrypto;
create table if not exists public.canonical_documents(
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 document_key text not null,
 source_class text not null check (source_class in ('CANONICAL_POLICY','WORKFLOW_SKILL','CATEGORY_PLAYBOOK','PROJECT_BUILD_BRIEF','OPERATIONAL_LOG')),
 authority_rank integer not null default 50 check(authority_rank between 0 and 100),
 title text not null,
 content text not null,
 content_sha256 text not null,
 source_path text not null,
 source_version text,
 ingested_at timestamptz not null default now(),
 is_current boolean not null default true,
 unique(owner_id,document_key,content_sha256)
);
create or replace function public.ci_canonical_hash() returns trigger
language plpgsql set search_path=pg_catalog,public,extensions as $$
begin
 new.content_sha256 := encode(digest(convert_to(new.content,'UTF8'),'sha256'),'hex');
 return new;
end $$;
drop trigger if exists canonical_hash_on_write on public.canonical_documents;
create trigger canonical_hash_on_write before insert or update of content on public.canonical_documents
 for each row execute function public.ci_canonical_hash();

create or replace function public.ci_canonical_reject_mutations() returns trigger
language plpgsql set search_path=pg_catalog,public,extensions as $$
begin
 if current_user not in ('postgres','supabase_admin') then
   raise exception 'Canonical document versions cannot be edited or deleted by app clients';
 end if;
 return coalesce(new,old);
end $$;
drop trigger if exists canonical_no_update_or_delete on public.canonical_documents;
create trigger canonical_no_update_or_delete before update or delete on public.canonical_documents
 for each row execute function public.ci_canonical_reject_mutations();

alter table public.canonical_documents enable row level security;
drop policy if exists canonical_documents_owner_all on public.canonical_documents;
drop policy if exists canonical_documents_owner_insert on public.canonical_documents;
drop policy if exists canonical_documents_owner_read on public.canonical_documents;
create policy canonical_documents_owner_read on public.canonical_documents
 for select to authenticated using(owner_id=(select auth.uid()));
create index if not exists canonical_documents_owner_current on public.canonical_documents(owner_id,source_class,is_current);
create index if not exists canonical_documents_latest_by_key on public.canonical_documents(owner_id,document_key,ingested_at desc);

create table if not exists public.intake_photo_sessions(
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 storage_bucket text not null default 'item-images',
 session_key text not null,
 first_uploaded_at timestamptz not null,
 last_uploaded_at timestamptz not null,
 photo_count integer not null check(photo_count>0),
 image_manifest jsonb not null,
 linked_analysis_run uuid references public.ai_analysis_runs(id) on delete set null,
 link_method text not null default 'UNMATCHED',
 captured_at timestamptz not null default now(),
 unique(owner_id,session_key)
);
alter table public.intake_photo_sessions enable row level security;
drop policy if exists intake_photo_sessions_read_owner on public.intake_photo_sessions;
create policy intake_photo_sessions_read_owner on public.intake_photo_sessions
 for select to authenticated using(owner_id=(select auth.uid()));
create index if not exists intake_photo_sessions_owner_recent on public.intake_photo_sessions(owner_id,last_uploaded_at desc);
create index if not exists intake_photo_sessions_linked_run_idx on public.intake_photo_sessions(linked_analysis_run);
alter table public.ci_migration_history enable row level security;
-- No client-access policy on migration history: privileged administrators only.
