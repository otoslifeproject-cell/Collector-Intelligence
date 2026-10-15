# Commercial decision engine — build contract (2026-10-15)
Status: staged specification, NOT fully built or validated.
Applies after reliable one-object photo attachment and draft preservation.

## User result (surface)
One photo-led object card and one recommended primary action: KEEP / SELL ON EBAY / SEND TO SPECIALIST AUCTION / SELL LOCALLY / DEALER OFFER / RESEARCH FIRST / SPECIALIST REVIEW. Show the top recommendation, realistic expected net £ range, confidence in the recommendation, and one sentence why. Alternatives and full evidence are expandable.

## Evidence inputs and explicit boundaries
- Observed dimensions, condition, marks, provenance and original photographs.
- Attribution state (confirmed/strong/possible/unknown) with revision history.
- Actual comparable sale basis (hammer, premium-inclusive realised, confirmed eBay sold, estimate, dealer asking, unverified) and currency/date.
- Verified source trust gate independent of AI claims. The V&A connection returns museum reference leads, not authentication or sold prices. Europeana requires credential. No pretending that paid pricing datasets are connected.
- Acquisition price, tax/premium, platform fees, payment fees, packaging, shipment, insurance, return risk, repair, time to sell and likelihood of sale.
- Scarcity, venue fit, thresholds and owner objectives (speed, net return, keep enjoyment, workload).

## Decision economics
Gross expected sale amount, sale costs, estimated net proceeds, purchase cost and net profit must be DISTINCT. Auction requires estimated hammer, seller commission and other seller charges; buyer premium cannot be silently mixed. eBay fees/trader/returns depend on account category and seller jurisdiction. Never invent a live fee. Show assumptions and last checked date.
Expected net return should be ranges with venue-specific uncertainty and minimum net floor; user may override assumptions.
'KEEP' is a viable recommendation where expected net is low, condition/identity uncertain or owner preference merits holding. Auction is not automatically premium; seller workload, minimum consignment and fees matter.
Always distinguish verified/comparable-based valuation from purely visual provisional value.

## Evidence readiness gate
NO VERIFIED sale basis => recommendation stays PROVISIONAL and explains uncertainty. A generic low-value piece may proceed via realistic low-risk route if the owner accepts visual-only assumptions; don't force uneconomic research.
High-risk/high-upside/strong maker attribution without proof => RESEARCH FIRST or specialist review. Never auto-post or send consignments.

## Build sequence
1. Reliable persisted intake drafts + object-specific photos with one-click reopen and safe item approval.
2. Reviewed object record with evidence links and visible next check.
3. Source provenance and independent original auction sale confirmation.
4. Venue-cost calculator and recommendation rules; basic conservative route recommendations first.
5. User-facing one-action KEEP / SELL / RESEARCH decision card on each item, alternative venues expandable.
6. Listing draft/auction enquiry creation after owner review; sale outcomes feedback loop.
Test cases: generic cheap bowl, high-confidence signed glass, fragile oversize piece, worn/unmarked piece, multiple objects in a batch, estimates with no verified sold evidence, and scenario where auction fees exceed expected proceeds.

## Acceptance
A user can photograph an item, preserve result, return after logout, open it with correct full-object cover, see credible route and realistic net, and draft a selling action without paying again or accepting an invented source. No duplicate items on retry; no false verified claims.
