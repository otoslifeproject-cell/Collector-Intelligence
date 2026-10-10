# Evidence Provenance Graph and Trust Gates — Build Plan

Status: design only; not evidence that all gates operate. Approved architecture: Drive for original unverified research; owner-restricted Supabase for structured operational records and reviewed facts; GitHub for engineering/governance. Master Brief v4.0 and Evidence Policy v4.0 control.

## Model
Use typed, source-linked nodes: object, photograph, observation/mark reading, maker, design/pattern, historical source, attribution hypothesis/version, comparable lot, outcome, specialist, supplier, venue, buyer, wanted-list demand, purchase, sale, recovered conversation and benchmark. Edges include observed_on, evidenced_by, contradicts, supersedes, attributed_to, sold_at, sourced_from, buyer_lead and matches_wanted_list. Preserve evidence origin and uncertainty on every relation. Matching a design does not prove a physical object's authenticity. Repeated online claims are not independent corroboration.

## Gates
1. RAW: record original private Drive file ID, checksum, date, page/photo locator, verified write/read-back. Never invent another conversation's original transcript.
2. EXTRACTION: observation versus inference versus historical AI assertion; keep alternatives and chronological corrections. Default unverified.
3. DEDUP: exact hashes and candidate fuzzy matches; cross-reference rather than delete distinct research.
4. DOCUMENTATION: verify that cited factory/museum/catalogue/auction source actually supports this specific assertion; capture source-independent corroboration and limitations.
5. SOLD: auction lot must visibly have sold with date, amount, currency and exact basis; never promote estimate, unsold lot or asking listing to realised comparable.
6. PROMOTION: object-specific maker/period/rarity claims need appropriate independent support and reviewer authorization; source reputation alone does not establish object match. Never promote AI-generated claims automatically.
7. CONFLICT: preserve adverse evidence, source freshness and supersession link; do not silently overwrite.
8. REUSE: retrieve both positive and misleading near-matches with citations and log the impact on a new analysis; actual sale outcomes inform later values.
9. ACCESS: preserve owner-scoped permissions and private evidence; public repository holds no collector photos or contacts.

## Acceptance tests
Benchmark unsold Mdina lot, marketplace-anchored Empoli-type bottle, uncertain signature, mixed-object photograph, six-inch cut vase dating revisions, false market result and outdated fee/buyer. Require gate PASS/FAIL/UNKNOWN and reproducible source trace. Daily scheduled review is independent audit, not a substitute for synchronous application-side validation.

## Observed baseline on 2026-10-10
10 conversation source manifests, 353 historical claims, 2 knowledge_records, 0 comparable transactions, 0 sales, 2 stored AI runs at point of audit. Two knowledge_records are named conversation-recovery documents and flagged VERIFIED_DIRECT; that may verify that a dossier exists, not claims within. Review semantic classification before any automatic promotion.
Six nested Drive workflow SKILL.md files and original specialist skills are archived; correctness/actual application execution of all skills remains untested. Separate chats are not automatically contained in MASTER.

## Build order
A. Complete source-original Drive archival and conversation inventory. B. Compare current v4.3 active user instructions with v4.0 governing documents and specialist skills. C. Design normalized claim/evidence/source/edge/revision tables with owner permissions. D. Implement synchronously enforced ingestion, sale-price and review gates and fail-closed UI. E. Connect retrieval to object/photo investigation endpoints with source citations. F. Run correction benchmarks and authenticated end-to-end write-back/read-back/reuse; only then mark learning active.

No automatic source promotion, file deletion, production mutation or paid AI inference just because this plan exists.
