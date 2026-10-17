# Phase 6 — Illustrated visual source comparisons and rejection learning
Date: 17 October 2026. Owner direction: continue non-destructive layered build; use prior evidence; real collection loading on hold.

## Problem, preserved
Owner's most recent two-piece dark decorated pair was MATERIAL-CORRECTED by owner to metal. Model had repeatedly classified it glass and followed misleading glass-maker and glass-market source leads. An unverified visual resemblance must not become a confirmed maker or a sold comparable. Approved trusted Knowledge Brain view was 0 records. Prior images, original AI mistake and rejected analysis remain preserved in owner archive.

## Official source verification
- V&A official API guides: https://developers.vam.ac.uk/guide/v2/images/introduction.html and https://developers.vam.ac.uk/guide/v2/search/introduction.html; V&A API v2 /v2/objects/search supports images_exist=1 and _primaryImageId / _images._primary_thumbnail, and IIIF reference images via https://framemark.vam.ac.uk.
- This phase uses official V&A public catalogue metadata and credited direct images. No arbitrary third-party image is trusted, and no source copy/maker authentication is inferred.
- The separate manual Google Images link is an external image-search handoff, **NOT integrated Google Lens** or automatic reverse-image matching.

## Implemented
1. `api/museum-search.ts`: V&A catalogue search for illustrated objects only when visual=1, validates source images and returns official image URL, catalogue material, image provider, original V&A object URL and accession number. Existing global Research museum search still operates without requiring images.
2. `src/lib/vamVisual.ts`: exact bounded V&A image host/reference ID validation, and owner-material-led query normalization. Negative material words from a previously rejected glass hypothesis are stripped when the owner identifies metal. `tests/vamVisual.test.mjs` protects against non-V&A hosts, malicious image IDs, wrong-material carryover and overly long queries.
3. `src/components/VisualReferenceWorkbench.tsx`: side-by-side exact private original object photograph and an illustrated official V&A object, metadata/credit and V&A source link, gallery of alternative references, optional owner observation, "Not a match" and "Keep as possible lookalike". Source photo index is selectable within the exact original object or matched-pair photo union. Desktop/touch-mobile CSS uses object-fit contain and does not alter evidential originals.
4. `src/pages/SavedDraft.tsx`: direct Market visual comparison before paid Deep Dive, with owner correction material. First-pass AI/photo references remain untouched. `src/pages/ItemDetail.tsx`: exact same comparison workflow on permanent items. Existing draft comparison reviews are read back into permanent-item history by exact source analysis run, child index and owner-approved pair lot status.
5. Append-only `public.ai_visual_reference_reviews` table with source systemNumber, museum URL/title/date/catalogued maker/material/image, owner's exact source photo, candidate/rejected decision, note, query, owner ID, timestamps and constant UNVERIFIED evidence label. Two migrations: `20261017_visual_reference_review_ledger.sql` and `20261017_visual_reference_catalogued_item_support.sql`. Either draft source/photo-index OR permanent item/owned photo-ID must be supplied, never both. RLS checks current owner plus actual correct original photo; SELECT/INSERT only, no update/delete, no merchant sale evidence implied.
6. `api/research-item.ts`: retrieves newest owner visual decision per museum ID before any paid AI call, passes museum source+owner note+decision to Deep Dive. Up to three bounded museum reference images are provided as distinctly labelled PUBLIC REFERENCE COMPARISONS, never silently treated as user-owned photos. Model is instructed to reject owner's explicit NOT_A_MATCH as support and not transfer the catalogued museum maker/date. After permanent cataloguing, old draft matches and owner corrections remain reusable with the exact original pair/child identity.
7. A manual broad Google Images link uses corrected search terms but is explicitly not an integrated reverse-image API; first-party UI does not scrape or store Google results.

## Database regression and proof boundaries
- Authenticated-role BEGIN/ROLLBACK test on owner six-photo matched-pair draft: positive review save+readback succeeded; nonexistent seventh photo index was rejected by RLS. Cross-owner insertion into same draft rejected.
- Authenticated-role BEGIN/ROLLBACK test on existing permanent item and one of its owned item_photos: positive review+readback succeeded; unrelated photo reference rejected; another owner cannot insert against that item.
- All tests rolled back. No actual museum lead, rejected match or owner catalogue object was created/modified by testing.
- Automated Node 22 regression and `npm run build` run in GitHub Actions, followed by Vercel READY checks. Initial TS union-payload error in shared component was discovered by CI and corrected. No authenticated browser visual QA, no human expert signoff, no actual search result owner-side acceptance, and no paid deep-dive model trial made by this development session.

## UX review (AI-assisted expert-style, NOT an external human review)
- Goal: object photo first, one query then selected museum photo, visible source attribution and obvious evidence decision.
- From saved draft Market or permanent Item Detail Market, no more page navigation is needed before photo comparison; user searches the query, taps a candidate, records positive/rejected visual opinion.
- Primary decision at comparison: Keep as possible lookalike; secondary: Not a match. The separate paid Deep Dive stays a deliberate action. Advanced evidence history closed by default.
- Mobile: each image gets its own full-width column below 680px; no destructive cropping; buttons remain normal keyboard controls with aria-pressed for selected image cards and labelled search/photo select fields.
- Errors: missing owner source/photo or unavailability of saved comparison history blocks recording; source API errors and empty results are labelled, not replaced with fake matches.
- Source-trust: no similarity % invented; no automated maker authentication or sold comparable promotion; exact original V&A catalogue link exposed.
- Acceptance: CONDITIONAL until signed-in owner checks V&A images, match save/reload, corrected-metal search terms, item-photo boundaries, tablet/mobile and keyboard. No claim of actual human UX testing.

## Next practical checkpoint
Open the saved dark-metal pair Market. Check that the visual query says Metal (not glass), open V&A results, compare source photo, and optionally mark a clearly unrelated museum object NOT A MATCH; refresh and confirm preserved decision. Do not approve into permanent catalogue just to test images. Then confirm same side-by-side experience on existing permanent item Market. No paid Deep Dive or new upload required for this test.

## Future layers
Actual source verification of best original auction realised and maker catalogue evidence, eligible Knowledge Brain write-back after review, variant listings and net fee routes, condition/photo source refinement and complete signed-in mobile/accessibility acceptance before opening real collection intake.
