# Collector Intelligence — confirmed sale and item editor synchronisation

21 October 2026 · Europe/London · same draft PR #2 / `continuity/resolver-fixtures-20261020`. Continues the verified sale-form stage and documentation head `39cedbfdf2e8be6e0271513f41264258a067f413`. No restart or production change.

The integration review found that the surrounding ItemDetail editor could retain its pre-sale status after the actual sale component had saved and read back SOLD. A later general item edit could therefore submit that stale status. Its header also prioritised sale_readiness over an achieved SOLD state. The previously archived form checkpoint was correctly scoped to the component; this follow-up closes this specific parent-editor integration issue without claiming full hosted-route acceptance.

The sale component now notifies its parent only after owner-verified item/history readback reports SOLD, with matching current account scope. A guarded helper changes only the still-selected owner's matching item's status, preserving title, notes and other unsaved edits. A notification for another owner/item is ignored. Per-item notification identity prevents render/effect loops. ItemDetail prioritises SOLD in the header. The Item type now includes the existing required owner_id column so the scope guard is checked by TypeScript. No new database column, direct status write, additional RPC, Auth configuration, migration or source change is introduced.

The actual test fixture uses the production component and the same guarded helper in a small parent editor. Every width/theme positive save now also asserts that the parent reports SOLD while its synthetic unsaved title stays unchanged. Positive saves still reach genuine Auth/Kong/PostgREST and the disposable database; recovery/account/race cases remain in the suite. This tests the shared status update and component callback, not the entire hosted ItemDetail route or unrelated photo/research/editor state.

## Verification

Final tested code `2ddb30202c1352493c1f4e1a1362654bbc00c167`. [Actions run 39611455222](https://github.com/otoslifeproject-cell/Collector-Intelligence/actions/runs/39611455222): **all four jobs completed/SUCCESS**; all four complete logs fetched. **418 named checks PASS**: 122 resolver/source/runtime/target, 40 PostgreSQL, 163 real Auth/Kong/PostgREST/SDK/research/catalogue/sale, 14 actual archive browser, 20 actual sale browser, 13 existing static layout, 46 application/reader. All 47 browser cases pass, now including eight real saved-sale parent-status/unsaved-title assertions. No extra named cases are counted for those added assertions.

| Job | ID | Conclusion |
|---|---:|---|
| Real services and Chromium | 119261096391 | SUCCESS |
| Resolver/source/runtime/target | 119261096725 | SUCCESS |
| PostgreSQL integration | 119261096819 | SUCCESS |
| Application regression/build | 119261096821 | SUCCESS |

Strict API compilation, locked dependency installation, TypeScript/Vite build, local 46-test regression and syntax/whitespace checks pass. Existing bundle/tooling warnings remain. Actual services run on disposable GitHub runners because local Docker is unavailable. Automatic Vercel status for tested code is SUCCESS, read separately; this is not production promotion.

The existing real-service counts include seven labelled original-defect reproductions followed by SQL-candidate acceptance. Original production migrations and both separately marked unapplied candidates remain unchanged. The front-end uses the already existing sale RPC shape. Previous same-currency/cross-currency, exact pence, unknown/zero cost, losses, complete history, lost acknowledgement, explicit retry, account switch/sign-out, delayed responses, object reset, keyboard and responsive cases continue to pass.

## UX and retained scope

Starting context remains an item's collapsed actual-sale section. One disclosure opens the form; after entry/review/confirmation one primary action records and checks the result. No new user action is required for the surrounding status to update. The status callback preserves unsaved fields and performs no network write. The achieved SOLD label now precedes older readiness wording. Actual signed-in component/browser screens use shared style tokens; checkbox size/44px label, overflow and result focus checks remain enforced at four widths/two themes.

Final raw browser artifact 12350294190 contains 33 PNGs, including 17 sale images. Size 3,341,817 bytes; SHA-256 `27ac5b4f6256e0f1e5639d4ca826d9abca07de7da5f8409b3dadb27174d34054`; actual downloaded bytes/digest, ZIP integrity and all 33 PNG entries verified. The final saved 320px dark and entry 1440px light images were actually inspected. The synthetic parent visibly changes to SOLD while its unsaved title remains; exact receipt amounts and owner-report status remain readable. Shared form styling and responsive checks are unchanged from the earlier fully archived stage.

AI-assisted UX decision remains CONDITIONAL: this verifies the actual component, shared parent-status helper and synthetic parent integration, not full hosted navigation, actual photographs, independent human design/assistive-technology/contrast approval, real receipts, accounting/FX/tax/refund treatment or currency-specific minor units. Native Linux Chromium date controls still display MM/DD/YYYY despite requested en-GB; submitted ISO values are verified. Unsent drafts/events remain in memory and are not preserved across browser refresh. Owner reports never automatically become independently verified comparables or Knowledge Brain facts.

Earlier handovers remain exact and unchanged: [full sale form checkpoint](https://drive.google.com/file/d/18PPRhw2MWMVFdsPXD7i2YRh90fGnQtZ7/view?usp=drivesdk), 15,005 bytes, SHA-256 `77f5acb9197da7e4f65e1c482152f524b82c91d27204f726f64be18c0eb7b21c`; [48-file form evidence/failure archive](https://drive.google.com/file/d/17IzB5L9-KXzLL9xpPYQSCAnlX9uF66WW/view?usp=drivesdk), 6,313,461 bytes, SHA-256 `27e5dce3abd897f635edf5c8e769d9dbd3ffdfc04ea898ab8a6be0107242ea73`. Documentation-only head 39cedbf also passed all four jobs in Actions 39610966830. Earlier original snapshots, failure evidence, source manuscripts, SQL candidates and all catalogue/research/archive checkpoints remain preserved.

## Verified archive and boundaries

[Verified 46-file editor-sync evidence ZIP](https://drive.google.com/file/d/1yAgHAItKTa-kz2SbKFUKK8W3s92alTq4/view?usp=drivesdk), Drive ID `1yAgHAItKTa-kz2SbKFUKK8W3s92alTq4`: **3,427,583 bytes**, SHA-256 `1951e57b68d75ad0ac124d1730842f79704b4df099184ab1ad878701a4b80efd`. Includes all four full final logs, 33 final PNGs, tested component/helper/parent/type/browser source, small review diff, machine receipt and per-file manifest. Actual raw Drive bytes equal the local ZIP; size/archive parent, ZIP integrity/46 entries and every contained digest verified. No private collection photographs or production credentials included. The original form/failure archive remains unchanged, preserving earlier versions and failures.

This dated follow-up is saved as a separate immutable Drive handover; exact text/size/archive parent and committed GitHub text are checked. Its ID/digest are appended to CURRENT_HANDOVER and the progress log.

Both SQL candidates remain unapplied; live sale body hash last read in this stage chain still matches original v3 (`cf7cca2300632ff4a73943703724b4e01b26c21d24bf1bc6bbe9886547552552`). No live sale RPC invoked. No production database/schema/function/permission/Auth/environment/source/stock/photo/attribution/comparable/sale/Knowledge Brain data changed. No main merge, hosted branch, paid inference or manual deployment/promotion. Automatic preview builds do not establish production promotion. Main remains 052a14d; PR remains draft/unmerged.

Exact full current Project Instructions (previously referenced v4.3) and source approval still block source publication/activation. Older supplied Instructions are not substituted. Real photo Storage bytes/signed URLs, complete hosted catalogue/ItemDetail flows, broader editor/account state and actual user acceptance remain separate work. Standing authorisation covers this bounded independent engineering; no exhaustive archival startup PASS or production rollout is claimed.
