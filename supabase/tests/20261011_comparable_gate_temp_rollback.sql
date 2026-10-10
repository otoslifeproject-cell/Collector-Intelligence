-- Rollback-only regression executed successfully 2026-10-11 against bwdafrwkimjvwfoqomot.
-- Negative promotion is rejected; provisional estimate is accepted. No persistent fixture rows.
BEGIN;
CREATE TEMP TABLE gate_test_comparables (LIKE public.comparables INCLUDING DEFAULTS) ON COMMIT DROP;
CREATE TRIGGER gate_test BEFORE INSERT OR UPDATE OF verification_status,price_type,price,currency,source_reference,source_url,owner_id ON gate_test_comparables FOR EACH ROW EXECUTE FUNCTION public.enforce_comparable_promotion();
DO $$
DECLARE rejected boolean := false;
BEGIN
 BEGIN
  INSERT INTO gate_test_comparables(id,owner_id,item_id,venue,source_reference,price_type,price,currency,description,verification_status)
  VALUES(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),'TEST ONLY','TEST LOT','HAMMER_REALIZED',99,'GBP','TEST ONLY','VERIFIED_DIRECT');
 EXCEPTION WHEN raise_exception THEN
  rejected := SQLERRM LIKE 'COMPARABLE_GATE:%';
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'FAIL: unreviewed verified promotion accepted'; END IF;
 INSERT INTO gate_test_comparables(id,owner_id,item_id,venue,source_reference,price_type,price,currency,description,verification_status)
 VALUES(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),'TEST ONLY','TEST LOT','AUCTION_ESTIMATE',99,'GBP','TEST ONLY','UNVERIFIED');
 RAISE NOTICE 'PASS: unreviewed promotion rejected; provisional estimate accepted';
END $$;
ROLLBACK;
-- PENDING: approved source, revocation, cross-owner RLS and mutation fixtures.
