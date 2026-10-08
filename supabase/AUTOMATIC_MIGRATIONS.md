# Collector Intelligence — automatic Supabase migrations

This repository now deploys database migrations automatically from GitHub to the **dedicated Collector Intelligence Supabase project only**.

Canonical Supabase project ref:

`bwdafrwkimjvwfoqomot`

The workflow contains a hard safety check and refuses to run SQL unless the database URL contains that exact project ref.

## One-time setup

In the surviving Vercel project `collector-intelligence-sngf`, copy the value of:

`POSTGRES_URL_NON_POOLING`

Do not paste it into source code or chat.

In GitHub:

1. Open `otoslifeproject-cell/Collector-Intelligence`.
2. Go to **Settings → Secrets and variables → Actions**.
3. Choose **New repository secret**.
4. Name it exactly:
   `CI_SUPABASE_DB_URL`
5. Paste the `POSTGRES_URL_NON_POOLING` value from Vercel.
6. Save.

Then open:

**GitHub → Actions → Deploy CI Supabase migrations → Run workflow**

The first configured run will:
- verify it is targeting project `bwdafrwkimjvwfoqomot`;
- create a migration ledger;
- recognise 001–003 as already applied from the original manual setup;
- recognise 004 too if it was manually applied already;
- otherwise apply 004 automatically;
- record checksums so applied migrations cannot silently be edited later.

## Going forward

Every new SQL change must be a **new file** in:

`supabase/migrations/`

Do not edit an already-applied migration.

A push to `main` that changes a migration automatically runs the production migration workflow.

The workflow uses a dedicated `public.ci_migration_history` ledger. It does not touch OTOS and will stop before SQL execution if the target URL does not contain the canonical CI project ref.

## Non-transaction migrations

Migrations run in a transaction by default. If a future PostgreSQL operation cannot run inside a transaction, put this on the first line of that migration:

`-- CI_NO_TRANSACTION`

The pipeline will apply that file without wrapping it in a transaction.
