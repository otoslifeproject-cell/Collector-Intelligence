# Collector Intelligence — owner revisions and paid research session acceptance

21 October 2026 (Europe/London). Continued from `7eaa7c3dcc34eecb96b5c1e42f69807b59fe745f` on the existing `continuity/resolver-fixtures-20261020` branch and [draft PR #2](https://github.com/otoslifeproject-cell/Collector-Intelligence/pull/2). No restart, merge, production database modification or manual deployment.

## Result

Saved research replay previously omitted its stored model because the owner-scoped SELECT did not request that column. It now returns the actual stored model and original response ID alongside the unchanged saved result, with no new provider request.

A provider connection loss or non-JSON response after a successful claim previously escaped the handler without a structured recovery response. It now returns `PAID_RESEARCH_OUTCOME_UNCONFIRMED`, identifies the saved run and explicitly warns against repeating paid research. Provider HTTP errors and invalid structured output similarly identify the claimed run with distinct error codes. Missing/null provider envelopes are handled without throwing during text extraction. Failed persistence still returns the complete recoverable result, now with its research run ID.

The handler never resets an uncertain run to STAGED or automatically retries inference. PROCESSING is retained because a lost response cannot establish whether work or billing occurred. This is duplicate protection for the same staged run through the application/RPC flow, not an account-wide billing guarantee: deliberately creating a new research session remains a separate paid action. No existing interrupted production run was reset, recovered or changed.

Implementation commit `efed091516683018d6bc4f64e7994b7c4329b21d`; fixture/diagnostic correction `07012adb5b729646735a48843a92e38313ba4dc8` (final tested code).

## Verification

[Final Actions run 39591614313](https://github.com/otoslifeproject-cell/Collector-Intelligence/actions/runs/39591614313) is SUCCESS in all four jobs at code `07012adb5b729646735a48843a92e38313ba4dc8`. Complete job logs were fetched and counts checked, including all 37 new real-service cases and seven new cost-free handler cases.

| Job/coverage | Named tests/checks | Job ID |
|---|---:|---|
| Resolver, exact source, runtime and target fixtures | 122 | 119193693963 |
| PostgreSQL 17 publication integration | 40 | 119193693927 |
| Real Auth/Kong/PostgREST/SDK and session tests | 68 (31 existing + 37 new) | 119193693888 |
| Actual signed-in archive component browser | 14 | Same HTTP job |
| Existing static layout browser | 13 | Same HTTP job |
| Application and archive reader | 46 | 119193693579 |
| **Total** | **303** | Four successful jobs |

Strict API compilation, locked dependency installation and TypeScript/Vite build also PASS. Local cost-free handler tests (23), app/reader tests (46), strict API compilation, syntax/whitespace checks and build passed. Local Docker is unavailable; the actual-service acceptance ran in GitHub's isolated runner. Existing >500 kB bundle and action/dependency deprecation warnings remain non-blocking. Expected database permission/conflict exceptions are negative-test evidence, not test failures.

The source/review checker continues to report **integrity PASS / publication BLOCKED**. This is the expected source-review boundary, not a CI failure or authorisation to publish.

### Real Auth/PostgREST coverage added

The existing guarded HTTP harness starts with an empty PostgreSQL 17 database, real GoTrue 2.197.0, PostgREST 14.18 and supported Kong 3.9.3, using two genuine disposable Auth accounts. It now installs the original AI-run schema, paid-claim RPC and owner-review revision RPC from their checked-in migrations, unchanged. Their SECURITY INVOKER, auth.uid(), row locks, owner RLS, grants and audit transactions execute in actual database requests through the gateway.

| Workflow | Verified acceptance |
|---|---|
| Owner edit | A revision saves working title/condition while original AI objects and complete photo-manifest JSON remain identical |
| Concurrent edit | Two requests using the same expected revision produce one winner, one conflict and one new audit entry; prior fields survive the merge |
| Stale tab | A stale expected revision cannot overwrite newer text |
| Rejected input | Unknown fields, non-text/oversized values, blank title, invalid object index and empty/non-object changes produce no row or audit changes |
| Audit failure | Revoking audit INSERT in the disposable DB makes the entire attempted review update/revision increment roll back; grant restored afterwards |
| Private history | Other-owner reads see no history; anonymous/other-owner edits and client audit update/delete are refused |
| Claim contention | Twelve simultaneous real HTTP claims admit exactly one CLAIMED result; eleven are rejected, with original source context retained |
| Claim state | PROCESSING, missing stage, malformed envelope, missing source, non-DRAFT and non-research records are refused without resetting them; COMPLETE returns COMPLETE unchanged |
| Actual server handler | With real Auth, source retrieval, ownership checks, RPC claim and REST persistence, a held synthetic provider response makes a concurrent duplicate return 409; exactly one fixture provider dispatch occurs |
| Persist/replay | Real storage contains the complete returned result, source receipts and model. Replay returns the same model/response/result with zero new provider calls |
| Preflight mismatch | Wrong source object, photo count or research depth stops before claim, preserving STAGED and making no provider request |
| Uncertain outcome | Injected connection loss, non-JSON HTTP response, provider error, malformed structured output and null envelope retain PROCESSING; same-run retry is refused with no second dispatch |
| Failed result save | An injected PATCH outage returns the completed recoverable fixture answer; storage remains PROCESSING and repeated invocation cannot dispatch again |

The exact original source-photo manifest is JSON fixture evidence in these tests. No Storage service, actual photograph bytes, catalogue approval or private object upload is exercised. The two-tab behaviour is a real concurrent RPC test, not browser acceptance of the SavedDraft form.

`tests/fixtures/research-session-support.sql` is explicitly disposable support, not a production migration. It supplies a minimal owner-RLS item table and **empty synthetic evidence-context views** so the actual research handler can reach persistence. This does not certify the production trusted-knowledge, comparable or visual-review view definitions. Model replies are synthetic and intercepted; no AI provider is contacted. Unknown non-loopback requests are blocked inside the handler tests. Positive Auth/REST/RPC paths use real services; only provider output and intentional save-outage responses are mocked.

The existing authenticated archive-component browser suite is rerun by the same job after the new session acceptance; its scope remains the actual component/SDK against disposable services. The old layout suite remains separate static layout coverage. No new UI or CSS was changed in this stage, and no new full-route or human UX acceptance is claimed.

### Failure preserved and corrected

[First run 39591309651](https://github.com/otoslifeproject-cell/Collector-Intelligence/actions/runs/39591309651) passed the source, PostgreSQL and application jobs. The HTTP job passed owner revision contention, audit rollback and twelve-way claim contention, then failed before the synthetic provider barrier. Service diagnostics identified a missing `items.source_object_index` column in the deliberately minimal fixture; production lineage uses that column. The fixture now includes it. The barrier also races the first handler response so a preflight rejection reports its status/body immediately rather than only a ten-second timeout. This was a test-fixture failure, preserved in history; it was not treated as acceptance.

## Source continuity and production boundary

Read the existing startup/no-drift skills, latest chronological handover/progress/queue and phase 3/4 records, PR history and verified Drive archive handover before changes. Existing controlling v4.0 source bodies and exact original workflow/instruction fixtures remain unchanged. The current Instructions source conflict is not resolved by these engineering changes; no exhaustive historical-archive startup PASS or automatic cross-window learning is claimed.

A fresh **read-only** connected Supabase snapshot returned 90 canonical rows / 41 distinct keys, no publication-events relation and no approved view. Stored v4.0 hashes still match database recomputation:

- Master Brief: `4237146b7142b62f9bc423fcbbb42d3205899eef67ca8135cf7dc066904292a2` (13,235 characters).
- Evidence Policy: `1eeab79c9ac903ff7ca69b6dcf15f9c38a9e2a273698e910c7926dd60e74b7e4` (5,450 characters).

No hosted Auth accounts, production rows, original photographs, source versions, approvals, evidence, comparables, catalogue items, sale records, environment flags or database permissions were modified. No SQL migration was applied to production; no paid branch or inference was created. All test database permission changes described above occurred only in the disposable CI database.

GitHub main remains `052a14dbd54a60872240d1c8cca1a5b54c53cda0` with Vercel SUCCESS. Tested branch code `07012adb5b729646735a48843a92e38313ba4dc8` also has automatic Vercel SUCCESS. These are separately retrieved status observations; no manual deployment, production promotion or hosted signed-in acceptance is inferred.

The exact full current Project Instructions (previously referenced as v4.3) remain unavailable; the latest supplied file matches an older unversioned archive. Do not invent that manuscript or substitute archived v4.1. Publishing the prepared source candidates or enabling the approved-source mode remains excluded under the standing no-production instruction. Hosted Envoy/TLS/OAuth/session persistence and complete Research/SavedDraft/ItemDetail browser acceptance remain environment-specific. Live model research quality and genuine sold-source verification are not inferred from fixture success.

## Integrity

| Checked-in file | SHA-256 |
|---|---|
| Original AI-run migration | c8f5a24291f08250e3742233e8f068e527845e566d1ea24224bddb5b074d3f9d |
| Original paid-claim migration | 78afb6bb606dff2ea3573cd8a55ab4b90697fe3b8e631bbd4cdef470c53ef4b9 |
| Original owner-review migration | d125c47ed2182bb6df78f58fd7cebf934931b9aa6f9e3f74dce6f81f0900ccac |
| Research handler | e10dc2fd253a5a09ff2a1b9800b6c2ed548a1b42b116ad6230416794ec6db43c |
| Session acceptance module | 7aa785810aa29f2ff3402a19fb3069fa56a775682d0b1bffd1ec5706fe895777 |
| Disposable supporting schema | 2a52df58f9c205fb4130796b8b0c2e0d9780ebde8ccf1c40883684201747b312 |
| Cost-free handler regressions | 0f4de2ba41c3ce3d4e8e518918c7d4565c9969a8235ef2e5f8bf0588aad8c1cc |

[Verified seven-file evidence ZIP](https://drive.google.com/file/d/1SfHY0a6wugo9C97YhRgVZYlXPU_K_vqD/view?usp=drivesdk), Drive ID `1SfHY0a6wugo9C97YhRgVZYlXPU_K_vqD`, contains all four final full job logs, the first failed HTTP job log, a machine-readable result receipt and per-file integrity manifest. Size 72,066 bytes; SHA-256 `b4bee3dc5d660b12128a764bfa6ce0467ad32e5fbcd5c659d6fc594f083796f9`. Actual raw Drive download equals the local ZIP byte-for-byte; ZIP integrity, seven entries, metadata size and archive parent verified. Logs contain disposable fixture activity, not private collection photographs or production credentials.

This dated checkpoint is archived separately and preserved unchanged after exact text read-back. Its final Drive ID, size and digest are appended to CURRENT_HANDOVER and PROJECT_PROGRESS_LOG. Previous source, handover and screenshot archives remain preserved.

Safe continuation can extend disposable acceptance to the existing photo-preserving catalogue approval path, retaining original source bytes and testing idempotence/rollback. Full signed-in hosted-route acceptance needs an appropriate non-production account/environment, not production mutations or another blind paid rerun. Source publication remains blocked on the exact current Instructions and subsequent review; this does not invalidate the independently verified session engineering.
