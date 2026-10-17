-- Correct provider rights after terms review: Met Open Access CC0 is allowed;
-- V&A commercial images/API require licensing and are NOT enabled in default app.
ALTER TABLE public.ai_visual_reference_reviews
  DROP CONSTRAINT IF EXISTS ai_visual_reference_reviews_reference_provider_check,
  DROP CONSTRAINT IF EXISTS ai_visual_reference_reviews_reference_system_number_check,
  DROP CONSTRAINT IF EXISTS ci_reference_url_expected,
  DROP CONSTRAINT IF EXISTS ci_reference_image_host;
ALTER TABLE public.ai_visual_reference_reviews
  ALTER COLUMN reference_provider SET DEFAULT 'The Metropolitan Museum of Art';
ALTER TABLE public.ai_visual_reference_reviews
  ADD CONSTRAINT ci_visual_ref_provider CHECK(
    reference_provider IN ('The Metropolitan Museum of Art','Victoria and Albert Museum')),
  ADD CONSTRAINT ci_visual_ref_id CHECK(
    (reference_provider='The Metropolitan Museum of Art'
      AND reference_system_number~'^[1-9][0-9]{0,9}$')
    OR
    (reference_provider='Victoria and Albert Museum'
      AND reference_system_number~'^O[0-9]{1,12}$')),
  ADD CONSTRAINT ci_visual_ref_source CHECK(
    (reference_provider='The Metropolitan Museum of Art'
      AND reference_url='https://www.metmuseum.org/art/collection/search/'||reference_system_number)
    OR (reference_provider='Victoria and Albert Museum'
      AND reference_url='https://collections.vam.ac.uk/item/'||reference_system_number||'/')),
  ADD CONSTRAINT ci_visual_ref_image CHECK(
    reference_image_url IS NULL
    OR (reference_provider='The Metropolitan Museum of Art'
      AND reference_image_url~'^https://images\.metmuseum\.org/[A-Za-z0-9_./%()!~-]+\.(jpg|jpeg|png)(\?[A-Za-z0-9=&_-]+)?$')
    OR (reference_provider='Victoria and Albert Museum'
      AND reference_image_url~'^https://framemark\.vam\.ac\.uk/collections/[A-Za-z0-9_-]+/full/![0-9]+,[0-9]+/0/default\.jpg$'));
ALTER TABLE public.ai_visual_reference_reviews
  ADD COLUMN IF NOT EXISTS reference_image_license text;
ALTER TABLE public.ai_visual_reference_reviews
  ADD CONSTRAINT ci_visual_ref_cc0 CHECK(
    reference_provider <> 'The Metropolitan Museum of Art'
    OR reference_image_license='CC0_MET_OPEN_ACCESS_PUBLIC_DOMAIN'
  );
