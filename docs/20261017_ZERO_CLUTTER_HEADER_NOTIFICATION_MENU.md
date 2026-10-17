# Zero-clutter report header — owner-requested correction
Date: 2026-10-17. Priority: UX defect / navigation preservation, not a new collector feature.

## Evidence and user requirement
The owner supplied a close-up from the real signed-in Saved Draft at roughly 21:55 showing a stack between the object title and six navigation tabs: “Disagree with verdict”, “Owner corrected: Metal”, “6 original photos / Not catalogued”, and “Photo index needs review”. They explicitly rejected the preceding strategy of shrinking and stacking these as small labels and ⓘ icons. The user wants EMPTY SPACE and immediate navigation, and asked that the activity/correction/warning information live together in a menu/notifications area.

## Implemented, source preserved
- `src/pages/SavedDraft.tsx`: entire `ci-report-top-actions`, `ci-owner-status`, `ci-report-meta`, `ci-photo-review-status` removed from above/below the tab bar. Even the label “Saved report” was removed from the default heading. The title, unobtrusive Back to Inventory arrow, single bell/notification summary, and six tabs are the entire default report header.
- Bell menu (native `<details>`, keyboard/tab/Enter accessible, touch-capable; Escape/outside pointer closes) contains: Disagree with verdict action and full editor, owner correction statements, raw model-to-original photo-index discrepancy, any missing/incomplete manifest status, original photo count, saved date and report status. None is rendered as default-page rows.
- Source discrepancy still protects the catalogue workflow. In Catalogue ONLY, a short explicit checkbox “Confirm existing uploaded photos only” remains next to the approve action, with no silent photo-index remapping. Original AI and owner corrections were never overwritten.
- The research and image comparison sections, original photos, valuation and sale outcomes are unchanged. No new object, source, AI request, paid usage, database mutation or catalogue approval.
- `src/styles.css`: responsive 22–30px two-line-clamped object title, two icon controls, clean tabs directly below title, anchored light/dark notification overlay no layout shift, max-height scroll on phones. Object tabs remain a visible 3×2 grid on mobile, all six destinations reachable.
- `tests/designContract.test.mjs`: automated source-level guard forbids the earlier report badge/metadata row classes and asserts notification content precedes tab navigation.
- `tests/fixtures/appearance-layout.html`: representative browser fixture uses ONLY title/back/bell/tabs plus report data inside the closed notification popup.
- `tests/ui-layout.spec.mjs`: mobile default has no visible report warning rows, button and correction available on one bell tap, and no vertical shifting while popup open; popup bounds checked at 320/390/1100/1440 pixels; eight view dark/light matrix remains.

## Acceptance boundary
Use source-linked CI run result plus real Vercel deployment SHA, not a READY status for a stale build. The logged-in owner must check that title + bell + tabs appear with nothing between, menu contains the previous correction, action and photo discrepancy, and Catalogue confirmation remains present. All actual private data remains in place and behind authenticated RLS.
