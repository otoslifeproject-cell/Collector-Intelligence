# SOURCE & EVIDENCE POLICY
Version: 4.0
Status: CONTROLLING RESEARCH POLICY

## Golden rule
A visually convincing internet match is a lead, not proof.


## Internal-first research policy
Before new web research:
1. inspect visible/user evidence;
2. retrieve relevant internal Collector Intelligence records;
3. assess whether those records are sufficiently verified and fresh;
4. search externally only for material gaps.

Do not repeat searches merely to recreate already-verified internal knowledge.

### Reuse conditions
Internal evidence may be reused when:
- source/reference is retained;
- verification status is adequate;
- the object is genuinely comparable;
- the evidence is still fresh enough for its purpose.

### Refresh conditions
Refresh externally when:
- price evidence is stale for the market decision;
- platform fees/rules may have changed;
- the comp set is too small or weak;
- the attribution is disputed;
- specialist/wanted-list status may have changed;
- the user asks for current/latest information.

## Write-back policy
After research, reusable findings should be classified:

### WRITE BACK — VERIFIED DURABLE
Examples:
- maker documentation;
- confirmed marks;
- direct auction results;
- confirmed marketplace sold records;
- rejected-attribution logic with source support;
- verified specialist routes.

### WRITE BACK — TIME-SENSITIVE
Examples:
- marketplace/platform rules;
- fees;
- active dealer stock;
- active wanted-list request;
- current asking context.

Must carry `last_verified` and freshness requirements.

### DO NOT WRITE BACK AS FACT
Examples:
- visual guesses;
- unattributed “looks like” matches;
- unsupported marketplace seller claims;
- ambiguous OCR/readings;
- unverified price claims.

## Price evidence hierarchy
### Tier A
- directly verified specialist/recognised auction realised results;
- directly verified marketplace sold results;
- maker/factory/museum/catalogue documentation for attribution.

### Tier B
- recognised auction aggregators/databases;
- eBay SOLD/COMPLETED;
- other genuine completed-sale sources.

### Tier C
- dealer sold archive where achieved price is confirmed;
- dealer archive where only former asking price is known;
- auction estimates.

### Tier D
- current dealer asking;
- 1stDibs asking;
- Etsy asking;
- Vinted asking;
- eBay active asking;
- other active marketplace asks.

Tier D is context, not valuation evidence.

## Mandatory price type
Use:
- HAMMER_REALIZED
- REALIZED_INCL_BP
- MARKETPLACE_SOLD
- DEALER_SOLD_CONFIRMED
- DEALER_ARCHIVED_LAST_ASK_ACHIEVED_UNKNOWN
- AUCTION_ESTIMATE
- DEALER_ASKING
- MARKETPLACE_ASKING
- INDEXED_SOLD_NOT_DIRECTLY_VERIFIED
- UNVERIFIED

## Verification status
Use:
- VERIFIED_DIRECT
- INDEXED_SOLD
- SECONDARY_REPORT
- UNVERIFIED

A result can only be VERIFIED_DIRECT if the exact source reference is retained.

## Mandatory comparable fields
- item ID
- source/venue
- URL/reference
- lot/item ID
- date checked
- sale/listing date
- price type
- raw price
- currency
- converted price if used
- premium status
- description
- maker attribution
- period
- dimensions
- colour/variant
- condition
- signed/labelled
- similarity score
- verification status
- notes

## Comparable scoring
Suggested:
- 30 maker/pattern
- 15 object type
- 10 size
- 10 colour
- 10 age
- 10 condition
- 5 signed/labelled
- 5 venue quality
- 5 recency

Then apply judgement.

Reject/heavily discount:
- different maker;
- unrelated form;
- material size mismatch;
- exceptional damage/condition;
- seller-speculative attribution;
- isolated outlier;
- asking-only evidence;
- unverifiable “sold” claims.

## Evidence provenance
Record:
- PHOTO
- USER_SUPPLIED_FACT
- DOCUMENTARY_SOURCE
- RESEARCH_SOURCE
- INFERENCE

Never silently convert inference into fact.

## Photo chronology
Preserve:
- in-situ/pre-buy;
- visual-search lead;
- post-purchase;
- later forensic evidence.

Later evidence must not retroactively justify an earlier buy decision.

## Visual search
Google Lens/image similarity may:
- produce hypotheses;
- find search terms;
- locate candidate models.

It may not:
- prove maker;
- prove date;
- prove value;
- upgrade an asking price to a comp.

## Market attribution
Record separately:
- **market attribution** (“commonly sold as…”)
- **maker attribution** (documentary/physical evidence)

## Rejected attribution
Store:
- rejected maker/model;
- why considered;
- evidence conflict;
- source/reference.

## Condition taxonomy
Distinguish:
- manufacturing feature;
- bubble/seed/inclusion;
- firing flaw;
- wear;
- dirt/residue;
- chip;
- crack;
- bruise;
- repair;
- uncertain anomaly.

## Confidence
Separate:
- identification confidence;
- dating confidence;
- valuation confidence.

Example:
“85% confident it is not Qianlong period” is not the same as “85% confident it is late-20th-century”.

## Attribution dependency
If maker/date remains conditional, valuation and collector routing must remain conditional.

## Valuation evidence strength
Use:
- HIGH
- MEDIUM
- LOW
- VERY LOW / PROVISIONAL

A low-evidence estimate must be visibly labelled.

## Research stopping
Use:
- CONTINUE
- ONE QUICK CHECK
- STOP — ECONOMICALLY SUFFICIENT
- SPECIALIST ESCALATION
- READY TO SELL

## Trend discipline
Do not infer a trend from scattered asking prices or a tiny sample.

When insufficient:
**UNKNOWN / INSUFFICIENT DATA**

## Research log
Retain enough evidence for another person to reproduce the research later.
