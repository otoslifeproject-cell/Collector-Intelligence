# Collector Intelligence — catalogue approval transactions and source guards

21 October 2026 (Europe/London). Continued from `eb4b06e545eea97c8dfa5b46fb0dc77def7a45f1` on `continuity/resolver-fixtures-20261020` / [draft PR #2](https://github.com/otoslifeproject-cell/Collector-Intelligence/pull/2). Existing branch/history retained. Production remains unchanged.

## Outcome and before/after evidence

The next independent stage tests catalogue approval with genuine signed-in requests and actual application schema/RLS/RPCs in the existing disposable GoTrue/Kong/PostgREST/PostgreSQL stack. The former minimal item fixture is replaced by the unchanged original core schema and RLS migrations. Source Storage rows remain an explicitly synthetic metadata stand-in; no Storage API or original photograph byte acceptance is claimed.

Three original-function defects were reproduced in disposable records before installing the candidate:

1. An owner-confirmed photo correction `[0,0]` was accepted and created two photo links to the same source path.
2. Pair members such as `["0","1","ignored-invalid-member"]` were filtered into a valid pair instead of being refused as malformed.
3. A physical material correction from Glass to Metal invalidated the copied maker/date/prices, but left the original model's identification/dating/valuation confidence at 82/75/65 in the catalogue item. The original report was retained, but the new item still carried confidence from rejected assumptions.

A separate **unapplied preproduction candidate**, `supabase/proposals/catalogue-approval-input-guards.sql`, now rejects malformed source/object lists, null review envelopes, non-integer/duplicate approved photo references and invalid explicit pair members. A material contradiction clears all three copied confidence values and copied attribution-history confidence to NULL, alongside the existing maker/date/price invalidation. Unknown confidence is not replaced by a fabricated zero. The original model report, original scores, raw photo references and full source manifest remain unchanged and inspectable.

The candidate preserves the three-argument RPC signature/default, owner checks, SECURITY INVOKER, fixed search path, RLS, row lock, atomic status transition, exact source links, explicit correction snapshots and idempotent reuse for an already approved selection. It does not edit/backfill previously approved catalogue items or automatically install anywhere. The original v6 migration is preserved byte-for-byte. Reinstallation, reversal to the original function and subsequent reapplication were tested in the disposable database without changing existing accepted rows or source metadata.

## Verification

Tested code `7ff2d30a3139aab7e3f8956e65e35d7301a79e2c`.

[Actions run 39597878718](https://github.com/otoslifeproject-cell/Collector-Intelligence/actions/runs/39597878718) is SUCCESS in all four jobs. Complete job logs were retrieved and counts checked:

| Coverage | Named tests/checks | Job ID |
|---|---:|---|
| Resolver/source/runtime/target fixtures | 122 | 119214624774 |
| PostgreSQL publication integration | 40 | 119214624733 |
| Real Auth/Kong/PostgREST/SDK/session/catalogue | 119 | 119214624386 |
| Actual signed-in archive component browser | 14 | Same HTTP job |
| Existing static layout browser | 13 | Same HTTP job |
| App and archive reader tests | 46 | 119214624728 |
| **Total** | **354** | Four successful jobs |

The HTTP total adds **51 catalogue checks** to the previous 68: three original-defect reproductions plus 48 candidate/transaction acceptance checks. Baseline reproduction is labelled BASELINE in the logs and is not presented as acceptance of the original unsafe behaviour. The proposal was then installed only in that disposable database and the corrected cases were checked.

Strict API compilation, locked dependency installation and TypeScript/Vite build PASS. Changed scripts pass local syntax and whitespace checks. Actual services run in GitHub's isolated runner because local Docker is unavailable. Existing >500 kB bundle and action/dependency deprecation warnings remain non-blocking; expected permission/conflict exceptions are negative-test evidence. No paid model call was made.

| Acceptance boundary | Real-service evidence |
|---|---|
| Ownership | Anonymous and other-owner approval refused without row changes; foreign catalogue/photo/evidence/attribution/task reads empty under original RLS |
| Single object | Owner title/condition and acquisition context retained; exact original source paths linked; one hero; original AI objects, first-pass snapshot and manifest unchanged |
| Idempotence | Four repeated requests return the same item identity without extra children/photos; an approved selection cannot expand to different source objects |
| Contention | Eight simultaneous requests create one catalogue child and two photo links; every response reuses the same identity |
| Separate siblings | Batch objects keep their own non-contiguous original photo indices and independent hero selection |
| Explicit pair | Two physical members become one lot with deduplicated union of both photo sets; original member observations and pair snapshot retained |
| Invalid AI reference | An invented seventh-photo index blocks approval; explicit owner-confirmed real subset succeeds and records raw versus approved indices |
| Input guard | Duplicate, foreign, fractional, string, empty or null photo corrections; extra/string/mixed/duplicate/null pair members; invalid selections/review objects all refused atomically |
| Preserved malformed original | Missing/non-array objects, null source object and absent/non-array photo indices remain inspectable rather than being overwritten or silently repaired |
| Source ambiguity | Duplicate selected manifest index, missing metadata row or another owner's path cannot become a photo link |
| Partial analysis | STAGED, FIRST_PASS_SAVED and PROCESSING intake cannot be approved; final status trigger rolls back attempted catalogue children; direct status PATCH also refused |
| Atomic child writes | Injected INSERT denial separately at photos/evidence/attribution/tasks rolls back the entire request; failing later batch sibling also rolls back the earlier valid child |
| Material contradiction | New item maker/date/region/prices/confidences remain unresolved; model glass evidence weakens and remains UNVERIFIED; owner observation is separately labelled and not claimed instrument-tested |
| Correction scope | Sibling-specific material correction does not erase an unrelated sibling's original confidence |
| Review history | Revision-backed owner title survives approval snapshot merge; original AI and manifest remain unchanged |
| Source trust | AI intake evidence stays UNVERIFIED; no comparable or Knowledge Brain record is created by approval |
| Reversal | Original v6 can be restored and candidate reapplied without changing accepted records or source metadata |

The metadata table has synthetic object identities and paths, RLS enabled, and the actual application's unchanged Storage policies from migration 002. Its folder helper and schema are test support, not the actual Storage server migration. Approval is exercised through real Auth, gateway and PostgREST with SECURITY INVOKER and original table constraints. The tests prove reference/metadata preservation and transaction behaviour; they do not prove image upload/download byte integrity, signed URL expiry or real private-image rendering.

Application evidence-context views remain explicitly empty fixtures for the paid-handler tests. The full production trusted-knowledge/comparable/visual-review definitions are not certified by these tests. The existing actual archive-component browser tests are rerun and pass; this is not browser acceptance of SavedDraft catalogue controls, two-tab form UX or complete hosted routes. No new UI/CSS or paid handler behaviour is changed in this stage.

## Production definition and source continuity

A **read-only** connected query confirms live `ci_approve_saved_intake_v1(uuid,integer[],jsonb)` has SECURITY INVOKER, `search_path=pg_catalog, public`, and function-body SHA-256 `8b53651cce1bf08ebaff610acd461a9fff8d0750c5761c6538c120f362a158f3`, exactly matching the checked-in original v6 body used for the baseline reproductions. No live approval or test record was executed. The candidate remains unapplied; this result must not be advertised as a production fix.

Canonical snapshot remains 90 rows / 41 keys, no publication-events relation and no approved-source view. The controlling v4.0 Master/Evidence hashes still match recomputation. The original Instructions/source-version conflict is unchanged. Relevant startup/no-drift, catalogue/photo/build sources, phase records, current handover, PR history and prior verified Drive checkpoint were read. Applied Supabase/Postgres guidance for owner RLS and short atomic transactions. No exhaustive historical-archive startup PASS or automatic cross-window learning is claimed.

No production schema, function, permission, record, Auth account, original photograph, catalogue, comparable, Knowledge Brain claim, sale, environment or source-mode flag was changed. No migration/proposal was applied to production, hosted branch created, paid inference made, merge or manual deployment/promotion performed. All permission revocation, synthetic metadata deletion and function reversal above occur only in the guarded disposable database. Sequence values may have gaps after rollback; transactional row preservation, not sequence reuse, is the acceptance criterion.

GitHub main remains `052a14dbd54a60872240d1c8cca1a5b54c53cda0` with Vercel SUCCESS. Tested branch `7ff2d30` also has automatic Vercel SUCCESS. Build/deployment status does not establish production promotion, live SQL installation or authenticated hosted-route acceptance.

The owner's emailed screenshot shows an earlier HTTP-job failure. The first fixture failure was corrected previously; final session code run 39591614313 and the subsequent handover-head run 39592336162 are both SUCCESS. The new catalogue run above also passes. No mail message was altered or sent.

## Integrity and preserved review package

| File | SHA-256 |
|---|---|
| Original core schema | 2ccb166341e2d4e056c7239af6e2cbd25cf740252d844fa99b60d0af478e5057 |
| Original RLS/Storage policies | d4ea0965f1915dff06237c5c73684e63c54c601e641a780709accaa65f1bce95 |
| Original v6 approval migration | 4f68ab63c7e26dcf37580a581942ac52c272f68b073620b87d27f6da4c578540 |
| Unapplied catalogue candidate | 9519ae2d6dba5d3d7f66014d1e7bf9ee590d9ba2dce71d3a7b1b4698da2b8751 |
| Catalogue acceptance module | e2ed49070ca3d921f5be24d03680d0d0cf4f26692697dbd86f7d4b8fe4405268 |
| Storage metadata fixture | 4da65cbf77e30ba3a24d6fed1d7b5ae17ca35da9d71b1111828b73b45223d140 |

[Verified nine-file review/evidence ZIP](https://drive.google.com/file/d/1WmSqPEqjmEqDVrTfry0LQef74VKAXZd9/view?usp=drivesdk), Drive ID `1WmSqPEqjmEqDVrTfry0LQef74VKAXZd9`, contains all four full final job logs, machine-readable result receipt, unchanged original v6, separately marked candidate, review diff and per-file manifest. Size 71,207 bytes; SHA-256 `b91037a0aa6c8f9f0d8428eb0f1bc35f42fd04f859b0af8db8ece66a5a7ea52f`. Actual raw Drive download equals the local ZIP byte-for-byte. Metadata size/archive parent, ZIP integrity/nine entries and every contained file digest checked. No production credentials or private collection photographs are in the package.

This dated checkpoint is archived separately and kept unchanged after exact read-back. Its final Drive ID, size and digest are appended to CURRENT_HANDOVER/PROJECT_PROGRESS_LOG. Previous versions, source manuscripts, failed-run evidence and reviewed screenshot archives remain preserved.

## Remaining acceptance and decision boundaries

The candidate is ready for review, not production application under the standing no-production instruction. Do not backfill or rewrite existing catalogue confidence, original AI material, photographs or approved history. A later controlled rollout needs an appropriate environment and explicit scope, with installed-definition verification after any authorised application.

Exact full current Project Instructions (previously referenced as v4.3) remain unavailable; do not invent or substitute historical v4.1. Source review/publication and approved-source-mode activation remain pending. Full hosted routes/Envoy/TLS/OAuth/session persistence, actual Storage bytes/signed images and human mobile/form acceptance remain separate. No collection ingestion, genuine sold-source verification or live AI quality acceptance is inferred from fixture success.
