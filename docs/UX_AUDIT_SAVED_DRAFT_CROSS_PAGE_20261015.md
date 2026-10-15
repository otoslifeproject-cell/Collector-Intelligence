# CI UX expert-style review — 2026-10-15
**Reviewer:** AI-assisted UX/code audit, NOT an independent hired human designer.
**Scope:** Inventory + Saved Draft visual/interaction contract; repository-wide static screen sweep.
**Evidence:** User screenshot of five three-column overstuffed draft edit cards; current TSX/CSS and GitHub Vercel build status.
**Status:** Conditional acceptance — deployment compiled; signed-in cross-device visual/regression pending.

## Critical findings and corrective changes
1. FAIL — Saved Draft used `ci-review-card` unrelated to Inventory `itemCard`, and permanently displayed complex fields, AI observations and evidence on each card. **Fixed** in `978ce5f`: saved report now uses `itemCard ci-record-card`, `itemCardImage`, `itemCardBody`, `ci-record-title`, search/filter and the same Tiles/List/Icons view preference. Its primary surface is a photo/placeholder, title, stage and a single 'Review object & evidence' disclosure.
2. FAIL — Same object had inconsistent layout and density across screens. **Fixed for Inventory and Saved Draft** by shared global layout CSS; no duplicate card component definitions introduced in the report.
3. FAIL — List/Icons CSS concealed direct `details` editing controls, making reviewing impossible. **Fixed** with explicit accessibility-safe layout overrides in `9d92327`; all three views keep a visible review control.
4. FAIL — Information overload in report default: editable fields and long conditions permanently visible. **Fixed** via progressive disclosure; inputs, AI original condition and evidence load behind review summary. No AI call is made.
5. RISK — Older DRAFT runs still lack source-photo manifest and signed previews; labelled missing rather than guessed. **Open; data recovery only after verification.**
6. RISK — Save review changes uses client read/merge/write, not revisioned compare-and-swap; cross-tab edit collision possible. **Open; transactional owner-scoped RPC needed.**
7. RISK — Approve and catalogue remains non-idempotent. **Open; do not enable blindly.**
8. RISK — Every object in a five-object report links to same report without selected-index deep-link. **Open; per-object focus route desirable.**

## Static site-wide sweep
- Dashboard: shared pageHeader + ItemCard; five inline styles still to consolidate.
- Inventory: shared pageHeader and object card system; updated shared toolbar.
- AI Intake: shared heading, but independent draftGrid and 19 inline style occurrences; requires visual QA and gradual shared-card migration while preserving upload behavior.
- Add Item: shared heading, no inline overrides in page.
- Object Detail: custom itemHero, 10 inline style occurrences; check correspondence with `ci-page-header` and object photo card.
- Research: shared heading, 23 inline style occurrences; risk of technical-data overload; preserve separate evidence ledger in disclosure.
- Sales, Contacts, Reports: shared heading; require user-facing acceptance.
- Saved Draft: now shared cards, search/filter/view; editable details deferred.

## Design sign-off criteria (NOT yet met)
- At 1440px desktop, 1100px tablet and 390px mobile: page header, search, filter, control baseline match Inventory; no horizontal clipping or sticky header.
- Tiles: photo-first cards with two-line titles; disclosure opened and saved.
- List: thumbnail/title/status/review remain visible; opening review causes no horizontal overflow.
- Icons: photograph (if linked) dominates; review action remains accessible on keyboard/touch.
- Saved title and condition survive browser refresh, preserving original model analysis.
- No cross-user data and no new paid model request.
- No negative impact on Dashboard, AI Intake, Item Detail, Research, Sales, Contacts, Reports.
- Signed-in screenshot acceptance and manual keyboard/screen-reader checks outstanding.

## Verdict
**CONDITIONAL:** Sitewide shared tokens/layout shell exist; Saved Draft and Inventory now share their object presentation and have fix for disclosure in all modes. Build success confirmed on latest commit. Do not label 'every page visually verified' until screenshots/tests pass.
