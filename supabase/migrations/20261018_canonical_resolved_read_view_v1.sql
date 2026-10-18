-- 2026-10-18: non-destructive canonical source resolution.
-- Historical canonical_documents rows are intentionally NOT modified or deleted.
-- Explicitly pin governing v4.0 hashes until a reviewed governance update.
-- SECURITY INVOKER: retain owner-scoped canonical_documents RLS (Postgres 15+).
create or replace view public.ci_canonical_resolved_v1
with (security_invoker=true)
as
with eligible as (
  select d.id, d.owner_id, d.document_key, d.source_class, d.authority_rank,
         d.title, d.content, d.content_sha256, d.source_path,
         d.source_version, d.ingested_at,
         row_number() over (
           partition by d.owner_id, d.document_key
           order by d.ingested_at desc, d.id desc
         ) as source_rank
  from public.canonical_documents d
  where d.is_current = true
    and length(d.content) >= 400
    and d.content not like 'No readable content%'
    and (
      (d.document_key = '02_MASTER_PROJECT_BRIEF.md'
       and d.source_version = '4.0'
       and d.content_sha256 = '4237146b7142b62f9bc423fcbbb42d3205899eef67ca8135cf7dc066904292a2')
      or
      (d.document_key = '03_SOURCE_AND_EVIDENCE_POLICY.md'
       and d.source_version = '4.0'
       and d.content_sha256 = '1eeab79c9ac903ff7ca69b6dcf15f9c38a9e2a273698e910c7926dd60e74b7e4')
      or d.document_key not in ('02_MASTER_PROJECT_BRIEF.md','03_SOURCE_AND_EVIDENCE_POLICY.md')
    )
)
select id,owner_id,document_key,source_class,authority_rank,title,
       content,content_sha256,source_path,source_version,ingested_at
from eligible where source_rank=1;

revoke all on public.ci_canonical_resolved_v1 from public, anon;
grant select on public.ci_canonical_resolved_v1 to authenticated;

comment on view public.ci_canonical_resolved_v1 is
'Owner-RLS-scoped, non-destructive canonical read projection; one valid row per document key with pinned validated v4 policy hashes. Historical is_current flags remain untouched.';
