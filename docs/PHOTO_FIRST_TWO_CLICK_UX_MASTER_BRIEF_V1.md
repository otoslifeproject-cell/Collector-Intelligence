# Collector Intelligence — PHOTO-FIRST TWO-CLICK UX MASTER BRIEF
**Version:** 1.0 — DESIGN FREEZE CANDIDATE  
**Date:** 2026-10-15  
**Status:** Specification and expert-style UX critique; **NO live implementation authorised by this document alone**  
**Owner intent:** Serious, deep intelligence beneath a remarkably simple, calm, intuitive interface. Every important workflow should require one or two avoidable clicks from its natural starting screen. The approved Collector's Facet visual brand remains unchanged.  
**Authority:** 02_MASTER_PROJECT_BRIEF.md > 03_SOURCE_AND_EVIDENCE_POLICY.md > this design brief. Also follow docs/TWO_CLICK_UX_STANDARD_V1.md and docs/CONTINUOUS_UX_REVIEW_STANDARD_V1.md.

## 1. Decision / north star
**Show the object. Show its honest stage. Show the next action. Hide everything else until asked.**

The app should feel like Finder/Photos for collecting and like a trustworthy specialist research desk when opened. A novice should feel confident in seconds; an experienced dealer should be able to work fast without re-reading forms; the evidence system remains extensive and auditable.

Not a dashboard of model output. Not an endless form. Not a generic AI chatbot. One canonical object, with status, photo and meaningful action at the centre.

### Core user jobs
1. Photograph a found item; get preliminary identity / conservative BUY–MAYBE–PASS.
2. Upload a mixed batch; visually distinguish objects and preserve all drafts immediately.
3. Find any object again by image/name/CI code in one interaction.
4. Continue unfinished research; do not pay again or lose earlier photos.
5. Verify maker, auction sale and market valuation without inventing confidence.
6. Route item to a sale channel, generate a truthful listing, see estimated NET not merely gross.
7. Return months later; all images, past attributions, uncertainty and outcomes remain accessible.

## 2. UX rules (non-negotiable)
- Two avoidable clicks MAX for the most frequent actions **once required data already exists**. Uploading files, entering missing evidence, authorising paid searches, irreversible cataloguing, publication or disposal may take more; label why.
- At most **one strongest primary CTA** and one secondary prominent CTA per context. Place specialist actions in an overflow menu or closed evidence drawer.
- On collection surfaces **photo is primary**; text is secondary. Never permit a text-only 'Icons' mode unless no recoverable photograph exists.
- Nothing from a successfully returned AI report may vanish because a user did not approve catalogue promotion. A saved provisional AI *run* is not the same as an approved CI *item*; clearly distinguish.
- Information is layered: **Overview (default) → Work details → Evidence/History/Advanced**. Technical ledgers, raw source results and machine statuses are collapsed by default.
- Every significant action returns one unambiguous result: Saving / Saved / Requires input / Failed / Partially saved. Never show 'complete' or 'verified' on an unverified object.
- Progress measures completed *workflow milestones*, NOT identification confidence or model certainty. No fabricated 100% readiness.
- A persistent global marketing banner must not obscure working content while scrolling, especially in a mobile intake screen. Retain positioning under About/Brand or one compact dismissible top message.
- Preserve approved brand palette, graphic assets and consistent typography; no gratuitous animation, gradients, novelty UI or needless pages.

## 3. Information architecture: ONE canonical home per object
**Dashboard:** 'Continue where I left off', recently photographed items, one-tap Quick Buy / Add photos, short business metrics behind optional disclosure.  
**Inventory:** All objects **including unapproved AI draft objects**, visually distinguishable, searchable, filterable, with Tiles / List / Icons and optional board grouping.  
**Object workspace:** Single page with hero photo, title, unique ID or draft source reference, trustworthy stage, next action, quick-sale range, confidence separated from progress. Below are collapsed Photo set, Identification, Research, Market, Sale, Evidence and History. A context action may deep-link directly to an expanded section without further nav.  
**Research:** Global source explorer and queue, not a second object-home. Results are attached to a selected item and return to that item.  
**Sales:** Queue/status view of the same objects, not a separate competing record.  
**AI Intake:** Upload → brief visual review of separated objects → approve or save drafts. Always save draft run and photo manifest automatically before model results are shown.  
**Advanced Admin:** source ledger, source snapshots, ownership checks, model run history and Knowledge Brain behind one clearly labelled area.

