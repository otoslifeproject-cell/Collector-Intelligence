# Supabase setup — Collector Intelligence

**Apply these files only to the dedicated Collector Intelligence Supabase project. Never to OTOS or a Universal Marketing client database.**

## Order
In Supabase → SQL Editor → New query:

1. Run `migrations/001_core_schema.sql`
2. Run `migrations/002_rls_and_storage.sql`
3. Run `migrations/003_catalogue_views.sql`

Run each whole file separately and confirm success before the next one.

## Authentication
Use Supabase Auth with email/password initially.

Recommended first setup:
1. Authentication → Providers → Email enabled.
2. Create your owner account from the web app.
3. Confirm the email if confirmation is enabled.
4. Once the owner account is working, consider disabling public signups if this remains a single-user private management system.

## Storage
Migration 002 creates a **private** bucket named `item-images`.

Expected object path:
`<auth-user-id>/<item-code>/<filename>`

The RLS policies only allow a signed-in user to access their own first-level folder.

## Frontend keys
Supabase → Project Settings / API:
- Project URL → `VITE_SUPABASE_URL`
- Publishable key → `VITE_SUPABASE_PUBLISHABLE_KEY`

Use the publishable key only. **Never put a service-role/secret key in the browser or GitHub.**

## Private image note
The app upload is wired to the private bucket. The production-safe image display path should use short-lived signed URLs. The current v2 UI leaves this as the next hardening step before broad external access.
