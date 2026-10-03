-- COLLECTOR INTELLIGENCE — DEDICATED SUPABASE PROJECT ONLY
-- NEVER APPLY THIS TO OTOS OR ANY UNIVERSAL MARKETING CLIENT PROJECT.

create extension if not exists pgcrypto;
create sequence if not exists public.item_code_seq start 1;

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  item_code text not null unique default ('CI-' || to_char(nextval('public.item_code_seq'), 'FM000000')),
  title text,
  category text,
  object_type text,
  maker text,
  market_attribution text,
  designer text,
  pattern_model text,
  region_country text,
  period_wording text,
  material text,
  colour text,
  current_attribution text,
  identification_confidence smallint check (identification_confidence between 0 and 100),
  dating_confidence smallint check (dating_confidence between 0 and 100),
  valuation_confidence smallint check (valuation_confidence between 0 and 100),
  rarity_desirability text,
  condition_summary text,
  dimensions jsonb not null default '{}'::jsonb,
  weight_g numeric(12,2),
  marks_signatures_labels text,
  provenance text,
  acquisition_price numeric(12,2),
  acquisition_currency text not null default 'GBP',
  acquisition_date date,
  acquisition_source text,
  all_in_cost numeric(12,2),
  storage_location text,
  status text not null default 'CATALOGUED'
    check (status in ('CATALOGUED','RESEARCH','ONE_QUICK_CHECK','SPECIALIST_REVIEW','READY_TO_SELL','LISTED','CONSIGNED','SOLD','ARCHIVED')),
  sale_readiness text
    check (sale_readiness is null or sale_readiness in ('SELL_NOW','ONE_QUICK_CHECK_THEN_SELL','RESEARCH_FIRST','SPECIALIST_REVIEW')),
  strategy text check (strategy is null or strategy in ('FAST_CASH','BALANCED','MAX_VALUE')),
  currency text not null default 'GBP',
  quick_sale_value numeric(12,2),
  balanced_value_low numeric(12,2),
  balanced_value_high numeric(12,2),
  auction_value_low numeric(12,2),
  auction_value_high numeric(12,2),
  private_sale_low numeric(12,2),
  private_sale_high numeric(12,2),
  dealer_asking_low numeric(12,2),
  dealer_asking_high numeric(12,2),
  floor_price numeric(12,2),
  expected_net numeric(12,2),
  best_venue text,
  backup_venue text,
  notes text,
  catalogue_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.item_photos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  item_id uuid not null references public.items(id) on delete cascade,
  storage_path text not null,
  file_name text,
  caption text,
  photo_role text,
  position integer not null default 0,
  is_hero boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.item_evidence (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  item_id uuid not null references public.items(id) on delete cascade,
  photo_id uuid references public.item_photos(id) on delete set null,
  claim text not null,
  provenance text not null check (provenance in ('PHOTO','USER_SUPPLIED_FACT','DOCUMENTARY_SOURCE','RESEARCH_SOURCE','REALIZED_SALE','MARKETPLACE_SOLD','DEALER_ARCHIVE','ACTIVE_ASK','INFERENCE')),
  certainty_class text check (certainty_class is null or certainty_class in ('FACT','STRONG_ATTRIBUTION','POSSIBLE_ATTRIBUTION','UNKNOWN')),
  stance text not null default 'NEUTRAL' check (stance in ('SUPPORTS','WEAKENS','NEUTRAL')),
  source_reference text,
  source_url text,
  source_date date,
  verification_status text check (verification_status is null or verification_status in ('VERIFIED_DIRECT','INDEXED_SOLD','SECONDARY_REPORT','UNVERIFIED')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.attribution_history (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  item_id uuid not null references public.items(id) on delete cascade,
  attribution_text text not null,
  maker text,
  region_country text,
  period_wording text,
  confidence smallint check (confidence between 0 and 100),
  attribution_status text not null default 'CURRENT' check (attribution_status in ('CURRENT','PREVIOUS','WITHDRAWN','REJECTED')),
  evidence_summary text,
  change_reason text,
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.comparables (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  item_id uuid not null references public.items(id) on delete cascade,
  venue text not null,
  source_reference text not null,
  source_url text,
  lot_item_id text,
  date_checked date not null default current_date,
  sale_date date,
  price_type text not null check (price_type in (
    'HAMMER_REALIZED','REALIZED_INCL_BP','MARKETPLACE_SOLD','DEALER_SOLD_CONFIRMED',
    'DEALER_ARCHIVED_LAST_ASK_ACHIEVED_UNKNOWN','AUCTION_ESTIMATE','DEALER_ASKING',
    'MARKETPLACE_ASKING','INDEXED_SOLD_NOT_DIRECTLY_VERIFIED','UNVERIFIED'
  )),
  price numeric(14,2),
  currency text,
  description text not null,
  maker_attribution text,
  period_wording text,
  dimensions text,
  condition_summary text,
  colour_variant text,
  signed_labelled boolean,
  similarity_score smallint check (similarity_score between 0 and 100),
  comparability_grade text check (comparability_grade is null or comparability_grade in ('HIGH','MEDIUM','LOW')),
  verification_status text not null check (verification_status in ('VERIFIED_DIRECT','INDEXED_SOLD','SECONDARY_REPORT','UNVERIFIED')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.valuation_history (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  item_id uuid not null references public.items(id) on delete cascade,
  valuation_date date not null default current_date,
  identification_confidence smallint check (identification_confidence between 0 and 100),
  dating_confidence smallint check (dating_confidence between 0 and 100),
  valuation_confidence smallint check (valuation_confidence between 0 and 100),
  quick_sale_value numeric(12,2),
  balanced_low numeric(12,2),
  balanced_high numeric(12,2),
  auction_low numeric(12,2),
  auction_high numeric(12,2),
  private_sale_low numeric(12,2),
  private_sale_high numeric(12,2),
  dealer_asking_low numeric(12,2),
  dealer_asking_high numeric(12,2),
  currency text not null default 'GBP',
  methodology_notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  item_id uuid not null references public.items(id) on delete cascade,
  platform text not null,
  listing_url text,
  listing_status text not null default 'DRAFT' check (listing_status in ('DRAFT','READY','PUBLISHED','SOLD','ENDED','PAUSED')),
  strategy text check (strategy is null or strategy in ('FAST_CASH','BALANCED','MAX_VALUE')),
  canonical_title text,
  platform_title text,
  description text,
  condition_report text,
  keywords text[] not null default '{}',
  category text,
  item_specifics jsonb not null default '{}'::jsonb,
  asking_price numeric(12,2),
  minimum_price numeric(12,2),
  currency text not null default 'GBP',
  expected_net_sale_proceeds numeric(12,2),
  listed_at timestamptz,
  sold_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sale_outcomes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  item_id uuid not null references public.items(id) on delete cascade,
  listing_id uuid references public.listings(id) on delete set null,
  venue text,
  listing_date date,
  asking_price numeric(12,2),
  offers jsonb not null default '[]'::jsonb,
  sale_date date,
  gross_sale numeric(12,2),
  currency text not null default 'GBP',
  platform_fees numeric(12,2) not null default 0,
  payment_fees numeric(12,2) not null default 0,
  packing_cost numeric(12,2) not null default 0,
  shipping_subsidy numeric(12,2) not null default 0,
  insurance_cost numeric(12,2) not null default 0,
  acquisition_cost numeric(12,2),
  net_sale_proceeds numeric(12,2),
  net_profit numeric(12,2),
  return_on_cash numeric(12,4),
  days_to_sell integer,
  buyer_geography text,
  return_refund_notes text,
  valuation_accuracy_notes text,
  venue_performance_notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  name text not null,
  contact_type text not null default 'ORGANISATION',
  organisation text,
  email text,
  phone text,
  website text,
  geography text,
  tags text[] not null default '{}',
  wanted_capability boolean,
  membership_required boolean,
  source_reference text,
  last_verified date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.research_tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  item_id uuid not null references public.items(id) on delete cascade,
  task_type text,
  title text not null,
  information_value smallint check (information_value between 0 and 100),
  status text not null default 'OPEN' check (status in ('OPEN','IN_PROGRESS','DONE','NOT_WORTH_IT')),
  notes text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.knowledge_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  knowledge_type text not null,
  entity_type text,
  entity_key text,
  claim text not null,
  certainty_class text check (certainty_class is null or certainty_class in ('FACT','STRONG_ATTRIBUTION','POSSIBLE_ATTRIBUTION','UNKNOWN')),
  confidence smallint check (confidence between 0 and 100),
  evidence_provenance text,
  source_reference text,
  source_url text,
  source_date date,
  last_verified date,
  freshness_requirement text not null default 'STABLE' check (freshness_requirement in ('STABLE','SLOW_CHANGING','FAST_CHANGING')),
  verification_status text check (verification_status is null or verification_status in ('VERIFIED_DIRECT','INDEXED_SOLD','SECONDARY_REPORT','UNVERIFIED')),
  stance text check (stance is null or stance in ('SUPPORTS','WEAKENS','NEUTRAL')),
  tags text[] not null default '{}',
  related_item_id uuid references public.items(id) on delete set null,
  supersedes_id uuid references public.knowledge_records(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public
as $$ begin new.updated_at = now(); return new; end; $$;

create or replace function public.protect_item_code()
returns trigger language plpgsql set search_path = public
as $$ begin
  if old.item_code is distinct from new.item_code then
    raise exception 'item_code is immutable';
  end if;
  return new;
end; $$;

drop trigger if exists trg_items_updated_at on public.items;
create trigger trg_items_updated_at before update on public.items for each row execute function public.set_updated_at();
drop trigger if exists trg_listings_updated_at on public.listings;
create trigger trg_listings_updated_at before update on public.listings for each row execute function public.set_updated_at();
drop trigger if exists trg_contacts_updated_at on public.contacts;
create trigger trg_contacts_updated_at before update on public.contacts for each row execute function public.set_updated_at();
drop trigger if exists trg_knowledge_updated_at on public.knowledge_records;
create trigger trg_knowledge_updated_at before update on public.knowledge_records for each row execute function public.set_updated_at();
drop trigger if exists trg_protect_item_code on public.items;
create trigger trg_protect_item_code before update on public.items for each row execute function public.protect_item_code();

create index if not exists items_owner_status_idx on public.items(owner_id,status);
create index if not exists items_owner_category_idx on public.items(owner_id,category);
create index if not exists items_maker_idx on public.items(maker);
create index if not exists item_photos_item_idx on public.item_photos(item_id);
create index if not exists item_evidence_item_idx on public.item_evidence(item_id);
create index if not exists attribution_history_item_idx on public.attribution_history(item_id);
create index if not exists comparables_item_idx on public.comparables(item_id);
create index if not exists comparables_sale_date_idx on public.comparables(sale_date desc);
create index if not exists valuation_history_item_idx on public.valuation_history(item_id);
create index if not exists listings_item_idx on public.listings(item_id);
create index if not exists listings_status_idx on public.listings(owner_id,listing_status);
create index if not exists sale_outcomes_item_idx on public.sale_outcomes(item_id);
create index if not exists research_tasks_item_idx on public.research_tasks(item_id);
create index if not exists knowledge_entity_idx on public.knowledge_records(owner_id,entity_type,entity_key);
create index if not exists knowledge_tags_idx on public.knowledge_records using gin(tags);
