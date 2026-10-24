# Source reconciliation — review package, 20 October 2026

This package preserves exact manuscripts and makes the remaining choices reviewable. It does not publish sources, modify production, select by import recency, or authorise activation. The application does not load this manifest. The existing draft PR #2 and opt-in rollout boundary remain in force.

## Exact source decisions

| Required source | Preserved evidence | Candidate / remaining action |
|---|---|---|
| Master Brief | Frozen canonical v4.0 bytes and SHA-256 | Retain the v4.0 policy pin; no proposed policy edit |
| Evidence Policy | Frozen canonical v4.0 bytes and SHA-256 | Retain the v4.0 policy pin; no proposed policy edit |
| Project Instructions | Exact archived v4.1, not a reconstructed summary | Current v4.3 was referenced in the preceding owner context, but no exact complete manuscript was recovered. Keep candidate absent; never silently substitute v4.1 |
| Photo Examination | Exact 1,144-character archive variant, including final newline | Byte preservation verified; semantic review/publication decision pending |
| Comparable Research | Exact old 1,595-character workflow, including final newline | Separate `proposed/03_COMPARABLE_RESEARCH.md`, version `4.0-aligned-draft-20261020`; review before any publication |

All hashes, exact versions and UTF-8 byte sizes are in `manifest.json`. Byte size and Unicode character count are deliberately distinct. Neither current flags nor timestamps select a manuscript.

## Comparable-workflow changes

The historical workflow classified specialist dealers/1stDibs as Tier C without distinguishing active asks. The proposed revision takes the complete Tier A–D section from controlling Evidence Policy v4.0. Current dealer/1stDibs asks are Tier D context. Confirmed dealer sold, former ask/achieved unknown and estimates remain distinct Tier C price types. A museum attribution reference supplies no resale price by itself.

The draft preserves the original four-step search order and 100-point matching weights. It adds the controlling internal-first, independent verification, separate confidence, provisional valuation and classified write-back requirements. It does not introduce a new price methodology or claim any object attribution/sale has been verified. The old manuscript remains intact in `tests/fixtures/source-archive`.

`CANONICAL_GOVERNANCE_AND_SOURCE_TRUST_PROTOCOL.md` also contained the outdated current-retail/Tier C sentence. A dated correction now explicitly supersedes it without erasing the historical text. No canonical database record was edited.

## Reproduce the preservation check

From the repository root with Node 22+:

```sh
node --experimental-strip-types scripts/check-source-review-bundle.mjs
node --experimental-strip-types --test tests/continuity/source-review.test.mjs
```

The first command returns **integrity PASS / publication BLOCKED** when all six preserved/candidate bodies match their bytes and hashes. Missing exact v4.3 and semantic review of the two workflows are reported separately. Exit success means preservation checks passed; it does not mean approval. The checker has no network client, database credential, publication command or activation flag. The tests also reject incomplete/duplicate keysets, byte/newline changes, changed policy pins and substitution of historical instructions for the missing current version.

These tests validate reproducible integrity and specified tier consistency, not a full semantic review of arbitrary documents. Source publication remains a privileged, reviewed operation. A manifest edit cannot grant publication authority.

## Search receipt and next decision

Read-only canonical instruction inventory contained v4.1, DRIVE_2026-10-10, two original-file newline variants and a 67-character placeholder; no v4.3 row. Targeted Drive and personal-context retrieval did not yield a verified exact full Collector Intelligence v4.3 manuscript. Similar v4.3 filenames in unrelated projects are not evidence of Collector authority. Partial snippets and assistant recollections were not used to invent a new version.

Provide an exact complete current Project Instructions manuscript or identify the exact authoritative version to use. Then prepare its hash-preserved candidate, review the workflow draft, and rerun the source check. Production migration, source publication and rollout remain separately excluded by the current no-production instruction; no approval request is needed to keep developing/testing on this draft.

The older exhaustive historical-archive read gate is not marked PASS by this scoped engineering continuation. This package is not a claim that all original modules, historic transcripts, images or workbooks have been fully recovered.
