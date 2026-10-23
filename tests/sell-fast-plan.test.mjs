import test from 'node:test'
import assert from 'node:assert/strict'
import {assessSaleScenario, chooseSaleScenario, emptySaleScenario, prepareListing, storedPublication, validReviewDate} from '../src/lib/sellFastPlan.ts'
import {auditResearch, researchTypes} from '../src/lib/researchSaleDecision.ts'

const item={id:'item-1',owner_id:'owner-1',item_code:'CI-000001',object_type:'Vase',material:'Glass',colour:'Red',maker:'Unconfirmed maker',currency:'GBP',condition_summary:'Light surface wear; no crack seen on owner inspection.',marks_signatures_labels:'MEDINA (owner reading)',weight_g:200,dimensions:{height_cm:12},status:'CATALOGUED',acquisition_price:null}
const comp={id:'comp-1',item_id:item.id,venue:'Example auction',price_type:'HAMMER_REALIZED',verification_status:'VERIFIED_DIRECT',sale_date:'2026-09-12',date_checked:'2026-10-23',source_reference:'Example auction lot 123',source_url:'https://example.org/auction/lot-123',price:60,currency:'GBP',description:'Comparable red glass vase',comparability_grade:'A'}
const review={conditionReviewed:true,comparableReviewed:true,photosReviewed:true,attribution:'GENERIC',makerSource:'',specialistRisk:false,shippingInstructions:'Collection by appointment. Confirm payment and handover arrangements before listing.'}
const scenario={...emptySaleScenario('FAST_CASH','GBP'),comparableId:comp.id,grossLow:50,grossHigh:70,feePercent:10,fixedFee:1.25,packing:3,delivery:4,insurance:2,returnAllowance:1.5,daysLow:7,daysHigh:14,workHours:1,
  grossBasis:'SELLER_GROSS',priceAdjustment:'Comparable is a similar size and condition; the lower expected gross allows for visible surface wear and the selected venue.',premiumAdjustmentSource:'',
  feeSource:'https://example.org/fees',eligibilitySource:'https://example.org/eligibility',checkedAt:'2026-10-23',eligibilityConfirmed:true,sellerStatus:'PRIVATE',shippingReviewed:true}
const fullAudit=auditResearch(researchTypes.map(type=>({type,status:'DONE_EVIDENCED',runId:'stored-run-1',sourceRefs:['stored-evidence-1'],checkedAt:'2026-10-23'})))
const finalDecision={id:'reviewed-decision-1',itemId:item.id,ownerId:item.owner_id,status:'READY_TO_LIST',reviewStatus:'APPROVED',reviewedAt:'2026-10-23T08:00:00Z',sourceRefs:['reviewed-assessment-1'],
  rationale:'All available original photographs, signature alternatives, documentary maker references, source-reviewed achieved sales and seller economics have been evaluated for this specific item; the retained evidence supports the stated final decision.',
  availabilityScope:{checkIds:[...researchTypes],sourceRefs:['source-reviewed-availability-inventory-1'],rationale:'Original photographs, stored research history and documentary/source inventory were reviewed to enumerate all currently available relevant identification, condition and value checks for this particular object.'},
  availableChecks:researchTypes.map(id=>({id,status:'COMPLETE',sourceRefs:['stored-evidence-1']}))}
const research={audit:fullAudit,finalDecision}
const assess=(s=scenario,r=review,comps=[comp],i=item,ids=[comp.id],gate=research)=>assessSaleScenario(s,i,comps,r,'2026-10-23',ids,gate)

