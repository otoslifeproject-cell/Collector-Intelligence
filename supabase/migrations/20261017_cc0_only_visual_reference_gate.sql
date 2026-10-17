-- Rights-aware evidence ledger. No V&A API or embedded V&A image licence granted.
-- New visual comparisons are restricted to the Met Museum's isPublicDomain=true CC0 corpus.
ALTER TABLE public.ai_visual_reference_reviews
 DROP CONSTRAINT IF EXISTS ci_visual_ref_provider,
 DROP CONSTRAINT IF EXISTS ci_visual_ref_id,
 DROP CONSTRAINT IF EXISTS ci_visual_ref_source,
 DROP CONSTRAINT IF EXISTS ci_visual_ref_image,
 DROP CONSTRAINT IF EXISTS ci_visual_ref_cc0;
ALTER TABLE public.ai_visual_reference_reviews
 ADD CONSTRAINT ci_visual_ref_provider
   CHECK(reference_provider='The Metropolitan Museum of Art'),
 ADD CONSTRAINT ci_visual_ref_id
   CHECK(reference_system_number~'^[1-9][0-9]{0,9}$'),
 ADD CONSTRAINT ci_visual_ref_source
   CHECK(reference_url='https://www.metmuseum.org/art/collection/search/'||reference_system_number),
 ADD CONSTRAINT ci_visual_ref_image
   CHECK(reference_image_url IS NULL OR
    reference_image_url~*'^https://images\.metmuseum\.org/[A-Za-z0-9_./%()!~-]+\.(jpg|jpeg|png)(\?[A-Za-z0-9=&_-]+)?$'),
 ADD CONSTRAINT ci_visual_ref_cc0
   CHECK(reference_image_license='CC0_MET_OPEN_ACCESS_PUBLIC_DOMAIN');
