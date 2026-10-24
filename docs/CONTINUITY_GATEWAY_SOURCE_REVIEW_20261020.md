# Collector Intelligence — gateway acceptance and source reconciliation

20 October 2026, continuation from `55ac0e3fce598cda7851cc556e5902ba820a080c`. Existing branch `continuity/resolver-fixtures-20261020`, [draft PR #2](https://github.com/otoslifeproject-cell/Collector-Intelligence/pull/2). No project restart.

**Tested code: `5c44b5807149a04aabcbe4060dba3ea26a25e6f6`. All four CI jobs pass, 210 test cases/checks.** The disposable Auth/PostgREST acceptance now includes a real Kong API-key gateway and the actual Supabase JavaScript SDK. Exact source originals and a separate policy-aligned comparable-workflow draft are preserved. The remaining source blocker is the exact current Project Instructions manuscript; no v4.3 text was invented or replaced by v4.1.

## Verified checks

[GitHub Actions run 39514363879](https://github.com/otoslifeproject-cell/Collector-Intelligence/actions/runs/39514363879) completed successfully:

| Job | Checks | Job ID |
|---|---:|---|
| Real GoTrue/PostgREST/Kong/SDK | 28 | 118942852131 |
| PostgreSQL 17 integration | 40 | 118942851849 |
| Resolver/source/target/runtime/paid-route fixtures | 115 | 118942852185 |
| Existing application tests | 27 | 118942852483 |
| **Total** | **210** | Four successful jobs |

Retrieved the complete job logs and read their reported counts. The fixtures include 12 new source-review tests (previous fixture count 103). The HTTP suite adds five named cases (previous count 23). Tests contain multiple assertions; 210 is the named test/check total, not a claim that every individual assertion was counted. Strict affected-API compilation, clean lockfile installation and TypeScript/Vite build also pass. Local source/reader/runtime/handler tests, syntax checks, API compilation and application build pass. Existing >500 kB bundle warning and the SDK test's Node punycode deprecation warning are non-blocking.

## Real API-key gateway and SDK

Replaced the Node prefix-only router in `scripts/test-continuity-http.mjs` with disposable `kong/kong:3.9.3`, the currently supported Supabase Kong override image. `scripts/continuity-kong-config.mjs` constructs a narrow Auth/REST configuration with real key-auth, ACL and request-transformer plugins. Kong admin/status listeners are disabled; proxy binds loopback. The test config accepts only a per-run signed anon key and a generated opaque publishable fixture key. No service-role API credential is provisioned.

The configuration follows the supported primary-source [Kong Compose override](https://github.com/supabase/supabase/blob/master/docker/docker-compose.kong.yml), [routing configuration](https://github.com/supabase/supabase/blob/master/docker/volumes/api/kong.yml), and [Authorization translation entrypoint](https://github.com/supabase/supabase/blob/master/docker/volumes/api/kong-entrypoint.sh), fetched during this continuation. The official [default Compose](https://github.com/supabase/supabase/blob/master/docker/docker-compose.yml) now uses Envoy; this suite deliberately tests the supported Kong alternative, not the hosted Envoy deployment.

Verified through the actual gateway:

- Missing/invalid API keys are rejected on Auth and REST, including requests carrying an otherwise valid genuine user JWT.
- Both legacy signed anon and opaque publishable keys preserve the genuine user principal and exact approved-source receipts.
- The locked Supabase SDK performs password login, getUser, owner-scoped PostgREST reads and refreshSession for both accounts/key formats. Refreshed tokens pass the actual approved-source loader. Explicit other-owner queries return no rows.
- An opaque publishable key without a user session remains anonymous and cannot read the approved view or satisfy the source gate.
- Existing forged/expired JWT, metadata-spoofing, RLS, publication denial, private-RPC exclusion, revocation, reapproval, missing-grant, safety-disable and zero-provider handler tests all pass through Kong.
- Importing the genuine proposed comparable draft as a newer unapproved row does not replace the existing explicitly approved fixture version.

GoTrue `v2.197.0`, PostgREST `v14.18` and PostgreSQL 17 remain disposable CI services. The HTTP job now installs the existing lockfile so its SDK and database driver are reproducible. Database-target, explicit-confirmation and empty-database guards run before DDL; no production credentials are used. Fixture containers and generated gateway configuration are cleaned up.

Coverage does not certify hosted API-key translation/signing infrastructure, hosted Envoy, TLS, OAuth, browser cookies, signed-in product UI or live paid-model output. Provider requests remain intercepted in cost-boundary success tests. No paid analysis was triggered.

## Source reconciliation prepared

`docs/source-reconciliation/REVIEW.md` explains each source decision. `manifest.json` records exact versions, paths, SHA-256 and UTF-8 byte counts for six bodies:

| Manuscript | Character count | SHA-256 |
|---|---:|---|
| Master Brief v4.0 | 13,235 | 4237146b7142b62f9bc423fcbbb42d3205899eef67ca8135cf7dc066904292a2 |
| Evidence Policy v4.0 | 5,450 | 1eeab79c9ac903ff7ca69b6dcf15f9c38a9e2a273698e910c7926dd60e74b7e4 |
| Historical Project Instructions v4.1 | 8,887 | c3901aa1d69b156fc686d8dccd8705e3db0f799bc58dca0d2c6ce94c4a5f67d7 |
| Original Photo Examination | 1,144 | 7c5bae03c54d47a05f94ee7a46bc4e7a8c809006e9dc29f69baa4dd1ab550a3c |
| Original Comparable Research | 1,595 | 034f2674a7bfe5e30050c39b5a91ef426306596e95a1f9815123d15d49cbe0ed |
| Proposed comparable revision | 3,856 | bf1f55b11742007b7b4f6583a56800c8aac58c0070398919e3da471ba14c31f4 |

The original three non-governing manuscripts were retrieved read-only from canonical archive rows and saved byte-exactly in `tests/fixtures/source-archive`. Newline variants and placeholders remain untouched in the database. Frozen Master/Policy fixtures are unchanged; the Master retains its intentional Markdown hard-break spaces.

The proposed comparable revision takes the complete Tier A–D section from v4.0 Evidence Policy: active dealer/1stDibs asks are Tier D context. It retains search order and matching weights, and applies the existing internal-first, independent verification, provisional valuation and write-back rules. A dated correction also supersedes the same outdated retail/Tier C wording in the repository governance protocol; historical text is preserved. This is a proposal in a separate directory, not an installed/published workflow or a policy rewrite.

`scripts/check-source-review-bundle.mjs` verifies the exact caller-required key union, complete source identities, UTF-8 sizes/digests, policy pins and historical/candidate separation. It reports **integrity PASS / publication BLOCKED**. Tests detect missing/duplicate/extra keys, changed bytes/final newlines, recomputed-but-wrong governing policies and attempted v4.1 substitution for v4.3. The comparable tier block is checked directly against the controlling policy.

The checker is offline and has no publication/database operation. Its exit success certifies preserved bytes, not semantic approval or production readiness. The runtime does not consume this review manifest.

## Exact outstanding source/access decision

The read-only canonical inventory contains Instructions v4.1, DRIVE_2026-10-10, original-file variants and a placeholder, but no v4.3 row. The known Drive `01_PROJECT_INSTRUCTIONS.md` was read in full and identifies itself as **v4.0**, not v4.3. Targeted Drive and personal-context retrieval returned no verified full current v4.3 manuscript. The native project-settings-addendum fetch returned empty text. No unrelated project's similarly named instructions were adopted.

**Needed from the owner: the exact complete current Project Instructions, or an exact authoritative source link/version to use.** This is needed to prepare and review the missing source, not repeated permission for development. The historical v4.1 candidate remains absent from the current-publication slot. The photo workflow and proposed comparable workflow still need an explicit content/publication review before activation.

After the exact instructions are available: preserve and hash them, complete review of the prepared sources, and rerun the source tests. Production migration/publication/activation remain outside the current no-production instruction. No production action is implied by this continuation. The previous Auth/PostgREST access blocker is closed for disposable CI; do not reopen it as a need for production credentials.

## Production and repository boundary

Read-only Supabase still shows **90 canonical rows / 41 keys**, no publication-events table, no approved view and no `ci_private` schema. No production DDL, records, Auth accounts, source approvals, environment settings, photographs, stock, attributions, comparables or sale outcomes were changed. No hosted branch was created.

Original ledger proposal SHA remains `340ced9aa9fcfd1f2b5fecd909fd032d066de0f16998d1ccd10e43111ce6e304`; workflow SQL remains `c019866d911ab31f92b1973e99a491ed58bff39d70a20d7acd1a054367b1e068`. No SQL proposal was applied to production. Paid handlers and source-mode behavior are unchanged in this continuation; only the approved-reader comment was corrected to describe the existing opt-in accurately.

GitHub main remains `052a14dbd54a60872240d1c8cca1a5b54c53cda0` with Vercel SUCCESS. Branch `5c44b58` also has automatic Vercel SUCCESS. These are status observations, not signed-in UI acceptance or proof of promotion. No manual deployment/promotion command or merge was executed; PR #2 remains draft/open. This scoped engineering work does not claim exhaustive archival startup PASS, canonical skill publication or automatic cross-window learning.

## Verified archive

[Private Drive source review package](https://drive.google.com/file/d/1rUILRYJ03Qc3WzolR9bgw7vIq6f9qmkq/view?usp=drivesdk), ID `1rUILRYJ03Qc3WzolR9bgw7vIq6f9qmkq`, in the existing approved project archive folder. Nine files, 21,320 ZIP bytes; SHA-256 `47b2fe018f600978449a1ef5aa81e1035cfe4df2e0ba2137966bf42234b75032`. Downloaded the actual raw Drive ZIP and confirmed exact byte equality, hash and ZIP integrity. Includes both frozen policies, three originals, the proposed revision, manifest and explanations. No private object evidence was included.

Previous [Auth/PostgREST handover](https://drive.google.com/file/d/1Da3W-IFsTnw1PeVcxynk5MDp0OsfpPv0/view?usp=drivesdk) remains preserved. The new dated checkpoint itself is also archived separately; the resulting Drive ID/read-back is recorded in the chronological handover/progress entry to avoid editing this checkpoint after verification.
