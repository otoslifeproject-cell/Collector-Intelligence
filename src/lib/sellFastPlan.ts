import type {Comparable, Item} from '../types'
import {classifyComparables, evidenceDate} from './comparableEvidence.ts'
import {auditResearch, researchTypes} from './researchSaleDecision.ts'
import type {ResearchAudit} from './researchSaleDecision'

export const sellModes = ['FAST_CASH', 'BALANCED', 'MAX_VALUE'] as const
export type SellMode = typeof sellModes[number]
export const salePlatforms = ['eBay', 'Vinted', 'Etsy', 'Auction / specialist', 'Direct collector / dealer', 'Local collection'] as const
export type SalePlatform = typeof salePlatforms[number]
export type StoredListing = {id:string; item_id:string; owner_id?:string; platform:string; listing_status:string; listing_url?:string|null; listed_at?:string|null}
export type SaleScenario = {
  mode:SellMode; platform:SalePlatform; currency:string; comparableId:string
  grossLow:number|null; grossHigh:number|null; feePercent:number|null; fixedFee:number|null
  grossBasis:'UNKNOWN'|'SELLER_GROSS'|'BUYER_TOTAL'; priceAdjustment:string; premiumAdjustmentSource:string
  packing:number|null; delivery:number|null; insurance:number|null; returnAllowance:number|null
  daysLow:number|null; daysHigh:number|null; workHours:number|null
  feeSource:string; eligibilitySource:string; checkedAt:string; eligibilityConfirmed:boolean
  sellerStatus:'UNKNOWN'|'PRIVATE'|'BUSINESS'
  deliveryMethod:'COLLECTION'|'DELIVERY'; shippingReviewed:boolean
}
export type ListingReview = {
  conditionReviewed:boolean; comparableReviewed:boolean; photosReviewed:boolean
  attribution:'UNRESOLVED'|'GENERIC'|'DOCUMENTED_MAKER'; makerSource:string
  specialistRisk:boolean; shippingInstructions:string
}
// Supplied by the persisted, reviewed item assessment. This is deliberately not an owner-editable readiness switch.
export type FinalResearchDecision = {
  id:string; itemId:string; ownerId:string; status:'READY_TO_LIST'|'DO_NOT_LIST_YET'|'SPECIALIST_REVIEW'
  reviewStatus:'APPROVED'; reviewedAt:string; sourceRefs:string[]
  rationale:string
  makerApproval?:{maker:string;sourceRefs:string[]}
  availabilityScope:{checkIds:string[];sourceRefs:string[];rationale:string}
  availableChecks:{id:string;status:'COMPLETE'|'INCONCLUSIVE'|'BLOCKED'|'NOT_RUN'|'RUNNING'|'MISSING_RECEIPT';sourceRefs:string[]}[]
}
export type ResearchSaleGate = {audit?:ResearchAudit; finalDecision?:FinalResearchDecision}
export type ScenarioAssessment = {scenario:SaleScenario; netLow:number|null; netHigh:number|null; feesLow:number|null; feesHigh:number|null; blockers:string[]; ready:boolean}
export type PreparedListing = {
  status:'PREPARED'|'REVIEW_REQUIRED'; publicationStatus:'NOT_PUBLISHED'; itemId:string; itemCode:string
  platform:SalePlatform; mode:SellMode; currency:string; title:string; description:string
  recommendedPrice:number|null; recommendedPriceBasis:'ALL_IN_ITEM_PRICE_OR_COLLECTION'; priceRange:{low:number|null; high:number|null}; expectedNet:{low:number|null; high:number|null}
  itemSpecifics:Record<string,string>; keywords:string[]; photographsNeeded:string[]; shippingInstructions:string
  comparableIds:string[]; sourceReferences:string[]; outstandingChecks:string[]
}

