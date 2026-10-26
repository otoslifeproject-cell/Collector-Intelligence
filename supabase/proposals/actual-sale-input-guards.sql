-- PREPRODUCTION PROPOSAL ONLY. No automatic hosted installation or data backfill.
-- Preserve v3 owner-reported sales, loss-making outcomes and explicit event identity.
-- Reject non-finite/sub-penny amounts and implicit mixed-currency acquisition cost.
-- Lock source item before checking the event so simultaneous identical retries reuse it.
CREATE OR REPLACE FUNCTION public.ci_record_actual_sale_v1(
 p_item_id uuid,p_client_event_id uuid,p_sale jsonb
)
RETURNS TABLE(sale_id uuid,item_id uuid,gross_sale numeric,net_sale_proceeds numeric,net_profit numeric,return_on_cash numeric)
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public
AS $$
DECLARE
 v_owner uuid:=auth.uid();
 v_item public.items%rowtype;
 v_old public.sale_outcomes%rowtype;
 v_new public.sale_outcomes%rowtype;
 v_date date;
 v_gross numeric;
 v_platform numeric;
 v_payment numeric;
 v_shipping numeric;
 v_pack numeric;
 v_insurance numeric;
 v_acquisition numeric;
 v_net numeric;
 v_profit numeric;
 v_roi numeric;
 v_venue text;
 v_currency text;
 v_confirmation boolean;
 v_fingerprint text;
