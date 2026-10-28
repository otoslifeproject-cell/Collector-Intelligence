export type SaleEvidence = {
  price?: number | null
  price_type?: string | null
  verification_status?: string | null
  currency?: string | null
  sale_date?: string | null
  source_url?: string | null
  venue?: string | null
}
export type MiniAppraisalInput = {
  objectType?: string | null
  workingTitle?: string | null
  identificationConfidence?: number | null
  valuationConfidence?: number | null
  status?: string | null
  readyToList?: boolean
  period?: string | null
  verifiedSales?: SaleEvidence[]
  sourceReviewedVenue?: string | null
}
const achieved = new Set(['HAMMER_REALIZED','REALIZED_INCL_BP','MARKETPLACE_SOLD','DEALER_SOLD_CONFIRMED'])
const concise=(value:string|null|undefined,limit=88)=>String(value||'').replace(/\s+/g,' ').trim().slice(0,limit)
const currencyValid=(code:string)=>{try{return !!new Intl.NumberFormat('en-GB',{style:'currency',currency:code}).format(1)}catch{return false}}
export function approvedSoldEvidence(rows:SaleEvidence[]=[]):SaleEvidence[]{
  return rows.filter(row=>Number.isFinite(row.price)&&Number(row.price)>=0
    &&achieved.has(row.price_type||'')
    &&row.verification_status==='VERIFIED_DIRECT'
    &&!!row.source_url&&/^https:\/\/[^\s]+$/i.test(row.source_url)
    &&!!row.sale_date&&!Number.isNaN(Date.parse(row.sale_date))
    &&!!row.currency&&currencyValid(row.currency))
}
const confidenceWord=(value:number|null|undefined)=>{
 if(typeof value!=='number'||!Number.isFinite(value))return 'confidence not established'
 if(value>=80)return 'higher identification confidence'
 if(value>=55)return 'moderate identification confidence'
 return 'low identification confidence'
}
function marketplace(venue:string|null|undefined):string|null{
 const v=String(venue||'').toLowerCase()
 if(v.includes('ebay'))return 'eBay'
 if(v.includes('etsy'))return 'Etsy'
 if(v.includes('auction')||v.includes('bonhams')||v.includes('christies')||v.includes('sotheby'))return 'Specialist auction'
 if(v.includes('local')||v.includes('collection'))return 'Local'
 return null
}
export function miniAppraisal(input:MiniAppraisalInput){
 const sold=approvedSoldEvidence(input.verifiedSales)
 // Never collapse auction hammer, premium-inclusive, and marketplace sold into
 // one undifferentiated price range. Each achieved-price basis is distinct.
 const priceGroups=new Map<string,number[]>()
 for(const row of sold){
  const key=(row.currency||'')+'|'+row.price_type
  priceGroups.set(key,[...(priceGroups.get(key)||[]),Number(row.price)])
 }
 const selected=[...priceGroups.entries()].sort((a,b)=>b[1].length-a[1].length)[0]
 const [currency,priceType]=selected?selected[0].split('|'):['','']
 const basis:Record<string,string>={
  HAMMER_REALIZED:'auction hammer',
  REALIZED_INCL_BP:'buyer-premium-inclusive realised',
  MARKETPLACE_SOLD:'marketplace sold',
  DEALER_SOLD_CONFIRMED:'confirmed dealer sale'
 }
 const fmt=(n:number,c:string)=>new Intl.NumberFormat('en-GB',{style:'currency',currency:c}).format(n)
 const worth=selected?
  'Verified '+basis[priceType]+': '+fmt(Math.min(...selected[1]),currency)+'–'+fmt(Math.max(...selected[1]),currency):
  'No sold prices found yet'
 const worthBasis=selected
  ? 'Observed '+basis[priceType]+' only, not a valuation or promised asking price.'
  : 'Check one matching completed eBay sale or auction result.'
 const itemType=concise(input.objectType)||concise(input.workingTitle)||'Unidentified collectable'
 const identity=itemType+' · '+confidenceWord(input.identificationConfidence)
 const ready=!!input.readyToList&&input.status!=='SOLD'&&input.status!=='ARCHIVED'
 const status=input.status==='SOLD'?'Keep':ready?'Sell':'Check'
 let venue:string
 const chosen=ready&&sold.length?marketplace(input.sourceReviewedVenue)||marketplace(sold[0].venue):null
 if(chosen==='Etsy'){
   // Era text from visual inference alone cannot establish Etsy vintage eligibility.
   venue='eBay · Etsy vintage age must be independently confirmed (20+ years).'
 }else if(chosen){
   venue=chosen+' · based on the source-reviewed sale route; check fees and net.'
 }else if(input.status==='SPECIALIST_REVIEW'){
   venue='Specialist auction · seek an appraisal before offering for sale.'
 }else if(/(?:lamp|furniture|mirror|large|heavy)/i.test(itemType)){
   venue='Local · easier in-person condition inspection; provisional route.'
 }else{
   venue='eBay · broad second-hand audience; route not yet price-validated.'
 }
 return {identity,worth,worthBasis,decision:status,venue,hasVerifiedSold:sold.length>0,
   isReady:ready,valuationConfidence:input.valuationConfidence,
   etsyAgeUnconfirmed:!input.period||/unknown|unconfirmed|likely|possible|undated|could|not established/i.test(input.period)}
}
