-- PREPRODUCTION DESIGN ONLY: NOT APPROVED FOR APPLICATION TO PRODUCTION.
-- Requires isolated PostgreSQL 17+ test, verified RLS, publication race and rollback tests.
BEGIN;
-- Canonical rows are preserved. Composite identity ensures owner/key cannot be swapped.
CREATE UNIQUE INDEX IF NOT EXISTS ci_canonical_docs_identity
 ON public.canonical_documents(id,owner_id,document_key);
CREATE TABLE IF NOT EXISTS public.ci_canonical_publication_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL,
 document_key text NOT NULL,
 document_id uuid NOT NULL,
 source_version text NOT NULL,
 content_sha256 text NOT NULL CHECK(content_sha256 ~ '^[0-9a-f]{64}$'),
 event_kind text NOT NULL CHECK(event_kind IN ('APPROVE','REVOKE')),
 recorded_at timestamptz NOT NULL DEFAULT now(),
 recorded_by uuid NOT NULL,
 review_reference text NOT NULL CHECK(length(btrim(review_reference))>0),
 supersedes_event_id uuid,
 CONSTRAINT ci_event_document_owner_fk FOREIGN KEY(document_id,owner_id,document_key)
  REFERENCES public.canonical_documents(id,owner_id,document_key) ON DELETE RESTRICT,
 CONSTRAINT ci_event_identity_unique UNIQUE(id,owner_id,document_key),
 CONSTRAINT ci_event_predecessor_fk FOREIGN KEY(supersedes_event_id,owner_id,document_key)
  REFERENCES public.ci_canonical_publication_events(id,owner_id,document_key)
);
CREATE INDEX IF NOT EXISTS ci_publication_events_owner_key_time
 ON public.ci_canonical_publication_events(owner_id,document_key,recorded_at DESC,id DESC);
CREATE OR REPLACE FUNCTION public.ci_reject_publication_event_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 RAISE EXCEPTION 'Publication events are immutable';
END;$$;
DROP TRIGGER IF EXISTS ci_publication_events_immutable ON public.ci_canonical_publication_events;
CREATE TRIGGER ci_publication_events_immutable BEFORE UPDATE OR DELETE
 ON public.ci_canonical_publication_events FOR EACH ROW
 EXECUTE FUNCTION public.ci_reject_publication_event_mutation();
CREATE TABLE IF NOT EXISTS public.ci_canonical_active_approvals (
 owner_id uuid NOT NULL,
 document_key text NOT NULL,
 event_id uuid NOT NULL UNIQUE,
 CONSTRAINT ci_active_owner_key_pk PRIMARY KEY(owner_id,document_key),
 CONSTRAINT ci_active_matching_event_fk FOREIGN KEY(event_id,owner_id,document_key)
  REFERENCES public.ci_canonical_publication_events(id,owner_id,document_key) ON DELETE RESTRICT
);
-- Prevent activating a REVOKE event as an approved source pointer.
-- Approval events must be bound to their exact immutable source bytes at INSERT.
-- The canonical_documents hash trigger's own crypto schema must be checked in staging.
CREATE OR REPLACE FUNCTION public.ci_validate_publication_event()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public,extensions AS $
DECLARE actual_hash text;
BEGIN
 SELECT encode(digest(convert_to(d.content,'UTF8'),'sha256'),'hex')
 INTO actual_hash FROM public.canonical_documents d
 WHERE d.id=NEW.document_id AND d.owner_id=NEW.owner_id
   AND d.document_key=NEW.document_key
   AND d.source_version IS NOT DISTINCT FROM NEW.source_version
   AND d.content_sha256=NEW.content_sha256
   AND length(d.content)>=400 AND d.content NOT LIKE 'No readable content%';
 IF actual_hash IS NULL OR actual_hash<>NEW.content_sha256
 THEN RAISE EXCEPTION 'Publication event source mismatch'; END IF;
 IF NEW.event_kind='REVOKE' AND NEW.supersedes_event_id IS NULL
 THEN RAISE EXCEPTION 'Revocation requires predecessor'; END IF;
 IF NEW.supersedes_event_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM public.ci_canonical_publication_events previous
  WHERE previous.id=NEW.supersedes_event_id AND previous.owner_id=NEW.owner_id
    AND previous.document_key=NEW.document_key
    AND previous.event_kind='APPROVE'
    AND previous.document_id=NEW.document_id
 ) THEN RAISE EXCEPTION 'Invalid predecessor approval'; END IF;
 IF NEW.document_key='02_MASTER_PROJECT_BRIEF.md'
 AND (NEW.source_version<>'4.0' OR NEW.content_sha256<>'4237146b7142b62f9bc423fcbbb42d3205899eef67ca8135cf7dc066904292a2')
 THEN RAISE EXCEPTION 'Unapproved Master policy'; END IF;
 IF NEW.document_key='03_SOURCE_AND_EVIDENCE_POLICY.md'
 AND (NEW.source_version<>'4.0' OR NEW.content_sha256<>'1eeab79c9ac903ff7ca69b6dcf15f9c38a9e2a273698e910c7926dd60e74b7e4')
 THEN RAISE EXCEPTION 'Unapproved Evidence policy'; END IF;
 RETURN NEW;
END;$;
DROP TRIGGER IF EXISTS ci_publication_event_valid ON public.ci_canonical_publication_events;
CREATE TRIGGER ci_publication_event_valid BEFORE INSERT
 ON public.ci_canonical_publication_events FOR EACH ROW
 EXECUTE FUNCTION public.ci_validate_publication_event();
CREATE OR REPLACE FUNCTION public.ci_validate_active_approval()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public,extensions AS $
BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM public.ci_canonical_publication_events e
   JOIN public.canonical_documents d ON d.id=e.document_id
   WHERE e.id=NEW.event_id AND e.owner_id=NEW.owner_id
     AND e.document_key=NEW.document_key AND e.event_kind='APPROVE'
     AND e.content_sha256=d.content_sha256
     AND e.source_version IS NOT DISTINCT FROM d.source_version
     AND encode(digest(convert_to(d.content,'UTF8'),'sha256'),'hex')=e.content_sha256
     AND length(d.content)>=400 AND d.content NOT LIKE 'No readable content%'
 ) THEN RAISE EXCEPTION 'Invalid approved document event'; END IF;
 RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS ci_active_approval_valid ON public.ci_canonical_active_approvals;
CREATE TRIGGER ci_active_approval_valid BEFORE INSERT OR UPDATE
 ON public.ci_canonical_active_approvals FOR EACH ROW
 EXECUTE FUNCTION public.ci_validate_active_approval();
ALTER TABLE public.ci_canonical_publication_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ci_canonical_active_approvals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ci_canonical_publication_events FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.ci_canonical_active_approvals FROM PUBLIC,anon,authenticated;
-- No approvals seeded. No client access until staged owner-scoped policy is verified.
-- Grant/read views, publisher-only atomic transaction, REVOCATION semantics, and
-- pinned policy-hash validation require separate review before staging approval.
COMMIT;
