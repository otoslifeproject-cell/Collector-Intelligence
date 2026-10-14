# Collector Intelligence — UX Design Authority and Continuous Review v1.0
Owner instruction: 2026-10-15. Status: mandatory at every meaningful UI build.
Subordinate to the Master Project Brief, Source & Evidence Policy and privacy/security safeguards.

## Expert review model
Apply a specialist product UX designer's review lens at every build. This is an AI-assisted expert-design critique, **not** a claim that an independent human designer has been appointed, consulted or signed off. Invite actual external designer review when available and record their identity, work and approval separately.

## Design principles
1. **Object-first, action-first:** The object photograph, brief defensible identification, provisional value or next action should be visible before explanations. Research, sale, intake and cataloguing should converge on one canonical object record.
2. **Two-click target:** For repeat workflows, a first action selects the task/object and the next performs or opens it, when existing inputs permit. Count from appropriate starting context; distinguish typing, photo upload, sensitive authorisation, payment and irreversible approvals.
3. **Progressive disclosure:** Keep source ledgers, maker alternatives, analysis history, advanced editing, economics and raw research behind optional expandable areas. Never delete stored evidence to simplify the display.
4. **Limited decisions:** At most two dominant actions in each screen/state; use clear verb+object labels. No technical status codes or repeated labels on default surfaces.
5. **Cognitive accessibility:** Brief headings, consistent layouts, large readable controls, restrained contrasting colour, no intrusive sticky text obscuring content, predictable navigation, keyboard and mobile support. Accommodate attention variability without sacrificing details.
6. **Truth in UI:** "Verified" only when independently proven by documented checks. Provisional visual estimates and museum reference matches remain clearly labelled; never imply maker authentication or realised sale from AI output.
7. **Safe and recoverable:** Avoid silent paid AI reruns; preserve drafts across refresh when feasible; make irreversible saves explicit, resumable and idempotent. Show exactly what was saved and what wasn't.
8. **Batch results:** Use one compact photo-led card per object. Offer per-item next actions and a batch-wide action only when safe, user-approved, bounded in spend and reliable.

## Required UX acceptance record per code change
- User goal and starting screen
- Primary CTA and expected outcome
- Expected clicks and observed clicks (do not invent test observations)
- Visual hierarchy assessment at desktop and narrow mobile
- Overload review (word count, always-open panels, duplicated statuses)
- Keyboard, accessible naming, focus, screen-reader status and contrast review
- State/refresh/recovery and failure handling
- Evidence / ownership / paid action and cost gate impacts
- Screenshot or signed-in browser acceptance, or explicitly "NOT TESTED"
- Decision: PASS / CONDITIONAL / FAIL and next correction

## Recent assessment: AI Intake five-card design
- Previous implementation: **FAIL** for multiple scroll screens of mark readings, Knowledge Brain, raw conditions and five drafts without immediate per-object actions.
- New five-card review + post-save actions: **CONDITIONAL**, because build succeeded but authenticated screenshot acceptance, draft-resumption, transactional multi-object save and one-click navigation need verification.
- Bulk 'Save N objects': sensible one deliberate commit after review. Do not run paid verification silently.
- Sticky global brand statement may overlap long intake on narrow screens; test and permit nonsticky/compressed behaviour if necessary.
- Research global and individual item duplication remains an information architecture risk.

## Future priority order
1. Confirm five-card AI Intake screenshot and correct visual hierarchy.
2. Ensure saved batch has one card per item, single-object research / sell actions, no extra navigation.
3. Make five-object saving atomic/resumable and prevent duplicate records on retry.
4. Item-page summary and Research/Sales route convergence.
5. Quick Buy 2-click and mobile photography.
6. Reports/Settings and real user task regression.

No human designer or fully automated permanent reviewer is claimed. Re-apply this protocol during each future work session; log actual checks with the relevant commits.