test('empty plans preserve unknown costs rather than silently assuming free selling',()=>{
  const a=assess(emptySaleScenario('FAST_CASH','GBP'))
  assert.equal(a.ready,false);assert.equal(a.netLow,null);assert.equal(a.netHigh,null)
  assert.equal(chooseSaleScenario([a]).recommendation,null)
})
test('complete route subtracts every named selling cost at pence accuracy',()=>{
  const a=assess();assert.equal(a.ready,true);assert.equal(a.feesLow,6.25);assert.equal(a.feesHigh,8.25)
  assert.equal(a.netLow,33.25);assert.equal(a.netHigh,51.25)
})
test('explicit zero fees and fulfilment costs are accepted; unknown is not zero',()=>{
  const free={...scenario,feePercent:0,fixedFee:0,packing:0,delivery:0,insurance:0,returnAllowance:0}
  assert.equal(assess(free).netLow,50);assert.equal(assess(free).ready,true)
  assert.equal(assess({...free,insurance:null}).netLow,null)
})
test('negative proceeds remain visible and prevent cash recommendation',()=>{
  const a=assess({...scenario,packing:80});assert.equal(a.netLow,-43.75);assert.equal(a.ready,false)
  assert.equal(chooseSaleScenario([a]).recommendation,null)
})
test('invalid numeric and inverted inputs fail closed without fabricated net',()=>{
  for(const change of [{grossLow:NaN},{feePercent:Infinity},{feePercent:101},{fixedFee:-1},{grossHigh:40}]){
    const a=assess({...scenario,...change});assert.equal(a.ready,false);assert.equal(a.netLow,null)
  }
})
test('a plausible URL and model-claimed sale never replace independent stored source review',()=>{
  assert.equal(assess(scenario,review,[comp],item,[]).ready,false)
  assert.equal(assess(scenario,review,[{...comp,verification_status:'UNVERIFIED'}]).ready,false)
  assert.equal(assess(scenario,review,[{...comp,price_type:'DEALER_ASKING'}]).ready,false)
})
test('unrelated, duplicated or currency-mismatched comps cannot price this object',()=>{
  assert.equal(assess(scenario,review,[{...comp,item_id:'another-item'}]).ready,false)
  assert.equal(assess(scenario,review,[comp,comp]).ready,false)
  assert.equal(assess(scenario,review,[{...comp,currency:'USD'}]).ready,false)
  assert.equal(assess({...scenario,currency:'USD'}).ready,false)
})
test('auction premium-inclusive and confirmed dealer sold remain separate accepted classes',()=>{
  for(const price_type of ['HAMMER_REALIZED','REALIZED_INCL_BP','MARKETPLACE_SOLD','DEALER_SOLD_CONFIRMED'])assert.equal(assess({...scenario,premiumAdjustmentSource:'https://example.org/premium-conversion'},review,[{...comp,price_type}]).ready,true)
  for(const price_type of ['AUCTION_REALISED','AUCTION_ESTIMATE','MARKETPLACE_ASKING','DEALER_ARCHIVED_LAST_ASK_ACHIEVED_UNKNOWN','INDEXED_SOLD_NOT_DIRECTLY_VERIFIED'])assert.equal(assess(scenario,review,[{...comp,price_type}]).ready,false)
})
test('fee review dates must be real, not future, and within the disclosed 30-day window',()=>{
  assert.equal(validReviewDate('2026-10-23','2026-10-23'),true)
  assert.equal(validReviewDate('2026-09-23','2026-10-23'),true)
  for(const date of ['2026-09-22','2026-10-24','2026-02-30','yesterday',''])assert.equal(validReviewDate(date,'2026-10-23'),false)
  assert.equal(assess({...scenario,checkedAt:'2025-10-23'}).ready,false)
})
test('fees, eligibility and business treatment require actual review inputs',()=>{
  for(const change of [{feeSource:''},{eligibilitySource:'javascript:alert(1)'},{eligibilityConfirmed:false},{sellerStatus:'UNKNOWN'}])assert.equal(assess({...scenario,...change}).ready,false)
  assert.equal(assess(scenario,review,[comp],{...item,acquisition_intent:'acquired_to_resell'}).ready,false)
  assert.equal(assess({...scenario,sellerStatus:'BUSINESS'},review,[comp],{...item,acquisition_intent:'acquired_to_resell'}).ready,true)
})
test('uncertain maker requires generic fallback or documented source and specialist uncertainty blocks sale',()=>{
  assert.equal(assess(scenario,{...review,attribution:'UNRESOLVED'}).ready,false)
  assert.equal(assess(scenario,{...review,attribution:'DOCUMENTED_MAKER'}).ready,false)
  assert.equal(assess(scenario,{...review,attribution:'DOCUMENTED_MAKER',makerSource:'https://example.org/maker/archive'}).ready,false)
  const bound={...research,finalDecision:{...finalDecision,sourceRefs:[...finalDecision.sourceRefs,'https://example.org/maker/archive'],makerApproval:{maker:item.maker,sourceRefs:['https://example.org/maker/archive']}}}
  assert.equal(assess(scenario,{...review,attribution:'DOCUMENTED_MAKER',makerSource:'https://example.org/maker/archive'},[comp],item,[comp.id],bound).ready,true)
  assert.equal(assess(scenario,{...review,specialistRisk:true}).ready,false)
})
test('condition, physical comparability, shipping and already sold object gates survive complete pricing',()=>{
  for(const key of ['conditionReviewed','comparableReviewed'])assert.equal(assess(scenario,{...review,[key]:false}).ready,false)
  assert.equal(assess({...scenario,shippingReviewed:false}).ready,false)
  assert.equal(assess(scenario,{...review,shippingInstructions:''}).ready,false)
  assert.equal(assess(scenario,review,[comp],{...item,condition_summary:null}).ready,false)
  assert.equal(assess(scenario,review,[comp],{...item,status:'SOLD'}).ready,false)
})
test('time and workload estimates are required, realistic ordering preserved',()=>{
  for(const change of [{daysLow:null},{daysHigh:3},{daysHigh:NaN},{workHours:null},{workHours:-1}])assert.equal(assess({...scenario,...change}).ready,false)
})
test('FAST CASH recommendation follows speed objective rather than highest gross',()=>{
  const quick=assess(),premium=assess({...scenario,mode:'MAX_VALUE',grossLow:100,grossHigh:150,daysLow:90,daysHigh:180,workHours:5})
  const result=chooseSaleScenario([premium,quick],'FAST_CASH')
  assert.equal(result.recommendation.scenario.mode,'FAST_CASH');assert.match(result.reason,/shorter assumed sale window/)
  assert.equal(chooseSaleScenario([quick,premium],'MAX_VALUE').recommendation.scenario.mode,'MAX_VALUE')
})
test('balanced choice uses conservative net rather than optimistic upside',()=>{
  const uncertain=assess({...scenario,mode:'BALANCED',grossLow:30,grossHigh:300}),stable=assess({...scenario,mode:'BALANCED',grossLow:60,grossHigh:70})
  assert.equal(chooseSaleScenario([uncertain,stable],'BALANCED').recommendation.scenario.grossLow,60)
})
test('generic listing preserves reported MEDINA spelling without promoting maker/date assertions',()=>{
  const draft=prepareListing({...item,current_attribution:'Michael Harris Mdina 1970',period_wording:'1970'},assess(),review,[comp])
  assert.equal(draft.status,'PREPARED');assert.equal(draft.publicationStatus,'NOT_PUBLISHED')
  assert.equal(draft.title,'Red Glass Vase');assert.match(draft.description,/MEDINA \(owner reading\)/)
  assert.doesNotMatch(draft.title,/Harris|Mdina|Unconfirmed maker|1970/)
  assert.equal(draft.itemSpecifics.Maker,'Unconfirmed');assert.equal(draft.recommendedPrice,50)
  assert.equal(draft.expectedNet.low,33.25);assert.equal(draft.comparableIds[0],comp.id)
  assert.ok(!JSON.stringify(draft).includes('profit'))
})
test('documented maker variants retain the same physical facts and source provenance',()=>{
  const r={...review,attribution:'DOCUMENTED_MAKER',makerSource:'https://example.org/maker/archive'}
  const provisional=prepareListing(item,assess({...scenario,platform:'Vinted'},r),r,[comp]);assert.equal(provisional.status,'REVIEW_REQUIRED');assert.doesNotMatch(provisional.title,/Unconfirmed maker/)
  const bound={...research,finalDecision:{...finalDecision,sourceRefs:[...finalDecision.sourceRefs,r.makerSource],makerApproval:{maker:item.maker,sourceRefs:[r.makerSource]}}}
  const a=assess({...scenario,platform:'Vinted'},r,[comp],item,[comp.id],bound),draft=prepareListing(item,a,r,[comp])
  assert.match(draft.title,/Unconfirmed maker/);assert.equal(draft.platform,'Vinted')
  assert.ok(draft.sourceReferences.includes(r.makerSource));assert.match(draft.description,/Light surface wear/)
})
test('draft still needs review when photographs or price evidence are missing',()=>{
  assert.equal(prepareListing(item,assess(),{...review,photosReviewed:false},[comp]).status,'REVIEW_REQUIRED')
  const unpriced=prepareListing(item,assess({...scenario,comparableId:''}),review,[comp])
  assert.equal(unpriced.recommendedPrice,null);assert.equal(unpriced.publicationStatus,'NOT_PUBLISHED')
})
test('stored published status needs matching owner/item, URL and timestamp; a draft is not publication',()=>{
  const listing={id:'l1',owner_id:item.owner_id,item_id:item.id,platform:'eBay',listing_status:'PUBLISHED',listing_url:'https://example.org/listing/1',listed_at:'2026-10-23T12:00:00Z'}
  assert.equal(storedPublication(listing,item.id,item.owner_id),'RECORDED_PUBLISHED')
  for(const change of [{listing_url:null},{listed_at:null},{listed_at:'invalid'},{owner_id:'other-owner'},{item_id:'other-item'}])assert.equal(storedPublication({...listing,...change},item.id,item.owner_id),'PUBLICATION_UNCONFIRMED')
  assert.equal(storedPublication({...listing,listing_status:'READY'},item.id,item.owner_id),'PREPARED')
  assert.equal(storedPublication({...listing,listing_status:'SOLD'},item.id,item.owner_id),'SOLD')
  for(const listing_status of ['','UNKNOWN','PENDING','FAILED','READY-ish'])assert.equal(storedPublication({...listing,listing_status},item.id,item.owner_id),'PUBLICATION_UNCONFIRMED')
})
test('complete scenario controls cannot override missing full research or final item assessment',()=>{
  const a=assess(scenario,review,[comp],item,[comp.id],{})
  assert.equal(a.netLow,33.25);assert.equal(a.ready,false)
  assert.equal(chooseSaleScenario([a]).recommendation,null)
  assert.equal(prepareListing(item,a,review,[comp]).status,'REVIEW_REQUIRED')
  assert.equal(assess(scenario,review,[comp],item,[comp.id],{audit:fullAudit}).ready,false)
})
test('any incomplete category or missing receipt blocks sale even with an approved final label',()=>{
  for(const status of ['NOT_RUN','RUNNING','INCONCLUSIVE','BLOCKED','RECEIPT_MISSING','FAILED']){
    const audit=auditResearch(fullAudit.receipts.map((r,index)=>index===0?{...r,status}:r))
    assert.equal(assess(scenario,review,[comp],item,[comp.id],{audit,finalDecision}).ready,false)
  }
  assert.equal(assess(scenario,review,[comp],item,[comp.id],{audit:{...fullAudit,receipts:[]},finalDecision}).ready,false)
})
test('final decision must cover completed source-linked available checks for the matching item and owner',()=>{
  const invalid=[{ownerId:'someone-else'},{itemId:'another-item'},{reviewStatus:'DRAFT'},{sourceRefs:[]},{availableChecks:[]},{reviewedAt:'not-a-date'},{status:'DO_NOT_LIST_YET'},{status:'SPECIALIST_REVIEW'}]
  for(const change of invalid)assert.equal(assess(scenario,review,[comp],item,[comp.id],{audit:fullAudit,finalDecision:{...finalDecision,...change}}).ready,false)
  for(const status of ['BLOCKED','RUNNING','NOT_RUN','MISSING_RECEIPT','INCONCLUSIVE']){
    const decision={...finalDecision,availableChecks:[{id:'open-check',status,sourceRefs:['prior-check']}]}
    assert.equal(assess(scenario,review,[comp],item,[comp.id],{audit:fullAudit,finalDecision:decision}).ready,false)
  }
})
test('final assessment rejects arbitrary checks, subsets, duplicates and undocumented availability scope',()=>{
  const missing=[{availableChecks:finalDecision.availableChecks.slice(1)},{availableChecks:[...finalDecision.availableChecks,finalDecision.availableChecks[0]]},
    {availableChecks:[{id:'arbitrary-everything-done',status:'COMPLETE',sourceRefs:['pretend-receipt']}]},
    {availabilityScope:undefined},{availabilityScope:{...finalDecision.availabilityScope,checkIds:researchTypes.slice(1)}},
    {availabilityScope:{...finalDecision.availabilityScope,checkIds:[...researchTypes,'ADDITIONAL_MARK_CHECK']}},
    {availabilityScope:{...finalDecision.availabilityScope,sourceRefs:[]}},{rationale:'done'},
    {availabilityScope:{...finalDecision.availabilityScope,rationale:'all done'}},
    {availableChecks:finalDecision.availableChecks.map((c,i)=>i===0?{...c,sourceRefs:['not-in-research-audit']}:c)},
    {availableChecks:[null]}, {id:null}, {reviewedAt:null}]
  for(const change of missing)assert.equal(assess(scenario,review,[comp],item,[comp.id],{audit:fullAudit,finalDecision:{...finalDecision,...change}}).ready,false)
})
test('unknown item or scenario currency cannot silently become GBP',()=>{
  for(const currency of [null,'','XXX','ZZZ','gbp'])assert.equal(assess(scenario,review,[comp],{...item,currency}).ready,false)
  assert.equal(assess({...scenario,currency:'ZZZ'}).ready,false)
})
test('buyer-inclusive totals never calculate seller proceeds and premium comps need documented adjustment',()=>{
  const buyer=assess({...scenario,grossBasis:'BUYER_TOTAL'})
  assert.equal(buyer.netLow,null);assert.equal(buyer.netHigh,null);assert.equal(buyer.ready,false)
  const premium={...comp,price_type:'REALIZED_INCL_BP'}
  assert.equal(assess(scenario,review,[premium]).ready,false)
  assert.equal(assess({...scenario,premiumAdjustmentSource:'https://example.org/premium-terms'},review,[premium]).ready,true)
  assert.equal(assess({...scenario,priceAdjustment:'same'}).ready,false)
})
