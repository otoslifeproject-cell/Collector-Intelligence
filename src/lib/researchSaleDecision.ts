// Evidence-gated research tracker. Tasks describe observable executions, not AI claims.
export const researchTypes=[
 'PHOTOGRAPH_EXAM','SIGNATURE_READING','MAKER_ARCHIVE','AUCTION_REALISED',
 'MARKETPLACE_SOLD','CONDITION_REVIEW','SALES_ECONOMICS'
] as const
export type ResearchType=typeof researchTypes[number]
export type ResearchStatus='NOT_RUN'|'RUNNING'|'DONE_EVIDENCED'|'INCONCLUSIVE'|'FAILED'|'BLOCKED'|'RECEIPT_MISSING'
export type ResearchReceipt={type:ResearchType;status:ResearchStatus;runId?:string;sourceRefs?:string[];checkedAt?:string;detail?:string;confidence?:number|null}
export type ResearchAudit={complete:number;total:number;percent:number;receipts:ResearchReceipt[];unresolved:ResearchType[]}
const terminal=new Set<ResearchStatus>(['DONE_EVIDENCED','INCONCLUSIVE','FAILED','BLOCKED'])
export function auditResearch(input:ResearchReceipt[]):ResearchAudit{
 const receipts=researchTypes.map(type=>{
  const matching=input.filter(x=>x.type===type)
  const row=matching.length===1?matching[0]:undefined
  if(matching.length>1)return {type,status:'INCONCLUSIVE' as ResearchStatus,detail:'Conflicting receipts; original history retained for review'}
  if(!row)return {type,status:'NOT_RUN' as ResearchStatus}
  if(row.status==='DONE_EVIDENCED'&&(!row.runId||!row.checkedAt||!row.sourceRefs?.some(x=>typeof x==='string'&&x.trim().length>0)))
   return {...row,status:'INCONCLUSIVE' as ResearchStatus,detail:'Completion lacks traceable source and execution receipt'}
  if(terminal.has(row.status)&&!row.runId)
   return {...row,status:'RECEIPT_MISSING' as ResearchStatus,detail:'Missing execution receipt; not proof the work was never attempted'}
  return row
 })
 const complete=receipts.filter(x=>x.status==='DONE_EVIDENCED').length
 return {complete,total:researchTypes.length,percent:Math.floor(100*complete/researchTypes.length),
  receipts,unresolved:receipts.filter(x=>x.status!=='DONE_EVIDENCED').map(x=>x.type)}
}
export type SaleRoute={venue:string;mode:'FAST_CASH'|'BALANCED'|'MAX_VALUE';grossLow:number;grossHigh:number;feeRate:number;fixedCosts:number;shippingRisk:'LOW'|'MEDIUM'|'HIGH';daysToSaleLow:number;daysToSaleHigh:number;sourceRefs:string[];eligible:boolean;priceBasis?:'AUCTION_REALISED'|'MARKETPLACE_SOLD'|'DEALER_ASKING'|'MARKETPLACE_ASKING'|'UNVERIFIED';feeCheckedAt?:string}
export type RouteDecision={status:'RESEARCH_FIRST'|'ONE_QUICK_CHECK_THEN_SELL'|'SELL_NOW';recommendation:SaleRoute|null;netLow:number|null;netHigh:number|null;ranked:{route:SaleRoute;netLow:number;netHigh:number}[];warnings:string[]}
/** Legacy scenario calculator. Final readiness is governed by sellFastPlan's
 * source-linked final assessment, never this older aggregate-receipt helper. */
export function recommendSaleRoutes(audit:ResearchAudit,routes:SaleRoute[],signedMakerConfirmed:boolean):RouteDecision{
 const warnings:string[]=[]
 const validated=routes.filter(r=>r.eligible&&r.sourceRefs?.some(x=>typeof x==='string'&&x.trim().length>0)&&
  [r.grossLow,r.grossHigh,r.feeRate,r.fixedCosts,r.daysToSaleLow,r.daysToSaleHigh].every(Number.isFinite)&&
  r.grossLow>=0&&r.grossHigh>=r.grossLow&&r.feeRate>=0&&r.feeRate<=1&&r.fixedCosts>=0&&
  r.daysToSaleLow>=0&&r.daysToSaleHigh>=r.daysToSaleLow&&r.venue?.trim()&&
  ['AUCTION_REALISED','MARKETPLACE_SOLD'].includes(r.priceBasis||'')&&!!r.feeCheckedAt?.trim()&&
  ['FAST_CASH','BALANCED','MAX_VALUE'].includes(r.mode))
 const ranked=validated.map(route=>({route,netLow:Math.round((route.grossLow*(1-route.feeRate)-route.fixedCosts)*100)/100,netHigh:Math.round((route.grossHigh*(1-route.feeRate)-route.fixedCosts)*100)/100}))
  .sort((a,b)=> ((b.netLow+b.netHigh)/2)-((a.netLow+a.netHigh)/2))
 const evidence=audit.receipts
 const soldEvidence=evidence.some(x=>['AUCTION_REALISED','MARKETPLACE_SOLD'].includes(x.type)&&x.status==='DONE_EVIDENCED')
 const condition=evidence.find(x=>x.type==='CONDITION_REVIEW')?.status==='DONE_EVIDENCED'
 if(!signedMakerConfirmed)warnings.push('Signature reading does not confirm maker authenticity; describe signed mark without unsupported attribution')
 if(!soldEvidence)warnings.push('No verified SOLD/REALISED evidence: estimates and asking prices cannot establish resale')
 if(!condition)warnings.push('Condition verification incomplete')
 if(!ranked.length)warnings.push('No eligible route with verified realised/sold price basis and dated fee assumptions')
 warnings.push('Scenario ranking is provisional. Complete all available checks and a source-reviewed final item assessment before a selling recommendation.')
 return {status:'RESEARCH_FIRST',recommendation:null,netLow:null,netHigh:null,ranked,warnings}
}
