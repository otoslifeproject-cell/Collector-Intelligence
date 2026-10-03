export type Item = {
  id: string
  item_code: string
  title: string | null
  category: string | null
  object_type: string | null
  maker: string | null
  current_attribution: string | null
  period_wording: string | null
  region_country: string | null
  material: string | null
  colour: string | null
  condition_summary: string | null
  identification_confidence: number | null
  dating_confidence: number | null
  valuation_confidence: number | null
  status: string
  sale_readiness: string | null
  quick_sale_value: number | null
  balanced_value_low: number | null
  balanced_value_high: number | null
  floor_price: number | null
  expected_net: number | null
  best_venue: string | null
  backup_venue: string | null
  storage_location: string | null
  acquisition_price: number | null
  acquisition_currency: string | null
  currency: string | null
  dimensions: Record<string, unknown> | null
  weight_g: number | null
  marks_signatures_labels: string | null
  provenance: string | null
  notes: string | null
  catalogue_note: string | null
  created_at: string
  updated_at: string
}

export type ItemPhoto = {
  id: string
  item_id: string
  storage_path: string
  file_name: string | null
  caption: string | null
  photo_role: string | null
  position: number
  is_hero: boolean
}

export type Comparable = {
  id: string
  item_id: string
  venue: string
  sale_date: string | null
  price_type: string
  price: number | null
  currency: string | null
  description: string
  source_url: string | null
  verification_status: string
  comparability_grade: string | null
}