Avoid redundant 'AI intake' versus 'Add item' options if they execute the same task; if both remain, make differences explicit.

## 4. Three universal collection layouts
Implement a **reusable ViewModeSwitcher** (not separate custom copies) wherever the page actually displays a collection of objects: Inventory first, then Dashboard recent objects, Sales queue and completed AI batches. Do not place layout toggles on forms or technical evidence tables without benefit.

**A. Tiles — default for review**
- 2–4 desktop columns according to actual container width; 1–2 responsive mobile.
- Large **complete-object photograph** with consistent aspect ratio and *contain*, not destructive cropping.
- Short visible title (max 2 lines), one concise truthful stage label, progress if applicable, one CTA: Continue / Research / List / Review.
- Secondary info: quick-sale provisional value or value unknown, one line maximum.
- Click photo/card to open the object; action button may deep-link into its next task.
- No long evidence paragraphs, maker speculation, technical codes, or more than two visible CTAs.

**B. List — fastest expert scanning**
- One row per object: 64–88 px thumbnail, CI/draft key + one-line title, stage, honest progress or next check, price band or unknown, primary action.
- Search, sort (recent, status, title, value), filters; sticky table headings only when useful.
- Keyboard Up/Down focus and Enter open; avoid horizontal scroll where reasonably possible.
- Row actions do NOT trigger parent navigation accidentally.

**C. Icons — visual collection / Finder style**
- Dense **image-first** grid with roughly square, large enough thumbnails and a 1–2-line label underneath.
- A tiny status dot/badge and optional one small progress line; no paragraphs, full-width CTA, or text-only miniature boxes.
- Single click selects or opens according to standard interaction defined consistently (recommended: click opens object; separate checkbox supports multi-select).
- Image should occupy majority of cell, with object comfortably inside frame and no clipped rim/handles/foot.
- For images of glass, allow neutral background and high-contrast silhouette; use contain to avoid cropping.
- Hover/keyboard-focus can reveal no more than one secondary quick action; remain accessible on touch.
- If photo unavailable display tasteful fallback icon and 'Photo unavailable', not a fabricated product picture.

View preference persists by user and device where possible; localStorage is acceptable as initial convenience, but not a source of truth for records. Changing views must preserve filters, selection, scroll position where feasible and current item set.

**Explicitly NOT Kanban as a replacement for Icons.** A Kanban Board is a separate optional status-grouped view later, for moving items through workflow. It must not imply real status changes by mere drag without confirmation.

## 5. Cover image selection — CRITICAL
Current screen failure: all seven unfinished AI drafts are text-only although the source images were uploaded for analysis. The cover-image algorithm must be object-specific; DO NOT borrow another object's photo.

1. Honor a user-approved **cover / hero photo** unless missing or unusable.
2. Otherwise choose an AI-suggested candidate from **photos associated with that exact object** only, scored for complete-object framing, sharpness, adequate lighting, natural orientation, visible silhouette, minimal hand/background, and absence of obscuring text.
3. Prefer a complete front/three-quarter view. Avoid underside scratches, blown highlights, isolated mark/base macro photographs as default covers even when more visually striking.
4. If confidence low / no complete-object shot, pick a clearly labelled fallback and request a better full-object shot; never use an unrelated image.
5. Save **selected photo ID + method (USER/AUTO/FALLBACK) + score/version** and allow one-click 'Set as cover' from the photo gallery; preserve all original photos.
6. On draft run restoration, map stored photo manifest index → immutable private storage path → correct draft object's `image_indices`. Verify ownership and that every referenced index belongs to the same analysis run.
7. Create small cached responsive thumbnails server-side from authorized originals where appropriate; signed URLs expire, display fallback gracefully. Don't publicly expose private storage.
8. Show a thumbnail loading/skeleton state and an explicit unavailable state instead of an empty black square.
9. Glass-specific checks: translucent rim must stay visible; white glass on white background needs neutral contrasting backdrop; no automatic visual transformations of evidential originals. Thumbnail adjustment is presentation-only, originals untouched.
10. Allow browse of 2–3 additional source images inside large Tiles on demand, but default remains visually calm.

