# Collector Intelligence — Knowledge and source integration audit

Date: 2026-10-09. Evidence-based review of repository code. Controlling project specification remains `02_MASTER_PROJECT_BRIEF.md`.

## Verified in code
- `api/analyse-intake.ts` accepts user photos and context, separates objects and returns structured draft. Conditional second image pass attempts inscription examination. This remains **visual-only**, not a verified external source search.
- `api/research-item.ts` accepts an already-permanent item and photo URLs, supplies a `web_search` tool to an AI model, and requests structured comparables with source URLs and sold/ask class. A model response claiming VERIFIED_DIRECT is not itself independent verification.
- `src/pages/AIIntake.tsx` stores analysis run draft and only makes permanent records after owner approval.
- `src/pages/ItemDetail.tsx` displays `item_evidence` and `attribution_history`. AI research write-back is owner-reviewed; independent verification remains required.
- Source policy exists in project instructions; it is not equivalent to a live machine-check of sources or internal-first retrieval.

## Not yet demonstrated in runtime
- Retrieval from canonical Knowledge Brain before model analysis.
- Source freshness checks tied to stored date accessed and last verified.
- Deduplicated reusable knowledge by maker/design/source ID.
- Automated validation of each realised/hammer claim against source content.
- Signed-image-region evidence and revisions automatically written back to Knowledge Brain on approval.
- Actual sale outcome learning, venue economics and complete sales listing integration.
- An end-to-end regression on Holmegaard Fionia: user test #2 still failed specific identification.

## Access limitation
The Supabase connector returned only a separate project named "Universal Marketing Ltd Client Projects" during this audit, so the dedicated Collector Intelligence database tables/permissions could not be verified through that connector. Do not execute SQL against that unrelated project. Confirm CI project scope before any schema changes.

## Required build order
1. Confirm dedicated CI database project and exact knowledge/source schemas; read-only audit first.
2. Introduce scoped internal retrieval with source references, freshness, object-level evidence and maker/design discriminators.
3. Supply retrieved context and its provenance to the image analysis and research models; prohibit unsourced promotion to verified facts.
4. Reconcile external results against stored knowledge, preserving revisions and source classifications.
5. Show the retrieval status and cited evidence on the owner review screen; only then approve permanent write-back.
6. Test signed and unsigned objects, controls with optical/background artefacts, repeat runs, spend per analysis and source mismatch cases.
7. Connect sale-ready listing generation and actual sale feedback after evidence controls pass.

## Stop conditions
- Do not claim the Knowledge Brain has been queried when it has not.
- Do not mark an attribution or comparable verified on model output alone.
- Do not re-run paid image tests merely to discover whether a backend stage executed; surface explicit stage status.
