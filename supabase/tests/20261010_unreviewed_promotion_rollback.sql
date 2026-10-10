-- Collector Intelligence trust-gate regression. Run only on the intended Supabase project.
-- The final intentional exception rolls back the entire transaction; historical records are not modified.
-- Expected error after successfully asserting the gate: ROLLBACK_TEST_TRANSACTION
DO $$
DECLARE test_record record; blocked boolean := false;
BEGIN
  SELECT id,owner_id INTO test_record FROM public.knowledge_records ORDER BY created_at LIMIT 1;
  IF test_record.id IS NULL THEN RAISE EXCEPTION 'NO_FIXTURE: requires at least one knowledge record'; END IF;

  BEGIN
    UPDATE public.knowledge_records SET verification_status='UNVERIFIED' WHERE id=test_record.id;
    UPDATE public.knowledge_records SET verification_status='VERIFIED_DIRECT' WHERE id=test_record.id;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'EVIDENCE_GATE:%' THEN blocked:=true;
    ELSE RAISE; END IF;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'GATE_FAILURE: unreviewed promotion was accepted'; END IF;

  IF (SELECT count(*) FROM public.trusted_knowledge_v1 WHERE id=test_record.id) <> 0
  THEN RAISE EXCEPTION 'VIEW_FAILURE: unreviewed claim appeared in trusted view'; END IF;

  RAISE NOTICE 'SUCCESS: unreviewed promotion blocked and trusted view excludes test record';
  RAISE EXCEPTION 'ROLLBACK_TEST_TRANSACTION';
END $$;