**Do not claim the currently uploaded image manifest has been reconstructed.** Existing DRAFT runs may lack an explicit manifest. Recovery requires direct authorization/ownership and safe path matching; never infer association between mixed photos solely from filenames.

## 6. Draft lifecycle and recovery — MUST be reliable
- A returned AI analysis becomes an **Unfinished report** immediately and survives refresh, logout, crash and device change. It is a stored draft run, not necessarily an approved catalogue item.
- Every detected physical object is represented visually as a **draft child object**, with a stable run ID + child index/ID; initially no permanent `CI-...` code if not yet approved.
- Explicitly separate **Save draft** (safe/provisional, automatic) from **Approve & catalogue** (creates persistent item).
- Store run owner, upload session ID, immutable original photo paths, photo-index mapping, model version, input context and structured result, selected/unselected objects, edits and state changes in a recoverable database-backed manifest.
- 'Continue' should reopen the **specific saved draft and all its correct photographs and edits**, NOT simply take user to a blank `/intake` upload form. Until implemented, don't display a misleading Continue/Open intake action.
- Approval needs an idempotency key per draft object, owner permissions, transaction/compensation strategy and read-back acknowledgement so network retries cannot create duplicates or partial five-object batches.
- Preserve discarded/excluded child hypotheses in the historical run without silently creating inventory stock.
- A draft discovered in two earlier runs may refer to the same object. Offer 'Potential duplicate' review, but never merge based solely on visual similarity or title.
- Clear archival/remove actions, no destructive clean-up without confirmation and source preservation.

**Current critical bug/UX debt:** Inventory shows seven draft children, five from the latest batch and two from earlier single runs, with no photos and an 'Open intake' button that doesn't actually resume them. The interface must resolve these facts precisely before claiming two-click completion.

## 7. Honest, actionable progress model
Progress is a **workflow readiness measure**, not a statement of rarity, confidence, monetary value or factual truth.
Keep a visible **stage label** more important than the numerical percentage. Consider percentage a secondary optional display to avoid false precision.

Suggested stage gates (to be confirmed by database logic, not AI assertions):
- 25%: Original AI report saved and source image manifest recoverable. **Until photo recovery exists, use 'Initial report saved · Needs photos linked' not an unqualified 25% complete.**
- 50%: Owner-reviewed canonical catalogue record created; key object/photos preserved and condition/description checks acknowledged.
- 75%: Necessary attribution research recorded, value basis and applicable costs reviewed, and outstanding critical risks identified. No trusted comp => cannot claim price VERIFIED; optional specialist cases may remain blocked.
- 100%: All *required for this item* checks satisfied, actual sale route approved, description/condition and price reviewed, no blocking unknowns; 'Ready to list' or 'Ready for sale'. **Never simply treat SELL_NOW status as proof all evidence checks passed.**
- Selling lifecycle is separate: Draft listing / Listed / Consigned / Sold / Settled. Do not treat 'Sold' as 125% completion.
- Provide one sentence 'What remains' and a **Continue** action that opens the next incomplete gate.
- Show confidence independently in advanced or medium-detail view: ID 62%, date 22%, value 12% are different constructs, not progress.
- Specialist review overrides generic readiness and blocks misleading green/100% badges.

## 8. Action model (commercially meaningful)
By state:
- Unfinished AI draft → **Continue draft**, secondary View evidence.
- Needs photo → **Add full-object photo**.
- Catalogue incomplete → **Review & save object**.
- Attribution uncertain → **Research identity**, optionally Run paid AI after explicit notice.
- Evidence incomplete → **Check source**.
- Value incomplete → **Review valuation**, show sale basis and realistic net.
- Ready to sell → **Create listing draft** or **Choose venue**.
- Listed → **Manage listing**.
- Sold → **Record sale price & fees**.

Batch actions only on explicitly selected records: **Save selected drafts**, **Queue research**, **Prepare listings**. Show number of objects, estimated fees/AI cost, and safe confirmations. Never automatically run paid AI on every object or publish listings from bulk selection.

**Commercial goals:** Shorten time to a defensible decision, reduce costly research on generic low-value glass, highlight high-upside candidates, quantify gross/net/profit separately, and keep the sold-outcome loop. Avoid premium pricing claims from dealer ASKING context.

