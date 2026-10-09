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

## 2026-10-09 — Inscription patch merged
**Implemented and merged:** PR #1, merge commit `b698aa4`, adds targeted image re-examination, provisional transcription with image references, and explicit review visibility. Preview build status success; production deployment check pending at merge. **No live 12-image regression or verified identification outcome yet.**

## 2026-10-09 — Research approval truthfulness safeguard
**Discovered:** ItemDetail research approval previously wrote `catalogue_review_status: RESEARCH_VERIFIED` purely on AI draft owner approval, regardless of whether real external source verification occurred. **Implemented:** commit `fcbe91f` requires all AI research write-backs to remain `OWNER_REVIEWED` and shows that AI-supplied sources require independent confirmation. No database schema changes. **Not yet acceptance-tested:** UI action against real database; Vercel deployment check pending. **Review impact:** source policy and identification confidence instructions are consistent; further work should provide explicit independent-verification actions before setting `RESEARCH_VERIFIED`.

## 2026-10-09 — Evidence visibility on permanent items
**Implemented:** `c900be6` reads existing `item_evidence` and `attribution_history` tables and displays source, certainty/verification state and attribution versions on Item Detail → Identification. No new schema or rewriting of historic records. Await deployment verification and live item acceptance test.

## 2026-10-09 — Holmegaard regression #2 failed
**Observed from owner-provided draft:** one physical object detected; identification 55%, dating 25%, valuation 20%; no candidate maker or transcription; false-looking opaque white interior; £25 visual-only quick-sale. Unlike expected candidate inscription, result describes mark as unreadable and requests another close-up. **Unknown:** whether second-pass endpoint ran, failed, or returned no useful reading; pasted UI did not display status. **Implemented:** server commit `3f6434c` returns inscription_review_status (not triggered, attempted, empty, gateway error, review error, completed); UI commit `da6abca` displays it. Neither change improves recognition by itself; diagnostic only. Do not repeat paid analysis until deployment confirms these changes. Source/skills impact: require visibility for automated escalation states and original-image evidence.

## 2026-10-09 — Source integration honesty check
**Verified:** source code has visual intake, conditional mark pass, separate AI web research on permanent items and saved evidence/history UI; internal-first Knowledge Brain query is not shown. **Database access blocker:** available Supabase connector exposes a different project; no Collector Intelligence SQL used. **Documentation:** `docs/KNOWLEDGE_AND_SOURCE_INTEGRATION_AUDIT.md` commit `abe54d8` defines evidence, gaps, build order and stop conditions. Latest main Vercel status success; full workflow still untested.

## 2026-10-09 — Supabase connection restored and verified
Read-only `list_projects` returned `bwdafrwkimjvwfoqomot` Collector Intelligence, healthy in `eu-west-1`. Table list and `knowledge_records` column structure verified. `knowledge_records`, `items`, `comparables` all initially empty. This establishes the existing Knowledge Brain schema but does NOT mean internal-first retrieval is connected. No SQL write. Next safe steps: inspect policies, implement read-only lookup in AI workflow, and write back only verified/approved evidence.

## 2026-10-10 — Internal retrieval connected in code
**Database evidence:** correct Supabase project has 2 analysis run records; no permanent items or knowledge_records. RLS enabled for knowledge and item tables. **Code:** `c23f1fc` performs REST lookup using signed-in user JWT after photo draft; `1ec8fbc` displays retrieval state and provenance. Both committed to main, no Supabase SQL writes. **Limits:** first-pass retrieval is not yet used for candidate generation; broad lookup limited to 100 recent records; no automatic source refresh, ingestion or sales learning. Vercel connector scope still 403, deployment check pending. Previous discussions remain in version-controlled documents and require evidence classification before ingestion. User asked all work brought into the connection; document exactly what has and has not been migrated.

## 2026-10-10 — Internal Knowledge Brain evidence reconciliation
**Code committed:** `46da1b6` reconciles owner-scoped retrieved source records into per-object evidence only when entity key matches an existing candidate maker/mark. Source reference and recorded verification required; object attribution remains provisional. No new tables, no data mutation, no automatic confidence upgrade. **Known limitation:** owner Brain currently empty; live reproduction requires reviewed source records. **Status:** code committed, Vercel check pending when logged, no paid model call run. Category playbooks and Master Brief reviewed for conceptual impact; source hierarchy unchanged, no unverified historical knowledge imported.

## 2026-10-10 — Stage 1: provisional Knowledge Brain entry UI
**Implemented:** commit `7c93847` replaces the placeholder Research page with owner-scoped Knowledge Brain browse and a documentary reference lead form. A record requires entity key, exact claim and HTTP(S) source URL and is always inserted as POSSIBLE_ATTRIBUTION / UNVERIFIED with no last_verified date. It cannot self-certify sources. Existing RLS owner_all protects records. **Not done:** automatic source verification, historic mass import, model consumption of independently verified records, end-to-end testing. GitHub deployment check pending/not yet reported as passing at this checkpoint. **Instruction impact:** no canonical changes; preserves source truth and revisions. No database schema changes.

