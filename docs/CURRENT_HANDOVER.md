# Collector Intelligence — Current handover

Updated: 2026-10-09. Open this first in any new work session.

## Controlling specification
`02_MASTER_PROJECT_BRIEF.md` is authoritative for product behaviour. Source & Evidence Policy controls evidence handling. Other skill/playbook files are subordinate. Do not treat this operational handover as new canon.

## Project and environment
- Source repository: `otoslifeproject-cell/Collector-Intelligence`.
- Vercel application: `collector-intelligence-sngf` in `otoss-projects`.
- Supabase dedicated Collector Intelligence backend (identity and permissions must be rechecked before mutations).
- Gateway analysis operational after billing credit added by user.

## Last observed end-to-end behaviour
12 photos grouped as one object; AI Intake produced an editable, non-permanent draft; base inscription was not adequately interpreted; no live comparable research in intake pass.

## Active work
- Draft PR #1: https://github.com/otoslifeproject-cell/Collector-Intelligence/pull/1
- Branch: `intake-inscription-fix`; commit `cac07947`.
- Second-pass inscription review added; deploy check success; **not yet merged or acceptance-tested**.


## Immediate commercial priority (user instruction 2026-10-09)
Focus on practical cataloguing and selling. Do not further troubleshoot the optional cross-ChatGPT Chrome extension unless explicitly requested. Persist decisions and work outcomes in the repository log as work occurs. Each code/research enhancement must trigger an impact check against Master Brief, source policy, skills, relevant category playbooks, Knowledge Brain, item records and sales routing. Only revise canonical rules after verification; avoid speculative drift.

## Continuity status
The prototype Chrome extension v0.1/v0.2 failed to capture visible messages reliably in the user's browser; it is paused and **not** a trusted verbatim capture system. GitHub operational documentation plus scheduled daily checks are currently the durable continuity path. They are not real-time cross-window automatic synchronization. New-window readers must reload these docs explicitly.

## Next actions (in order)
1. Review and run regression against same 12 Holmegaard/Fionia candidate images with a controlled AI spend budget.
2. Inspect actual transcription, linked image indices and object confidence; never infer signature verification from plausible maker.
3. Integrate internal-first Knowledge Brain lookup and source-backed research escalation before final valuation; record source freshness and approval/revisions.
4. Research valid sold comps and preserve price classifications, venue, sale date, condition and premium.
5. Add persistent app-side audit trail for user corrections, research observations, decisions and approved attribution changes.
6. Only then revise canonical skill/prompt files through reviewed changes.

## Known constraints
- Vercel connector previously returned 403 under `otoss-projects`; GitHub Vercel deployment status was accessible.
- UI must not overwrite older attributions without a revision; keep pre-approval drafts non-permanent.
- Automatic cross-window read/write does **not** exist merely because a file was committed; each new chat should read this file explicitly.

## New-window instruction
“Read `02_MASTER_PROJECT_BRIEF.md`, `docs/CURRENT_HANDOVER.md`, `docs/PROJECT_PROGRESS_LOG.md`, and `docs/INSTRUCTION_IMPROVEMENT_QUEUE.md` from the Collector Intelligence GitHub repository. Resume from the active PR and verify current state before changing code.”

## 2026-10-09 — Execution pass in progress
User authorised full build-out without repeated interruptions. Active PR #1 now also includes commit `cc1cfbe`: draft review UI explicitly exposes source-image-indexed inscription candidate, confidence, rationale and all captured evidence, rather than hiding them behind the five-item display limit. Production remains unchanged until merge. Vercel preview check was pending at time of this entry. **Do not claim the 12-image regression was run**; browser live test remains required. Continue with internal Knowledge Brain retrieval and sale-ready research after inscription test.

## 2026-10-09 — Release gate
PR #1 preview Vercel check succeeded at commit `cc1cfbe`. PR marked ready for review. GitHub reports `mergeable: false`, so no merge was attempted and production remains on the prior code. Investigate mergeability/rebase with main and rerun checks before release; never mark this feature live until deployed. User explicitly prioritises progress and selling. All further tests should avoid unnecessary AI Gateway spend.

