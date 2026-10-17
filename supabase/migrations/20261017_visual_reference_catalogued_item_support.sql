-- Reuse the same visual-reference review ledger for permanent collection items.
-- Exactly one of: saved AI draft/child and catalogued item/photo.
ALTER TABLE public.ai_visual_reference_reviews
 ALTER COLUMN source_analysis_run_id DROP NOT NULL,
 ALTER COLUMN source_object_index DROP NOT NULL,
 ALTER COLUMN source_photo_index DROP NOT NULL;
ALTER TABLE public.ai_visual_reference_reviews
 ADD COLUMN IF NOT EXISTS item_id uuid REFERENCES public.items(id),
 ADD COLUMN IF NOT EXISTS item_photo_id uuid REFERENCES public.item_photos(id);
ALTER TABLE public.ai_visual_reference_reviews
 DROP CONSTRAINT IF EXISTS ci_visual_reference_one_source;
ALTER TABLE public.ai_visual_reference_reviews
 ADD CONSTRAINT ci_visual_reference_one_source CHECK(
  (source_analysis_run_id IS NOT NULL AND source_object_index IS NOT NULL
    AND source_photo_index IS NOT NULL AND item_id IS NULL AND item_photo_id IS NULL)
  OR
  (item_id IS NOT NULL AND item_photo_id IS NOT NULL
    AND source_analysis_run_id IS NULL AND source_object_index IS NULL
    AND source_photo_index IS NULL AND NOT paired_lot)
 );
CREATE INDEX IF NOT EXISTS ci_visual_reference_item_history
 ON public.ai_visual_reference_reviews(owner_id,item_id,created_at DESC)
 WHERE item_id IS NOT NULL;
DROP POLICY IF EXISTS ci_visual_reference_insert ON public.ai_visual_reference_reviews;
CREATE POLICY ci_visual_reference_insert ON public.ai_visual_reference_reviews
 FOR INSERT TO authenticated WITH CHECK (
  owner_id=(SELECT auth.uid())
  AND (
   (source_analysis_run_id IS NOT NULL AND item_id IS NULL AND EXISTS(
     SELECT 1 FROM public.ai_analysis_runs a
      WHERE a.id=source_analysis_run_id AND a.owner_id=(SELECT auth.uid())
       AND a.mode IN ('single','batch')
       AND jsonb_typeof(a.result->'objects')='array'
       AND source_object_index>=0 AND source_object_index<jsonb_array_length(a.result->'objects')
       AND jsonb_typeof(a.result->'image_manifest')='array'
       AND EXISTS(
        SELECT 1 FROM jsonb_array_elements(a.result->'image_manifest') p
         WHERE jsonb_typeof(p->'index')='number'
          AND (p->>'index')::integer=source_photo_index
       )
       AND (NOT paired_lot OR (a.mode='single'
         AND jsonb_array_length(a.result->'objects')=2 AND source_object_index=0))
   ))
   OR
   (item_id IS NOT NULL AND source_analysis_run_id IS NULL AND NOT paired_lot
     AND EXISTS(
       SELECT 1 FROM public.items i JOIN public.item_photos ip
        ON ip.item_id=i.id
       WHERE i.id=item_id AND i.owner_id=(SELECT auth.uid())
        AND ip.id=item_photo_id AND ip.owner_id=(SELECT auth.uid())
     ))
  )
 );
