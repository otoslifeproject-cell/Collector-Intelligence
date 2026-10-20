-- PREPRODUCTION PROPOSAL ONLY. Requires isolated PostgreSQL 17+/Supabase RLS testing before deploy.
-- Preserves existing canonical_documents and prior document bytes.
BEGIN;
CREATE TABLE IF NOT EXISTS public.ci_canonical_publication_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  document_key text NOT NULL,
  document_id uuid NOT NULL REFERENCES public.canonical_documents(id) ON DELETE RESTRICT,
  source_version text NOT NULL,
  content_sha256 text NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  review_reference text NOT NULL CHECK (length(btrim(review_reference)) > 0),
  event_kind text NOT NULL CHECK (event_kind IN ('APPROVE','REVOKE')),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid NOT NULL,
  supersedes_event_id uuid REFERENCES public.ci_canonical_publication_events(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS ci_publication_events_owner_key_time
  ON public.ci_canonical_publication_events(owner_id,document_key,recorded_at DESC,id DESC);
ALTER TABLE public.ci_canonical_publication_events ENABLE ROW LEVEL SECURITY;
-- No client INSERT/UPDATE/DELETE privileges. Publishing requires a separately audited privileged transaction.
REVOKE ALL ON public.ci_canonical_publication_events FROM PUBLIC,anon,authenticated;
-- Reviewer ledger access is intentionally not granted until tested owner-scoped access mechanism exists.
-- Never select latest event by time as a fallback for active authority.
CREATE TABLE IF NOT EXISTS public.ci_canonical_active_approvals (
  owner_id uuid NOT NULL,
  document_key text NOT NULL,
  event_id uuid NOT NULL UNIQUE REFERENCES public.ci_canonical_publication_events(id) ON DELETE RESTRICT,
  PRIMARY KEY(owner_id,document_key)
);
ALTER TABLE public.ci_canonical_active_approvals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ci_canonical_active_approvals FROM PUBLIC,anon,authenticated;
-- Read grant/RLS publication gate must be developed and tested in staging before use.
-- No existing sources are automatically approved, and no existing canonical row is changed.
COMMIT;
