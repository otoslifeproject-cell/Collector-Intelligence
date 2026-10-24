-- PREPRODUCTION safety reversal, not a production data/schema rollback.
-- Stop publication and approved-reader access while RETAINING all evidence/audit rows.
-- Existing application routes are not cut over by this proposal. Never re-enable
-- recency fallback as a rollback strategy. Reapply the workflow proposal to re-enable.
BEGIN;
REVOKE ALL ON FUNCTION ci_private.publish_canonical(uuid,text,uuid,text)
 FROM PUBLIC,anon,authenticated,ci_canonical_publisher;
REVOKE ALL ON public.ci_canonical_approved_v1 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.ci_canonical_publication_events,public.ci_canonical_active_approvals
 FROM PUBLIC,anon,authenticated;
COMMIT;
