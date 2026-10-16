# Collector Intelligence — layered build phases 1–2: implementation and AI-assisted UX acceptance
Date: 2026-10-16
Reviewer: AI-assisted technical/product UX code review, **not** an independently hired human designer.
Verdict: CONDITIONAL — implementation and Vercel compile are not signed-in desktop/mobile acceptance.

## Owner direction
Proceed phase-by-phase using disposable test uploads and the permitted test AI budget. Do NOT invite real collection ingestion until the layered product is accepted. Ask owner only for specific real-account functional tests.

## Phase 1 — durable intake and atomic catalogue approval
1. New photo uploads stage a private `ai_analysis_runs` DRAFT with exact `image_manifest` before any paid AI invocation. The endpoint verifies the owner-scoped saved run, image count and original indexed filenames before starting model work.
2. The first paid AI answer is saved server-side immediately into that same owner-scoped DRAFT. Subsequent Knowledge Brain and mark review refine it without destroying the original image manifest. An enrichment failure redirects the user to the preserved provisional saved report instead of silently charging for another call.
3. New RPC `public.ci_approve_saved_intake_v1(uuid,integer[],jsonb)` is SECURITY INVOKER with explicit authenticated-only EXECUTE, owner-scoped and run-locked. In one DB transaction it creates selected permanent objects, original-image references, provisional evidence, attribution revision seeds and research tasks; status update and readback commit atomically. Unique owner+run+original-child index prevents duplicate multi-object records. Same request retries return the same records.
4. Source photo paths remain private/original, no storage copy/delete during transaction, shared photos can legitimately appear in more than one physical object's provenance. AI evidence is UNVERIFIED, never promoted VERIFIED_DIRECT by model text.
5. Legacy runs WITHOUT manifests remain safely blocked for approval; they are not erased, merged or presented as auto-recovered photos.

## Phase 2 — unified photo-first collection UX
- New shared `ObjectCollectionToolbar` used in Inventory, Saved Draft and AI Intake: search + relevant filter + Tiles/List/Icons; common persisted view preference.
- AI Intake review uses shared `itemCard ci-record-card` photo-first cards rather than independent large `draftCard` columns. One object per card; selection visible in Tiles/List; AI notes and original photographs folded under progressively disclosed sections.
- Icons mode shows photo/title only. Keyboard and click should directly open the selected object's review in Tiles.
- Saved reports offer selection and catalogue approval only when the source manifest appears complete; owner edits are kept separate from original AI source.
- Completed batches display the same object card template and direct Item workspace links.

## Review against required UX contract
- Object recognition in five seconds: PASS in source structure (photo, title, provisional state visible).
- Consistent object card and toolbar: PASS in source across three principal collection views; Dashboard has existing shared ItemCard.
- Progressive disclosure and reduced card overload: PASS in source for AI Intake/Saved Draft, with editable working title and condition retained.
- Two-click path: code supports icon-click -> opened review; creation/approval is deliberately a consentful additional action.
- State feedback: pending, success, partial report and missing photo warnings implemented; **refresh and interrupted model responses NOT SIGNED-IN TESTED**.
- Private photo trust: RPC validates owner folder and original path existence; **owner-signed thumbnail and multiple-user negative test still required**.
- Transaction/duplication: database function and uniqueness installed; auth-negative test passed; **signed-in successful save/retry/failure rollback NOT TESTED**.
- Data preservation: counts checked before any owner test. No existing reports, sale values, item evidence or original photos altered.
- Cross-page responsiveness: shared CSS present; **390/1100/1440 pixel screenshot test required**.
- Keyboard: tabindex/Enter/Space review opening code implemented; **manual focus/screen-reader inspection pending**.
- Seller fees, buyer matches and research-source verification untouched by these releases.

## Remaining material issues, not to conceal
1. Signed-in upload → AI result → saved report → refresh → catalogue → photo readback → identical retry is not yet measured.
2. Saved Draft free-form owner editing is client read/merge/write, not revision-based CAS across concurrent tabs. Add versioned RPC after first owner acceptance.
3. Image-to-physical-object assignment follows indexed AI draft and requires human review when a batch has overlapping/ambiguous images. Legacy 40-photo batch is NOT auto-promoted.
4. Research page and Object Detail still have bespoke presentation and await wider design-system convergence.
5. Full research → defensible comps → valuation → venue/net economics → listing → sale outcome → Knowledge Brain write-back loop remains a separate required product milestone.
6. Actual independent expert designer review and authenticated mobile/desktop testing are not represented as completed.

## First owner acceptance exercise
Use disposable test glass/object evidence, NOT production collection:
- upload 3–6 original photographs of ONE throwaway/test object through AI Intake;
- check upload, paid AI completion, object image/title, Tiles/List/Icons and collapsed evidence;
- refresh; open the saved report from Inventory, confirm the same source images and text;
- approve ONE test item; check its Item Detail photographs and return to Inventory;
- if safe to do, retry the same saved report approval; expect the same record, not a duplicate.
Record pass/fail screenshots, browser/device and exact failure stage. Do not spend again to recover a failed paid result.

## Continuation order
Phase 2 owner test → fix failures before release acceptance → Stage 3 versioned edit persistence/partial-result recovery → Stage 4 Object Detail and Research convergence → Stage 5 valuations/comps and Sell Fast net economics → Stage 6 automated historical research reuse/write-back and sale outcomes → end-to-end signed-in device/security QA → real collection ingestion.
