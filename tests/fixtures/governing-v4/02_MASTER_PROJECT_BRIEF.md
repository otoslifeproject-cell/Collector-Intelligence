# MASTER PROJECT BRIEF — Collector Intelligence
Version: 4.0
Status: CONTROLLING PRODUCT SPECIFICATION

## 1. Product vision
Build a collector/dealer operating system that turns photographs and user-supplied information into evidence-led buying, identification, valuation, collector-matching, selling and outcome intelligence.

It should answer:

1. What separate physical objects are represented?
2. What is each object?
3. How sure are we?
4. What evidence supports or contradicts the attribution?
5. What has genuinely comparable material sold for?
6. Is it worth buying at the price in front of me?
7. Who is the best buyer?
8. Where should it be sold for the best realistic net return?
9. How can the listing be created with the least manual work?
10. After sale, what actually happened and what should the system learn?

Core workflow:

**PHOTOS → OBJECT SEPARATION → EVIDENCE REGISTER → IDENTIFY → RESEARCH → VALUE → BUY/PASS → CATALOGUE → COLLECTOR MATCH → VENUE ROUTE → LIST → SHIP → SELL → RECORD OUTCOME → LEARN**

## 2. Categories
Glass is the first deep vertical.

The architecture must also support ceramics/pottery/porcelain, carved wood, pictures/prints, mirrors/decorative furniture, jewellery, marbles, stamps, playing cards, sculpture and other collectables.

## 3. Operating modes

### A — QUICK BUY CHECK
For shops, fairs, auctions, house clearances and online opportunities.

Outputs:
- provisional identification;
- identification confidence;
- buy-confidence;
- biggest uncertainty;
- credible resale evidence;
- all-in acquisition;
- downside/base/upside resale;
- selling costs;
- net sale proceeds;
- profit;
- return on cash;
- maximum sensible purchase price;
- BUY / MAYBE / PASS.

Low cost can reduce the amount of attribution certainty needed for BUY if the generic downside case remains commercially attractive.

#### SHELF SCAN
For mixed shelves:
- identify only the strongest candidates;
- score **VALUE POTENTIAL** separately from **BUY OPPORTUNITY**;
- request one high-value next photo/test where needed;
- do not research every low-value object.

### B — FULL IDENTIFICATION & VALUATION
Outputs:
- object separation where relevant;
- structured evidence register;
- current attribution;
- attribution revision history;
- rejected alternatives;
- maker / region / period;
- identification confidence;
- dating confidence;
- valuation confidence;
- comparable set;
- value bands;
- rarity/desirability;
- collector-premium potential;
- venue recommendation;
- research-stop decision;
- best next evidence.

### C — CATALOGUE
Store:
- immutable Item ID;
- photo assignments;
- physical data;
- acquisition intent;
- acquisition price/date/place;
- current attribution;
- previous and rejected attributions;
- evidence;
- comparable records;
- value history;
- preferred venue;
- status;
- sale outcome;
- valuation accuracy.

### D — SELL / SELL FAST
For every sale-ready item:
- sale readiness;
- FAST CASH / BALANCED / MAX VALUE;
- venue competition;
- best public market;
- best specialist/collector route;
- target price;
- fast-sale price;
- minimum sensible price;
- expected liquidity;
- canonical listing record;
- platform-specific listing variants;
- shipping/insurance;
- expected net proceeds;
- expected profit when cost known;
- cash-generation priority;
- export/cross-list package.

## 4. Multi-photo / batch object-separation gate
Before deep research:

1. Determine how many distinct physical objects are evidenced.
2. Assign each photo to one or more Object IDs.
3. Assign weights, dimensions, marks and condition issues to a specific Object ID.
4. Flag uncertain assignments.
5. Detect duplicate photographs.
6. Reconcile user-stated count against observed count.
7. If the upload appears incomplete, say so before spending time on deep research.

A photo may contain multiple objects.
A measurement may temporarily remain `UNASSIGNED`.
Never duplicate an unassigned measurement across several objects.


## 5. Collector Intelligence Knowledge Brain
Collector Intelligence must build a durable structured intelligence layer outside any single chat/model session.

### Core stores
1. **Object / Collection Brain**
   - owned/researched items;
   - photographs;
   - measurements;
   - marks;
   - attribution history;
   - acquisition;
   - listing/sale outcomes.

2. **Maker / Pattern Brain**
   - makers/factories/designers;
   - documented periods;
   - signatures/labels/marks;
   - forms;
   - construction characteristics;
   - catalogue/pattern/model references.

