# Instruction & skill improvement queue

Updated 2026-10-09. **Proposal register only** — no automatic edits to canonical files.

| ID | Trigger / observation | Proposed improvement | Verification / promotion gate | State |
|---|---|---|---|---|
| CI-001 | Signed Fionia candidate reduced to generic art glass | Recheck existing inscription images at original resolution before requesting more; preserve transcription uncertainty and source image index | Regression test multiple signed and unsigned objects; ensure no hallucinated signatures | In progress (PR #1) |
| CI-002 | Single visual-pass intake yields weak maker/period/value | Run internal Knowledge Brain lookup first; escalate to external authoritative reference and genuinely sold comparable retrieval as needed | Confirm links/source type/freshness, separate confidence scores | Proposed |
| CI-003 | Discussion decisions not reflected in durable project files | Maintain dated progress log, handover, proposal queue and review cadence | Confirm new window can locate current decision and active PR | Implemented as repository docs |
| CI-004 | Users may approve weak provisional drafts | Show research-stage and unverified-source label next to approval; require explicit review for material attribution uncertainty | User acceptance and no accidental canonical write | Proposed |
| CI-005 | Actual AI Gateway spend unclear | Record per-pass model usage/cost where provider metadata permits; track budget threshold | Verify reported usage matches Vercel billing | Proposed |


| CI-006 | Chrome Continuity Kit 0.1/0.2 displays no captures/inactive script in actual Chrome UI | Pause extension work; rely on GitHub progress/handover and scheduled checks, while prioritising selling | Only resume with explicit user request and browser-tested compatibility | Paused |
| CI-007 | User requires every change to propagate through project knowledge and instructions | Add change-impact checklist covering master brief, source policy, 01–18 skills/playbooks, Knowledge Brain, item schemas, sales workflow and user handover; record review outcome even when no change required | Subsequent implemented change includes affected-docs check and dated handover entry | Active operating procedure |

## Review protocol
1. Compare recent work against the controlling Master Brief and source policy.
2. Log problems with observed evidence, not hypotheses dressed as facts.
3. Propose the smallest viable change, and a falsifiable test.
4. Implement on a branch; check build/behaviour before merge.
5. Only promote confirmed improvements to prompts, skills, docs or Knowledge Brain.
6. Preserve old versions and explanation of each revision.

Never claim scheduled automatic reviews can access unseen conversation history. Ask for pasted summaries or use explicit connector-accessible logs when needed.

| CI-008 | Source-linked second-pass inscription remains invisible beneath first five evidence entries | Show complete marks, candidate transcription, evidence image indices and uncertainties before permanent approval | Confirm rendered in preview and live 12-photo regression | Implemented in PR #1; unverified |
| CI-009 | Research endpoint accepts only permanent items | Stage internal-first maker/design source retrieval and optional external verification before sale-ready valuation, without forcing approval of weak draft | Database-schema audit, citations/freshness and test | Proposed |

| CI-010 | PR #1 merged but live regression incomplete | Verify production readiness, run one controlled image-set regression, inspect citation/attribution correctness and Gateway spend | Evidence from actual UI and billing | Awaiting test |

| CI-011 | AI research draft owner approval was labelled RESEARCH_VERIFIED without independent source checking | Always preserve OWNER_REVIEWED until direct source validation is separately evidenced | Verify owner approval and a later independent-review workflow | Implemented on main; deployment/test pending |

| CI-012 | Identification tab was only a placeholder despite existing database records | Show immutable attribution versions and provenance/verification of item-level evidence | Vercel build and test with populated item record | Implemented, awaiting test |

| CI-013 | Holmegaard regression 2 repeats unidentified mark and optical-colour misreading | Record second-pass trigger/result/error state separately from identification; diagnose failures, then test photo-level mark analysis against independently verified image evidence | Gateway status, source image mapping, blind negative controls and app UI verified before attribution promotion | Diagnostic implemented, acceptance pending |

| CI-014 | Knowledge Brain and learned research presumed active despite no internal retrieval in analysed endpoints | Verify CI database access, implement scoped internal-first read-only lookup, source freshness and provenance, then evaluate external research only for gaps | Regression evidence showing accessed internal source IDs and explicit fallback status | Documented in integration audit; not implemented |

| CI-015 | Correct CI Supabase now connected; Brain empty, 2 saved analyses | Connect source-aware, owner-scoped Knowledge Brain lookup at intake and display provenance/freshness | Live regression with a seeded approved source; confirm performance and visible source ID | First implementation committed; acceptance pending |
| CI-016 | Historical chat findings stored as project documentation, not database facts | Controlled migration of validated reference records, hypotheses and research protocols, with separate evidence/verification classes | Source audit, owner approval and no promotion of unsupported attributions | Pending |

| CI-017 | Retained Knowledge Brain entries were not consumed after lookup | Conservative per-object reconciliation requiring entity match, claimed source verification and freshness, without maker auto-certification | Test source mismatch, supersession, stale record and blind Holmegaard run; source claims must be reviewed independently | Code committed `46da1b6`, pending acceptance |

| CI-019 | Stage 2 source reviews can race or accidentally be excluded from trusted reconciliation | Database unique successor enforcement plus allow current reviewed revisions in source reconciliation | SQL index read-back and Vercel pass; then duplicate insert rejection / owner review live test | Migration applied and code committed; live test pending |

| CI-020 | Poorly lit/scratched signatures need auditable original-photo access and rival explanations | Show all source photos and indices, contradictory readings and evidence notes; prohibit confidence uplift from unverified maker suggestion | Vercel pass plus actual 12-image negative controls | Commits `da6e45f`, `7012707`; pending acceptance |

| CI-021 | Prior chat continuity and GitHub documentation were not safely queryable from application | Central versioned canonical_documents archive with owner RLS, hashes, fail-closed model retrieval and mandatory policy-hash audit; Skill 15 | 19 exact source texts, recovery manifest, deployment success and authenticated endpoint test | Archive and app code deployed; authenticated acceptance outstanding |
| CI-022 | Multiple intake photo uploads and AI drafts were not linked or inventoried | Protected intake_photo_sessions manifests, infer links only from chronology + count; preserve unmatched | 48 objects in 4 sets; two links, two unmatched; no deletes | Verified migration |
| CI-023 | Import reader omitted trailing newline and later emitted 67-byte placeholders | Retain original versions, republish byte-exact version, reject future small/placeholder latest source texts | Original SHA-256 matching, 0 invalid latest documents, endpoint fail-closed | Corrected and logged |
| CI-024 | Source site reputation and model VERIFIED_DIRECT risk false attribution/pricing confidence | Distinct attribution versus realised-price trust axes, source-audit metadata, insufficient sold comps cap, Skill 15 | Museum/maker archive and asking-only adversarial controls; authenticated regression | Source policy integrated; full independent verification outstanding |
| CI-025 | Security advisor found function search_path and migration_history RLS issues | Hard-coded function search paths, enabled RLS, closed canonical publication to normal clients | Advisor retest; leaked-password protection still requires Dashboard action | Database fixes applied; Auth setting pending |
