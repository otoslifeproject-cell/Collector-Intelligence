# Collector Intelligence — real Auth/PostgREST and paid-route checkpoint

Continuation from `7fc21e6`, session 20 October 2026 (Europe/London). Existing draft [PR #2](https://github.com/otoslifeproject-cell/Collector-Intelligence/pull/2), branch `continuity/resolver-fixtures-20261020`.

**The Auth/PostgREST access blocker is resolved in disposable CI.** No hosted staging branch, production mutation or paid model call was needed. Both server handlers now support the approved-source reader behind an explicit server-side opt-in; production activation has not been performed.

## Verified result

Latest tested code: `518f3a1ac383fd5a3f3ecc765072ff060658cb32`.

[GitHub Actions run 39511758105](https://github.com/otoslifeproject-cell/Collector-Intelligence/actions/runs/39511758105) completed SUCCESS in all four jobs:

| Job | Evidence | Count |
|---|---|---:|
| Supabase HTTP integration | Real GoTrue signups/password logins, signed JWT validation, PostgREST, real owner RLS, approved reader and actual server-handler failure paths | 23 |
| PostgreSQL integration | Migration/replay, publisher privileges, immutable ledger, owner isolation, revocation, concurrent publication, atomic failure and safety disable | 40 |
| Resolver fixtures | Existing reference resolver (25), static migration guards (13), staging-target checks (19), approved reader (22), runtime gate (8), paid-route regression (16) | 103 |
| Application regression | Existing app tests; strict compilation of both affected APIs; clean lockfile installation and TypeScript/Vite build | 27 |
| **Total test/assertion count** | Across distinct suites; compilation/build are additional checks | **193** |

Final job IDs: HTTP `118934233396`, PostgreSQL `118934233347`, fixtures `118934233191`, application `118934233427`. Logs were retrieved and assertion counts read back, not inferred from a green badge alone. Local checks also passed. Vite retains the existing >500 kB bundle warning. UI/browser acceptance was not performed because these changes do not alter the interface.

## Real-service test environment

`scripts/test-continuity-http.mjs` requires the existing loopback/staging-name/explicit-confirmation guard and an empty PostgreSQL 17+ database. In GitHub CI it starts disposable `supabase/gotrue:v2.197.0` and `postgrest/postgrest:v14.18` containers alongside PostgreSQL 17.11. Versions/configuration were checked against the official [self-hosted Compose](https://github.com/supabase/supabase/blob/master/docker/docker-compose.yml) and [Docker changelog](https://github.com/supabase/supabase/blob/master/docker/CHANGELOG.md).

Two actual temporary Auth accounts sign up and log in with passwords. Their genuine signed access tokens are checked by GoTrue and PostgREST. This supersedes the earlier synthetic-claims-only SQL acceptance for the tested HTTP flows. Test passwords and the per-run random JWT secret are disposable and are never production credentials.

The local prefix router only forwards `/auth/v1/` and `/rest/v1/` to real upstream services. It does **not** implement or certify the hosted API-key gateway (Envoy/Kong), a real browser session, hosted deployment configuration, or live paid-model behavior. Publishing is exercised through a restricted test SQL login, not a client-accessible publication API.

Tested over actual HTTP: complete 3-source research and 4-source intake sets with genuine governing v4.0 bytes; owner A/B isolation; explicit cross-owner filters; anonymous denial; forged owner/role signatures; expired JWTs; client DML denial; private-schema/RPC exclusion; user-metadata privilege spoofing; no newest-import fallback; revocation/reapproval; missing grants; and safety disable. Both actual handler functions are invoked with real Auth/REST after disable and must return 503 with zero outbound provider calls.

## Server implementation and independent fixes

- `COLLECTOR_CANONICAL_SOURCE_MODE=approved-v1` selects the approved reader in both `api/analyse-intake.ts` and `api/research-item.ts`. No environment setting was changed. Unset/`legacy` preserves the existing loader for staged rollout and is honestly labelled `LEGACY_PINNED`; an invalid mode fails closed. Approved mode never falls back to legacy when sources are unavailable.
- `src/lib/canonicalRuntime.ts` revalidates the exact approval-event/document/version/hash receipts immediately before paid dispatch. Revocation, missing grants or a changed approval stops the request before the provider call. Caller-required key sets are frozen at runtime.
- Every newly saved first-pass/final result records `canonical_source_audit`: resolution mode, validation timestamp, owner in approved mode and exact publication receipts. Existing historical results are not rewritten or backfilled as approved.
- Intake rechecks before its optional second paid inscription pass. If a source changes after the first answer, that answer remains saved and the second call is blocked with an explicit source-gate status.
- Research now completes fallible source/visual/lineage preflight before claiming the staged paid run. A source or visual-preflight failure does not leave the run claimed without dispatch. Existing duplicate-paid-run protection remains in place.
- Provider responses are mocked in the 16 cost-boundary endpoint regressions. All network calls are intercepted there. Successful mocked requests persist the receipt; failure scenarios make zero provider calls. This is not a claim of live AI output quality.
- Added `tsconfig.api.json` / `npm run check:api`, covering the two previously excluded server handlers. It exposed four existing type errors; corrected the string-set type and declared trusted-comparable audit fields without changing evidence grading. Added exact dev dependency `@types/node@22.18.6`, a dependency lockfile and clean `npm ci` in CI. Runtime dependency ranges were not intentionally changed.

Pre-dispatch revalidation defines an auditable source snapshot. It cannot cancel an already-submitted external inference if an approval is revoked afterwards. Saved receipts retain which source decision was used; no atomic database-to-provider transaction or guaranteed in-flight cancellation is claimed.

## Preserved development history

| Commit | Result |
|---|---|
| `759082e4846dac862279c08892fdaff2f8f9efea` | Added real-service harness and frozen governing fixtures. Run 39510845633 failed during fixture bootstrap: the early auth.uid helper had the wrong owner for GoTrue migrations. |
| `e0d81a2f57da03822d0ebad99b8e06ff99208e08` | Let GoTrue establish helper ownership before installing the platform-compatible claims helper. Run 39511108753 passed all three then-existing jobs, including 22 genuine HTTP checks. |
| `08655d71188012c20cef18105120c039f71dbd4b` | Added opt-in handler integration, runtime/paid-route checks, API compilation and lockfile. Application/SQL/unit jobs passed; run 39511569845 failed the new last HTTP case because the test's network interception also intercepted its internal proxy transport. |
| `518f3a1ac383fd5a3f3ecc765072ff060658cb32` | Captured real upstream transport before installing the provider-call interceptor. Final run 39511758105 passed all four jobs and 193 checks. |

Both failures were test-environment defects, preserved and corrected; neither was a production incident. Original SQL proposal and workflow-extension bytes remain unchanged from the preceding checkpoint. The frozen Master fixture deliberately retains its original Markdown hard-line-break spaces; do not trim them to silence a whitespace warning and thereby break the governing hash.

## Live-state verification and boundaries

Read-only Supabase check: 90 canonical documents / 41 keys; governing v4.0 content hashes still recompute correctly. No publication-events table, approved view or private publisher schema is installed in production. The existing authenticated canonical SELECT grant and the actual `auth.uid()` claims fallback were inspected; the disposable helper uses the same sub/JSON-claims fallback semantics.

No production records, migrations, Auth accounts, source approvals, environment settings, stock, photographs, comparables or sale outcomes were changed. No hosted branch was created. PR remains draft/unmerged. No manual deployment or promotion command was invoked. The Vercel integration automatically reported SUCCESS for branch code `518f3a1`; this does not prove a production promotion or signed-in runtime acceptance.

Startup/source review remains scoped to the authorised engineering continuation. The older exhaustive historical-archive reading/preservation gate is not advertised as PASS, and no canonical startup-skill publication or automatic cross-window learning is claimed.

## Concrete source review before activation

The access/testing blocker is closed. The next boundary is **governance and production rollout**, which the current instruction excludes. Before any live publication, review the exact required source versions:

| Required source | Candidate or gap | SHA-256 / decision |
|---|---|---|
| Master Brief | Canonical v4.0; genuine byte-identical fixture tested | `4237146b7142b62f9bc423fcbbb42d3205899eef67ca8135cf7dc066904292a2` |
| Evidence Policy | Canonical v4.0; genuine byte-identical fixture tested | `1eeab79c9ac903ff7ca69b6dcf15f9c38a9e2a273698e910c7926dd60e74b7e4` |
| Project Instructions | Archive contains 4.1 plus older versions; current owner instructions are 4.3. No 4.3 source was published by this work. | Existing 4.1 hash `c3901aa1d69b156fc686d8dccd8705e3db0f799bc58dca0d2c6ce94c4a5f67d7`; review/version reconciliation required, not automatic approval of 4.1 |
| Photo Examination | Supplied original bytes match one existing archive variant; other newline/placeholder variants remain | Byte-match candidate `7c5bae03c54d47a05f94ee7a46bc4e7a8c809006e9dc29f69baa4dd1ab550a3c`; not published |
| Comparable Research | Supplied original bytes match one archive variant, but its older tier wording conflicts with controlling v4.0 Evidence Policy (e.g. current dealer/1stDibs asks). | Byte-match `034f2674a7bfe5e30050c39b5a91ef426306596e95a1f9815123d15d49cbe0ed`; reviewed aligned revision needed before treating it as current authority |

No unreviewed import is automatically promoted. Test-only non-governing workflow bodies are explicitly synthetic. Byte matching proves preservation, not approval or semantic compatibility.

Next safe sequence: reconcile those exact source versions; review the tested SQL and restricted publisher authority; exercise environment-specific hosted gateway/browser acceptance if required; then separately authorise production migration/publication and enable the server flag. Keep inference disabled if an activated approved source set becomes unavailable; do not use legacy mode to bypass a failed approved-source gate. Production changes are not implied by standing authorisation for safe development.

## Integrity at tested code 518f3a1

| File | SHA-256 |
|---|---|
| HTTP harness | `4ecea0e1e7989bd635f40af8f5cf658fa725dce4823d6b56d2bd59009eea177f` |
| Canonical runtime | `1799a56b1197dc1ca990a68aa60c924c6c1e168bd32114fe85462cea4702ec4b` |
| Intake handler | `7b4de906fc6f3bf98422c8ba48b94ef080161841eae4c0f9bb994f15a7494222` |
| Research handler | `f7a7096bc1ec0845feb0620cd521854370ec5b1a5d00f17908d66acabd1e09ba` |
| Dependency lockfile | `b00e22b1f02a26aae9cd490ebf8cc7910aa892f76dc579ed5143595d44eb661b` |

Previous source checkpoint and Drive archive remain preserved. Original transcript/photo/workbook archival gaps, independent original-sale verification, live model quality and signed-in product acceptance remain separate open work; none was silently marked complete here.
