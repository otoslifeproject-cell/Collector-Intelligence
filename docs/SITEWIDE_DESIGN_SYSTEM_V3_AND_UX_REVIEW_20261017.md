# Collector Intelligence — Sitewide design-system v3 and specialist-style review
Date: 17 October 2026. Trigger: owner supplied three authenticated screenshot failures from the saved metal-pair Market workspace (roughly 19:34–19:38 UK time). Urgent priority **STOP feature additions; fix consistency, usability and light/dark appearance**.

## Decision and failure chronology
**Screenshot status: FAIL for prior production interface.** The prior `.researchLauncher` used `display:flex;align-items:center;justify-content:space-between` to put a heading, several explanatory paragraphs, a prominent paid button, a text link, a collapsible action and other metadata in the same horizontal space. The primary CTA was squeezed into a tall narrow yellow stack; a link did not look reliably interactive; source notes/valuation text were overlong. Another screenshot showed a raw `Unexpected token 'A', 'A server e...' is not valid JSON` on museum search. An object-focused workflow should not have displayed either state.

Earlier global CSS carried a page-width contract but **did not enforce component composition or theme tokens**. Incremental patching, copied page-specific action rows, hard-coded dark colours, and absence of automated browser screenshots caused repeated regressions. A clean build does not prove a usable website.

## Multidisciplinary specialist review (AI-assisted, not human consultants)
1. **Product / interaction-design lens:** one obvious next action in a stable place; secondary manual image lookup as a recognisable underlined link; repetitive paid research behind a disclosure; explanatory notes below, not alongside, CTA. Source photos and saved results remain one-click accessible. This aligns with GOV.UK Design System button principles: https://design-system.service.gov.uk/components/button/.
2. **Frontend architecture / responsive CSS lens:** shared `WorkspaceActionPanel` on Saved Draft and permanent Item Detail; vertical single-column grid structure; separate header, selector, controls, note, advanced content. Global page width 1200px, 212px navigation rail, responsive 44px minimum controls and semantic colour tokens. Legacy `researchLauncher` no longer used in those components. All content fields min-width 0, no forced CTA column shrinking.
3. **Accessibility / inclusive design lens:** headings precede actions; keyboard focus indicator; mobile menu has `aria-expanded`, `aria-controls`, accessible label and an explicit sign-out path; primary controls meet 44px touch-height; no modal focus trap; use text as well as colour for state. Guidance checked: https://designsystem.digital.gov/documentation/accessibility/ and https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.
4. **Quality engineering / visual regression lens:** Playwright + Chromium live HTML/CSS layout fixture at 320, 390, 1100 and 1440 CSS pixels, in both dark and light. Assertions: no horizontal document overflow, primary CTA stays within panel and below excessive height threshold, theme token correct, visible narrow navigation affordance, mobile menu open/close and account sign-out, keyboard focus, research detail disclosure. Six/eight screenshots uploaded as GitHub Actions artifacts with 14-day retention. Node tests additionally assert both workspaces use the same component, no promotional banner, and correct appearance persistence precedence.

This is a documented **specialist-role critique performed by AI with independent published standards**. No hired human UX designer, accessibility assessor or design agency has reviewed or signed off. Do not market it as human expert certification.

