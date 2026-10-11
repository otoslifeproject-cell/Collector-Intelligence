# Independent original-source trust gate v5

Applied to Supabase project bwdafrwkimjvwfoqomot on 2026-10-11. `trusted_comparables_v1` now requires the latest owner-approved matching `comparable_evidence_reviews` and the latest independently fetched, `SOURCE_CONFIRMED` `comparable_source_checks`, with matching sale type, amount, currency and original URL/reference. The source-check row must have an archived snapshot reference and SHA-256 field.

Rollback test passed: an owner-approved HAMMER sale without independent source confirmation did not enter trusted view. Test objects and reviews were rolled back. No original auction result was fetched or verified. Source-fetch service, hash provenance validation and a controlled verifier role remain to be built. This document is not a substitute for the full migration SQL, which must be version-controlled when repository write access allows.
