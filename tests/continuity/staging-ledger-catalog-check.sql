-- ISOLATED STAGING ONLY: apply AFTER proposed migration, never on CI production.
-- Zero writes; fail loudly if required catalog structures are missing.
DO $check$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace
 WHERE ns.nspname='public' AND c.relname IN
 ('ci_canonical_publication_events','ci_canonical_active_approvals') AND c.relkind='r';
 IF n<>2 THEN RAISE EXCEPTION 'Expected two ledger tables; got %',n; END IF;
 SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace
 WHERE ns.nspname='public' AND c.relname IN
 ('ci_canonical_publication_events','ci_canonical_active_approvals') AND c.relrowsecurity;
 IF n<>2 THEN RAISE EXCEPTION 'RLS missing: %',n; END IF;
 SELECT count(*) INTO n FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
 WHERE c.oid IN ('public.ci_canonical_publication_events'::regclass,
 'public.ci_canonical_active_approvals'::regclass) AND NOT t.tgisinternal
 AND t.tgname IN ('ci_publication_events_immutable','ci_publication_event_valid','ci_active_approval_valid') AND t.tgenabled<>'D';
 IF n<>3 THEN RAISE EXCEPTION 'Expected three enabled protection triggers; got %',n; END IF;
 IF has_table_privilege('anon','public.ci_canonical_publication_events','SELECT')
 OR has_table_privilege('anon','public.ci_canonical_active_approvals','SELECT')
 OR has_table_privilege('authenticated','public.ci_canonical_publication_events','INSERT')
 OR has_table_privilege('authenticated','public.ci_canonical_active_approvals','UPDATE')
 THEN RAISE EXCEPTION 'Unexpected public/client ledger privileges'; END IF;
 RAISE NOTICE 'Catalog gate PASS (not equivalent to owner A/B RLS testing)';
END
$check$;
-- Next phase (requires isolated synthetic auth users and reviewed publication workflow):
-- simulate owner A/B and anon; verify cross-owner denial, immutable event update/delete,
-- foreign-key mismatch denial, hash tampering rejection, revoke semantics, parallel publication,
-- complete keyset reader failure and transaction-safe rollback.
