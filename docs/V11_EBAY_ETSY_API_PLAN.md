# v1.1 marketplace API plan — NOT IMPLEMENTED (28 Oct 2026)

This file is planning-only. Collector Intelligence v1.0 uses manual copy/export. No account connection, API offer, photo upload, listing publication or spend is authorised by this plan.

## Canonical item model for both venues
Keep the immutable internal `items.id` and owner ID. Add a mapping layer, not duplicated identities: `item_code` → venue SKU, the reviewed generic title/description and condition, optional explicitly authenticated maker/period, original `item_photos` stable IDs/byte hashes, price source/basis and seller economics, category-specific attributes, stock quantity, item state, listing draft ID, external offer ID, publication state, external listing ID, last sync receipt and replay/rollback marker. Never replace the original image path with a signed URL; never promote a model claim to verified sale evidence.

## eBay first
- One-time setup: seller account approved/verified for eBay UK, eBay developer application and production key, owner OAuth consent for the relevant sell scopes, business-policy programme opt-in, valid fulfillment/payment/return policies, inventory location and `merchantLocationKey`, supported category ID/aspects/condition, dispatch/returns/fee settings and true shipping location.
- API sequence (non-public until owner explicitly taps Publish): `createOrReplaceInventoryItem` keyed by immutable SKU → `createOffer` with marketplace, inventory location, price/category/policies → obtain offer ID and read back draft → `publishOffer` only following a distinct, owner-confirmed real-time publish action.
- Photos: use owner-original bytes from private Supabase storage via an authenticated backend, upload directly to eBay Picture Services through Media API `create_image_from_file` (or an approved eBay Picture Server upload route), preserve returned durable eBay-hosted HTTPS image URLs in external-link records and attach to inventory product `imageUrls`. A 30-minute Supabase signed download URL must NOT be used as an assumed permanent eBay image URL. Confirm originals, owner permissions, MIME type and complete uploads before draft readiness. Do not make a private storage bucket public.
- Store idempotent request IDs and read-back. Review net proceeds, legal seller status, category data, images and title before enabling the one-tap Publish control.
- External blockers: developer credentials, seller OAuth consent, business policies, seller-account eligibility and a real authenticated sandbox/prod acceptance run. No such integration exists in v1.0.

Official sources:
https://developer.ebay.com/api-docs/sell/inventory/overview.html
https://developer.ebay.com/api-docs/sell/static/inventory/inventory-item-to-offer.html
https://developer.ebay.com/api-docs/sell/static/inventory/publishing-offers.html
https://www.edp.ebay.com/develop/api/sell/media_api

## Etsy second, only after eBay
- One-time setup: active Etsy shop, Etsy developer-app registration and app approval/eligibility. For owner-only app use, Etsy Seller App access is usually approved promptly if eligible; for a commercial multi-seller client app, first obtain an approved Personal App and then **request Commercial Access and receive Etsy's manual approval**. Etsy OAuth scopes include `listings_w`; seller consents to shop access. Keep credentials server-side.
- Before recommending Etsy Vintage, prove an item is **at least 20 years old** with source-reviewed dating. A tentative style guess or an undated item is not enough; if unknown show “Date unknown — Etsy vintage eligibility unconfirmed”. Etsy permits handmade, vintage or craft supplies; don't assume all collectables are eligible.
- API flow: `createDraftListing` → `uploadListingImage` by authenticated backend using owner-original image bytes (or previously uploaded Etsy shop image ID) → read back listing/images → **`updateListing(state=active)`** only after explicit single-action owner publish confirmation; do not set it automatically.
- Images must be attached before activation. Store Etsy image IDs, listing ID/state and upload evidence; preserve originals privately. Reconcile listing fees, shop policy, shipping profiles/tax category and failures without retrying any publish operation blindly.
- External blockers: Etsy approved app access, shop/OAuth, image acceptance and real account/sandbox validation. No Etsy integration exists in v1.0.

Official sources:
https://developers.etsy.com/documentation/
https://developers.etsy.com/documentation/tutorials/listings/
https://www.etsy.com/uk/legal/policy/vintage-items-on-etsy/242665563649

## Release guard
For both APIs, draft creation is distinct from publication. Publication is a fresh owner tap for a specific item/venue/price, never inferred from an earlier approval or preview. Keep response receipts and re-read the external listing state before displaying PUBLISHED.
