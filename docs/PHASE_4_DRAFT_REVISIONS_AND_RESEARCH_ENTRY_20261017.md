# Phase 4 — Version-safe owner review and one-path research entry
Date: 17 October 2026. Owner authorised non-destructive implementation, rollback testing, deployments, CI checks and disposable AI test budget. User explicitly placed **real collection loading on hold**.

## Outcome
- Installed migration `20261017_owner_review_revision_cas_v1.sql` on private Supabase.
- `public.ai_analysis_runs.owner_review_revision` tracks successful edit revisions (default 0 for existing reports).
- `public.ai_owner_review_revisions` retains an append-only, owner-scoped history of changed working titles and condition notes; SELECT/INSERT subject to RLS and source run ownership.
- `ci_save_owner_review_v1(uuid,integer,jsonb)` runs with SECURITY INVOKER, checks `auth.uid()`, DRAFT and valid object indices, edit field whitelist, string/length limits, locks the analysis row, rejects stale expected revision, merges only user-editable `owner_review.objects`, increments the revision, and writes the history entry in the same transaction.
- `src/pages/SavedDraft.tsx` switched from client read/merge/whole-result overwrites to one owner-scoped RPC with explicit revision. A conflicting multi-tab save displays a warning and leaves the unsaved text visible; it does not destroy a newer review or overwrite original AI photos/models/evidence/owner feedback.
- Direct code and SQL transaction tests performed using a known owner and existing draft under authenticated role: first revision successfully saved, second stale-tab edit rejected, returned working title preserved, audit record exists, raw `result.objects[0]` unchanged. Test ROLLBACK kept all actual drafts at revision 0.
- Research page now starts with *photo-first recently saved drafts* (up to six cards, latest first) with private signed thumbnails and owner-corrected material titles. Clicking opens existing Saved Draft Market/Deep Dive rather than running or paying for another intake. Existing permanent Item picker and advanced evidence tools remain intact.
- Research direct-link `?item=` now reads React Router's `location.search` under HashRouter, avoiding the prior broken `window.location.search` lookup.
- Research/V&A museum result table had a fifth header for “Save lead” but no action cell. Restored explicit **Save provisional lead**, gated by selected owner item, with the existing owner-scoped record-creation and UNVERIFIED source policy.
- GitHub Actions `Collector Intelligence Typecheck` runs matched-pair and owner correction regressions before TypeScript/Vite. Vercel compilation state must be confirmed on latest code before declaring deployment accepted.

## Boundaries
- No original source photographs were moved, relinked, altered or deleted.
- No permanent collection item, comparable, sale outcome or verified Knowledge Brain record was created by these changes.
- A source excerpt from V&A/Europeana is a research lead, NOT automatic authentication or an auction sale.
- GitHub/Vercel READY plus database rollback tests do **not** establish signed-in browser/touch/mobile accessibility; the owner has not verified concurrent-tab conflict in the browser.
- No new AI spend in these tests. Paid Deep Dive still requires deliberate UI action.
- Caution: Research is an evidence-led workspace, not a tool which promotes unverified historical claims into trusted maker knowledge. Zero trusted Knowledge Brain records was the measured baseline in the previous phase.

## Next phase queue, no background claim
1. Authenticated signed-in acceptance of two-tab owner edit collision, recent-draft Research cards, museum reference saving and material-corrected Deep Dive.
2. Transactional outcome entry and seller net fees with documented actual sale result provenance and audit.
3. Exact reference-image comparison workflow with museum/catalogue image/source match, owner visual agreement and rejected alternatives; Google Lens remains manual, not an embedded reverse-image API.
4. Verified comparable approval and Knowledge Brain write-back using reviewed primary evidence, not AI market text.
5. Cross-page mobile 390/tablet 1100/desktop 1440 screen review plus keyboard, focus and image accessibility.
6. Final owner go/no-go before real collection ingestion.
