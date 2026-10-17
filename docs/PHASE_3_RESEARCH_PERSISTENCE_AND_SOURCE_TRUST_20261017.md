# Phase 3 — retained web research, sourced photo corrections and net sale economics
Date: 17 October 2026.
Decision: CODE COMPLETE / PRODUCTION BUILD CHECK PENDING final commit; owner authenticated UX acceptance PENDING.
Scope: test uploads only. Do not admit the real collection yet.

## Discovered in owner testing
1. New single-object upload contained an apparent matched pair of physical pieces. Draft report has two separate member observations, but one proposed sale lot. The details include an AI-supplied **nonexistent seventh photo index** in a six-file source manifest. This is a false index, not an absent original photograph.
2. Several test objects have live research results already saved in `ai_analysis_runs`, labelled provisional. A research model claimed external auction sold examples but there is NO independently verified comparable in approved `public.comparables`. Reuse source research, do not rerun or call market asking SOLD.
3. Original Inventory draft listing still showed two object cards for a matched pair and highlighted a stale historical mixed batch. It now shows a single matched lot and the latest report first.
4. Web research originally returned to the browser BEFORE storing the paid result; a page loss could cause lost research and repeat billing.

## Implemented
- Migration `20261017_paid_research_claim_gate_v1.sql` installs `ci_claim_paid_research_v1`, SECURITY INVOKER, owner-RLS, authenticated-only. A staged research row is atomically claimed to PROCESSING; second paid invocation for the same row is refused. A COMPLETE result is reused without a new call. DB transaction tested both claim and refused duplicate with rollback.
- `api/research-item.ts` validates the owner-scoped research envelope AND original item/draft source, pair scope and photo count before claiming; saves full audited model response server-side, and returns run ID. `SavedDraft.tsx` and `ItemDetail.tsx` stage private research before any paid call and read back the persisted result. Interrupted research is displayed separately; it is not incorrectly treated as complete.
- Saved research is the default view; new paid investigation requires extra deliberate action when prior relevant findings are available. Prior research results are scoped by original object index and pair-vs-individual status.
- Shared `ResearchDecisionPanel` provides conservative attribution, evidence caveats, gross values, actual-source links (HTTPS only), asking-vs-realised basis, comparability grade, specialist contradictions and next actions. Previous AI sold labels remain explicitly UNVERIFIED; an incorrect “fewer than two” source count warning was removed. Whole matched pairs now instruct the next web-research response to quote prices for the WHOLE LOT; older per-vessel estimates are labelled as such.
- Shared `SaleEconomics` calculates user-entered gross achieved price, venue fees, net proceeds, acquisition cost, profit and return on acquisition cash. Zero-percent fees must be entered intentionally. VAT, tax, refunds, etc. are not silently assumed.
- Migration `20261017_owner_review_photo_index_override_v3.sql`: report's original AI `image_indices` are not overwritten. Owner can explicitly confirm only extant original photo indices for catalogue approval, which is recorded with original vs approved source indices. Absent/invalid references remain a visible warning and block approval until signed-in owner confirms.
- New intake server `photo_index_audit` adds an explicit list of invalid raw model references at first paid AI response; `initial_ai_result` remains immutable. On AI Intake, an attempted approval with invalid refs routes to Saved Draft source-review rather than failing or inventing photo #7.
- Inventory uses `suggestSingleIntakePair` and a grouped lot card in latest and earlier drafts, avoiding the two-card apparent duplicate. Source photographs are signed and retained.
- After an eventual successful catalogue approval, ItemDetail Market locates previously saved research by source intake run, exact child index and approved paired status; it does not copy findings across sibling objects or promote them automatically into verified maker/price fields.

## Regression tests and limitations
- Role-simulated transaction against the exact six-photo anomaly: uncorrected nonexistent source index is blocked; owner-confirmed valid mapping creates **one matched pair lot and six original photo records**, an identical retry returns the same record. ROLLBACK preserved the owner's original database unchanged.
- Separate rollback test of paid research claim verified claim then duplicate rejection. No paid model was used in these development tests.
- GitHub Actions tests include the actual difficult “left vessel” / “right/detail-photographed vessel” language in matched-pair regression. TypeScript and Vite build gate applies to every commit.
- Source evidence and chronological correction narrative, including private run IDs, saved into private Google Drive historical dossier on 17 October; do not place private photo evidence in public GitHub. The original uploads remain private in Supabase.
- READY Vercel is a build check, not authentication, web-source verification or visual signoff. Remaining: signed-in browser research capture/recovery and photo correction, keyboard/touch/mobile visual inspection, user approval, versioned owner edits, fees/save outcome workflow and trusted comparable promotion rules. Keep real collection intake closed pending those gates.

## Next checkpoint
Ask the owner to open the ALREADY-SAVED recent paired-vase draft, not upload again. Check one grouped card in Inventory; six original photos and AI reference warning on draft; existing Market research and per-vessel-vs-pair scope; Sales scenario; and Catalogue correction checkbox. Do not approve into permanent catalogue unless intentionally testing. Capture screenshot/error and correct before larger collection ingestion.
