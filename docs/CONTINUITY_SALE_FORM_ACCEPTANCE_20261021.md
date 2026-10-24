# Collector Intelligence — actual sale form acceptance

21 October 2026 · Europe/London · bounded engineering checkpoint on existing draft PR #2, branch `continuity/resolver-fixtures-20261020`. Continues `22b2cdfe8b090ee56f65adc7349205562fb3b206`; original user resume commit `7fc21e6` remains in history. No restart, main merge, production mutation or manual deployment.

## What changed

The actual `RecordSaleOutcome` component now takes the existing authenticated Supabase client. It verifies the current principal through Auth, reads that owner's collection object and complete counted sale history with explicit owner/item filters, and blocks writing if either read is unavailable, incomplete, duplicated or malformed. The bounded history reader refuses more than 100 rows rather than implying that a truncated list is complete. Original historical records are never overwritten by the form.

A saved acquisition amount is displayed with its original currency. If it differs from the item's sale currency, a known acquisition cost requires an explicit owner-entered acquisition amount in the sale currency. No exchange rate is fetched or invented. The existing RPC's `acquisition_cost` argument is used; original costs and notes remain retained. Blank acquisition with no saved cost keeps profit unknown. Blank fees explicitly mean zero; all entered monetary values must be nonnegative, finite, within the supported bound and use at most two decimal places. Negative realised net/profit remains valid.

Receipt history uses each stored outcome's own currency and two decimal places. The general valuation formatter is unchanged. Gross, net and profit are separate, unknown profit is shown as Unknown, and owner reports retain the not-independently-verified label. No sale becomes a trusted comparable or Knowledge Brain fact automatically.

A request gets one event identity and an immutable copy of its facts before sending. Form fields are locked while its result is uncertain. A successful acknowledgement alone never displays a successful save: the form reads back the owner/item/event, exact submitted amounts, receipt/notes/provenance and SOLD status. An interrupted acknowledgement can be resolved by that read without a second POST. If readback is unavailable, the result stays visibly unconfirmed and saving stays blocked until history is readable. A deliberate retry reuses the exact original request. No mutation retry or paid action happens automatically.

Changing account or signing out clears draft, confirmation, history, request identity and messages. Same-owner reauthentication preserves a draft. Changing collection object remounts the form, discarding the former object's draft and request. Aborted/late reads and late committed responses cannot render the former owner's private result. Account identity is verified again before submitting. Request recovery state is in memory: browser refresh does not persist an unsent draft/event; initial fresh history/status is authoritative after remount. This is not a cross-device recovery ledger.

## Verification

