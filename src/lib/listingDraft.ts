import type {SupabaseClient} from '@supabase/supabase-js'
import type {Item} from '../types'
import type {ListingReview,PreparedListing,SaleScenario,SellMode} from './sellFastPlan'
import {knownSaleCurrency,salePlatforms,sellModes} from './sellFastPlan.ts'
export type SaleReviewDraft={format:'collector-sale-review-v1';itemId:string;ownerId:string;facts:Item;scenarios:SaleScenario[];review:ListingReview;objective:SellMode;draftMode:SellMode;listing:PreparedListing;capturedAt:string}
export type ListingDraftRequest={id:string;ownerId:string;itemId:string;row:Record<string,unknown>}
const freeze=<T,>(v:T):T=>{if(v&&typeof v==='object'){for(const x of Object.values(v))freeze(x);Object.freeze(v)}return v}
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
const stable=(v:unknown):string=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x)
export function restoreListingDraft(row:any,item:Item):SaleReviewDraft|null{
 const p=row?.item_specifics?.collector_sale_review_v1
 if(row?.owner_id!==item.owner_id||row?.item_id!==item.id||row?.listing_status!=='DRAFT'||!p||p.format!=='collector-sale-review-v1'||p.itemId!==item.id||p.ownerId!==item.owner_id||stable(p.facts)!==stable(item)||!knownSaleCurrency(item.currency))return null
 if(!Array.isArray(p.scenarios)||p.scenarios.length!==3||new Set(p.scenarios.map((s:any)=>s?.mode)).size!==3||!sellModes.includes(p.objective)||!sellModes.includes(p.draftMode))return null
 for(const s of p.scenarios){
  if(!sellModes.includes(s.mode)||!salePlatforms.includes(s.platform)||s.currency!==item.currency)return null
  for(const k of ['grossLow','grossHigh','feePercent','fixedFee','packing','delivery','insurance','returnAllowance','daysLow','daysHigh','workHours'])if(s[k]!==null&&(typeof s[k]!=='number'||!Number.isFinite(s[k])||s[k]<0))return null
  for(const k of ['comparableId','feeSource','eligibilitySource','checkedAt','sellerStatus','deliveryMethod','grossBasis','priceAdjustment','premiumAdjustmentSource'])if(typeof s[k]!=='string')return null
  if(typeof s.shippingReviewed!=='boolean'||typeof s.eligibilityConfirmed!=='boolean')return null
 }
 if(!p.review||!['UNRESOLVED','GENERIC','DOCUMENTED_MAKER'].includes(p.review.attribution)||typeof p.review.makerSource!=='string'||typeof p.review.shippingInstructions!=='string'||['conditionReviewed','comparableReviewed','photosReviewed','specialistRisk'].some(k=>typeof p.review[k]!=='boolean'))return null
 return JSON.parse(JSON.stringify(p))
}
export function prepareListingDraft(item:Item,payload:SaleReviewDraft,id=crypto.randomUUID()):ListingDraftRequest{
 if(!uuid.test(id)||!uuid.test(item.id)||!uuid.test(item.owner_id)||!knownSaleCurrency(item.currency)||payload.itemId!==item.id||payload.ownerId!==item.owner_id||stable(payload.facts)!==stable(item)||payload.listing.publicationStatus!=='NOT_PUBLISHED')throw Error('Review the current item facts and confirmed currency before saving a listing draft.')
 const row={id,owner_id:item.owner_id,item_id:item.id,platform:payload.listing.platform,listing_status:'DRAFT',listing_url:null,listed_at:null,strategy:payload.draftMode,canonical_title:item.title||item.object_type,platform_title:payload.listing.title,description:payload.listing.description,condition_report:item.condition_summary,keywords:payload.listing.keywords,currency:item.currency,asking_price:payload.listing.recommendedPrice,expected_net_sale_proceeds:null,item_specifics:{...payload.listing.itemSpecifics,collector_sale_review_v1:payload}}
 if(!restoreListingDraft(row,item))throw Error('The review-draft assumptions could not be validated; export them for review.')
 return freeze(JSON.parse(JSON.stringify({id,ownerId:item.owner_id,itemId:item.id,row})))
}
export async function settleListingDraft(client:SupabaseClient,request:ListingDraftRequest,current:()=>boolean,submit:boolean){
 const auth=async()=>{if(!current())throw Error('This object is no longer selected.');const a=await client.auth.getUser();if(!current()||a.error||a.data.user?.id!==request.ownerId)throw Error('Sign in as this object’s owner to confirm the review draft.')}
 await auth()
 const inspect=async()=>{
  const r=await client.from('listings').select('*',{count:'exact'}).eq('id',request.id).eq('owner_id',request.ownerId).eq('item_id',request.itemId).limit(2).abortSignal(AbortSignal.timeout(20000))
  await auth();if(r.error||!r.data||r.count===null||r.count!==r.data.length||r.count>1)throw Error('The draft save could not be read back. Keep this page open and Check saved review draft before retrying.')
  const row=r.data[0];if(row&&Object.entries(request.row).some(([k,v])=>stable(v)!==stable(row[k])))throw Error('The held event does not match the stored review draft. Original records were not overwritten.')
  return row||null
 }
 const existing=await inspect();if(existing||!submit)return existing
 if(!uuid.test(request.id)||request.row.listing_status!=='DRAFT'||request.row.listing_url!==null||request.row.owner_id!==request.ownerId||request.row.item_id!==request.itemId)throw Error('Invalid review draft; no write attempted.')
 try{await client.from('listings').insert(request.row).abortSignal(AbortSignal.timeout(20000))}catch{/* Only an independent readback confirms saving. */}
 return inspect()
}
