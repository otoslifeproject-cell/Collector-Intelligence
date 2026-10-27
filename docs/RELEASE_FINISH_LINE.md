# COLLECTOR INTELLIGENCE — RELEASE FINISH LINE

Updated: 27 October 2026, 12:05 UK. Owner priority: visible improvements on the live website, no duplicate functions or odd buttons, five-minute object journey. This is an acceptance tracker, NOT a statement that the product is finished.

## Acceptance rule
A task is COMPLETE only if (1) feature is present on **production** https://collector-intelligence-sngf-otoss-projects.vercel.app, (2) its relevant tests pass, (3) an actual signed-in owner workflow was verified and (4) original photos, research history and owner data remain safe. A Git commit or Vercel READY alone is NOT enough.

| # | Task / finish line | Current evidence | Status |
|---|---|---|---|
| 1 | Foundation / data safety and source preservation | Storage and source preservation code exists; final production audit outstanding | PARTIAL |
| 2 | One consistent global visual system, navigation, no duplicate actions | Live dashboard redesign; duplicate manual link removed; Collection label aligned; full page-by-page CSS audit still pending | PARTIAL |
| 3 | One Add Item action, photo upload, optional fields only | Development branch has simplified intake; release and owner-test outstanding | PARTIAL — DEV |
| 4 | Visual matches first, candidate names/images/links captured | Lens opens manually; no verified automatic Lens ingestion | BLOCKED |
| 5 | Evidence verification agents check candidates, dates, sold comps, alternatives | Research machinery exists; classification/photo benchmarks outstanding | PARTIAL |
| 6 | Live ticker and concise result in-place, without hunting through tabs | Inline result changes on development branch; end-to-end acceptance outstanding | PARTIAL — DEV |
| 7 | One-click Save Item, bulk save/next item without listing | Single-item safeguard and shortcut in development branch; real readback tests outstanding | PARTIAL — DEV |
| 8 | Sell Item: listing draft, pricing, condition, venue, packing, net economics | Listing tools exist; coherent one-stage screen not signed off | PARTIAL |
| 9 | Select multiple objects and export eBay-ready drafts, not publish | Initial CSV serializer and chooser on dev; category-template/import acceptance absent | PARTIAL — DEV |
| 10 | CI, security, accessibility, mobile, user timing test, production release | Some CI checks pass while others fail; five-minute owner test has not passed | BLOCKED |

## Verified engineering tasks (these ARE ticked; they are not whole-stage owner acceptance)
- [x] Live dashboard provides four primary activities (Add item, Collection, Research, Sell).
- [x] Duplicate manual-entry shortcut removed from the live dashboard.
- [x] Sidebar uses the same Collection label as dashboard.
- [x] Live object page no longer displays three competing navigation sets; extra evidence views remain.
- [x] Add Item shows the three truthful upload/analysis states without a fabricated progress percentage.
- [x] Saved research opens on the primary research result, with detail views collapsed.
- [x] Open-access Met keyword illustrations can be requested automatically once per object (NOT Google Lens image recognition).
- [x] Production commit `389c0d688926917b8397deada68fc2beb9f27ce2` passed both Typecheck and pages build/deployment GitHub workflows, and Vercel reports its production deployment READY.
- [ ] Signed-in real-object five-minute run with original-photo readback and verified comps.
- [ ] Automated visual recognition with candidate provenance, or explicit approved substitute.
- [ ] Verified eBay draft CSV import with unpublished drafts.
- [ ] Full browser/mobile/accessibility regression with no blocking findings.

**Engineering checklist:** 8 of 12 verified tasks ticked. **Product stages fully accepted: 0 of 10.** The two denominators deliberately differ. The production typecheck and deployment workflow pass does not establish that every browser workflow or data-integrity condition passed.

## Current production receipts
- Main commit `6e7c443a`: removed duplicate Manual catalogue entry action.
- Main commit `7ed1f134`: Collection label unified.
- Main commit `9c038bf7`: updated outdated home regression test; validation may still be in progress.
- Production commit `389c0d68`: automatic free museum keyword illustrations, corrected regressions; both production GitHub workflows SUCCESS and deployment READY.\n- Development work remains in draft PR #2 and must not be confused with released production.

## Do not call done until
- At least five real owner objects (including green hyacinth forcing vase and UV/uranium discriminator) run through Add → Visual matches → Verified research → Result → Save OR Sell.
- Ordinary cases take no longer than five minutes or explicitly show partial/provisional results if external work has not completed.
- Every production page has one clear primary action, no duplicate navigation or mismatched buttons.
- Save/reload and source provenance work; no invented signatures, makers, realised prices, or lost photos.
- A draft batch file is accepted by eBay Seller Hub without publishing anything.
- CI and owner browser checks pass; launch sign-off recorded.

No production database migration, automatic paid provider usage, or listing publication is implied by this checklist.
