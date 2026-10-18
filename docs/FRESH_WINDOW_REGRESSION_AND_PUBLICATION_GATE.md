# Fresh-window regression and publication checklist
Version 1.0 — 2026-10-18 · Checklist executable by any assistant with authorised GitHub/Supabase/Drive tools

## Purpose
Prove that a new Collector Intelligence window actually reads current sources and resumes the current work. A successful greeting or an old handover citation is not acceptance.

## Test FW-01: Canonical authority, no drift
- Fetch current `canonical_documents` for `02_MASTER_PROJECT_BRIEF.md`, `03_SOURCE_AND_EVIDENCE_POLICY.md`, `skills/00_STARTUP_CONTINUOUS_LEARNING.md`.
- Record document_key, source_version, SHA-256, length, current marker and ingestion date. Read the complete current content, not just metadata. Calculate or use validated DB hash and compare with repository content where mirroring is expected.
- The two v4.0 policy hashes observed 2026-10-18 are in `NEW_WINDOW_START_HERE.md`. Fail if an older uploaded version is treated as current.
- If a GitHub updated skill and Supabase current skill differ: show PUBLISH PENDING, do not claim synchronized.

## Test FW-02: Actual current code / deployment
- Fetch GitHub main HEAD, recent commits and status; compare Vercel deployment's SHA if available.
- A GitHub SUCCESS build may still lack signed-in UI acceptance; failure, pending, rate limit or 403 must be reported accurately.
- Never trigger a paid model request or deploy just to do startup.

## Test FW-03: Continuity beyond clipped handover
- Read `NEW_WINDOW_START_HERE.md`, then relevant latest chronological handover/progress entries rather than relying on opening dated sections.
- Retrieve pending queue, benchmark tests and photo/owner-correction evidence pertinent to chosen workflow.
- Repeat the latest known safe next action in one sentence, and name the blocker accurately.

## Test FW-04: Source/trust and owner boundaries
- Ensure no model-generated VERIFIED_DIRECT or auction SOLD status is accepted without independent reference checks.
- Keep PHOTO/OWNER FACT/MODEL GUESS separately tagged.
- Confirm no cross-object photo association or source-index guess. A model index outside the original 0..n-1 manifest must be shown as an error.
- No anonymous or cross-owner operations; RLS and JWT scope must be checked during actual writes.
- Never promote or delete drafts without owner-approved mapped originals.

## Test FW-05: The readability contract (when UI changes)
- Shared card classes, photo-first summary and Tiles/List/Icons semantics across comparable object collections.
- Default surface shows concise title, status/next step and at most two dominant actions. Deep observations behind disclosure.
- Test 1440, 1100 and 390px, keyboard, focus, contrast, long text, no clipping, low-motion handling and safe form recovery.
- AI-assisted expert review is not a human designer sign-off; screenshot observations must be real.
- Report PASS/CONDITIONAL/FAIL for each affected route: Inventory, SavedDraft, Intake, ItemDetail, Research, Sales, Dashboard, Contacts, Reports.

## Test FW-06: Write-back
- Name precise changed files + SHA/commit and confirm readback after changes.
- Supabase: if canonical publication is explicitly authorised and privileged publication mechanism available, append a new current version and retain prior; verify SHA, RLS and old version retention. Never directly update old canonical rows.
- Drive: archive original documents/photo evidence where relevant and verify resulting IDs. No guessed link.
- End with actual deployment state, database changes, regression results, obstacles, and next safe action. If no writes were made to a store, say so.

## How to grade
PASS: current authoritative content read; source/HEAD and handover inspected; appropriate knowledge retrieved; relevant regression executed; changes verified and gaps acknowledged.
CONDITIONAL: startup verified but missing authenticated acceptance, publication or unavailable source.
FAIL: stale policy silently promoted; invented retrieval/deployment/source; original evidence overwritten; blind paid rerun; irreversible unreviewed catalogue write.

## 2026-10-18 baseline
- Canonical Supabase Master Brief and Evidence Policy are v4.0.
- Main app HEAD before documentation work was fefced2, with failed Vercel status: build-rate-limit.
- Vercel team connector 403 forbids independent deployment metadata check; no authorised CLI fallback was found in the current execution environment.
- 12 AI runs (10 DRAFT / 2 APPROVED), one permanent item, zero comparable rows at last count; not a full source-integrity acceptance.
- Startup skill now updated in GitHub, publication to canonical Supabase NOT YET VERIFIED.
