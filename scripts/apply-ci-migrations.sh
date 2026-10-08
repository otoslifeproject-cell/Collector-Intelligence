#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATION_DIR="${ROOT_DIR}/supabase/migrations"
EXPECTED_REF="${CI_SUPABASE_PROJECT_REF:-bwdafrwkimjvwfoqomot}"
DB_URL="${CI_SUPABASE_DB_URL:-}"

if [[ -z "$DB_URL" ]]; then
  echo "CI_SUPABASE_DB_URL is not configured."
  exit 2
fi

# Hard safety boundary: this workflow is allowed to target Collector Intelligence only.
if [[ "$DB_URL" != *"$EXPECTED_REF"* ]]; then
  echo "SAFETY STOP: database URL does not contain the canonical Collector Intelligence project ref: $EXPECTED_REF"
  echo "No SQL was executed."
  exit 3
fi

if [[ ! -d "$MIGRATION_DIR" ]]; then
  echo "Migration directory not found: $MIGRATION_DIR"
  exit 4
fi

PSQL=(psql "$DB_URL" -X -v ON_ERROR_STOP=1 --no-psqlrc)

echo "Target safety check passed for Collector Intelligence project ref $EXPECTED_REF."

"${PSQL[@]}" <<'SQL'
create table if not exists public.ci_migration_history (
  filename text primary key,
  sha256 text not null,
  applied_at timestamptz not null default now(),
  source text not null check (source in ('pipeline','adopted_existing'))
);
comment on table public.ci_migration_history is
'Collector Intelligence schema deployment ledger. Managed by GitHub Actions.';
SQL

query_scalar() {
  "${PSQL[@]}" -Atqc "$1" | tr -d '[:space:]'
}

record_migration() {
  local filename="$1"
  local checksum="$2"
  local source="$3"
  "${PSQL[@]}" -v filename="$filename" -v checksum="$checksum" -v source="$source" <<'SQL'
insert into public.ci_migration_history(filename, sha256, source)
values (:'filename', :'checksum', :'source')
on conflict (filename) do nothing;
SQL
}

adopt_if_already_present() {
  local filename="$1"
  local checksum="$2"
  local present="false"

  case "$filename" in
    001_core_schema.sql)
      present="$(query_scalar "select (to_regclass('public.items') is not null and to_regclass('public.item_evidence') is not null and to_regclass('public.comparables') is not null)::text;")"
      ;;
    002_rls_and_storage.sql)
      present="$(query_scalar "select (coalesce((select relrowsecurity from pg_class where oid='public.items'::regclass),false) and exists(select 1 from storage.buckets where id='item-images'))::text;")"
      ;;
    003_catalogue_views.sql)
      present="$(query_scalar "select (to_regclass('public.external_catalogue') is not null)::text;")"
      ;;
    004_ai_intake.sql)
      present="$(query_scalar "select (to_regclass('public.ai_analysis_runs') is not null and exists(select 1 from information_schema.columns where table_schema='public' and table_name='items' and column_name='source_analysis_run_id'))::text;")"
      ;;
  esac

  if [[ "$present" == "true" ]]; then
    echo "Adopting already-applied migration into ledger: $filename"
    record_migration "$filename" "$checksum" "adopted_existing"
    return 0
  fi

  return 1
}

shopt -s nullglob
files=("$MIGRATION_DIR"/*.sql)
if [[ ${#files[@]} -eq 0 ]]; then
  echo "No migration files found."
  exit 0
fi

IFS=$'\n' files=($(printf '%s\n' "${files[@]}" | sort))
unset IFS

for file in "${files[@]}"; do
  filename="$(basename "$file")"
  checksum="$(sha256sum "$file" | awk '{print $1}')"
  existing="$(query_scalar "select sha256 from public.ci_migration_history where filename = '$(printf "%s" "$filename" | sed "s/'/''/g")';")"

  if [[ -n "$existing" ]]; then
    if [[ "$existing" != "$checksum" ]]; then
      echo "SAFETY STOP: applied migration was edited: $filename"
      echo "Create a new migration file instead of changing an applied migration."
      exit 5
    fi
    echo "Already applied: $filename"
    continue
  fi

  if adopt_if_already_present "$filename" "$checksum"; then
    continue
  fi

  echo "Applying migration: $filename"
  if grep -q '^-- CI_NO_TRANSACTION' "$file"; then
    "${PSQL[@]}" -f "$file"
  else
    "${PSQL[@]}" --single-transaction -f "$file"
  fi

  record_migration "$filename" "$checksum" "pipeline"
  echo "Applied successfully: $filename"
done

echo "Collector Intelligence database migrations are up to date."