3. **Comparable Sales Brain**
   - verified realised/sold records;
   - asking-price context;
   - dimensions/condition/colour;
   - source references;
   - comparability;
   - last verified.

4. **Rejected Attribution Brain**
   - tempting false matches;
   - why they were considered;
   - what evidence rejected them;
   - repeat-warning rules.

5. **Collector / Buyer Brain**
   - specialist dealers;
   - societies;
   - clubs;
   - forums;
   - replacement services;
   - wanted-list evidence;
   - actual buyer relationships where legitimately obtained.

6. **Venue Brain**
   - platform/category fit;
   - seller eligibility;
   - fees;
   - shipping rules;
   - sold-data quality;
   - time-to-sale;
   - actual venue performance;
   - `last_verified`.

7. **Outcome Brain**
   - actual sale prices;
   - fees;
   - packing;
   - days to sell;
   - returns;
   - net proceeds;
   - profit/ROC;
   - forecast error.

### Retrieval order
For a new object:

**PHOTO / USER EVIDENCE → INTERNAL KNOWLEDGE RETRIEVAL → FRESHNESS CHECK → GAP ANALYSIS → EXTERNAL RESEARCH IF NEEDED → VERIFY → WRITE BACK**

The system should not perform external research merely because it can.

### Freshness
Each reusable knowledge record should carry:
- `knowledge_type`
- `source_date`
- `last_verified`
- `freshness_requirement`
- `source_reference`
- `verification_status`

Stable maker documentation can remain useful for years.
Market prices, venue fees, seller rules, active wanted lists and platform eligibility should be refreshed much more often.

### Write-back threshold
Write durable knowledge only when:
- the source is reproducible;
- the evidence classification is clear;
- uncertainty is preserved;
- the finding is likely to be reusable.

Do not permanently write:
- unsupported visual guesses;
- unverified seller claims;
- ambiguous price evidence;
- transient speculation.

### Model independence
The AI model is the reasoning engine, not the sole repository of business knowledge.

The Knowledge Brain must be usable by a fresh chat/model session without depending on a particular historical conversation.

## 25. Evidence provenance
Every useful observation should be stored as:

- PHOTO
- USER_SUPPLIED_FACT
- DOCUMENTARY_SOURCE
- REALIZED_SALE
- MARKETPLACE_SOLD
- DEALER_ARCHIVE
- ACTIVE_ASK
- INFERENCE

Every evidence record should preserve:
- Item ID;
- observation/claim;
- provenance;
- supports / weakens / neutral;
- source reference;
- date checked;
- confidence impact;
- notes.

## 6. Attribution history
Store:
- current attribution;
- current confidence;
- previous attribution;
- previous confidence;
- evidence that changed the attribution;
- rejected attribution;
- rejection reason.

Do not silently overwrite.

## 7. Separate confidence dimensions
Maintain:

1. Identification confidence
2. Dating confidence
3. Valuation confidence / comparable-evidence strength
4. Research priority
5. Commercial potential
6. Liquidity

High identification confidence must not imply high valuation confidence.

## 8. Attribution dependency gate
Where value or buyer routing depends heavily on an uncertain maker/date/mark, show parallel cases.

Example:

**Case A — if Wedgwood mark confirms:** use Wedgwood comps/routes.  
**Case B — if not:** use generic Staffordshire comps/routes.

Do not let a speculative attribution silently control downstream output.

## 9. Comparable record
Every meaningful comparable must retain:
- source type;
- venue;
- URL/reference;
- lot/item ID where available;
- date accessed;
- sale date;
- price type;
- price;
- currency;
- premium status;
- description;
- maker attribution;
- date/period;
- dimensions;
- condition;
- colour/variant;
- signature/label;
- similarity score;
- verification status;
- notes.

No comparable may be labelled VERIFIED without a reproducible reference.

## 10. Price types
Keep distinct:

1. HAMMER / REALIZED
2. REALIZED INCLUDING BUYER PREMIUM
3. MARKETPLACE SOLD
4. DEALER SOLD — achieved confirmed
5. DEALER ARCHIVED / LAST ASK — achieved unknown
6. AUCTION ESTIMATE
7. DEALER ASKING
8. MARKETPLACE ASKING
9. INDEXED / SECONDARY / UNVERIFIED

Do not average them as though they are equivalent.

## 11. Economics
For buying:

`ALL_IN_ACQUISITION = purchase + premium + VAT/tax + inbound shipping/travel + cleaning/restoration + import/FX`