## 9. Screen-by-screen two-click flows
| Starting screen | User goal | Main path | Max avoidable clicks |
| --- | --- | --- | --- |
| Dashboard | Continue recently worked object | Photo tile → next action | 2 |
| Inventory | Open object | Photo/row → object workspace | 1 |
| Inventory | Continue unfinished draft | Continue → restored review | 1 (once recovery exists) |
| Inventory | Change view | Tiles/List/Icons | 1 |
| Inventory | Start Quick Buy | Quick Buy CTA → camera/upload | 1–2 plus upload |
| Draft batch review | Approve chosen five | Confirm selection → Save selected | 1–2 plus deliberate approval |
| Object | View preserved research | View research findings | 1 |
| Object | Check maker source | Research → original source | 1–2 |
| Object | Generate listing draft | Sell → Generate draft | 1–2 plus fields if required |
| Sales queue | Act on listing | Item → contextual action | 1–2 |
| Research | Museum lead to item | Select item → save provisional | 2 when source already found |

Never hide a safety acknowledgement just to win the click metric. Record true browser click counts, not hypothetical compliance.

## 10. Search, filters and sort
- One global search entry; results for **items**, **unapproved drafts** and **research records** clearly grouped, never mixed as identical status.
- Search title, maker, code, colour, materials, aliases, notes and source, respecting owner permissions. Debounced, typographically calm.
- Inventory quick filters: All / Needs action / Ready to sell / Listed / Sold, with Advanced filters collapsed.
- Show active filters and clear-all. Persist view and filter if useful, avoid leaving users in a confusing empty state.
- Search result card uses same cover image and trustworthy status as any other surface.

## 11. Technical component contract
Reusable primitives rather than per-page copying:
`ObjectCover`, `ObjectIdentity`, `ObjectStatus`, `ObjectProgress`, `ObjectAction`, `ObjectCard`, `ObjectRow`, `ViewModeSwitcher`, `EvidenceDrawer`, `BatchActionBar`, `EmptyState`.
- Use one owner-scoped object/draft view model with `kind: 'DRAFT'|'ITEM'`, stable ID, title, linked photo metadata, source evidence, progress gates and next action. Never pretend a DRAFT is already an ITEM.
- Reuse photo-source linkage and explicit evidence boundaries.
- Prefer semantic buttons, links, labelled controls, CSS grid, keyboard accessibility and predictable focus.
- Slow external calls and data-heavy detail loaders must not block initial visible content; use skeletons and actionable errors.
- Avoid N+1 signed-URL requests on large inventories: batch owned photo metadata; concurrency limits and cache signed URLs thoughtfully.
- Preserve old layouts and migrations until regression tested; code changes need version-controlled change log.

## 12. Accessibility and attention-friendly interaction
- Desktop and mobile tested at narrow width, 200% zoom and keyboard-only operation.
- Contrast and focus visibility per WCAG 2.2; meaningful accessible image alternatives, progress aria-valuenow only when justified, touch targets ideally >=44px (W3C minimum target-size criterion remains 24px with exceptions).
- Do not make hover the only way to access actions; no colour-only meaning.
- Avoid sticky banners obscuring work; reduce animations and comply with reduced-motion preference.
- No visually crowded tiny icon tiles: scale to minimum comfortable hit area and retain a legible title.
- Clear labels ('Continue research', not 'Open intake' when data is not actually resumed).
- Error recovery should be one sentence plus Retry / See details; no raw JSON or technical stack traces in ordinary UI.
- Progressive disclosure by intent, not merely 15 separate collapsed panels that still overwhelm visually.

## 13. Design references — principles, NOT copying protected layouts
- Apple Human Interface Guidelines — Collections: familiar grids/rows and image-based browsing; list is efficient for textual content. https://developer.apple.com/design/human-interface-guidelines/collections
- Nielsen Norman Group — Progressive Disclosure: primary functions first; defer advanced options. https://www.nngroup.com/videos/progressive-disclosure/
- Nielsen Norman Group — Recognition Rather Than Recall: objects should be recognisable through images, recent history, visible actions. https://www.nngroup.com/articles/recognition-and-recall/
- Nielsen Norman Group — Ten Usability Heuristics: system status, consistency, user control, error recovery. https://www.nngroup.com/articles/ten-usability-heuristics/
- Baymard Institute — Product-list thumbnail quality and multiple image access. https://baymard.com/research-articles/secondary-hover-information
- W3C — WCAG 2.2 targets and focus. https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/
- Product analogies: Finder/Photos for browse and recognisable objects; Shopify-type operational status grouping; Notion/Linear-style calm action-first surfaces. **These are inspiration, not validated exact UI reproduction; do not clone logos or proprietary screens.**

