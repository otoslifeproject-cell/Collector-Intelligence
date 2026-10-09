# Collector Intelligence — Progress and decision log

**Updated:** 2026-10-09
**Status:** working project record, not a replacement for `02_MASTER_PROJECT_BRIEF.md`.

## Operating rules
- Record every substantive product decision, user test, defect, resolution, deployment and research-quality finding.
- Clearly distinguish **observed**, **implemented**, **tested**, **deployed** and **proposed**.
- Preserve immutable Item IDs, object-level evidence, separate identification/dating/valuation confidence and attribution revision history.
- Changes to canonical instructions and skills are **proposals** until accepted. Master Project Brief remains controlling.
- Never silently claim all ChatGPT windows have synchronized. Future windows should explicitly open `docs/CURRENT_HANDOVER.md` and this log, and read controlling sources.
- Include dated evidence, source reference, affected workflow, action owner and verification state.

## 2026-10-09 — AI Intake live test
**Observed:** 12 photos of one three-lobed art-glass bowl correctly grouped into a single draft. Photo upload, analysis and review screen operational. The draft did not identify an apparently legible base inscription, instead assigning generic Scandinavian-influenced art glass attribution. App initial confidence ID 72%, dating 28%, value 22%, quick-sale estimate GBP 25 (visual-only; no verified sold comps).
**External comparator provided in conversation:** Holmegaard Fionia / Per Lütken, circa 1959; this is a research hypothesis requiring source verification and dimensional checks, not an automatic canonical fact.
**Diagnosis:** initial `api/analyse-intake.ts` is visual triage without research; signature handling insufficient.
**Implemented:** GitHub PR #1, branch `intake-inscription-fix`, commit `cac07947`: conditional targeted second photographic examination with uncertain inscription transcription and original image indices. Error fallback preserves first draft.
**Verification:** GitHub Vercel status success for commit; no end-to-end live regression yet; PR draft, not production release.
**Still open:** verified Knowledge Brain internal-first lookup, external reference verification, realised comps, source write-back, confidence recalibration and regression test with the same image set.

## 2026-10-09 — Vercel AI Gateway
**Observed:** runtime initially rejected requests because payment card required; user added USD 10 Gateway credit; subsequent intake analysis completed.
**Implication:** monitor spend per run; avoid repeated unnecessary model calls. No inference that a free allowance is active.

## 2026-10-09 — Requested project continuity
**Decision:** introduce version-controlled progress log, current handover and instruction-improvement queue; review regularly without unapproved canonical changes.
**Follow-up:** evaluate adding an append-only in-app audit event model and a shared Knowledge Brain update pipeline so observations and approved research revisions are visible inside the product as well as GitHub.

## 2026-10-09 — Priority reset and conversation capture
**User decision:** Stop debugging ChatGPT Continuity Kit v0.1/v0.2 Chrome extension. Both displayed missing or inactive message capture. User prioritises cataloguing and selling stock urgently. Resume core Collector Intelligence implementation; do not spend further time on browser-extension fixes without a new request.
**Continuity requirement:** For every substantial development or research iteration, record observable results, changes made, validation, next actions and any affected canonical instructions/skills. Maintain searchable handover and progress documentation in this repository. A scheduled daily review already exists; it cannot capture unseen ChatGPT conversations verbatim.
**Required review loop:** Observe → log → compare master brief, evidence policy and category/workflow skills → propose tested amendments → implement only when approved → update handover. Protect time-to-sale as primary near-term objective.

## 2026-10-09 — Source-image evidence review made visible
**Implemented:** commit `cc1cfbe` on draft PR #1 adds explicit inscriptions and original photo indices to the review card, displays candidate transcription/confidence/rationale, and shows all evidence claims. Captures second-pass review within `ai_analysis_runs.result` as an additional record field when the table permits JSON.
**Unverified:** no live AI analysis performed (avoid unneeded Gateway spend), TypeScript/deployment check pending. Not merged to production at time recorded.
**Gap identified:** `api/research-item.ts` works only on permanent records, and current AI Intake does not automatically retrieve internal Knowledge Brain evidence or external comps before draft approval. Requires deliberate staged integration with source and freshness records.
