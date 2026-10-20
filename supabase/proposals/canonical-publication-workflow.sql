-- PREPRODUCTION DESIGN ONLY. Extension of the existing draft ledger, NOT a rollout.
-- Apply only in a disposable PostgreSQL 17 database after the original proposal.
-- No canonical source is seeded, rewritten, approved or deleted by this file.
BEGIN;
DO $guard$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM information_schema.columns
   WHERE table_schema='public' AND table_name='ci_canonical_publication_events'
     AND column_name='publication_sequence')
 AND EXISTS (SELECT 1 FROM public.ci_canonical_publication_events)
 THEN RAISE EXCEPTION 'Cannot infer sequence for an already populated ledger'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='ci_canonical_publisher') THEN
   CREATE ROLE ci_canonical_publisher NOLOGIN NOSUPERUSER NOBYPASSRLS;
 END IF;
END $guard$;
ALTER TABLE public.ci_canonical_publication_events
 ADD COLUMN IF NOT EXISTS publication_sequence bigint GENERATED ALWAYS AS IDENTITY;
CREATE UNIQUE INDEX IF NOT EXISTS ci_publication_sequence_unique
 ON public.ci_canonical_publication_events(publication_sequence);

-- An APPROVE may replace a different document; a REVOKE must target its approval.
CREATE OR REPLACE FUNCTION public.ci_validate_publication_event()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public,extensions AS $$
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
     AND (NEW.event_kind='APPROVE' OR
       (previous.event_kind='APPROVE' AND previous.document_id=NEW.document_id))
 ) THEN RAISE EXCEPTION 'Invalid predecessor approval'; END IF;
 IF NEW.document_key='02_MASTER_PROJECT_BRIEF.md'
 AND (NEW.source_version<>'4.0' OR NEW.content_sha256<>'4237146b7142b62f9bc423fcbbb42d3205899eef67ca8135cf7dc066904292a2')
 THEN RAISE EXCEPTION 'Unapproved Master policy'; END IF;
 IF NEW.document_key='03_SOURCE_AND_EVIDENCE_POLICY.md'
 AND (NEW.source_version<>'4.0' OR NEW.content_sha256<>'1eeab79c9ac903ff7ca69b6dcf15f9c38a9e2a273698e910c7926dd60e74b7e4')
 THEN RAISE EXCEPTION 'Unapproved Evidence policy'; END IF;
 RETURN NEW;
END;$$;

-- Only the currently latest APPROVE can be activated. A later REVOKE invalidates it.
CREATE OR REPLACE FUNCTION public.ci_validate_active_approval()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public,extensions AS $$
BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM public.ci_canonical_publication_events e
   JOIN public.canonical_documents d ON d.id=e.document_id
     AND d.owner_id=e.owner_id AND d.document_key=e.document_key
   WHERE e.id=NEW.event_id AND e.owner_id=NEW.owner_id
     AND e.document_key=NEW.document_key AND e.event_kind='APPROVE'
     AND e.content_sha256=d.content_sha256
     AND e.source_version IS NOT DISTINCT FROM d.source_version
     AND encode(digest(convert_to(d.content,'UTF8'),'sha256'),'hex')=e.content_sha256
     AND length(d.content)>=400 AND d.content NOT LIKE 'No readable content%'
     AND NOT EXISTS (SELECT 1 FROM public.ci_canonical_publication_events later
       WHERE later.owner_id=e.owner_id AND later.document_key=e.document_key
         AND later.publication_sequence>e.publication_sequence)
 ) THEN RAISE EXCEPTION 'Invalid approved document event'; END IF;
 RETURN NEW;
END;$$;

CREATE SCHEMA IF NOT EXISTS ci_private;
REVOKE ALL ON SCHEMA ci_private FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA ci_private TO ci_canonical_publisher;

