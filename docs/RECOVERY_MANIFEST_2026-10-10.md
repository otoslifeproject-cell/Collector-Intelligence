# Collector Intelligence — verified recovery manifest

**System of record:** Supabase project `bwdafrwkimjvwfoqomot` (Collector Intelligence, eu-west-1). 
**Implementation mirror:** `otoslifeproject-cell/Collector-Intelligence` (GitHub).
**This is a migration checkpoint, not a claim that all prior chat conversations have been recovered.**

## Verified durable data in Supabase

| Dataset | Verified result | Limit |
|---|---|---|
| `canonical_documents` | 24 distinct documents; 62 append-only versions at audit; 0 latest versions below 400 bytes | 19 packaged Markdown project sources, 4 operational GitHub documents, 1 new governance protocol |
| `storage.objects` / `item-images` | 48 image objects in 4 upload sets of 12; 103 MB approx | Private source photos retained; not permanently catalogued |
| `intake_photo_sessions` | 4 manifest records, each with object paths, source timestamps and sizes | 2 match analysis runs by time/count; 2 intentionally UNMATCHED |
| `ai_analysis_runs` | 2 stored 12-photo analysis drafts, not approved | Inscription review on latest stored run is null |
| `knowledge_records` | 0 source-backed maker/design claim records | No model attribution was silently promoted to fact |
| `items` | 0 permanent catalogue objects | Owner has not approved drafts |
| `comparables` | 0 verified permanent comparables | No invented auction sales |

## Source integrity

The original 19 Markdown documents were imported from Project sources into the protected archive. A first extraction omitted a terminal newline, so its archive SHA-256 did not match the original byte file. A second file-reader attempt returned 67-byte 'no readable content' placeholders, which were unfortunately imported as a later version. These were **detected by hash and size audit before acceptance**. The intact first versions were retained, and byte-exact corrected versions were published from the original preserved text plus the terminal newline. Their source SHA-256 matched the original file bytes for the tested Master Brief, Source Policy and other checked documents. Supabase now enforces a 400-byte minimum on future archive inserts (legacy rows preserved), and model endpoints skip invalid placeholder versions. Old versions were NOT deleted, preserving the incident audit trail.

The latest code retrieves `02_MASTER_PROJECT_BRIEF.md`, `03_SOURCE_AND_EVIDENCE_POLICY.md` and applicable instructions/skills from the owner-scoped Supabase archive **before paid model inference**; if missing it fails closed. New AI runs preserve exact policy hashes and research source-audit state. A successful Vercel deployment is a code/build check, not a complete authenticated regression.

## Access/security

- Owner-only RLS for canonical_documents and intake_photo_sessions. App user has read access; canonical publication is privileged. Old canonical versions preserved, no edit/delete from ordinary app sessions.
- Supabase Advisor security re-run: the mutable search-path warnings were fixed; public `ci_migration_history` now has RLS with no client policies. Remaining warning: leaked-password protection disabled in Supabase Auth. Must be enabled in Supabase Dashboard, not by undocumented SQL.
- No service-role credentials intentionally placed in frontend code.
- Canonical governance protocol: `docs/CANONICAL_GOVERNANCE_AND_SOURCE_TRUST_PROTOCOL.md`, controlling original brief remains senior.
- Backup: `Collector_Intelligence_Portable_Source_Backup_2026-10-10.zip` generated in the conversation with 19 original source docs, 12 local original JPGs and `Collection_Register.xlsx` plus SHA-256 manifest. It is a portable user backup, not an automatic Supabase Storage upload.

## Outstanding and deliberately NOT claimed as complete

1. Full historical chat transcripts, earlier web receipts and any Project docs outside the 19 accessible source Markdown files were not captured automatically.
2. The locally available `Collection_Register.xlsx` exists in portable backup; not yet written byte-for-byte into Supabase Storage. The initial inspected Collection/Comparables rows were empty template rows, but the entire spreadsheet was not migrated as live item records.
3. Object photos are private in Supabase storage but no approved permanent Item IDs; do not fabricate them.
4. Model source classifications are not independent verification. Trust tiers govern authority per claim; no 'confirmed attribution' or sold comparable has been migrated without original cited evidence.
5. End-to-end authenticated UI regression, source trust grade comparisons, historical photo-matching review and 12-photo paid Holmegaard stress test still required.
6. Supabase Auth leaked-password protection requires user action.

## No-drift continuation gate

Every subsequent development pass must: read controlling original Master Brief from the archive; check latest source-policy hash; avoid upgrades based on user hypotheses; make a version-controlled change; verify deployment and SQL/RLS where relevant; record source/result in GitHub and Supabase. Any stage that does not pass remains PENDING. Don't repeat blind paid analysis without diagnostics and source provenance.

**Never assert that GitHub changes auto-synchronize into Supabase.** Synchronization must be explicit, versioned, hash checked and logged.