For selling:

`EXIT_COST = seller fees + payment/platform fees + packaging + outbound shipping subsidy + insurance + expected return/refund allowance`

`NET_SALE_PROCEEDS = sale price - EXIT_COST`

`NET_PROFIT = NET_SALE_PROCEEDS - ALL_IN_ACQUISITION`

`RETURN_ON_CASH = NET_PROFIT / ALL_IN_ACQUISITION`

Never call net sale proceeds “profit” if acquisition cost is unknown.

## 12. Acquisition intent / seller status
Store:

`acquisition_intent = personal_collection | acquired_to_resell | unknown`

Items deliberately acquired for resale should use trader/business economics by default.

For personal-collection disposal, private-seller economics may be modelled where legal/platform-appropriate.

Current fees, eligibility and platform rules should be verified when they materially affect the recommendation.

## 13. Venue routing
Compare relevant venues rather than defaulting to one.

Score:
- achievable gross;
- seller fees;
- expected net;
- category fit;
- business/private eligibility;
- collector depth;
- time-to-sale;
- international reach;
- listing effort;
- return/fraud risk;
- shipping burden;
- cross-list feasibility.

Output:
- BEST EXPECTED NET
- FASTEST ROUTE
- BEST COLLECTOR REACH
- LOWEST-EFFORT ROUTE
- RECOMMENDED ROUTE

Vinted is a first-class venue candidate where relevant and permitted, not automatically superior/inferior to eBay.

## 14. Collector network
Distinguish:
- `specialist_route_confidence`
- `actual_known_buyer_match`
- `wanted_list_match`
- `collector_premium_evidence`

A dealer/society/forum is a route or research node, not automatically a buyer.

## 15. Research economics
Research states:

- CONTINUE
- ONE QUICK CHECK THEN SELL
- STOP — ECONOMICALLY SUFFICIENT
- SPECIALIST ESCALATION
- READY TO SELL

Optimise for information gain versus effort.

## 16. Specialist escalation
Display:

**DO NOT LIST YET — SPECIALIST REVIEW**

where credible evidence could move the object between materially different valuation classes.

## 17. Sell Fast modes
For sale-ready items:

### FAST CASH
Target high probability of sale in roughly 7–14 days.

### BALANCED
Target reasonable net return and roughly 30–60 day horizon.

### MAX VALUE
Target specialist/collector buyer and tolerate longer sale time.

Potentially important objects must be protected from inappropriate fast-sale discounting.

## 18. Cash Generation Queue
Rank inventory using:

**expected net cash × probability of sale × speed ÷ work required**

Apply penalties for:
- attribution risk;
- shipping difficulty;
- high return risk;
- high risk of underselling.

Output:
- LIST FIRST
- LIST NEXT
- LIST LATER
- DO NOT LIST YET

## 19. Listing architecture
One canonical record is the factual source of truth.

Platform variants may change:
- title length;
- keywords;
- tone;
- category fields;
- shipping options.

They must not change factual certainty.

## 20. Cross-listing
The application should support:
- generating platform-specific drafts;
- file/API export where permitted;
- approval before publish;
- inventory sync;
- auto-delist/close other venues after a sale where technically available and authorised.

No automatic purchasing or publishing without explicit approval until the user deliberately enables that capability.

## 21. Shipping / insurance
Store:
- standard/enhanced/professional packing;
- packing cost;
- package dimensions/weight;
- declared value;
- carrier;
- glass/ceramic exclusions;
- breakage cover;
- loss cover;
- compensation limit;
- destination restrictions;
- claims evidence requirements.

## 22. Trend analysis
Only classify:
- HOT
- HEALTHY
- THIN
- SOFT

with adequate dated realised evidence.

Otherwise:
**UNKNOWN / INSUFFICIENT DATA**

A SELL NOW recommendation may be based on item economics even where market trend is unknown.

## 23. Feedback loop
When an item sells, record:
- venue;
- listing date;
- asking price;
- offers;
- sale date;
- gross;
- fees;
- packaging;
- shipping subsidy;
- insurance;
- net proceeds;
- acquisition cost;
- net profit;
- days to sell;
- returns/refunds;
- buyer geography where useful;
- valuation accuracy;
- venue-performance notes.

Use outcomes to improve:
- valuation;
- venue routing;
- liquidity;
- collector matching;
- Quick Buy thresholds.

## 24. Product principle
Collector Intelligence is an **evidence, decision, buyer-routing and selling system**, not a magic antique expert.
