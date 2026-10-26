# Collector Intelligence — owner Preview release gate (26 October 2026)

Status: NOT RELEASED. Read-only verification and non-production preparation only.

## Verified checkpoint
- Draft PR #2 `continuity/resolver-fixtures-20261020` at `8af8eca29a7d2fe0cd328967e48bfcea409c9797` when checked.
- GitHub Actions run 40256149902 passed all five jobs for that exact SHA (disposable test scope).
- Vercel project `collector-intelligence-sngf` had 18 configured variables, all production-targeted, zero preview-targeted at check.
- `src/lib/supabase.ts` throws on missing VITE/NEXT_PUBLIC Supabase URL and publishable key; a READY build cannot establish browser startup success.
- Supabase project `bwdafrwkimjvwfoqomot`: only default branch was reported; live migration count 37. Immutable paid intake claim, scoped research RPC and approved-v1 view not installed in production at last read-only check.

## Next non-production acceptance procedure
1. Keep PR #2 draft and preserve two Work-local source edits. Do not merge or route Preview writes to production.
2. Establish a genuinely isolated Auth/PostgREST/Storage/backend instance with distinct credentials and zero unapproved recurring cost. Existing disposable GitHub CI is proof of tests, not a persistent hosted Preview backend.
3. Configure **Preview-only** build variables with isolated backend URL and public publishable key. No service_role, database passwords or production credentials in public Vite variables. Require owner-only authentication and disable/negatively test anonymous account creation.
4. Deploy the exact candidate to Vercel Preview. Verify that the page renders without blank-screen startup error, then test signed-in owner dashboard, photo upload/recovery, distinct objects, review, research, ledger, draft title/description/text export, sales cost arithmetic, saved status, refresh persistence and logout.
5. Confirm unauthenticated and foreign-owner access denied; inspect RLS, Storage scopes, server endpoints, duplicate paid-claim conditions, network failures, and no paid provider calls during acceptance.
6. Preserve timestamps, exact SHA, deployment ID, backend isolation evidence, screenshots and failed cases. Green synthetic CI != signed-in hosted acceptance.
7. Separately review production migration SQL/RLS, security advisors, rollback and backup; production migration, merge, deployment and publication require a distinct owner approval.

## Explicit blockers
No available isolated persistent backend or Preview configuration; hosted signed-in acceptance NOT DONE. No new Supabase branch created (cost potentially applies). Main/production unchanged. No original personal photographs or confidential credentials belong in this repo document.

## Recheck before action
This note records the checkpoint above, not permanent current truth. Refresh GitHub head, Vercel env scope, isolated backend and SQL before executing.
