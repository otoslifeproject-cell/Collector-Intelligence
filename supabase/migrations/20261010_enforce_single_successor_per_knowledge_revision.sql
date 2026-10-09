-- Each historical Knowledge Brain revision can have at most one successor.
-- Prevent competing 'latest' claims in simultaneous review sessions.
create unique index if not exists knowledge_records_one_successor_per_revision
  on public.knowledge_records (supersedes_id)
  where supersedes_id is not null;