const achieved = new Set(['HAMMER_REALIZED','REALIZED_INCL_BP','MARKETPLACE_SOLD','DEALER_SOLD_CONFIRMED'])
const finiteNonnegative = (n:unknown):n is number => typeof n==='number' && Number.isFinite(n) && n>=0
const cents = (n:number) => Math.round((n+Number.EPSILON)*100)/100
const currencies=new Set((Intl as typeof Intl&{supportedValuesOf?:(key:'currency')=>string[]}).supportedValuesOf?.('currency')||['GBP','EUR','USD','CAD','AUD','NZD','CHF','JPY'])
export const knownSaleCurrency=(value:unknown):value is string=>typeof value==='string'&&currencies.has(value)
export function safeSourceUrl(value:unknown):value is string {
  if(typeof value!=='string'||value.trim()!==value||/\s/.test(value))return false
  try {const u=new URL(value);return u.protocol==='https:'&&!!u.hostname&&!u.username&&!u.password} catch {return false}
}
export function validReviewDate(value:string, today:string):boolean {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!/^\d{4}-\d{2}-\d{2}$/.test(today))return false
  const a=Date.parse(value+'T00:00:00Z'), b=Date.parse(today+'T00:00:00Z')
  return Number.isFinite(a)&&Number.isFinite(b)&&new Date(a).toISOString().slice(0,10)===value&&a<=b&&b-a<=30*86400000
}
export function emptySaleScenario(mode:SellMode, currency:string):SaleScenario {
  return {mode,platform:'Local collection',currency,comparableId:'',grossLow:null,grossHigh:null,feePercent:null,fixedFee:null,
    grossBasis:'UNKNOWN',priceAdjustment:'',premiumAdjustmentSource:'',
    packing:null,delivery:null,insurance:null,returnAllowance:null,daysLow:null,daysHigh:null,workHours:null,
    feeSource:'',eligibilitySource:'',checkedAt:'',eligibilityConfirmed:false,sellerStatus:'UNKNOWN',deliveryMethod:'COLLECTION',shippingReviewed:false}
}
export function researchSaleBlockers(item:Item, gate:ResearchSaleGate, today:string):string[] {
  const blockers:string[]=[]
  const audit=gate.audit?auditResearch(gate.audit.receipts):null
  if(!audit||audit.complete!==researchTypes.length||audit.unresolved.length)
    blockers.push('DO NOT LIST YET — complete all relevant research categories and recover missing execution/source receipts.')
  const decision=gate.finalDecision
  const referenced=(refs:unknown)=>Array.isArray(refs)&&refs.length>0&&refs.every(r=>typeof r==='string'&&r.trim().length>0)
  if(!decision||typeof decision.id!=='string'||!decision.id.trim()||decision.itemId!==item.id||decision.ownerId!==item.owner_id||decision.reviewStatus!=='APPROVED'||!referenced(decision.sourceRefs)||
    typeof decision.reviewedAt!=='string'||!Number.isFinite(Date.parse(decision.reviewedAt))||!evidenceDate(decision.reviewedAt.slice(0,10))||decision.reviewedAt.slice(0,10)>today){
    blockers.push('A stored, source-reviewed final decision for this owner and item is required. A form checkbox cannot certify research completion.')
  } else {
    if(decision.status!=='READY_TO_LIST')blockers.push(decision.status==='SPECIALIST_REVIEW'?'DO NOT LIST YET — SPECIALIST REVIEW remains the final item decision.':'DO NOT LIST YET remains the final item decision.')
    const checks=decision.availableChecks
    const scope=decision.availabilityScope
    const scopeIds=scope?.checkIds
    const checksWellFormed=Array.isArray(checks)&&checks.every(c=>c&&typeof c.id==='string')
    const checkIds=checksWellFormed?checks.map(c=>c.id):[]
    const scopeValid=Array.isArray(scopeIds)&&scopeIds.length>=researchTypes.length&&new Set(scopeIds).size===scopeIds.length&&
      scopeIds.every(id=>typeof id==='string'&&id.trim().length>0)&&researchTypes.every(type=>scopeIds.includes(type))&&referenced(scope.sourceRefs)&&typeof scope.rationale==='string'&&scope.rationale.trim().length>=80
    if(!scopeValid||typeof decision.rationale!=='string'||decision.rationale.trim().length<80)
      blockers.push('The stored final assessment needs a detailed source-linked account of the checks available for this item, and the reasoning for its final identity/value decision.')
    if(!checksWellFormed||checks.length<researchTypes.length||new Set(checkIds).size!==checks.length||researchTypes.some(type=>!checkIds.includes(type))||
      !scopeValid||checkIds.length!==scopeIds.length||scopeIds.some(id=>!checkIds.includes(id))||
      checks.some(c=>typeof c.id!=='string'||!c.id.trim()||c.status!=='COMPLETE'||!referenced(c.sourceRefs))||
      researchTypes.some(type=>{const row=checks.find(c=>c.id===type),receipt=audit?.receipts.find(r=>r.type===type);return !row?.sourceRefs.some(ref=>receipt?.sourceRefs?.includes(ref))}))
      blockers.push('The final assessment must document every available relevant identification/value check and its completed evidence; unresolved checks prevent sale readiness.')
  }
  return blockers
}
export function assessSaleScenario(scenario:SaleScenario, item:Item, comparables:Comparable[], review:ListingReview, today:string, trustedComparableIds:string[]=[], research:ResearchSaleGate={}):ScenarioAssessment {
  const blockers:string[]=[]
  blockers.push(...researchSaleBlockers(item,research,today))
  const numbers=[scenario.grossLow,scenario.grossHigh,scenario.feePercent,scenario.fixedFee,scenario.packing,scenario.delivery,scenario.insurance,scenario.returnAllowance]
  const validNumbers=numbers.every(finiteNonnegative)&&scenario.feePercent!<=100&&scenario.grossHigh!>=scenario.grossLow!
  const validMoney=validNumbers&&scenario.grossBasis==='SELLER_GROSS'
  if(!validNumbers)blockers.push('Enter all gross and cost assumptions; use an explicit zero for costs that do not apply.')
  if(scenario.grossBasis!=='SELLER_GROSS')blockers.push('Gross proceeds must exclude buyer premium and buyer taxes; a buyer-inclusive total cannot be treated as seller revenue.')
  const netLow=validMoney?cents(scenario.grossLow!*(1-scenario.feePercent!/100)-scenario.fixedFee!-scenario.packing!-scenario.delivery!-scenario.insurance!-scenario.returnAllowance!):null
  const netHigh=validMoney?cents(scenario.grossHigh!*(1-scenario.feePercent!/100)-scenario.fixedFee!-scenario.packing!-scenario.delivery!-scenario.insurance!-scenario.returnAllowance!):null
  if(!sellModes.includes(scenario.mode)||!salePlatforms.includes(scenario.platform))blockers.push('Choose a supported selling strategy and venue.')
  if(!knownSaleCurrency(item.currency)||!knownSaleCurrency(scenario.currency)||scenario.currency!==item.currency)blockers.push('Confirm the item currency and use the same supported currency for this scenario; no GBP default or currency conversion is assumed.')
  const matches=comparables.filter(c=>c.id===scenario.comparableId&&c.item_id===item.id)
  const comp=matches.length===1?matches[0]:undefined
  if(!comp||!trustedComparableIds.includes(comp.id)||!achieved.has(comp.price_type)||!classifyComparables([comp])[0]?.verified||comp.currency!==scenario.currency)
    blockers.push('Select a source-reviewed achieved sale for this item in the same currency. Estimates and asks cannot support pricing.')
  if(!review.comparableReviewed)blockers.push('Review physical comparability, condition differences and the proposed price adjustment.')
  if(typeof scenario.priceAdjustment!=='string'||scenario.priceAdjustment.trim().length<40)blockers.push('Document the physical, condition and price-basis adjustment from the selected sale to this item’s gross range.')
  if(comp?.price_type==='REALIZED_INCL_BP'&&!safeSourceUrl(scenario.premiumAdjustmentSource))blockers.push('A premium-inclusive comparable needs a checked conversion source documenting its hammer/seller-gross basis; do not copy the buyer total.')
  if(!finiteNonnegative(scenario.daysLow)||!finiteNonnegative(scenario.daysHigh)||scenario.daysHigh<scenario.daysLow||!finiteNonnegative(scenario.workHours))
    blockers.push('Enter a sale-time range and practical workload estimate.')
  if(!safeSourceUrl(scenario.feeSource)||!safeSourceUrl(scenario.eligibilitySource)||!validReviewDate(scenario.checkedAt,today))
    blockers.push('Add current fee and eligibility source URLs and a review date within 30 days.')
  if(!scenario.eligibilityConfirmed||scenario.sellerStatus==='UNKNOWN')blockers.push('Confirm venue/category eligibility and private or business seller status.')
  if((item as Item&{acquisition_intent?:string}).acquisition_intent==='acquired_to_resell'&&scenario.sellerStatus!=='BUSINESS')
    blockers.push('Stock acquired for resale needs business seller economics.')
  if(!review.conditionReviewed||!item.condition_summary?.trim())blockers.push('Inspect and confirm a written condition report.')
  if(review.attribution==='UNRESOLVED')blockers.push('Resolve maker-dependent value or choose a generic description and matching generic comparables.')
  if(review.attribution==='DOCUMENTED_MAKER'&&(!research.finalDecision?.makerApproval||research.finalDecision.makerApproval.maker!==item.maker||!research.finalDecision.makerApproval.sourceRefs.includes(review.makerSource)||!research.finalDecision.sourceRefs.includes(review.makerSource)))blockers.push('Maker authentication requires explicit matching maker and documentary source approval in the independent final assessment. Choose a generic description until that support exists.')
  if(review.attribution==='DOCUMENTED_MAKER'&&(!item.maker?.trim()||!safeSourceUrl(review.makerSource)))
    blockers.push('A maker attribution requires a recorded maker and reviewed documentary source URL; a signature reading is insufficient.')
  if(review.specialistRisk)blockers.push('DO NOT LIST YET — SPECIALIST REVIEW: a material attribution/value question remains.')
  if(!scenario.shippingReviewed||!review.shippingInstructions.trim())blockers.push('Confirm collection arrangements or packing, delivery and actual cover/exclusions before listing.')
  if(item.status==='SOLD')blockers.push('This item is already sold; do not prepare another live listing.')
  if(netLow!==null&&netLow<=0)blockers.push('Conservative net proceeds are zero or negative; revise the route before recommending it.')
  return {scenario,netLow,netHigh,feesLow:validMoney?cents(scenario.grossLow!*scenario.feePercent!/100+scenario.fixedFee!):null,
    feesHigh:validMoney?cents(scenario.grossHigh!*scenario.feePercent!/100+scenario.fixedFee!):null,blockers,ready:blockers.length===0}
}
export function chooseSaleScenario(assessments:ScenarioAssessment[], objective:SellMode='FAST_CASH'):{recommendation:ScenarioAssessment|null; reason:string} {
  // Prefer the owner's declared strategy, then conservative net and lower workload. Sale times are assumptions, not guarantees.
  const usable=assessments.filter(x=>x.ready)
  const sameMode=usable.filter(x=>x.scenario.mode===objective)
  const pool=sameMode.length?sameMode:usable
  pool.sort((a,b)=>objective==='FAST_CASH'?
    a.scenario.daysHigh!-b.scenario.daysHigh!||b.netLow!-a.netLow!||a.scenario.workHours!-b.scenario.workHours!:
    b.netLow!-a.netLow!||a.scenario.workHours!-b.scenario.workHours!||a.scenario.daysHigh!-b.scenario.daysHigh!)
  const recommendation=pool[0]||null
  return {recommendation,reason:recommendation?
    `${recommendation.scenario.platform} is the best supported ${recommendation.scenario.mode.replaceAll('_',' ')} option entered: ${objective==='FAST_CASH'?'prioritises the shorter assumed sale window, with positive conservative net proceeds':'prioritises conservative net proceeds, then lower practical workload'}. ${sameMode.length?'':'No fully reviewed route matches the preferred strategy. '}Sale time and achieved price remain estimates.`:
    'Research or review is still required. No entered route has sufficient evidence and complete economics for a recommendation.'}
}
export function storedPublication(listing:StoredListing, itemId:string, ownerId?:string):'RECORDED_PUBLISHED'|'PUBLICATION_UNCONFIRMED'|'PREPARED'|'SOLD'|'ENDED'|'PAUSED' {
  if(listing.item_id!==itemId||(ownerId&&listing.owner_id!==ownerId))return 'PUBLICATION_UNCONFIRMED'
  if(listing.listing_status==='PUBLISHED')return safeSourceUrl(listing.listing_url)&&!!listing.listed_at&&Number.isFinite(Date.parse(listing.listed_at))?'RECORDED_PUBLISHED':'PUBLICATION_UNCONFIRMED'
  if(['SOLD','ENDED','PAUSED'].includes(listing.listing_status))return listing.listing_status as 'SOLD'|'ENDED'|'PAUSED'
  return ['DRAFT','READY'].includes(listing.listing_status)?'PREPARED':'PUBLICATION_UNCONFIRMED'
}
export function prepareListing(item:Item, assessment:ScenarioAssessment, review:ListingReview, comparables:Comparable[]):PreparedListing {
  const s=assessment.scenario
  const documentary=assessment.ready&&review.attribution==='DOCUMENTED_MAKER'&&!!item.maker?.trim()&&safeSourceUrl(review.makerSource)
  const nouns=[documentary?item.maker:null,item.colour,item.material,item.object_type||'Collectable object'].filter(Boolean)
  const title=nouns.join(' ').replace(/\s+/g,' ').trim()
  const condition=item.condition_summary?.trim()||'Condition needs inspection and a written report.'
  const description=[title+'.',`Condition: ${condition}`,item.marks_signatures_labels?`Recorded inscription / label: ${item.marks_signatures_labels}. Reading a mark does not authenticate a maker.`:'No maker mark is confirmed in this draft.',
    documentary?'Maker attribution uses the owner-reviewed documentary reference.':'Maker, origin and period are unconfirmed; no maker attribution is offered.',
    item.weight_g!=null?`Recorded unpacked weight: ${item.weight_g} g.`:'',
    item.dimensions?`Recorded dimensions: ${Object.entries(item.dimensions).map(([k,v])=>`${k}: ${String(v)}`).join('; ')}.`:'Dimensions to be confirmed.',
    `Shipping / collection: ${review.shippingInstructions||'Confirm before listing.'}`].filter(Boolean)
  const short=s.platform==='Vinted'||s.platform==='Direct collector / dealer'
  const photographsNeeded=['Clear hero photograph and all sides','Base, rim and each inscription in readable close-up','Every chip, crack, repair and uncertain feature','Dimensions with scale and the complete lot together','Before dispatch: item, wrapping, inner/outer box, label and carrier receipt']
  const outstandingChecks=[...assessment.blockers]
  if(!review.photosReviewed)outstandingChecks.push('Confirm complete original photographs, readable marks and condition images.')
  const comp=comparables.find(c=>c.id===s.comparableId&&c.item_id===item.id)
  return {status:outstandingChecks.length?'REVIEW_REQUIRED':'PREPARED',publicationStatus:'NOT_PUBLISHED',itemId:item.id,itemCode:item.item_code,
    platform:s.platform,mode:s.mode,currency:s.currency,title,
    description:(short?[description[0],...description.slice(1)]:[`Item / SKU: ${item.item_code}`,...description]).join('\n\n'),
    // A range is a scenario, not an invented exact market appraisal. Use the conservative endpoint as the reviewable target.
    recommendedPrice:assessment.ready?s.grossLow:null,recommendedPriceBasis:'ALL_IN_ITEM_PRICE_OR_COLLECTION',priceRange:{low:s.grossLow,high:s.grossHigh},expectedNet:{low:assessment.netLow,high:assessment.netHigh},
    itemSpecifics:{'Object type':item.object_type||'Unconfirmed','Material':item.material||'Unconfirmed','Colour':item.colour||'Unconfirmed','Maker':documentary?item.maker!:'Unconfirmed','Condition':condition,'SKU':item.item_code},
    keywords:[item.object_type,item.material,item.colour,documentary?item.maker:null].filter((x):x is string=>!!x),photographsNeeded,
    shippingInstructions:review.shippingInstructions||'Shipping / collection arrangements require confirmation.',comparableIds:comp?[comp.id]:[],
    sourceReferences:[comp?.source_url,s.feeSource,s.eligibilitySource,s.premiumAdjustmentSource,documentary?review.makerSource:null].filter((x):x is string=>safeSourceUrl(x)),outstandingChecks}
}