-- Privileged publication is deliberately outside the exposed public schema.
-- No table DML is granted to the publisher; the narrow function must cross RLS.
-- Derive owner/reviewer from the verified database auth context, never an API owner argument.
-- Role membership/credential provisioning and review authority are separate rollout gates.
CREATE OR REPLACE FUNCTION ci_private.publish_canonical(
 p_document_id uuid, p_event_kind text, p_expected_event_id uuid, p_review_reference text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,extensions AS $$
DECLARE
 actor uuid := auth.uid();
 source public.canonical_documents%ROWTYPE;
 previous_id uuid;
 previous_kind text;
 previous_document_id uuid;
 new_id uuid;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Authenticated publisher required' USING ERRCODE='42501'; END IF;
 IF p_event_kind IS NULL OR p_event_kind NOT IN ('APPROVE','REVOKE')
   OR p_review_reference IS NULL OR length(btrim(p_review_reference))=0
 THEN RAISE EXCEPTION 'Invalid publication request' USING ERRCODE='22023'; END IF;
 SELECT * INTO source FROM public.canonical_documents WHERE id=p_document_id AND owner_id=actor;
 IF NOT FOUND THEN RAISE EXCEPTION 'Owner source not found' USING ERRCODE='42501'; END IF;
 -- Lock even the first publication (there is no pointer row to lock yet).
 PERFORM pg_advisory_xact_lock(hashtextextended(actor::text||':'||source.document_key,0));
 SELECT id,event_kind,document_id INTO previous_id,previous_kind,previous_document_id
 FROM public.ci_canonical_publication_events
 WHERE owner_id=actor AND document_key=source.document_key
 ORDER BY publication_sequence DESC LIMIT 1;
 IF previous_id IS DISTINCT FROM p_expected_event_id
 THEN RAISE EXCEPTION 'Publication predecessor changed' USING ERRCODE='40001'; END IF;
 IF p_event_kind='REVOKE' AND
   (previous_kind IS DISTINCT FROM 'APPROVE' OR previous_document_id IS DISTINCT FROM source.id)
 THEN RAISE EXCEPTION 'Revocation must target current approval' USING ERRCODE='22023'; END IF;
 INSERT INTO public.ci_canonical_publication_events
   (owner_id,document_key,document_id,source_version,content_sha256,event_kind,
    recorded_by,review_reference,supersedes_event_id)
 VALUES (actor,source.document_key,source.id,source.source_version,source.content_sha256,
   p_event_kind,actor,p_review_reference,previous_id) RETURNING id INTO new_id;
 IF p_event_kind='APPROVE' THEN
   INSERT INTO public.ci_canonical_active_approvals(owner_id,document_key,event_id)
   VALUES(actor,source.document_key,new_id)
   ON CONFLICT(owner_id,document_key) DO UPDATE SET event_id=EXCLUDED.event_id;
 ELSE
   DELETE FROM public.ci_canonical_active_approvals
   WHERE owner_id=actor AND document_key=source.document_key;
 END IF;
 RETURN new_id;
END;$$;
REVOKE ALL ON FUNCTION ci_private.publish_canonical(uuid,text,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION ci_private.publish_canonical(uuid,text,uuid,text) TO ci_canonical_publisher;

DROP POLICY IF EXISTS ci_publication_events_owner_read ON public.ci_canonical_publication_events;
CREATE POLICY ci_publication_events_owner_read ON public.ci_canonical_publication_events
 FOR SELECT TO authenticated USING(owner_id=(SELECT auth.uid()));
DROP POLICY IF EXISTS ci_active_approvals_owner_read ON public.ci_canonical_active_approvals;
CREATE POLICY ci_active_approvals_owner_read ON public.ci_canonical_active_approvals
 FOR SELECT TO authenticated USING(owner_id=(SELECT auth.uid()));
GRANT SELECT ON public.ci_canonical_publication_events,public.ci_canonical_active_approvals TO authenticated;

CREATE OR REPLACE VIEW public.ci_canonical_approved_v1 WITH (security_invoker=true) AS
SELECT d.id,d.owner_id,d.document_key,d.source_version,d.content_sha256,d.content,
       e.id AS approval_event_id,e.publication_sequence
FROM public.ci_canonical_active_approvals a
JOIN public.ci_canonical_publication_events e
 ON e.id=a.event_id AND e.owner_id=a.owner_id AND e.document_key=a.document_key
JOIN public.canonical_documents d
 ON d.id=e.document_id AND d.owner_id=e.owner_id AND d.document_key=e.document_key
WHERE a.owner_id=(SELECT auth.uid()) AND e.event_kind='APPROVE'
 AND d.source_version IS NOT DISTINCT FROM e.source_version
 AND d.content_sha256=e.content_sha256
 AND encode(extensions.digest(convert_to(d.content,'UTF8'),'sha256'),'hex')=e.content_sha256
 AND length(d.content)>=400 AND d.content NOT LIKE 'No readable content%'
 AND NOT EXISTS(SELECT 1 FROM public.ci_canonical_publication_events later
   WHERE later.owner_id=e.owner_id AND later.document_key=e.document_key
     AND later.publication_sequence>e.publication_sequence);
REVOKE ALL ON public.ci_canonical_approved_v1 FROM PUBLIC,anon;
GRANT SELECT ON public.ci_canonical_approved_v1 TO authenticated;
COMMIT;
