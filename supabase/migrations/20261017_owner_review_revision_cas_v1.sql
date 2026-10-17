-- Revisioned, optimistic-owner review save. Original AI is immutable by this route.
-- Explicit actor and source ownership, per-run lock, no silent multi-tab overwrites.
ALTER TABLE public.ai_analysis_runs
  ADD COLUMN IF NOT EXISTS owner_review_revision integer NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS public.ai_owner_review_revisions(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  source_analysis_run_id uuid NOT NULL REFERENCES public.ai_analysis_runs(id),
  revision integer NOT NULL CHECK (revision > 0),
  object_changes jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source_analysis_run_id,revision)
);
CREATE INDEX IF NOT EXISTS ci_review_revisions_owner_source
  ON public.ai_owner_review_revisions(owner_id,source_analysis_run_id,revision DESC);
ALTER TABLE public.ai_owner_review_revisions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ci_review_revision_read ON public.ai_owner_review_revisions;
CREATE POLICY ci_review_revision_read ON public.ai_owner_review_revisions FOR SELECT TO authenticated
  USING(owner_id=auth.uid());
DROP POLICY IF EXISTS ci_review_revision_insert ON public.ai_owner_review_revisions;
CREATE POLICY ci_review_revision_insert ON public.ai_owner_review_revisions FOR INSERT TO authenticated
  WITH CHECK(owner_id=auth.uid() AND EXISTS(
    SELECT 1 FROM public.ai_analysis_runs r
    WHERE r.id=source_analysis_run_id AND r.owner_id=auth.uid()
  ));
REVOKE ALL ON public.ai_owner_review_revisions FROM anon,authenticated;
GRANT SELECT,INSERT ON public.ai_owner_review_revisions TO authenticated;

CREATE OR REPLACE FUNCTION public.ci_save_owner_review_v1(
 p_run_id uuid,
 p_expected_revision integer,
 p_object_changes jsonb
)
RETURNS TABLE(revision integer,owner_review jsonb)
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public
AS $$
DECLARE
 v_run public.ai_analysis_runs%rowtype;
 v_owner uuid:=auth.uid();
 v_total integer;
 v_key text;
 v_value jsonb;
 v_next jsonb;
 v_objects jsonb;
 v_changes jsonb:='{}'::jsonb;
 v_item jsonb;
 v_field text;
BEGIN
 IF v_owner IS NULL THEN RAISE EXCEPTION 'Sign in to edit the saved draft'; END IF;
 IF p_expected_revision IS NULL OR p_expected_revision<0 THEN RAISE EXCEPTION 'Review revision required'; END IF;
 IF jsonb_typeof(p_object_changes) IS DISTINCT FROM 'object' OR p_object_changes='{}'::jsonb
 THEN RAISE EXCEPTION 'No valid owner review changes were provided'; END IF;
 SELECT * INTO v_run FROM public.ai_analysis_runs
   WHERE id=p_run_id AND owner_id=v_owner FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Private saved draft not found'; END IF;
 IF v_run.mode NOT IN ('single','batch') OR v_run.status<>'DRAFT' THEN
  RAISE EXCEPTION 'Only an unapproved owner draft can be edited'; END IF;
 IF v_run.owner_review_revision<>p_expected_revision THEN
  RAISE EXCEPTION 'REVIEW_REVISION_CONFLICT: another tab saved a newer owner review; reload before editing'; END IF;
 IF jsonb_typeof(v_run.result->'objects')<>'array' THEN RAISE EXCEPTION 'No saved object to review'; END IF;
 v_total:=jsonb_array_length(v_run.result->'objects');
 v_next:=coalesce(v_run.result->'owner_review','{}'::jsonb);
 IF jsonb_typeof(v_next)<>'object' THEN RAISE EXCEPTION 'Invalid existing review snapshot'; END IF;
 v_objects:=coalesce(v_next->'objects','{}'::jsonb);
 IF jsonb_typeof(v_objects)<>'object' THEN RAISE EXCEPTION 'Invalid existing object reviews'; END IF;
 FOR v_key,v_value IN SELECT key,value FROM jsonb_each(p_object_changes) LOOP
  IF v_key !~ '^(0|[1-9][0-9]*)$' OR v_key::integer>=v_total
     OR jsonb_typeof(v_value)<>'object' THEN
   RAISE EXCEPTION 'Invalid source object index or review entry'; END IF;
  IF v_value='{}'::jsonb THEN RAISE EXCEPTION 'Empty edit for object %',v_key; END IF;
  FOR v_field IN SELECT key FROM jsonb_each(v_value) LOOP
   IF v_field NOT IN ('working_title','condition_summary')
     THEN RAISE EXCEPTION 'Unrecognised editable review field %',v_field; END IF;
   IF jsonb_typeof(v_value->v_field)<>'string' THEN
     RAISE EXCEPTION 'Review field % must be text',v_field; END IF;
   IF length(v_value->>v_field)>2000 THEN
     RAISE EXCEPTION 'Review field % is too long',v_field; END IF;
   IF v_field='working_title' AND length(btrim(v_value->>v_field))<2
     THEN RAISE EXCEPTION 'Working title cannot be empty'; END IF;
  END LOOP;
  v_item:=coalesce(v_objects->v_key,'{}'::jsonb);
  IF jsonb_typeof(v_item)<>'object' THEN RAISE EXCEPTION 'Invalid saved object review'; END IF;
  v_objects:=jsonb_set(v_objects,ARRAY[v_key],v_item||v_value,true);
  v_changes:=v_changes||jsonb_build_object(v_key,v_value);
 END LOOP;
 v_next:=v_next||jsonb_build_object(
  'objects',v_objects,
  'edited_at',now(),
  'revision',p_expected_revision+1
 );
 UPDATE public.ai_analysis_runs
  SET result=jsonb_set(v_run.result,'{owner_review}',v_next,true),
      owner_review_revision=p_expected_revision+1
  WHERE id=p_run_id AND owner_id=v_owner;
 INSERT INTO public.ai_owner_review_revisions(
  owner_id,source_analysis_run_id,revision,object_changes
 ) VALUES(v_owner,p_run_id,p_expected_revision+1,v_changes);
 RETURN QUERY SELECT p_expected_revision+1,v_next;
END $$;
REVOKE ALL ON FUNCTION public.ci_save_owner_review_v1(uuid,integer,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ci_save_owner_review_v1(uuid,integer,jsonb) TO authenticated;
