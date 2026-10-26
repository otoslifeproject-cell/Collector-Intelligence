# Independent owner selling workflow QA — 23 October 2026

Status: development candidate; NOT owner acceptance or release approval.
Scope is the owner's first five items and the existing upload → research recovery
→ evidence review → explicit catalogue approval → selling scenarios → saved,
unpublished listing review workflow. Quick Buy and wider marketplace integrations
are deferred. No new browser stack, dependency, plugin or paid inference is needed.

The governing QA specification is the owner's Drive document
`1A-IH5sLGDJXnr56IFTcLYAM-aTGCumsmN4tUFyDMgI0` (full text read).
Reuse the existing disposable PostgreSQL17, Auth, PostgREST, private Storage and
Chromium application tests. Synthetic provider replies are labelled fixtures;
real Auth/REST/Storage operations do not prove live model or hosted acceptance.

Separate read-only reviews examined journeys, rendered design, accessibility,
state/recovery, commercial truth and the release gate. The current independent
reviewer executed47 focused helper tests and examined seven actual run107 images
across320/390/768/1440px and both themes. This is independent critique of that
candidate; fixes require fresh same-commit tests and rendered retest.

| Finding | Correction | Retest truth |
| --- | --- | --- |
| Legacy ready/sell-now labels implied evidence approval | Shared qualified labels on Dashboard/cards/Sales | Run107 owner journeys passed; later regressions pending |
| Different staged UUIDs could claim overlapping paid object research | Canonical item/member scope locks, one winner | Real Auth/REST scoped-claim tests passed on2b5d/a7/bc2 |
| Catalogue save left assessment facts timestamp stale | Independent saved-facts readback; preserve concurrent edits | Fresh browser save→hold test added |
| Held assessment could remain stuck after facts changed and exact event absent | GET check then explicit export/current-review recovery | Helper tests passed; browser gate retained |
| Unknown costs/currency appeared as zero/GBP | Required deliberate zero; unknown currency qualifier and disabled calculator | Local helper/build pass; actual browser added |
| Lost listing acknowledgement/refresh lost review work | Existing listings DRAFT, immutable event, exact independent GET, restore | Actual browser test added; not publication |
| Malformed scenario null crashed restore | Reject malformed persisted shape | Independent helper retest passed |
| Condensed research audit suppressed error alert | Explicit core alert, avoid duplicate announcements in batch cards | Six historical failures reproduced in107; correctedbc2; fresh CI pending |
| Mobile metadata labels touched | Shared wrap/gap and semantic muted text | Independent rendered107 finding; corrected29fec; fresh retest pending |
| Light readiness badge / photo placeholder contrast | Semantic theme foreground/surface | Independent rendered107 finding; corrected29fec; fresh contrast/visual retest pending |
| Positive reviewed final decision had no data path | Private reviewer-only append and qualified current-evidence projection under development | Not complete; no owner readiness claim |

Primary navigation acceptance checks use one Dashboard card click and one
Sell/route click. Per-category statuses remain visible on every task tab, while
long source details can be disclosed. Width/theme tests preserve keyboard access,
unknown confidence, no horizontal page overflow and unpublished draft wording.
Rendered text contrast,200% CSS zoom and reduced motion checks are bounded tests,
not a complete WCAG audit or browser/assistive-technology certification.

Failures keep screenshots, traces and videos using the existing Playwright
configuration. Run107 failure archive is privately preserved in Drive
`1ZXqiMkrYKBjvqLxV-UTSOzubfXVTl0KC`:132files,52,462,037bytes,
SHA256 `3075a5ce1c35cf4efd024d8b24412af12f0f949ac9cc2b2bde481066238825b2`.
Local ZIP integrity and downloaded Drive raw bytes match. Earlier artifacts remain
immutable. Private originals and research source captures are not added to this
public repository.

Run108 was cancelled at the20minute job limit: hosted dependency installation
consumed approximately12minutes before the bounded browser suite. This is not a
passing result. The candidate allows30minutes for setup plus unchanged bounded
acceptance and evidence upload; no assertion is removed or skipped.

Release requires all five jobs green for the same application SHA, independently
reviewed current screenshots, zero unresolved in-scope critical/major defects,
explicit remaining limitations and controlled owner acceptance. Production main,
DB, deployment aliases and marketplace listings remain unchanged. A review draft
or synthetic fully-qualified fixture is never proof that an actual owner object
is researched, correctly valued, ready or published.
