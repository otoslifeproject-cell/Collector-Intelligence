import type {GoogleFirstLook} from './googleFirstLook'

// One finished answer from the saved research. Sold and asking prices are never
// merged; model-reported sales stay "not independently checked".
const SOLD=new Set(['HAMMER_REALIZED','REALIZED_INCL_BP','MARKETPLACE_SOLD','DEALER_SOLD_CONFIRMED','INDEXED_SOLD_NOT_DIRECTLY_VERIFIED'])
const ASKING=new Set(['DEALER_ASKING','MARKETPLACE_ASKING','DEALER_ARCHIVED_LAST_ASK_ACHIEVED_UNKNOWN'])
const READINESS:Record<string,string>={
 SELL_NOW:'Ready to list',
 ONE_QUICK_CHECK_THEN_SELL:'One quick check, then list',
 RESEARCH_FIRST:'Do the checks below before listing',
 SPECIALIST_REVIEW:'Get a specialist opinion before selling'
}
const concise=(value:unknown,limit=110)=>{
 const text=String(value??'').replace(/\s+/g,' ').trim()
 return text.length>limit?text.slice(0,limit).trimEnd()+'…':text
}
const currencyOk=(code:string)=>{try{new Intl.NumberFormat('en-GB',{style:'currency',currency:code}).format(1);return true}catch{return false}}
const fmt=(n:number,c:string)=>new Intl.NumberFormat('en-GB',{style:'currency',currency:c,maximumFractionDigits:0}).format(n)

export type PriceLead={price:number;currency:string;venue:string;url:string|null;type:string}
export type ResearchAnswer={
 identity:string
 identityBasis:string
 google:string
 sold:string
 soldBasis:string
 asking:string|null
 range:string|null
 venue:string
 decision:string
 checks:string[]
 soldLeads:PriceLead[]
 quick:boolean
 triage:'FULL_RESEARCH_WORTH_IT'|'LOW_VALUE'|'UNCLEAR'|null
 triageText:string|null
}
const TRIAGE:Record<string,string>={
 FULL_RESEARCH_WORTH_IT:'Worth full research',
 LOW_VALUE:'Low value: sell quickly',
 UNCLEAR:'Unclear: full research could help'
}

function priceLeads(comps:any[],types:Set<string>):PriceLead[]{
 return comps.filter(c=>c&&types.has(c.price_type)&&typeof c.price==='number'&&Number.isFinite(c.price)&&c.price>=0
   &&typeof c.currency==='string'&&currencyOk(c.currency))
  .map(c=>({price:c.price,currency:c.currency,venue:concise(c.venue,60)||'Source',
   url:typeof c.source_url==='string'&&/^https:\/\/[^\s]+$/i.test(c.source_url)?c.source_url:null,type:c.price_type}))
}
function rangeText(leads:PriceLead[]):{text:string;count:number}|null{
 if(!leads.length)return null
 const counts=new Map<string,number>()
 for(const l of leads)counts.set(l.currency,(counts.get(l.currency)||0)+1)
 const currency=[...counts.entries()].sort((a,b)=>b[1]-a[1])[0][0]
 const prices=leads.filter(l=>l.currency===currency).map(l=>l.price)
 const low=Math.min(...prices),high=Math.max(...prices)
 return {text:low===high?fmt(low,currency):fmt(low,currency)+'–'+fmt(high,currency),count:prices.length}
}
const confidence=(value:unknown)=>{
 const n=typeof value==='number'?value:NaN
 if(!Number.isFinite(n))return 'confidence not stated'
 if(n>=80)return 'strong lead'
 if(n>=55)return 'moderate lead'
 return 'weak lead'
}

export function researchAnswer(research:any,fallbackTitle:string):ResearchAnswer{
 const id=research?.identification_update||{}
 const val=research?.valuation||{}
 const route=research?.routing||{}
 const comps=Array.isArray(research?.comparables)?research.comparables:[]
 const look:GoogleFirstLook|null=research?.google_first_look||null
 const name=concise(id.attribution||id.maker||fallbackTitle||'Unidentified collectable',120)
 const period=concise(id.period_wording,40)
 const identity=name+(period&&!name.toLowerCase().includes(period.toLowerCase())?' · '+period:'')
 const identityBasis=confidence(id.identification_confidence)+' · not authenticated'
 const lensMatches=look?.lens?.status==='CALLED'?look.lens.matches:[]
 const google=!look?'Google check not run for this research'
  :look.status!=='CALLED'?'Google check not run: '+(look.reason||'no reason recorded')
  :lensMatches.length?'Google Lens: '+concise(lensMatches[0].title,70)+' · '+lensMatches.length+' visual match'+(lensMatches.length===1?'':'es')
  :'Google: '+(look.best_guess[0]||look.entities[0]?.description||'no clear match')+' · '+look.pages.length+' matching page'+(look.pages.length===1?'':'s')
 const soldLeads=priceLeads(comps,SOLD)
 const sold=rangeText(soldLeads)
 const asking=rangeText(priceLeads(comps,ASKING))
 const currency=typeof val.currency==='string'&&currencyOk(val.currency)?val.currency:'GBP'
 const low=Number.isFinite(val.balanced_low)?val.balanced_low:null,high=Number.isFinite(val.balanced_high)?val.balanced_high:null
 const quick=research?.research_depth==='quick'
 const triageDecision=typeof research?.triage?.decision==='string'&&TRIAGE[research.triage.decision]?research.triage.decision:null
 const triageText=triageDecision?TRIAGE[triageDecision]+(research.triage.reason?' · '+concise(research.triage.reason,140):''):null
 return {
  identity,identityBasis,google,quick,triage:triageDecision,triageText,
  sold:sold?'Sold: '+sold.text+' ('+sold.count+' result'+(sold.count===1?'':'s')+')':'No sold prices found',
  soldBasis:sold?'Sources listed in Research · not independently checked':'Asking prices are not sales',
  asking:asking?'Asking: '+asking.text+' ('+asking.count+' listing'+(asking.count===1?'':'s')+', not sales)':null,
  range:low!==null&&high!==null?'Provisional range '+fmt(low,currency)+'–'+fmt(high,currency):null,
  venue:concise(route.best_venue,90)||'Not established yet',
  decision:quick&&triageDecision?TRIAGE[triageDecision]:READINESS[route.sale_readiness]||'Do the checks below before listing',
  checks:(Array.isArray(research?.next_evidence)?research.next_evidence:[]).map((x:any)=>concise(x?.title,90)).filter(Boolean).slice(0,3),
  soldLeads
 }
}