## 2026-10-10 — Stage 2 manual verification and revision records
**Implemented:** `b218b09`, `d1aa7eb` add owner-controlled source review UI. It captures review notes and class (SECONDARY_REPORT, VERIFIED_DIRECT, UNVERIFIED), requires affirmative owner confirmation, and inserts a new record pointing at the prior `supersedes_id`. Does not mutate original research claims. **Not yet tested:** actual browser form, concurrent reviewer conflict, source URL validation, deeper automated source inspection. **Safety:** a user verification assertion is not independently machine-verified; it must retain the documentary notes. No database writes or AI Gateway runs performed here. Vercel check pending. 

## 2026-10-10 — Stage 3 integrity implementation
**Verified:** Stage 2 Vercel success. **Bug fixed** (`afc4e1b`): latest reviewed records had been excluded by `!k.supersedes_id` even though a successor normally points to an older record. Now previous versions remain filtered by discovery of successors, while a current version can be considered. **Database migration applied successfully:** single-successor unique index on `knowledge_records.supersedes_id`, read-back verified; migration saved in repo commit `6114032`. No historical maker evidence auto-seeded or altered. **Pending:** UI browser regression, actual review insertion and retrieval, Vercel build for patch. No AI Gateway spend.

## 2026-10-10 — Ambiguous scratched-glass stress-test improvement
Commit `732ead4` revises the intake and second-look instructions to distinguish engraved grooves, crossed scratches, labels, shadows and refraction; avoid misclassifying bright reflections as opaque inclusions; compare lobed silhouette/base; and preserve '?' for uncertain characters. It also detects inscription clues in per-object evidence text, not just the marks field. **Not yet proven:** Holmegaard identity, real signature reading or live 12-photo regression. Vercel build pending when recorded. These are recognition heuristics, not source verification or Knowledge Brain import. Next stage: full per-image observations, controlled candidate checking, and independent source-backed verification. No paid test used here.

## 2026-10-10 — Object-level uncertainty and review safeguards
**Code:** `da6e45f` displays original images with numbers, contradictory mark readings, and evidence notes, rather than first four thumbnails; `7012707` prevents a speculative second-pass maker from lifting identification confidence. Prior lighting/scratches revision `732ead4` Vercel success. **Unverified:** latest build, browser photo links and actual Holmegaard transcription. No model run, database mutation, or source promotion. Relevant rules remain the Master Brief's evidence separation/independent confidence requirements; no canon rewrite needed.

## 2026-10-10 — Major recovery/migration and integrity fixes

**Executed against correct Supabase project:** 19 full project Markdown source documents archived and checksummed; four GitHub operational docs and protocol archived. `canonical_documents` versioned store and RLS created. Initial incomplete-line endings were detected; failed second read emitted short placeholder text, also caught in post-import audit. Byte-correct source documents were recovered from intact original archived copies and re-published without deleting prior versions. New small-doc insert rejected by DB constraint; AI loaders reject inadequate or placeholder documents. This incident is deliberately logged rather than hidden.

**Historical preservation:** four 12-image storage sets (48 photos total); `intake_photo_sessions` table records source object paths and timestamps; two analysis run links supported by matching chronology and counts; two explicitly unmatched. Neither draft approved, no permanent item inserted. Portable backup ZIP of originals and collection workbook created with manifest.

**App integration:** `api/analyse-intake.ts` and `api/research-item.ts` now load controlling document versions from authenticated Supabase REST and fail closed if essential policies unavailable. AI Intake and item research save source hashes and diagnostic trust state in `ai_analysis_runs.result`; research valuations with insufficient cited sold candidates capped and routed to further research. Research screen displays canonical archive plus photo preservation sessions. Compiles/deployment check for screen commit `496930c` succeeded; authenticated end-to-end test pending.

**Database security:** RLS owner read for canonical, no client insert/update/delete; immutable history. Hardened functions' search_path and enabled RLS on ci_migration_history. Security advisor retest leaves one account-level WARN: leaked-password protection disabled, plus INFO for migration history lacking client policy by design. No destructive data migrations.

**Authoritative artifacts:** docs/CANONICAL_GOVERNANCE_AND_SOURCE_TRUST_PROTOCOL.md, docs/RECOVERY_MANIFEST_2026-10-10.md, skills/15_NO_DRIFT_MIGRATION_AND_SOURCE_TRUST.md, version-controlled migration SQL.

**Pending:** latest logs/skills publication to DB, photo asset byte verification, authenticated UI smoke test, workbook Storage backup, independent seller/auction verification and Holmegaard retest.
