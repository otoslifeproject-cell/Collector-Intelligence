# Owner isolation rollback regression — 2026-10-11

Executed in Supabase project `bwdafrwkimjvwfoqomot`. Database contained **one registered auth user**, so the test used the existing owner and a simulated second JWT subject via `request.jwt.claim.sub`, running with Postgres role `authenticated`. This is an RLS SQL simulation, **not** a two-account signed-in browser test.

Transaction setup: BEGIN; temporary fixture table with GRANT SELECT to authenticated; synthetic owner-owned item and UNVERIFIED auction estimate comparable; `set_config('request.jwt.claim.sub',owner_uuid,true)`; SET LOCAL ROLE authenticated; assert owner sees exactly one comparable. RESET ROLE; set an unrelated random subject, SET LOCAL ROLE authenticated; assert the comparable is invisible and an attempt to create an owner evidence review fails under RLS. RESET ROLE; ROLLBACK.

**Outcome: PASS.** The first attempt was invalid due to missing SELECT on temporary fixture table and fully rolled back. The corrected run completed without SQL errors. No synthetic comparable, item or review remained.

Scope limitation: SQL role/JWT-claim simulation only. Real JWT session tests for two authenticated users, frontend workflow, and per-table cross-owner UPDATE/DELETE remain outstanding. Do not create actual second accounts without authorisation.
