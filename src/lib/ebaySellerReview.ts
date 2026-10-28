import type {Comparable,Item} from '../types'

export type EbayFormat='AUCTION_5_DAYS'|'AUCTION_7_DAYS'|'FIXED_PRICE'
export type EbayDraftReview={
 title:string;description:string;category:'Check eBay category';itemSpecifics:Record<string,string>
 format:EbayFormat;formatReason:string;verifiedSoldCount:number;soldKeywords:string[]
 photoGuidance:string[];checks:string[];listingStatus:'NOT_PUBLISHED'
}

const trim=(x:unknown,n=55)=>typeof x==='string'?x.trim().replace(/\s+/g,' ').slice(0,n):''
const unique=(x:string[])=>x.filter((v,i)=>v!==''&&x.findIndex(y=>y.toLowerCase()===v.toLowerCase())===i)
const safe=(v:unknown)=>trim(v).replace(/\b(?:amazing|bargain|l@@k|rare!!!)\b/gi,'').replace(/\s+/g,' ').trim()
const sizeText=(dim:Record<string,unknown>|null)=>{
 if(!dim)return''
 const entries=Object.entries(dim).filter(([k,v])=>/diameter|height|width|length|depth|inch|cm/i.test(k)&&
  (typeof v==='number'&&Number.isFinite(v)||typeof v==='string'&&/^\d+(?:\.\d+)?(?:\s*(?:cm|mm|in|inch|inches))?$/.test(v.trim())))
 return entries.length===1?String(entries[0][1])+(typeof entries[0][1]==='number'?' cm':''): ''
}
const titleParts=(item:Item,makerApproved:string|null,condition:string,extraKeywords:string[])=>{
 const parts=[makerApproved?safe(makerApproved):'',safe(item.object_type||item.title),safe(item.colour),sizeText(item.dimensions),makerApproved?safe(item.period_wording):'',safe(item.material),condition]
 return unique([...parts,...extraKeywords]).filter(Boolean)
}
function title80(parts:string[]):string{
 const words=parts.join(' ').replace(/\b(?:amazing|bargain|L@@K)\b/gi,'').replace(/\s+/g,' ').trim().split(/\s+/)
 const out:string[]=[]
 for(const word of words){
  if(!word||/^\W+$/.test(word))continue
  if(out.join(' ').length+word.length+(out.length?1:0)>80)break
  if(!out.some(w=>w.toLowerCase()===word.toLowerCase()))out.push(word)
 }
 return out.join(' ')
}
export function ebaySellerReview(item:Item,comparables:Comparable[],approvedMaker:string|null,photoCount:number):EbayDraftReview{
 // Only a source-reviewed, dated, reproducible eBay SOLD record is a market keyword source.
 const sold=comparables.filter(c=>c.item_id===item.id && c.verification_status==='VERIFIED_DIRECT' &&
  c.price_type==='MARKETPLACE_SOLD' && /ebay/i.test(c.venue) && !!c.source_url?.startsWith('https://') &&
  !!c.sale_date && Number.isFinite(Date.parse(c.sale_date)))
 const knownWords=unique([safe(item.object_type),safe(item.colour),safe(item.material),approvedMaker?safe(approvedMaker):'']
  .flatMap(s=>s.toLowerCase().split(/\s+/))).filter(s=>s.length>=4)
 const wordCounts=new Map<string,number>()
 for(const c of sold){
  const text=' '+c.description.toLowerCase().replace(/[^a-z0-9]+/g,' ')+' '
  for(const w of knownWords)if(text.includes(' '+w+' '))wordCounts.set(w,(wordCounts.get(w)||0)+1)
 }
 const soldKeywords=[...wordCounts].filter(([,n])=>n>=Math.min(sold.length,2)&&n>0).map(([w])=>w).slice(0,4)
 const condition=item.condition_summary?.trim()?'Used':''
 const title=title80(titleParts(item,approvedMaker,condition,soldKeywords))
 // Bid counts and formats must be documented; absent metadata cannot be fabricated.
 const records=sold as (Comparable&{listing_format?:string;bid_count?:number})[]
 const fixed=records.filter(c=>c.listing_format==='FIXED_PRICE').length
 const auctions=records.filter(c=>c.listing_format==='AUCTION'&&typeof c.bid_count==='number'&&c.bid_count>0).length
 let format:EbayFormat='AUCTION_7_DAYS',formatReason='Provisional: value or buyer demand is uncertain. Check genuine sold formats and bids before choosing a starting price.'
 if(sold.length>=3&&fixed>=2){format='FIXED_PRICE';formatReason='At least two source-reviewed eBay sold listings record fixed-price format. Confirm condition and price differences.'}
 else if(auctions>=2){format='AUCTION_7_DAYS';formatReason='At least two source-reviewed eBay auctions have recorded bids. Seven days is proposed; verify sale outcomes and demand.'}
 const itemSpecifics={
  'Category':'Check this — select the correct eBay category first',
  'Maker / Brand':approvedMaker||'Check this — attribution unconfirmed',
  'Type':safe(item.object_type)||'Check this',
  'Colour':safe(item.colour)||'Check this',
  'Material':safe(item.material)||'Check this',
  'Pattern':'Check this — do not invent a pattern',
  'Size':sizeText(item.dimensions)||'Check this — measure it',
  'Era':approvedMaker&&item.period_wording?safe(item.period_wording):'Check this — age unconfirmed',
  'Condition':condition||'Check this — examine the item',
  'MPN / product code':'Check this — only supply a code visible on the item or documented',
  'UPC / EAN':'Check this — only supply a verified code'
 }
 const checks=[
  'Check this: category and every relevant required or optional item specific',
  'Check this: inspect all chips, scratches, repairs, marks and measurements',
  'Check this: photograph dimensions — aim for 1600px; eBay minimum is 500px',
  'Check this: confirm original photo order and the plain main background',
  ...(approvedMaker?[]:['Check this: maker and date are unconfirmed; do not state them as fact']),
  ...(sold.length?[]:['No verified eBay SOLD listings available; no asking price supported']),
  'Check this: choose price and postage only after reviewing actual sold comparables and costs'
 ]
 const description=[
  safe(item.object_type||item.title)||'Collectable item',
  'Colour / material: '+[safe(item.colour),safe(item.material)].filter(Boolean).join(', ')+'.',
  'Condition: '+(item.condition_summary?.trim()||'Inspect the item in person. Condition not yet confirmed.'),
  'Dimensions: '+(sizeText(item.dimensions)||'Check this — measure before listing')+'.',
  'Maker / age: '+(approvedMaker?approvedMaker+' (review documented evidence)':'Check this — maker and age unconfirmed')+'.',
  'Photographs: '+photoCount+' original photos linked; check every flaw and show scale.',
  /glass/i.test([item.material,item.category,item.object_type].join(' '))?
   'Packing: fragile glass. Double-box with generous padding, immobilise the piece and check carrier breakage cover.':'Packing: protect the item thoroughly; confirm carrier cover.',
  'This is a draft. Nothing is listed or published.'
 ].join('\n\n')
 const photoGuidance=[
  'Use up to 24 original photographs (eBay allows 24 free).',
  'Aim for at least 1600 pixels; do not claim that uploaded photos have been measured.',
  'Plain uncluttered first photo: whole item, no text, borders or watermarks.',
  'Show a ruler/scale, the base and marks, and clear close-ups of every flaw.'
 ]
 return {title,description,category:'Check eBay category',itemSpecifics,format,formatReason,verifiedSoldCount:sold.length,soldKeywords,photoGuidance,checks,listingStatus:'NOT_PUBLISHED'}
}
export function formatEbaySellerHandoff(draft:EbayDraftReview):string{
 return ['eBay listing review — NOT PUBLISHED','Title (max 80 characters): '+draft.title,
 'Selling format: '+draft.format.replaceAll('_',' '),'Reason: '+draft.formatReason,
 'Category: '+draft.category,'Verified eBay sold listings: '+draft.verifiedSoldCount,
 'Buyer search words supported by sold listings: '+(draft.soldKeywords.join(', ')||'None independently verified'),
 '',draft.description,'','Item specifics:',...Object.entries(draft.itemSpecifics).map(([k,v])=>k+': '+v),
 '','Photos:',...draft.photoGuidance,'','Before publishing:',...draft.checks,
 'Private seller UK: ordinary sales generally have no final value fee within the monthly listing allowance; exceptions and overseas fees apply.',
 'Buyer Protection fee is included in the shown item price/bid on eBay, not a surprise checkout surcharge.',
 'Not-as-described or damaged claims may require a refund even when no returns are offered.',
 'Platform reporting to HMRC is not itself a new tax.']
 .join('\n')
}
