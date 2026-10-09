# Collector Intelligence database migrations

Collector Intelligence uses GitHub as the migration source of truth and the dedicated Supabase project:

`bwdafrwkimjvwfoqomot`

Database migrations are **not** executed inside the normal Vercel build. This keeps application deployments independent from temporary database/network issues.

## Current managed path

A protected Vercel server endpoint applies the numbered SQL files from the exact deployed Git commit:

`/api/admin-migrate`

The endpoint:
- requires the private `CI_MIGRATION_TOKEN`;
- verifies the deployment points at Supabase project `bwdafrwkimjvwfoqomot`;
- uses the existing Vercel/Supabase Postgres connection;
- records applied migrations in `public.ci_migration_history`;
- adopts migrations that were already applied manually;
- refuses checksum changes to previously recorded migrations;
- applies new migrations in filename order.

Migration 004 was successfully applied through this path on 2026-10-09.

## Adding a database change

Create a new numbered file in:

`supabase/migrations/`

Example:

`005_listing_exports.sql`

Never edit an already-applied migration. After the code deployment is ready, run the protected migration endpoint and verify its JSON result before treating the schema change as complete.

## Architecture

- GitHub: application source + SQL migration source of truth
- Vercel: application runtime + protected migration executor
- Supabase: database/auth/storage
- Collector Intelligence app: owner-facing catalogue and research system

The migration executor is hard-scoped to Collector Intelligence and must never target OTOS or unrelated Universal Marketing databases.