// Moving tracker for a research run. The server reports no sub-stages, so the
// steps advance by elapsed time; "Ready" only appears when the saved result exists.
export const RESEARCH_STEPS=['Google check','Identifying','Searching sold prices','Nearly there'] as const
export function researchStep(elapsedMs:number):number{
 if(elapsedMs<15000)return 0
 if(elapsedMs<45000)return 1
 if(elapsedMs<120000)return 2
 return 3
}

// The owner's end article (result screen): titles in marketplace format and a price.
export function resultListing(research:any,fallbackTitle:string){
 const l=research?.listing||{}
 const fit=(s:unknown,n:number)=>{const v=String(s??'').replace(/\s+/g,' ').trim();if(v.length<=n)return v;const cut=v.slice(0,n);const at=cut.lastIndexOf(' ');return (at>n*0.6?cut.slice(0,at):cut).trim()}
 const val=research?.valuation||{}
 const currency=typeof l.currency==='string'&&currencyOk(l.currency)?l.currency:'GBP'
 // Always a price to list at: the research suggestion, else the provisional range,
 // else the middle of what similar items are sold or asked at.
 const comps=Array.isArray(research?.comparables)?research.comparables:[]
 const leads=priceLeads(comps,SOLD),asks=priceLeads(comps,ASKING)
 const middle=(xs:PriceLead[])=>{const gbp=xs.filter(x=>x.currency==='GBP').map(x=>x.price).sort((a,b)=>a-b);return gbp.length?gbp[Math.floor((gbp.length-1)/2)]:null}
 const valCur=typeof val.currency==='string'&&currencyOk(val.currency)?val.currency:'GBP'
 let price:string|null=null,priceBasis:string|null=null
 if(typeof l.price==='number'&&Number.isFinite(l.price)){price=fmt(l.price,currency);priceBasis=leads.length?'Based on '+leads.length+' sold result'+(leads.length===1?'':'s'):asks.length?'Based on similar items for sale':'Suggested listing price'}
 else if(Number.isFinite(val.balanced_low)&&Number.isFinite(val.balanced_high)){price=fmt(val.balanced_low,valCur)+'–'+fmt(val.balanced_high,valCur);priceBasis='Provisional range'}
 else if(middle(leads)!==null){price=fmt(middle(leads) as number,'GBP');priceBasis='Middle of '+leads.length+' sold result'+(leads.length===1?'':'s')}
 else if(middle(asks)!==null){price=fmt(Math.round((middle(asks) as number)*0.9),'GBP');priceBasis='Just under similar items for sale'}
 const format=l.sale_format==='AUCTION'?'Auction'+(typeof l.auction_start==='number'&&Number.isFinite(l.auction_start)?' · start '+fmt(l.auction_start,currency):'')
  :l.sale_format==='FIXED_PRICE'?'Buy it now':null
 const checks=(Array.isArray(l.title_checks)&&l.title_checks.length?l.title_checks:(Array.isArray(research?.next_evidence)?research.next_evidence.map((x:any)=>x?.title):[]))
  .map((x:any)=>concise(x,90)).filter(Boolean).slice(0,3)
 return {
  ebayTitle:fit(l.ebay_title||fallbackTitle||'Collectable item',80),
  etsyTitle:l.etsy_title?fit(l.etsy_title,140):null,
  etsyReason:typeof l.etsy_reason==='string'?concise(l.etsy_reason,120):null,
  price,priceBasis,format,checks,
  description:typeof l.description==='string'&&l.description.trim()?l.description.trim().slice(0,2500):null,
  stillChecking:research?.research_depth==='quick'&&research?.triage?.decision==='LOW_VALUE'
 }
}
