-- Clean external-facing catalogue layer.
-- Does NOT expose acquisition cost, internal notes, detailed evidence, rejected attributions, or profit.

create or replace view public.external_catalogue
with (security_invoker = true)
as
select
  id,
  owner_id,
  item_code,
  coalesce(nullif(current_attribution,''), nullif(title,''), nullif(object_type,''), 'Unidentified object') as catalogue_title,
  category,
  object_type,
  maker,
  designer,
  pattern_model,
  region_country,
  period_wording,
  material,
  colour,
  rarity_desirability,
  condition_summary,
  dimensions,
  weight_g,
  marks_signatures_labels,
  provenance,
  identification_confidence,
  dating_confidence,
  valuation_confidence,
  catalogue_note,
  currency,
  quick_sale_value,
  balanced_value_low,
  balanced_value_high,
  auction_value_low,
  auction_value_high,
  private_sale_low,
  private_sale_high,
  status,
  created_at,
  updated_at
from public.items;

comment on view public.external_catalogue is
'Presentation-safe catalogue layer. Internal research notes, acquisition economics, contacts and rejected attribution history remain excluded.';
