# Automatic database migrations

Collector Intelligence database migrations are applied during the **Vercel production build**.

Canonical production Supabase project ref:

`bwdafrwkimjvwfoqomot`

The surviving Vercel project already receives the Supabase database connection variables from its Supabase integration. The build reads `POSTGRES_URL_NON_POOLING` first.

## Safety boundary

The migration runner refuses to execute SQL unless the database URL contains the exact Collector Intelligence project ref above.

Therefore a Vercel project accidentally connected to another Supabase project will fail safely before SQL is executed.

If a build environment has no database URL at all, migration is skipped. This allows non-Vercel builds such as GitHub Pages checks to compile without database access.

## Migration behaviour

On each Vercel deployment:

1. `npm run migrate:ci` runs before the frontend build.
2. A `public.ci_migration_history` ledger is created if needed.
3. Existing manually-applied migrations 001–003 are detected and adopted into the ledger.
4. Migration 004 is also adopted if it already exists, otherwise it is applied.
5. Future unapplied migration files are applied in filename order.
6. Applied migration checksums are locked. Editing an already-applied file stops the deployment.

## Adding a database change

Create a new numbered SQL file in:

`supabase/migrations/`

Example:

`005_listing_exports.sql`

Never edit an already-applied migration. Push the new migration to `main`; Vercel deploys the app and migrates the database in the same release.

## Architecture

- GitHub: application source + migration source of truth
- Vercel: deployment/runtime + migration execution
- Supabase: database/auth/storage
- Collector Intelligence app: owner-facing catalogue and research system

This pipeline is intentionally independent of the ChatGPT Supabase admin connector.
