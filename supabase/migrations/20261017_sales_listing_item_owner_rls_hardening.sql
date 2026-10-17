-- Security: even an authenticated owner cannot attach sale evidence or listings
-- to another owner's collection item. Previously policy only checked record owner_id.
REVOKE ALL ON public.sale_outcomes,public.listings FROM anon;
DROP POLICY IF EXISTS owner_all ON public.listings;
DROP POLICY IF EXISTS ci_listing_owner_item ON public.listings;
CREATE POLICY ci_listing_owner_item ON public.listings
  FOR ALL TO authenticated
  USING (
    owner_id=(select auth.uid()) AND EXISTS(
      SELECT 1 FROM public.items i WHERE i.id=listings.item_id AND i.owner_id=(select auth.uid())
    )
  )
  WITH CHECK (
    owner_id=(select auth.uid()) AND EXISTS(
      SELECT 1 FROM public.items i WHERE i.id=listings.item_id AND i.owner_id=(select auth.uid())
    )
  );
DROP POLICY IF EXISTS owner_all ON public.sale_outcomes;
DROP POLICY IF EXISTS ci_sale_owner_item ON public.sale_outcomes;
CREATE POLICY ci_sale_owner_item ON public.sale_outcomes
  FOR ALL TO authenticated
  USING (
    owner_id=(select auth.uid()) AND EXISTS(
      SELECT 1 FROM public.items i WHERE i.id=sale_outcomes.item_id AND i.owner_id=(select auth.uid())
    )
  )
  WITH CHECK (
    owner_id=(select auth.uid()) AND EXISTS(
      SELECT 1 FROM public.items i WHERE i.id=sale_outcomes.item_id AND i.owner_id=(select auth.uid())
    )
    AND (
      listing_id IS NULL OR EXISTS(
        SELECT 1 FROM public.listings l WHERE l.id=sale_outcomes.listing_id
          AND l.owner_id=(select auth.uid()) AND l.item_id=sale_outcomes.item_id
      )
    )
  );
