-- Owner-reviewed visual analogues, never maker authentication or market realisations.
-- Original private photos stay in item-images and source model output remains immutable.
CREATE TABLE IF NOT EXISTS public.ai_visual_reference_reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL DEFAULT auth.uid(),
 source_analysis_run_id uuid NOT NULL REFERENCES public.ai_analysis_runs(id),
 source_object_index integer NOT NULL CHECK (source_object_index>=0),
 paired_lot boolean NOT NULL DEFAULT false,
 source_photo_index integer NOT NULL CHECK(source_photo_index>=0),
 reference_provider text NOT NULL DEFAULT 'Victoria and Albert Museum'
   CHECK (reference_provider='Victoria and Albert Museum'),
 reference_system_number text NOT NULL
   CHECK(reference_system_number~'^O[0-9]{1,12}$'),
 reference_url text NOT NULL,
 reference_title text NOT NULL,
 reference_maker text,
 reference_date text,
 reference_material text,
 reference_image_url text,
 search_query text,
 review_decision text NOT NULL
   CHECK(review_decision IN ('POSSIBLE_LOOKALIKE','NOT_A_MATCH','NEEDS_REVIEW')),
 review_note text NOT NULL DEFAULT '',
 evidence_status text NOT NULL DEFAULT 'OWNER_VISUAL_COMPARISON_UNVERIFIED'
   CHECK(evidence_status='OWNER_VISUAL_COMPARISON_UNVERIFIED'),
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT ci_reference_url_expected CHECK (
  reference_url='https://collections.vam.ac.uk/item/'||reference_system_number||'/'),
 CONSTRAINT ci_reference_image_host CHECK (
  reference_image_url IS NULL OR
  reference_image_url ~ '^https://framemark\.vam\.ac\.uk/collections/[A-Za-z0-9_-]+/full/![0-9]+,[0-9]+/0/default\.jpg$'),
 CONSTRAINT ci_visual_reference_length CHECK (
  length(reference_title) BETWEEN 1 AND 250 AND
  length(coalesce(reference_maker,''))<=180 AND
  length(coalesce(reference_material,''))<=180 AND
  length(coalesce(reference_date,''))<=100 AND
  length(coalesce(search_query,''))<=120 AND
  length(review_note)<=1200)
);
CREATE INDEX IF NOT EXISTS ci_visual_reference_owner_source
 ON public.ai_visual_reference_reviews(owner_id,source_analysis_run_id,source_object_index,created_at DESC);
ALTER TABLE public.ai_visual_reference_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ci_visual_reference_select ON public.ai_visual_reference_reviews;
CREATE POLICY ci_visual_reference_select ON public.ai_visual_reference_reviews
 FOR SELECT TO authenticated USING(owner_id=(SELECT auth.uid()));
DROP POLICY IF EXISTS ci_visual_reference_insert ON public.ai_visual_reference_reviews;
CREATE POLICY ci_visual_reference_insert ON public.ai_visual_reference_reviews
 FOR INSERT TO authenticated
 WITH CHECK(
  owner_id=(SELECT auth.uid())
  AND EXISTS(
   SELECT 1 FROM public.ai_analysis_runs a
   WHERE a.id=source_analysis_run_id AND a.owner_id=(SELECT auth.uid())
     AND a.mode IN ('single','batch')
     AND jsonb_typeof(a.result->'objects')='array'
     AND source_object_index<jsonb_array_length(a.result->'objects')
     AND jsonb_typeof(a.result->'image_manifest')='array'
     AND EXISTS(
      SELECT 1 FROM jsonb_array_elements(a.result->'image_manifest') p
      WHERE jsonb_typeof(p->'index')='number'
        AND (p->>'index')::integer=source_photo_index
     )
     AND (
       NOT paired_lot OR (
        a.mode='single' AND jsonb_array_length(a.result->'objects')=2
         AND source_object_index=0
       )
     )
  )
 );
REVOKE ALL ON public.ai_visual_reference_reviews FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.ai_visual_reference_reviews TO authenticated;
