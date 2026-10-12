-- Applied to bwdafrwkimjvwfoqomot on 2026-10-12. An archive object may be linked to at most one source-check record.
create unique index if not exists comparable_source_checks_archive_unique_v1
on public.comparable_source_checks (archive_reference)
where archive_reference is not null;
