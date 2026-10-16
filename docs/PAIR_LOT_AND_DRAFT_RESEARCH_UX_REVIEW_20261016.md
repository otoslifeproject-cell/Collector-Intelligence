# Collector Intelligence — Owner test corrections: pair lot and missing research workspace
Date: 16 October 2026
Review: AI-assisted technical / collector-workflow UX critique. No independent human expert engaged.
Source: owner signed-in experience with two fresh `ai_analysis_runs`. Verified server-side independently against Supabase.

## Observed failures, preserved exactly as separate hypotheses
1. Owner's matching pale yellow-green bubble-glass vase pair appeared twice as separate AI draft objects after ONE-OBJECT intake.
   - Run `2f0b0149-0cd9-4d7d-b55d-41dd7568a10b` genuinely has two *physical-member observations*, each with overlapping source photo indices, not two *confirmed permanent catalogue records*.
   - Left: indices 0,1,3,4,5,7; right: 0,2,3,4,6,7. The union is eight distinct images. **Two separate physical pieces and one potential commercial lot must not be conflated.**
2. Single purple art-glass vessel `3f8d90ff-97ac-4f7c-9c21-38a7020aba6b`, eight source photographs, one complete DRAFT AI object. Clicking its saved report did NOT display familiar six-tab object workspace or enable live web-based research; it displayed mostly more-photo suggestions.
3. Neither of the above newer DRAFT runs had been approved into public.items at the time of investigation. No deletion, forced merge or irreversible item creation was authorised by this fix.

## Implementation
- Conservative `src/lib/pairGrouping.ts`: proposes one matched *sale/catalogue lot* only for one-object-mode with exactly two physically differentiated matching LEFT/RIGHT descriptions and common type descriptors. False match prevention: batch mode, one object repeated, unrelated objects return null. Owner can uncheck pair grouping to create separate items. The original two AI observations remain unchanged.
- Supabase migration `20261016_explicit_matched_pair_single_lot_v2.sql`: owner-confirmed `pair_source_indices=[0,1]` with representative source index 0 creates one atomic catalogued item containing the unique union of photo indices and both evidence/task arrays; the original two member observations/conditions are recorded in notes and immutable original AI run. Pair cannot be injected for unrelated batch or one with missing/invalid membership.
- Actual database transaction (same owner-scoped original eight-image DRAFT): one pair created as **1 item, 8 image links**, identical repeat returned same item; transaction ROLLBACK verified no permanent promotion. Security invoker/RLS and explicit source owner check preserved.
- `AIIntake.tsx` displays one photo-led pair lot by default with opt-out, suppressed inappropriate first-piece price as a pair valuation, complete photo union; direct **Research & value** CTA to saved work before catalogue approval.
- `SavedDraft.tsx` restores six-tab experience: Overview, Photos, Identification, Market, Sales, Catalogue. Market shows preliminary visual price with qualifier, an optional **Research & value online** request, saved web-research results, source quality, comparables and route. Pair defaults to one lot (original member records available). One-item approval opens permanent Item Detail Market.
- `api/research-item.ts` allows live web search for an owner-readable completed DRAFT without inventing a permanent item. Existing canonical policy, trusted Knowledge Brain, independently checked comparables gate and downgraded source audit remain. Paid research is only invoked after user action. Provisional research saved separately in `ai_analysis_runs`, leaving original AI object and photos untouched.
- `ItemDetail.tsx` now respects React Router hash-route `?tab=market`, rather than reading the wrong browser search string.
- Research results are scoped to original draft child index AND paired/separate mode to prevent accidental comparables/price transfer between physical items.
- Intake AI prompt now explicitly distinguishes multiple photos of one object, two members of a matched pair, and the combined catalogue lot.

## Quality / design review
**Five-second comprehension:** same photo and short title, pair banner says TWO PHYSICAL PIECES / ONE LOT, review shows original member observations. No maker authentication implied.
**Progressive disclosure:** raw AI evidence, photo sheet, price leads and specialist checks remain behind panels rather than crammed on initial cards. Desktop CSS inherits shared global card system.
**Main user action:** AI output → Research & value → Market tab → explicit online web search; or Catalogue → permanent Item Detail.
**Trust:** no automatic real-market attribution promotion; all model-supplied sold claims marked provisional pending direct source verification. One-piece visual valuation is not displayed as a verified pair value.
**Retention:** new saved research is separate from original model; no destructive edit of saved AI source or old draft runs.
**Evidence:** database roll-back confirmed one paired catalogue record and eight original photographs and identical retry safety. No actual owner-level web API result or authenticated browser screenshot was run within this automated check.
**Regression:** GitHub Actions `Collector Intelligence Typecheck` uses Node 22, npm install, explicit matched-pair benchmark tests and `npm run build`; this must pass before user acceptance. Initial JSX compile errors were discovered and fixed; old failed deployments must not be described as successful.
**Verdict:** CONDITIONAL until latest GitHub/Vercel READY, owner signed-in pair/Market page check, online research result saved/reloaded and next disposable AI item test. Mobile and screen-reader acceptance still not evidenced.

## Required owner check
- Existing pair: open Saved Draft `#/draft/2f0b0149-0cd9-4d7d-b55d-41dd7568a10b`, see one matched-pair card with opt-out. Do NOT catalogue unless deliberately testing.
- Existing purple item: open `#/draft/3f8d90ff-97ac-4f7c-9c21-38a7020aba6b`, see six tabs, Market visual estimate and Research & value online (the extra web search is opt-in paid).
- Only once these behave: use a disposable different object for a single-item intake. Confirm identical images, correct object count, research source quality, Market/Sales tabs and saving to Inventory after refreshing. Report failing screen/photo only.