## 14. Implementation order / risk-managed rollout
**Phase 0 — preserve and measure (MANDATORY):** Schema/code inventory; export current status and original photo manifests; identify duplicate DRAFT runs, selected items and ownership; capture baseline screenshots and click counts; confirm rollback plan. No destructive migration.
**Phase 1 — usable object photos:** Secure linkage and best-cover pipeline for draft and approved records; basic Set cover; source-original preservation. Test 5-object mixed batches and old draft recovery.
**Phase 2 — actual resume:** Owner-scoped restore of original AI draft+photos+edits, idempotent five-item approval; save read-back; retry/partial-failure tests.
**Phase 3 — unified surface:** Shared ObjectCard/ObjectCover and Tiles/List/Icons; one canonical Inventory plus quick filters; fix icons as photo-led.
**Phase 4 — progress and action:** Data-driven milestone gates, per-state Next action, batch actions with cost and evidence review.
**Phase 5 — propagate:** Dashboard, AI Intake completed review, Sales and Research linking reuse; optional Kanban Board only if it solves a validated task.
**Phase 6 — acceptance:** Desktop + mobile + keyboard and screen reader spot check; end-to-end five-object recovery, no double payment, no duplicates, no cross-object photo contamination, valid trusted-source status, 2-click paths; user owner sign-off.

This order intentionally fixes source-of-truth and photo recovery **before** further cosmetic work. Do not claim photo-first experience achieved with CSS masking when draft images are not yet linked.

## 15. Test matrix: acceptance gates
1. Old batch report of FIVE appears after logout/login, each with correct object-specific main photo. No paid model request.
2. Earlier TWO single runs remain distinguishable; no merging or ambiguous "seven items" claiming seven approved records.
3. Selecting Icons shows an actual representative photo, not a text mini card; no clipping of a whole glass object.
4. List shows thumbnail, title, stage and primary action in one scanning row.
5. Switching layout retains search/status filter; preference survives refresh and mobile layout remains legible.
6. Continue on draft restores existing result and correct original images; never drops user into blank upload.
7. Save selected five creates exactly five items, even after retry/reload/network loss; read-back verifies all links.
8. Partial error shows real saved count and safe resume, without duplicate creation.
9. User choice of cover photo persists across Inventory, Dashboard, Research and Sales.
10. Stage/progress accurately computed; insufficient verified sales evidence cannot yield bogus 'verified 100%'.
11. Photo links are owner-scoped; cross-account records inaccessible; originals preserved.
12. Sales path represents acquisition, shipping, fees, gross/net/profit separately.
13. Keyboard Tab/Enter/Escape, screen reader image labels and 200% zoom do not trap/obscure actions.
14. No page shows raw research paragraphs/ledgers by default; important action above fold at laptop/mobile widths.
15. Evidence, provenance, rejected hypotheses and source limitations survive every workflow.

## 16. Per-build UX expert review
Treat the role as a rigorous **AI-assisted product/UX critic**, not an independently retained human designer. After each UI implementation record:
- Before/after screenshots and click-count walkthrough.
- Five-second comprehension test: which object? what stage? what is next?
- Visual hierarchy and photo fidelity.
- Disabled/loading/error/empty/partial/success paths.
- Commercial decision impact and cost consent.
- Accessibility and private evidence constraints.
- Actual measured tests versus untested claims.
- PASS / CONDITIONAL / FAIL, why, and next correction.

**Approval rule:** Do not declare a screen done because TypeScript builds. Require user-visible behavioural evidence and original-source safety checks. Unresolved material gaps remain prominently documented.

## 17. Immediate deliverable (definition of done)
A returning collector opens Inventory and sees **real photographs of all seven unfinished saved report objects**, clearly tagged DRAFT, grouped appropriately by analysis batch, with an honest stage and an action that *actually resumes that exact draft*. The same picture appears consistently in Tiles/List/Icons. One click gets into the correct work. Deeper detail is available but invisible until requested.

**Stop criterion:** If the original image mapping cannot be safely recovered, show 'Photo link requires recovery' and disable misleading resume/approval, while preserving the original report. Never invent, mix or discard photographic evidence.