## Implemented change inventory
- `src/components/WorkspaceActionPanel.tsx`: shared stable research-action component; one strong primary button, one text-style external alternative, controls and disclosures in separate regions.
- `src/pages/SavedDraft.tsx`: replaces overcrowded paid-action row with clear **Dive deeper**; prior research and optional standard rerun are secondary; no new paid action triggered automatically.
- `src/pages/ItemDetail.tsx`: adopts same panel rather than a second variant.
- `src/components/ResearchDecisionPanel.tsx`: limits visible long labels and summary, keeps complete archived research in disclosure, hides detailed market economics until requested; no data discarded or promoted from AI to verified value.
- `src/lib/appearance.ts`, `src/App.tsx`, `index.html`: dark/light/system-respectful appearance, local device preference, and early document theme set to avoid flash; brand's persistent promotional banner removed from main working surface.
- `src/components/Sidebar.tsx`: appearance controls on desktop/mobile and explicit mobile disclosure Menu, accessible keyboard and mobile sign-out.
- `src/styles.css`: v3 semantic light/dark tokens and legacy coverage, consistent buttons, sidebars/panels/inputs/tables/notes, bounded action controls and responsive review cards.
- `src/components/VisualReferenceWorkbench.tsx` and `src/pages/Research.tsx`: handle unexpected non-JSON remote service errors as a clear user-facing failure; no record falsely saved. `api/open-access-search.ts` caps the search fan-out and timeouts to reduce serverless timeouts, without claiming its upstream failure was root-cause verified.
- `.github/workflows/typecheck.yml`, `tests/fixtures/appearance-layout.html`, `tests/ui-layout.spec.mjs`, `tests/designContract.test.mjs`, `tests/appearance.test.mjs`: browser-level and source-level release gates.

## Actual QA observations and fixes
- Original screenshot: FAIL, giant multi-line primary button and misplaced notes; page-specific flex structure directly confirmed in previous code.
- First six screenshot build: action layout looked proportionate at 390, 1100, 1440 both themes; 7/8 checks passed. The keyboard-focus test initially failed because the test used mouse/programmatic focus before measuring `:focus-visible`, not a keyboard navigation sequence. The test was corrected to drive actual keyboard focus.
- Chromium screenshots exposed a separate genuine mobile navigation bug: original `.navItem{width:100%}` caused horizontally scrolling first-only tab visibility; earlier light/dark footer duplicated the mobile appearance control. These were corrected. Subsequent mobile navigation design was simplified further to a labelled disclosure Menu and desktop-only footer. Tests now open the menu, verify Inventory and sign-out, close it, and check the desktop nav remains visible.
- Light preview: white panels, pale blue-grey background, high-contrast dark text, muted dark-gold paid CTA. Dark preview: charcoal panels, clear pale gold CTA, balanced card hierarchy. Original screenshots and private item photos are not copied into public GitHub.
- Dedicated browser check uses a **representative unauthenticated fixture**, not a logged-in screenshot of actual production data. The authenticated end-to-end experience remains **NOT TESTED** until the owner confirms it.

## CSS and product guardrails — apply to EVERY future change
1. Use existing semantic tokens for any component/background/text/border; do not add hard-coded dark backgrounds that break light mode.
2. Use `WorkspaceActionPanel` or another reviewed shared control layout; never put descriptive paragraphs and action buttons as peer children of a `justify-content:space-between` row.
3. Use at most one filled primary action in the main decision container. Secondary can be outline/underlined text; advanced paid actions are disclosed with explicit cost context.
4. Place full evidence notes under closed details. Never erase provenance or contradict the original visual evidence while simplifying layout.
5. Test geometry at 320/390/1100/1440, dark and light; verify keyboard focus and accessible mobile menu. Release blocked on browser test failure, even when TypeScript/Vite succeeds.
6. An actual signed-in screenshot or user acceptance is REQUIRED before claiming final visual acceptance. No automatic admission of user's real collection is permitted from browser fixture tests alone.
7. Theme setting is UI preference, not data evidence. No private owner source images, object status, maker records, comparables, fees or sale outcomes are changed by this visual repair.

## Status / next actual test
Status: **CONDITIONAL — code and mock-browser geometry passed when indicated by CI; signed-in screenshot acceptance pending**.
Open existing dark-metal pair Market and confirm the research action panel has one normal-height gold button, a recognisable manual-image-search link, and concise valuation cards/details. Toggle dark/light with desktop sidebar or mobile header; reload to verify setting. On a phone open Menu to reach Inventory and Sign out. Check museum search failure returns a useful error instead of JavaScript/JSON text; if it still fails, pass the exact message, which may require Vercel runtime-log access (prior attempt returned 403 and was not misreported as an inspected log).
Do not restart paid AI tests or import real collection items as a prerequisite of this check.
