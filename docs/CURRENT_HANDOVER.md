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