BEGIN
 IF v_owner IS NULL THEN RAISE EXCEPTION 'Sign in before reporting a sale'; END IF;
 IF p_item_id IS NULL OR p_client_event_id IS NULL OR jsonb_typeof(p_sale) is distinct from 'object'
 THEN RAISE EXCEPTION 'Sale record identity and financial inputs required'; END IF;
 IF (SELECT bool_and(key IN ('sale_date','gross_sale','venue','currency',
            'platform_fees','payment_fees','packing_cost','shipping_cost','insurance_cost',
            'acquisition_cost','owner_confirmed','source_reference','notes'))
    FROM jsonb_object_keys(p_sale) key) IS DISTINCT FROM true
 THEN RAISE EXCEPTION 'Sale request contains an unsupported field'; END IF;
 IF p_sale->'owner_confirmed' IS DISTINCT FROM 'true'::jsonb THEN
  RAISE EXCEPTION 'Owner must confirm that the sale actually occurred'; END IF;
 -- Serialize all events for this owned item before looking for a saved event.
 SELECT * INTO v_item FROM public.items WHERE id=p_item_id AND owner_id=v_owner FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Permanent item not accessible to owner'; END IF;
 v_fingerprint:=md5(p_sale::text);
 SELECT * INTO v_old FROM public.sale_outcomes
 WHERE owner_id=v_owner AND client_event_id=p_client_event_id FOR UPDATE;
 IF FOUND THEN
  IF v_old.item_id<>p_item_id OR v_old.request_fingerprint IS DISTINCT FROM v_fingerprint
  THEN RAISE EXCEPTION 'Sale event identifier was already used for different facts'; END IF;
  RETURN QUERY SELECT v_old.id,v_old.item_id,v_old.gross_sale,v_old.net_sale_proceeds,v_old.net_profit,v_old.return_on_cash;
  RETURN;
 END IF;
 IF v_item.status='SOLD' OR EXISTS(
   SELECT 1 FROM public.sale_outcomes s WHERE s.owner_id=v_owner AND s.item_id=p_item_id AND s.gross_sale IS NOT NULL
 ) THEN RAISE EXCEPTION 'This item already has a reported sold outcome; review before adding another'; END IF;
 BEGIN
  v_date:=nullif(p_sale->>'sale_date','')::date;
  v_gross:=nullif(p_sale->>'gross_sale','')::numeric;
  v_platform:=coalesce(nullif(p_sale->>'platform_fees','')::numeric,0);
  v_payment:=coalesce(nullif(p_sale->>'payment_fees','')::numeric,0);
  v_shipping:=coalesce(nullif(p_sale->>'shipping_cost','')::numeric,0);
  v_pack:=coalesce(nullif(p_sale->>'packing_cost','')::numeric,0);
  v_insurance:=coalesce(nullif(p_sale->>'insurance_cost','')::numeric,0);
  v_acquisition:=coalesce(nullif(p_sale->>'acquisition_cost','')::numeric,v_item.all_in_cost,v_item.acquisition_price);
 EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range OR datetime_field_overflow THEN
  RAISE EXCEPTION 'Invalid monetary or date input';
 END;
 IF EXISTS(SELECT 1 FROM unnest(ARRAY[v_gross,v_platform,v_payment,v_shipping,v_pack,v_insurance,v_acquisition]) amount
           WHERE amount::text IN ('NaN','Infinity','-Infinity')) THEN
  RAISE EXCEPTION 'Monetary amounts must be finite';
 END IF;
 IF EXISTS(SELECT 1 FROM unnest(ARRAY[v_gross,v_platform,v_payment,v_shipping,v_pack,v_insurance,v_acquisition]) amount
           WHERE amount IS DISTINCT FROM round(amount,2)) THEN
  RAISE EXCEPTION 'Monetary amounts must use at most two decimal places';
 END IF;
 v_venue:=nullif(btrim(p_sale->>'venue'),'');
 v_currency:=coalesce(nullif(btrim(p_sale->>'currency'),''),v_item.currency,'GBP');
 IF nullif(p_sale->>'acquisition_cost','') IS NULL AND v_acquisition IS NOT NULL
    AND v_item.acquisition_currency IS DISTINCT FROM v_currency THEN
  RAISE EXCEPTION 'Acquisition and sale currencies differ; supply an explicit acquisition cost in the sale currency. No automatic FX conversion was made';
 END IF;
 IF v_date IS NULL OR v_date>CURRENT_DATE OR v_date<DATE '1950-01-01'
  OR v_gross IS NULL OR v_gross<0 OR v_gross>100000000
  OR v_venue IS NULL OR length(v_venue)>160
  OR v_currency !~ '^[A-Z]{3}$'
  OR v_platform<0 OR v_payment<0 OR v_shipping<0 OR v_pack<0 OR v_insurance<0
  OR v_acquisition<0
  OR length(coalesce(p_sale->>'source_reference',''))>1000
  OR length(coalesce(p_sale->>'notes',''))>2000
 THEN RAISE EXCEPTION 'Invalid or incomplete achieved-sale details'; END IF;
 v_net:=v_gross-v_platform-v_payment-v_shipping-v_pack-v_insurance;
 v_profit:=CASE WHEN v_acquisition IS NULL THEN NULL ELSE v_net-v_acquisition END;
 v_roi:=CASE WHEN v_acquisition>0 THEN 100*v_profit/v_acquisition ELSE NULL END;
 INSERT INTO public.sale_outcomes(
  owner_id,item_id,client_event_id,provenance_basis,venue,sale_date,gross_sale,currency,
  platform_fees,payment_fees,packing_cost,shipping_subsidy,insurance_cost,
  acquisition_cost,net_sale_proceeds,net_profit,return_on_cash,
  owner_notes,source_reference,request_fingerprint
 ) VALUES (
  v_owner,p_item_id,p_client_event_id,'OWNER_REPORTED_UNVERIFIED',v_venue,v_date,v_gross,v_currency,
  v_platform,v_payment,v_pack,v_shipping,v_insurance,
  v_acquisition,v_net,v_profit,v_roi,
  nullif(p_sale->>'notes',''),
  nullif(p_sale->>'source_reference',''),v_fingerprint
 ) RETURNING * INTO v_new;
 UPDATE public.items SET status='SOLD',updated_at=now()
 WHERE id=p_item_id AND owner_id=v_owner;
 RETURN QUERY SELECT v_new.id,v_new.item_id,v_new.gross_sale,v_new.net_sale_proceeds,v_new.net_profit,v_new.return_on_cash;
END $$;
REVOKE ALL ON FUNCTION public.ci_record_actual_sale_v1(uuid,uuid,jsonb) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.ci_record_actual_sale_v1(uuid,uuid,jsonb) TO authenticated;
