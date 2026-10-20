# Collector Intelligence — isolated publication workflow checkpoint

20 October 2026 (Europe/London). Resume draft PR [#2](https://github.com/otoslifeproject-cell/Collector-Intelligence/pull/2), branch `continuity/resolver-fixtures-20261020`.

The isolated PostgreSQL execution blocker is resolved. The original ledger proposal and a new workflow extension passed actual PostgreSQL 17.11 tests. Production source resolution is **not** repaired or cut over.

## Verified code and tests

| Stage | Commit | Result |
|---|---|---|
| Disposable PostgreSQL harness, publication workflow proposal, safety disable and URL guard | `6ac245e024d4cd17639dfe1e057c1a856dd4c141` | [Actions run 39509335989](https://github.com/otoslifeproject-cell/Collector-Intelligence/actions/runs/39509335989): both jobs succeeded; 36 PostgreSQL assertions |
| Approved-source reader candidate, expanded atomic/race tests, publisher role guard | `92231966ac9b854003a28b012447a7fbbd6e2cdc` | [Actions run 39509625617](https://github.com/otoslifeproject-cell/Collector-Intelligence/actions/runs/39509625617): both jobs succeeded; 40 PostgreSQL assertions and 22 reader assertions |

Latest code checks: 40 database assertions, 22 reader assertions, 25 existing resolver assertions, 13 static migration assertions, 19 staging-target assertions and 27 existing application tests passed (146 total across distinct suites). Local `npm run build` passed. Vite retains the existing warning about a bundle exceeding 500 kB. No browser/layout acceptance or paid model call was performed.

Database job `118927121136` explicitly logged PostgreSQL `170011`, synthetic database `ci_staging_ledger`, and **40 PostgreSQL integration assertions passed**. These are real separate PostgreSQL login sessions and RLS policies with synthetic `request.jwt.claim.sub` values. They are **not** two real Supabase Auth accounts or HTTP/PostgREST end-to-end acceptance.

## What changed

- `scripts/test-continuity-postgres.mjs` requires explicit isolated confirmation, a loopback URL, `ci_staging_*` database name, PostgreSQL 17+ and an empty database before any setup. The GitHub job supplies a disposable `postgres:17` service and synthetic credentials, never production secrets. It reuses the existing canonical schema/triggers. Embedded migration COMMIT is allowed only because the entire database is disposable; it is not hidden inside a supposedly rollback-safe outer transaction.
- `supabase/proposals/canonical-publication-workflow.sql` extends the preserved original proposal. It adds an immutable publication sequence; a private, privilege-restricted publisher deriving owner from `auth.uid()`; per-owner/key transaction locks; expected-predecessor conflict detection; exact-version replacement; revocation; owner SELECT policies; and a SECURITY INVOKER approved-source view. Ordinary clients receive no publication DML or private publisher access. The special publisher role has no login or membership assigned by this proposal. Privileged role provisioning and publication review authority remain rollout decisions.
- Tests cover missing/other-owner/anonymous access, missing base-table grants, pinned-policy and placeholder rejection, exact older-version selection, version replacement history, immutable audit events, stale publishers, rollback on pointer-write failure, revocation and attempted reactivation, concurrent first/subsequent publication, preserved source bytes and disable/re-enable replay.
- `supabase/proposals/canonical-publication-disable.sql` revokes reader/publisher access while preserving source, event and pointer rows. It is a tested preproduction safety disable, **not** a complete production/schema rollback or a return to recency fallback.
- `scripts/validate-staging-target.mjs` now rejects query parameters and fragments. Driver URL parameters could otherwise override a validated host/database. Added override and IPv6 cases; 19 target checks pass.
- `src/lib/approvedCanonicalSources.ts` is an **unwired server reader candidate**. It verifies Auth first, derives owner from that response, uses fixed caller-specific required keys, queries only the approved view, requires an exact complete result count, recomputes every body hash, verifies governing pins and returns publication receipts. Missing, duplicate, truncated, tampered or wrong-owner results fail closed. Its pure validator is not an authentication boundary. The two paid endpoints and Research UI have deliberately not been switched to it.
- `.gitignore` excludes dependencies, build output and local secrets. No dependency update was committed; the CI database driver is explicitly `pg@8.13.1`.

## Source receipt and authority limits

Current owner instructions v4.3 and the explicit request to resume safe development govern this bounded session. The supplied short Master/Policy copies are older; they were not substituted for canonical v4.0.

Full governing Supabase texts were retrieved and their SHA-256 values recomputed in the database:

| Source | Version | SHA-256 |
|---|---|---|
| Master Brief | 4.0 | `4237146b7142b62f9bc423fcbbb42d3205899eef67ca8135cf7dc066904292a2` |
| Evidence Policy | 4.0 | `1eeab79c9ac903ff7ca69b6dcf15f9c38a9e2a273698e910c7926dd60e74b7e4` |
| Archived Project Instructions | 4.1 | `c3901aa1d69b156fc686d8dccd8705e3db0f799bc58dca0d2c6ce94c4a5f67d7` |

Read and applied repository startup skill, Skill 15 and relevant governance, recovery, build-contract, benchmark and Knowledge Brain records; inspected the existing PR/history, current operating index, progress and relevant chronological handover sections. Read Drive checkpoints `1mC3RsVqUfWPbf7rerB-tVXid1CCZhbtVvRNFA3jS-5c`, `1cyVPpyReGyc6Etm7tXz1Lkqff34U_2b3u10B9bzrjsI`, `1i1lpyjWvxQu8iIJN8KDyK9xZ2HtQuyL1I77D6uHSmTA` and `1liW3Xov8Sc2eZCeEOC5_JNI_aW2rTmh9zOwGJSJIEU8`.

**Scoped engineering receipt: CONDITIONAL.** The complete 155 kB historical handover, every foundational module/version and every original Drive object investigation were not fully reread in this session. No exhaustive v1.2 archival startup PASS is claimed. This work follows the current owner's bounded safe-development instruction and v4.3 provisional-access rule. No governing instructions/skills were revised or published. Supabase startup skill remains version 1.0 (`ab688d1e5a02b921ebe0bfcb2970298bfe70c84a07523055994591ee4a94609e`); repository updates do not automatically publish there.

## Production and deployment boundary

Read-only Supabase checks before and after work: 90 canonical rows / 41 keys; no publication ledger, active approvals or approved-reader view installed. Current v4.0 hashes still recompute correctly. Only the production/default Supabase branch is connected. No database writes, migrations, source promotions, stock changes or sale claims were made there. Existing conflicting `is_current` flags remain unresolved in production.

GitHub main remains `052a14dbd54a60872240d1c8cca1a5b54c53cda0`; its Vercel status is SUCCESS, superseding the older rate-limit snapshot for that SHA. Vercel's integration also automatically reported a successful build for branch code `9223196`. No deployment/promotion command or merge was invoked. Deployment environment details and signed-in product behavior were not independently verified; a Vercel success status is not proof of Auth or runtime acceptance.

Native PostgreSQL binaries were obtainable in this workspace but could not start under the available process/identity permissions. The executed PostgreSQL evidence comes from the disposable GitHub service, not that unsuccessful local attempt. No permission bypass was used.

## Exact remaining gate

Before production cutover, provide or explicitly provision an isolated **non-production Supabase Auth/PostgREST target**. No such connected target is available; creating a hosted branch may incur charges and was not attempted. Do not use production as a fixture sandbox.

1. Provision two genuine test Auth users and a deliberately restricted publisher identity in that isolated target; verify authenticated/anonymous HTTP RLS, grants and private-schema exclusion.
2. Review exact source versions and publication authority, including governing policy hashes, required workflow versions, predecessor and rollback procedure. Test genuine v4.0 policy success with reviewed bytes; synthetic substitutes correctly fail these tests.
3. Exercise the candidate reader through Auth and PostgREST with missing/revoked/complete sources. Verify the exact caller-required set and zero paid calls on failure. Reconcile revocation during an in-flight request and the policy for already-running analysis.
4. Only then refactor both paid endpoints and Research inspector, save publication receipts, run endpoint and signed-in regression, and obtain production migration/cutover authority. Draft PR remains unmerged; no automatic production approval is implied by this checkpoint.

Historical transcript/photo/workbook binary archival gaps remain a separate open backlog. No recovered AI assertion was promoted to verified object knowledge.

## File integrity

| File | SHA-256 at code commit `9223196` |
|---|---|
| Original ledger proposal, unchanged | `340ced9aa9fcfd1f2b5fecd909fd032d066de0f16998d1ccd10e43111ce6e304` |
| Workflow extension | `c019866d911ab31f92b1973e99a491ed58bff39d70a20d7acd1a054367b1e068` |
| Safety disable | `feabf147613b85ddf77677871791ae70a56951608dbd8bb70b212942014a1730` |
| Reader candidate | `d339fff02ac81d16af9a30598ddb105688c6a01dd9f81c02cc3f7d6d7051f638` |

Source history remains in GitHub. This checkpoint is suitable for a private Drive archival copy; it is not evidence that the production source gate or automatic learning has shipped.
