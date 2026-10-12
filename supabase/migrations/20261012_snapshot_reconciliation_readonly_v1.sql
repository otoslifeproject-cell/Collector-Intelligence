-- Applied to Supabase bwdafrwkimjvwfoqomot, 2026-10-12.
-- Read-only inventory: no deletion and no upgrade to trusted evidence.
create or replace view public.snapshot_reconciliation_v1 with (security_invoker=true) as
select o.id, o.name, o.created_at, o.updated_at,
  exists(select 1 from public.comparable_source_checks c
         where c.archive_reference='supabase://comparable-source-snapshots/'||o.name) as has_source_check
from storage.objects o
where o.bucket_id='comparable-source-snapshots';