## 2026-10-09 — PR #1 merged
PR #1 merged as `b698aa4` (squash); Vercel production deployment check was **pending** at the time of update. The prior paragraph describing a blocked merge is historical and superseded. Do not call it production-ready until Vercel success is verified. The 12-photo live regression and model-cost check still require testing.

## 2026-10-09 — Additional research guardrail
Commit `fcbe91f` changes item research write-back to `OWNER_REVIEWED`; formerly AI source claims were auto-stamped `RESEARCH_VERIFIED`. Evidence tables still preserve source URLs and verification status but model claims are not trusted as independent validation. UI states this explicitly. Deployment build and actual approve-flow acceptance remain to be checked.

## 2026-10-09 — Identification evidence tab
Commit `c900be6` replaces the placeholder Identification tab with live `item_evidence` and `attribution_history` views, preserving source and verification statuses. GitHub deployment check pending at recording time; needs test against real owned item. User priority remains cataloguing/selling and source-trust discipline.

## 2026-10-09 — Regression #2 and diagnostics
User reran identical 12-image Holmegaard candidate. Draft ID 55%, date 25%, value 20%; failed maker/inscription again. Do not approve generic draft. Main now has `3f6434c` diagnostic server status and `da6abca` UI status to distinguish second-pass not triggered/failure/completed. Deployment and live test not yet verified. Prioritize cause diagnosis rather than repeating blind Gateway calls. Mark source reading hypothesis only; do not preload target identity into blind image recognition.

## 2026-10-09 — Internal-first audit
Verified source architecture in actual code and committed `docs/KNOWLEDGE_AND_SOURCE_INTEGRATION_AUDIT.md`. Knowledge Brain retrieval is **not yet demonstrated** before analysis; live research is a distinct post-catalogue endpoint. Supabase connector currently lists only an unrelated Universal Marketing database, so CI database schema was not audited or changed. Latest main commit `34e57d95` Vercel status success (individual earlier diagnostic commit failed, later deploy succeeded). Next action: confirm CI database scope, then implement read-only internal retrieval with provenance/freshness.

## 2026-10-09 — Correct Supabase access restored
Supabase connector now lists **Collector Intelligence**, project ref `bwdafrwkimjvwfoqomot`, region `eu-west-1`, status ACTIVE_HEALTHY. Read-only schema audit confirmed `knowledge_records`, `items`, `comparables`, `item_evidence`, `attribution_history`, `listings`, `sale_outcomes` and others. Counts: zero in `knowledge_records`, `items`, `comparables` at audit. Existing `knowledge_records` has owner-scoped, evidence/source, freshness, verification and supersession fields. NO database writes performed. Next: inspect RLS and access patterns, connect safe internal-first retrieval, seed only properly sourced approved knowledge.

## 2026-10-10 — Correct database consolidation
Read-only live audit: Supabase project `bwdafrwkimjvwfoqomot`, public schema contains Knowledge Brain and full operational tables, with RLS enabled on knowledge_records/items/ai_analysis_runs. Counts: 2 ai_analysis_runs, 0 items, 0 knowledge_records. The 2 prior runs strongly support historical frontend linkage but Vercel env could not be directly inspected because Vercel connector returned 403 to otoss-projects. Commits `c23f1fc` (owner-token-scoped read-only knowledge lookup in intake API) and `1ec8fbc` (retrieval status and source UI) are on main; Vercel deployment status pending when recorded. This is stage-one retrieval only, not verified knowledge ingestion, automated external corroboration, or complete historical migration. Canonical rules remain in project files/GitHub; no historic maker hypotheses imported as verified facts. Next gate: deployment verification, actual in-app retrieval regression with correctly sourced record, rule/skill impact review and approved knowledge write-back.

## 2026-10-10 — Knowledge reconciliation build pass
Commit `46da1b6` on main adds conservative reconciliation of read-only Knowledge Brain results into per-object evidence when a named entity key already appears in the candidate mark/attribution. Requires source reference, VERIFIED_DIRECT and current source freshness; resulting item claim is still POSSIBLE_ATTRIBUTION and route RESEARCH_FIRST. It NEVER auto-certifies a maker or promotes model confidence. Database remains zero knowledge records as last audited; therefore new logic must be tested with a correctly sourced approved seed, not a hypothetical match. Deployment verification and regression pending. Source policy / category skills impact: no change in factual standards; future amendments require a reproducible example, verification and approval.
