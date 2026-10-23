-- DISPOSABLE TEST SUPPORT ONLY. Not a production migration.
-- Core items/RLS/AI tables now come from their unchanged original migrations.
-- EMPTY research-context views let the real handler exercise persistence;
-- they do not certify the production evidence-view definitions.
CREATE VIEW public.trusted_knowledge_v1 AS SELECT
  null::uuid id,null::text entity_key,null::text claim,null::text source_url,
  null::text source_reference,null::timestamptz last_verified,null::text certainty_class
  ,null::text knowledge_type,null::text entity_type,null::integer confidence,
  null::text evidence_provenance,null::date source_date,null::text freshness_requirement,
  null::text verification_status,null::text stance,null::text[] tags,
  null::uuid supersedes_id,null::timestamptz updated_at
WHERE false;
CREATE VIEW public.trusted_comparables_v1 AS SELECT
  null::uuid id,null::uuid owner_id,null::uuid item_id,null::text venue,null::text source_reference,
  null::text source_url,null::text lot_item_id,null::date sale_date,null::text price_type,
  null::numeric price,null::text currency,null::text description,null::text maker_attribution,
  null::text dimensions,null::text condition_summary,null::text comparability_grade,
  null::text verification_status
WHERE false;
CREATE VIEW public.ai_visual_reference_reviews AS SELECT
  null::uuid id,null::uuid item_id,null::uuid item_photo_id,null::text reference_system_number,
  null::text reference_url,null::text reference_title,null::text reference_maker,
  null::text reference_material,null::text reference_image_url,null::text reference_provider,
  null::text reference_image_license,null::text review_decision,null::text review_note,
  null::timestamptz created_at
WHERE false;
GRANT SELECT ON public.trusted_knowledge_v1,public.trusted_comparables_v1,
  public.ai_visual_reference_reviews TO authenticated;