Final tested code: `ad19feed9925f368bdad5504cee9874ce93b50ce`. [Actions run 39609580960](https://github.com/otoslifeproject-cell/Collector-Intelligence/actions/runs/39609580960) reports completed / SUCCESS. Full logs from all four jobs were fetched and checked.

| Coverage | Named checks | Job ID |
|---|---:|---|
| Resolver/source/runtime/target | 122 | 119254602318 |
| PostgreSQL publication integration | 40 | 119254602571 |
| Real Auth/Kong/PostgREST/SDK/research/catalogue/sale | 163 | 119254601818 |
| Actual signed-in archive browser | 14 | Same HTTP job |
| Actual signed-in sale form browser | 20 | Same HTTP job |
| Existing static layout browser | 13 | Same HTTP job |
| App and archive reader | 46 | 119254602087 |
| **Total** | **418** | Four full logs |

All 47 browser cases pass, including 20 added sale cases. Strict API compilation, locked dependency installation, TypeScript/Vite build and local whitespace/syntax checks pass. Existing bundle-size and action/dependency warnings remain. Local Docker is unavailable; actual service acceptance runs on disposable GitHub runners. The application job listing initially lagged at in_progress/null despite every step (including Complete job) reporting completed/success and its full log proving 46/46 tests and completed build. A subsequent fresh jobs read resolves that discrepancy: **all four job statuses are completed and all four conclusions SUCCESS**. The original observation remains preserved in the earlier archived checkpoint; it is not an open CI blocker.

The actual React component, shared stylesheet and official SDK run in Chromium against genuine signed-in disposable users, real Auth/Kong/PostgREST and the original core schema/RLS plus separately tested catalogue/sale candidates. Positive saves and readbacks reach the real disposable database. Intentional negative transport interception is explicitly scoped below; it does not replace positive service acceptance. Browser network requests are restricted to loopback. The synthetic fixture is a test entry, not a production application route; it does not import the environment-backed production client.

| Actual form boundary | Coverage |
|---|---|
| Receipt and precision | Real save, gross 100.25, platform fee 1.05, net 99.20, GBP cost 20.50 => profit 78.70; one stored outcome per item |
| Currency | GBP original acquisition/USD sale requires explicit USD cost 25.10 => profit 74.10 USD; saved USD display survives actual component remount |
| Unknown and zero | Missing acquisition leaves profit/return NULL even with negative net; known zero gives known profit and NULL percentage return |
| Entry validity | Sub-penny, negative, NaN, Infinity and exponent text cannot enable submission; unchanged empty fees recorded as zero |
| Complete history | Injected permission failure or inconsistent exact count hides the form and blocks writing; removing the transport fault and explicitly reloading recovers against real services |
| Lost acknowledgement | Real request commits, response is deliberately interrupted; one subsequent real read resolves it, with exactly one POST |
| Failed readback | Real save acknowledgement followed by injected history 503 never claims saved; explicit reload resolves the same event without another POST |
| Uncommitted interruption | First POST is deliberately aborted before reaching service; fields remain locked; explicit retry sends byte-equivalent JSON/event identity and creates one real result |
| Account boundary | Same-owner reauthentication retains draft; genuine second owner sees neither private history nor old form; sign-out clears state and requires sign-in |
| Late response | Real private history and real committed sale responses are separately delayed until after account switch; stale results stay hidden; returning original owner sees saved record |
| Object boundary | Switching to another owner object clears former draft/confirmation/pending event; new save uses a new item/event identity |
| Layout/accessibility | Four widths (320/390/1100/1440), light/dark, no horizontal overflow, real controls and save, confirmation target size and keyboard disclosure/date focus; result status receives focus |

Original API transaction, source/publication, archive and static layout suites also rerun. Existing seven explicitly labelled baseline defect reproductions remain included in service counts; passing these means defects were reproduced and followed by candidate acceptance, not that original unsafe behaviour was certified.

Two earlier browser runs are preserved. Code `6c61e496a9ec7a5acccd0283c6b1dd8ba3a73344`, run 39608763380, passed 43/45 browser cases: a broad fixture route continued before the intended earlier fault handler, and the 503 expectation expired before SDK retries completed. Code `23273ab364ddd259443fe76829d6dc06563fe2e7`, run 39609007257, passed 46/47 after handler fallback plus two additional race/object tests; the remaining assertion still used the short wait. The final test allows 15 seconds for that deliberate retry scenario. This does not remove a case or weaken the required unconfirmed state. The two full failed HTTP logs and first raw screenshot/error-context artifact are retained alongside final evidence.

## UX acceptance record

Starting screen: collection object's existing actual sale section; browser acceptance mounts that exact production component with a synthetic owner's object. Closed by default. One disclosure opens the form; after entry/review/confirmation, one explicit primary action records the completed sale and marks SOLD. The isolated component's observed action count is two clicks plus typing and confirmation. Full app navigation click counts are NOT TESTED here.

Hierarchy: the section title and owner-report status precede one collapsed task; details contain one primary save action. An uncertain result offers one deliberate same-request retry and a secondary history reload. No raw database error/status code, source ledger, estimates, model confidence, AI cost or external research is introduced into this flow. Required receipt/cost inputs are retained; acquisition guidance explains the original currency and any required conversion entry. Original evidence is preserved.

The first reviewed 320px light screenshot exposed a shrinking confirmation checkbox; final scoped CSS fixes it at 20px, with the full wrapping label at least 44px high. Every final width/theme test asserts these sizes. Shared theme tokens, existing minimum control heights and visible focus are retained. Playwright requests en-GB, but the reviewed Linux Chromium native date control still displays MM/DD/YYYY. ISO values sent to the RPC are correct and verified; UK native date presentation remains unverified. No claim that the locale request changed that native control is made. Result status is focused after completion/uncertainty. Screen-reader announcement roles and accessible field names are present; actual assistive-technology/user testing and instrumented contrast certification are NOT TESTED.

Final artifact 12348774808 contains 33 PNGs: 17 sale images (eight entry, eight saved-result, one saved USD), eight archive and eight existing static layout screenshots. Raw artifact bytes: 3,272,769; SHA-256 `24525cb366fd1682a598933f35a3e1a18ed54f0ecd26c639c5909b6d3ae510c8`. Actual PNGs inspected: sale-320-light, sale-1440-dark, sale-saved-320-dark, sale-saved-1440-light and sale-saved-usd. Corrected checkbox is readable at 320px; form/result labels and exact pence/currency stay visible without horizontal scrolling. Saved result separates gross/net/profit and keeps source status explicit. These are screenshots of the actual component on real disposable services, not mock markup or a claim of hosted full-route acceptance.

AI-assisted UX decision: CONDITIONAL. Actual component/browser/service acceptance is scoped and recorded; full hosted ItemDetail route, surrounding object/photo layout, real user receipt review, human designer approval, refresh draft persistence and independent accessibility audit remain separate. No claim that an independent designer signed off.

## Retained deployment/source boundaries

Neither SQL candidate is applied to production. Original migration bytes are unchanged. A connected read-only definition check in this stage returned live `ci_record_actual_sale_v1(uuid,uuid,jsonb)`, SECURITY INVOKER, fixed `search_path=pg_catalog, public`, body SHA-256 `cf7cca2300632ff4a73943703724b4e01b26c21d24bf1bc6bbe9886547552552`, still exactly the original sale v3 used for baseline tests. The live function was not invoked. The form uses the already existing RPC shape; test services install the separately marked guards, not the live project.

Source publication and approved-source activation remain blocked by unavailable exact full current Project Instructions (previously referenced v4.3) and unresolved source approval. Older supplied Instructions are not substituted. Existing canonical v4.0 Master/Evidence Policy and startup/source/UX requirements were read in the resumed development chain; relevant latest GitHub/Drive handover and UI standards were read before this stage. Standing authorisation permits these bounded engineering changes. No exhaustive archival startup PASS is claimed.

Real Auth/PostgREST access requirements for the tested component are resolved in disposable CI; that does not establish hosted TLS/Envoy/OAuth/session persistence. Storage rows in catalogue tests remain synthetic metadata, not actual image upload/download/signed-URL acceptance. Provider/evidence-context fixtures remain labelled and no paid inference occurred. Real receipts, accounting/FX/tax/refund correctness and currency-specific minor units are not certified; the existing schema uses two-decimal money columns.

No production DB/schema/function/permission/Auth/source/environment/stock/photo/attribution/comparable/Knowledge Brain/sale data changed. No hosted branch, paid service, main merge, manual deployment or promotion. Automatic GitHub preview builds are separate from production promotion. Draft PR #2 remains open and unmerged. Previous checkpoints, source manuscripts, candidate SQL, failure evidence and verified Drive archives remain preserved.

## Verified archive

[Verified 48-file sale form evidence ZIP](https://drive.google.com/file/d/17IzB5L9-KXzLL9xpPYQSCAnlX9uF66WW/view?usp=drivesdk), Drive ID `17IzB5L9-KXzLL9xpPYQSCAnlX9uF66WW`: **6,313,461 bytes**, SHA-256 `27e5dce3abd897f635edf5c8e769d9dbd3ffdfc04ea898ab8a6be0107242ea73`. Contains 33 final PNGs, four complete final logs, both complete failed HTTP logs, original first failed screenshot/error-context ZIP, tested component/reader/browser fixture/config source, review diff, machine receipt and manifest. Actual raw Drive download equals local bytes; archive parent/size, ZIP integrity/48 entries and every per-file digest verified. Earlier sale/catalogue/source/archival evidence packages remain unchanged. No private collection photographs or production credentials are included.

The earlier pre-closeout checkpoint remains preserved separately in [Drive file 153z_EroJK3-VTt6lmzKccIOsHctbOYe8](https://drive.google.com/file/d/153z_EroJK3-VTt6lmzKccIOsHctbOYe8/view?usp=drivesdk): 14,499 bytes, SHA-256 `104319efe7c7dbb8517c279f85ac4fd9d9d28bb5355b9e87b961748cda4f32da`, exact text/metadata verified. This final checkpoint records the resolved four-job metadata and is archived as a new file, preserving that earlier snapshot unchanged. This immutable dated checkpoint is archived separately after final verification. Exact Drive readback, metadata byte size/archive parent and committed GitHub text are checked. Its Drive ID/hash and evidence ZIP receipt are appended to CURRENT_HANDOVER and PROJECT_PROGRESS_LOG. Current source Instructions, source publication, full hosted application UX and actual Storage bytes remain open boundaries.
