# Phase 5 — Achieved sale capture and item ownership hardening
Date: 2026-10-17. Owner had authorised non-destructive development, rollback tests, and CI/deploy while away. No private collection items or claimed real sale values were imported.

## Existing product assets reused
- The database already contained `public.sale_outcomes` and `public.listings`, both empty, plus an `items` table with acquisition and expected-sale fields.
- We did **not** build a parallel sales table or promote any AI-provided comparable to the trusted comparable view.
- Added to existing `sale_outcomes`: `client_event_id`, `provenance_basis`, `request_fingerprint`, `source_reference`, `owner_notes`; unique index `(owner_id,client_event_id)` for client retry safety.

## Server implementation and economic discipline
- Migrations `20261017_atomic_actual_sale_capture_v1.sql`, `20261017_actual_sale_source_integrity_v2.sql`, `20261017_allow_loss_making_sales_v3.sql`.
- `ci_record_actual_sale_v1(uuid,uuid,jsonb)` is SECURITY INVOKER, authenticated-only, locks owner-owned item, requires explicit `owner_confirmed=true`, validates achieved sale date and user monetary figures, rejects reused event IDs with changed inputs, creates one owner-reported sale outcome and atomically moves the catalogue item to SOLD.
- Stored `gross_sale`, `net_sale_proceeds`, `net_profit`, `return_on_cash` separately; selling costs and actual/acquisition amounts remain individually auditable. Missing acquisition cost gives null profit. Negative net/profit are valid (loss-making sales), not rejected.
- Owner-supplied result is `OWNER_REPORTED_UNVERIFIED` and will NOT be automatically treated as independently verified auction realisation, authenticated maker, trusted comparable or public marketplace sale.
- No live sale recorded or item status changed in development.

## UI
- `src/components/RecordSaleOutcome.tsx` is shown after the existing `SaleEconomics` scenario calculator on permanent Item Detail → Sales.
- Prior sale outcomes are read back first. The entry form is collapsed and requires user-completed sale date, venue, actual gross, cost inputs, source/reference and an explicit confirmation checkbox before invoking the transaction.
- After a confirmed outcome the screen shows actual net/profit and prevents an additional sold event; a stable client event key allows a safe identical retry if the network response is ambiguous.
- This is a future owner action only; no sale event is created by browsing the screen.

## Security fix discovered during implementation
- Pre-existing `owner_all` RLS on `listings` and `sale_outcomes` only checked each record's `owner_id`, not whether `item_id` belongs to that owner. Authenticated users could potentially link another user's item UUID.
- Migration `20261017_sales_listing_item_owner_rls_hardening.sql` now requires both record owner and foreign-key item owner on SELECT/INSERT/UPDATE/DELETE, checks that sale listing refers to same item and owner, and revokes anonymous table permissions.
- Authenticated-role rollback tests: owner sale succeeds and can read its own outcome; a different user attempting a cross-owner listing or sale insertion is rejected.

## Rollback tests performed
- Actual £100 gross, £12 platform fee, £3 payment fee, £5 shipping and £2 packaging, £20 acquisition => £78 net proceeds, £58 profit. Identical event retry returned SAME record; changed input with reused key rejected; item status changed to SOLD in transaction.
- Loss-making actual £10 sale with costs £16 and £20 acquisition => -£6 net proceeds, -£26 profit.
- All tests used BEGIN/ROLLBACK. Database remains unchanged: one existing permanent item, zero real sales, zero listings, original private photos and owner corrections intact.

## QA and acceptance boundaries
- Code-level TypeScript/Vite and GitHub tests are separate from actual signed-in browser interaction. New sale capture was not tested with a real user's browser/receipt and must not be described as accepted real sale data.
- No seller fee rate or achieved price is inferred from dealer listings, model claims or unverifiable search snippets.
- The first genuine real sale recorded in the future should trigger outcome-aware review of earlier valuation, fees, venue speed and Knowledge Brain improvements — but **only** after source audit and user-approved promotion, not automatically.
- Further priorities: listing lifecycle, verified external sold comparables, source-photo similarity discrimination, return/refund corrections and sale-outcome audit; finish owner signed-in UX/mobile/keyboard quality gates before real collection ingestion.
