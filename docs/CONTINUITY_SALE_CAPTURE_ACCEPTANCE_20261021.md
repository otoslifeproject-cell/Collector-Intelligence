# Collector Intelligence — consolidated catalogue and sale transaction acceptance

21 October 2026 (Europe/London). Continued the same development branch `continuity/resolver-fixtures-20261020` and [draft PR #2](https://github.com/otoslifeproject-cell/Collector-Intelligence/pull/2), from `eb4b06e`. Original history retained. Production remains unchanged.

## Completed safe stages

| Stage | Result | Preserved checkpoint |
|---|---|---|
| Catalogue transactions | 51 new real-service checks; three original defects reproduced, separate strict photo/pair/confidence candidate verified | [Catalogue handover](https://drive.google.com/file/d/119crl2kDhQapi43jdHJKyCX-UNdWSlq9/view?usp=drivesdk), code 7ff2d30; docs head 54848fc; all four jobs PASS |
| Owner-reported sale transactions | 44 additional real-service checks; four original defects reproduced, separate amount/currency/retry candidate verified | This checkpoint; final code 4153231; all four jobs PASS |

Both SQL candidates are **unapplied preproduction proposals**, not production fixes. No actual item, photograph or sale was created or modified outside disposable CI. The previous paid-research recovery/owner-edit acceptance and actual archive-component browser work remain included and passing.

## Sale findings and candidate

The original checked-in sale v3 body was installed first, with its exact earlier schema migrations and actual listing/sale owner-item RLS. Four defects were reproduced using synthetic items through genuine Auth/Kong/PostgREST requests:

1. A fee string `NaN` passed numeric parsing and stored non-finite net/profit while marking the item SOLD.
2. A GBP acquisition amount was silently subtracted from USD sale proceeds when no explicit same-currency acquisition amount was supplied.
3. Sub-penny fees were rounded individually by the two-decimal storage columns, while net was calculated from the unrounded inputs. Three fees of 0.004 stored as 0.00 each but yielded net 99.99 from gross 100.00, breaking reconciliation against the stored cost lines.
4. Simultaneous identical events checked for a saved event before waiting for the item lock. The first request saved successfully; the waiting identical requests rejected the now-SOLD item instead of returning its already saved outcome.

`supabase/proposals/actual-sale-input-guards.sql` is a separate forward replacement for the existing three-argument function. It requires a JSON boolean owner confirmation, rejects non-finite monetary values and amounts with more than two decimal places (matching the existing database columns), and refuses implicit acquisition fallback when acquisition and sale currencies differ. An explicit acquisition amount supplied in the sale currency is permitted; no exchange rate is fetched, assumed or calculated.

The candidate locks the owner-owned item before checking the event. Forced overlapping identical requests then all return the same saved sale identity. Changed facts with an existing event and a different event for an already sold item remain refused. Original event fingerprints/source references/owner notes stay separate from valuation feedback.

Loss-making sales remain valid. Missing acquisition cost leaves profit and return NULL; a genuinely known zero acquisition cost permits profit but leaves division-by-zero return unknown. Same-currency all-in cost still takes precedence over purchase-only cost. Owner-reported proceeds never become independently verified sold comparables or Knowledge Brain facts automatically.

The original v1/v2/v3 migrations and ownership-hardening migration remain unchanged. The candidate makes no table/data/backfill change. Original-function reversal, candidate reinstallation and reapplication preserve accepted events, item state and fingerprints. This is API/database acceptance, not a claim that the existing UI can enter every API override: the current sale form does not expose the explicit cross-currency acquisition-cost override. That entry/review path must be designed and verified before a rollout covering such items. No UI/CSS was changed in this stage.

## Verification and exact scope

Final tested code `4153231847005793cd991067e79318d788b3a114`, after implementation `80baae669068a752d233c4f747b74c4b1c987311` and a test-only strengthening of late failure injection.

[Final Actions run 39600399011](https://github.com/otoslifeproject-cell/Collector-Intelligence/actions/runs/39600399011) is SUCCESS in all four jobs. Complete logs fetched and counts checked:

| Coverage | Named tests/checks | Job ID |
|---|---:|---|
| Resolver/source/runtime/target fixtures | 122 | 119223137923 |
| PostgreSQL publication integration | 40 | 119223137751 |
| Real Auth/Kong/PostgREST/SDK/research/catalogue/sale | 163 | 119223138152 |
| Actual signed-in archive component browser | 14 | Same HTTP job |
| Existing static layout browser | 13 | Same HTTP job |
| Application and archive reader | 46 | 119223138179 |
| **Total** | **398** | Four successful jobs |

The 163 HTTP checks include seven explicitly labelled BASELINE defect reproductions (three catalogue + four sale), followed by corrected-candidate acceptance. Those reproductions do not certify the original behaviour as safe. Added since eb4b06e: **95 real-service checks** across both stages. Strict API compilation, clean locked dependency installation and TypeScript/Vite build PASS. Local changed-script syntax and whitespace checks pass; actual services run in GitHub because local Docker is unavailable. Existing bundle-size and action/dependency warnings remain non-blocking.

Initial sale run [39600258317](https://github.com/otoslifeproject-cell/Collector-Intelligence/actions/runs/39600258317) also passed all four jobs. The follow-up replaces a permission-denial test with a temporary trigger exception on SOLD status so failure demonstrably occurs **after** the sale INSERT. Revoking UPDATE would instead fail at SELECT FOR UPDATE before insertion, which would not prove late rollback. The final test proves no sale row or status change survives the late failure; the synthetic trigger/function are removed in a finally block. No production trigger is created.

| Sale boundary | Evidence |
|---|---|
| Ownership | Anonymous/other-owner RPC refused without writes; other-owner history invisible; direct foreign-item listing/sale inserts and wrong-item listing links rejected by original hardening RLS |
| Economics | Gross 100, costs 22, acquisition 20 => net 78, profit 58, percentage return 290%; each cost remains individually stored |
| Loss | Gross 10, costs 16, acquisition 20 => net -6, profit -26, percentage return -130% |
| Missing/zero acquisition | Unknown cost yields NULL profit/return; known zero yields profit and NULL percentage return |
| Currency | Implicit GBP acquisition/USD sale blocked; explicit owner-supplied USD acquisition 25 gives net 78 and profit 53 USD; no automatic conversion |
| Idempotence | Exact saved event replay unchanged; reused key/changed facts, different key/second sale and same key/other item refused |
| Forced concurrency | Administrative transaction holds only a disposable item lock; real RPCs are observed waiting via pg_stat_activity/pg_blocking_pids; release proves original failure and four candidate requests reusing one identity |
| Numeric/input guard | NaN/infinite/sub-penny/negative values, invalid dates/currency/venue, non-boolean/unconfirmed input, unsupported fields and oversized source/notes rejected atomically |
| Atomicity | Denied sale INSERT leaves item unchanged; actual late status-trigger failure rolls back the already attempted outcome INSERT |
| Source integrity | OWNER_REPORTED_UNVERIFIED, receipt reference, original owner notes and request fingerprint retained; valuation_accuracy_notes not repurposed |
| Reversal | Reinstall/original restore/reapply preserve saved event/source/fingerprint and return the same identity |

These are synthetic owner reports, not genuine sale receipts, tax/fee advice, independently checked realised evidence or accounting certification. The supported storage schema has two-decimal money columns; the candidate does not establish currency-specific minor-unit rules, valid ISO currency membership, rates, VAT, refunds or tax treatment. Future changes must preserve unknowns instead of fabricating profit or conversion.

Existing catalogue/claim/source tests rerun against the expanded original schema. Browser tests remain scoped to the real archive component and old static layout fixture. Storage objects are still synthetic metadata stand-ins, not real image byte/signed URL acceptance. Research evidence-context views/provider responses remain explicit fixtures. No paid inference or external model request occurred.

## Read-only production definition and retained boundaries

A connected SELECT returned live `ci_record_actual_sale_v1(uuid,uuid,jsonb)` with SECURITY INVOKER, fixed `search_path=pg_catalog, public`, body SHA-256 `cf7cca2300632ff4a73943703724b4e01b26c21d24bf1bc6bbe9886547552552`, exactly matching the checked-in original v3 used for baseline reproductions. The live function was not invoked or replaced. The earlier catalogue body hash similarly matched original v6. The proposals remain unapplied and no existing records were backfilled or corrected.

Canonical read-only snapshot remains 90 rows / 41 keys, no publication-events/approved-source view, controlling v4.0 hashes matching recomputation. Exact full current Instructions (previously referenced as v4.3) remain unavailable; the older supplied Instructions do not resolve that conflict. Source review/publication and source-mode activation remain pending. The current standing authorisation permits these bounded independent engineering stages; no exhaustive archival startup PASS or automatic cross-window memory is claimed.

No production DB/schema/function/permission/Auth/environment/source/stock/photo/attribution/comparable/Knowledge Brain/sale record changed. No hosted branch, paid AI, merge or manual deployment/promotion. GitHub main remains 052a14d with Vercel SUCCESS; final branch code 4153231 also has automatic Vercel SUCCESS. Build status does not establish production promotion, live SQL installation or signed-in hosted-route acceptance.

## Preserved evidence and integrity

| File | SHA-256 |
|---|---|
| Original sale v3 migration | e0f59c9d8a953de3fafd60ac41c896eb0fdf46d68dcfa651b3a8c1f902add005 |
| Unapplied sale candidate | 2497739f69bcab311bc90a4a58a6753b02dd65aca477cf312e9eaeae28126ca2 |
| Sale acceptance module | e73abafa5da3b2680e312a56c95dc91c97335153537c1a3019fc6702df7a95a3 |
| Unapplied catalogue candidate | 9519ae2d6dba5d3d7f66014d1e7bf9ee590d9ba2dce71d3a7b1b4698da2b8751 |

[Verified nine-file sale review/evidence ZIP](https://drive.google.com/file/d/11I7LGJliLtjjOQ9n4eWbHBP0fmPDwn0o/view?usp=drivesdk), Drive ID `11I7LGJliLtjjOQ9n4eWbHBP0fmPDwn0o`, contains four full final job logs, machine-readable receipt, original v3, separately marked candidate, review diff and per-file manifest. Size 67,167 bytes; SHA-256 `9eaed324ea79e775c43bc43b1b34b6807201206477736352bf2f910bae73a8fd`. Actual raw Drive download equals the local ZIP byte-for-byte. Metadata size/archive parent, ZIP integrity/nine entries and every contained file digest verified. No private collection photographs or production credentials are included.

[Catalogue review/log package](https://drive.google.com/file/d/1WmSqPEqjmEqDVrTfry0LQef74VKAXZd9/view?usp=drivesdk) remains preserved separately: 71,207 bytes, SHA-256 b91037a0aa6c8f9f0d8428eb0f1bc35f42fd04f859b0af8db8ece66a5a7ea52f. [Catalogue checkpoint](https://drive.google.com/file/d/119crl2kDhQapi43jdHJKyCX-UNdWSlq9/view?usp=drivesdk) remains byte-exact: 12,731 bytes, SHA-256 315adc99f335206ab1b7b139a36ee7ea2b5dc40fa6e7879b5460f87e18ebed7a. Previous research/source handovers, original manuscripts, failed-run records and reviewed screenshots are retained.

This dated checkpoint is archived separately, then kept unchanged after exact read-back. Its Drive ID, byte count and digest are appended to CURRENT_HANDOVER and PROJECT_PROGRESS_LOG. Full application/catalogue/sale form UX, real Storage bytes, human acceptance and any authorised rollout remain separate from these verified API/database stages. Current Instructions and review of prepared candidates are still required before source publication; production changes remain excluded.
