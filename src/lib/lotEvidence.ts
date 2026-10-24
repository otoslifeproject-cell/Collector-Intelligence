// Existing independently fetched achieved sources plus a distinct controlled
// review of the whole composition. Never accepts owner notes as qualification.
import type {SupabaseClient} from '@supabase/supabase-js'
import {immutableLotComparable} from './lotOptimizer.ts'
import type {LotComparable} from './lotOptimizer'
export type QualifiedLotComparable=LotComparable&{sourceItemId:string;targetItemIds:string[];compositionRelationship:string;reviewedAt:string;reviewerId:string;compositionRationale:string;sourceSnapshotSha256:string}
export type StoredLotCompositionReview={id:string;owner_id:string;comparable_id:string;client_event_id:string;reviewer_id:string;decision:'CONFIRMED'|'WITHDRAWN';composition:Record<string,unknown>;rationale:string;source_snapshot:Record<string,unknown>|null;source_snapshot_sha256:string|null;reviewed_at:string}
export type LotEvidence={ownerId:string;comparables:QualifiedLotComparable[];qualifiedComparableIds:string[];reviews:StoredLotCompositionReview[]}
const uuid=/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i,sha=/^[a-f\d]{64}$/
const text=(x:unknown,min=1):x is string=>typeof x==='string'&&x.trim().length>=min
const timestamp=(x:unknown)=>typeof x==='string'&&Number.isFinite(Date.parse(x))
const plain=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x)
const fail=():never=>{throw Error('Complete independently reviewed lot evidence could not be confirmed. Reload sources; missing evidence is not an empty verified result.')}
export function parseQualifiedLotComparable(row:any,ownerId:string):QualifiedLotComparable{
 if(!row||row.owner_id!==ownerId||!uuid.test(row.source_item_id)||!Array.isArray(row.target_item_ids)||row.target_item_ids.length!==row.quantity||new Set(row.target_item_ids).size!==row.quantity||row.target_item_ids.some((id:unknown)=>typeof id!=='string'||!uuid.test(id))||!row.target_item_ids.includes(row.source_item_id)||!['SINGLE_OBJECT','MATCHED_ORIGINAL_SET','SAME_MAKER_PATTERN','THEMED_CURATED','MIXED_CLEARANCE'].includes(row.composition_relationship)||row.quantity===1&&row.composition_relationship!=='SINGLE_OBJECT'||row.quantity>1&&row.composition_relationship==='SINGLE_OBJECT'||!uuid.test(row.composition_review_id)||!uuid.test(row.reviewer_id)||row.reviewer_id===ownerId||!timestamp(row.reviewed_at)||!text(row.composition_rationale,40)||!sha.test(row.source_snapshot_sha256)||row.unit_price!==null||!['HAMMER_REALIZED','REALIZED_INCL_BP','MARKETPLACE_SOLD','DEALER_SOLD_CONFIRMED'].includes(row.price_type)||!/^\d{4}-\d{2}-\d{2}$/.test(row.sale_date)||!Number.isFinite(Date.parse(row.sale_date))||new Date(row.sale_date).toISOString().slice(0,10)!==row.sale_date||row.sale_date>new Date().toISOString().slice(0,10))return fail()
 try{const comparable=immutableLotComparable({id:row.id,ownerId,sourceUrl:row.source_url,sourceReference:row.source_reference,venue:row.venue,saleDate:row.sale_date,currency:row.currency,totalPrice:typeof row.total_price==='number'?row.total_price:null,priceType:row.price_type,quantity:row.quantity,members:row.members,unitPrice:null,compositionReviewId:row.composition_review_id,...(row.conversion_source?{conversionSource:row.conversion_source}:{})})
  if(comparable.totalPrice===null)return fail()
  return {...comparable,sourceItemId:row.source_item_id,targetItemIds:[...row.target_item_ids],compositionRelationship:row.composition_relationship,reviewedAt:row.reviewed_at,reviewerId:row.reviewer_id,compositionRationale:row.composition_rationale,sourceSnapshotSha256:row.source_snapshot_sha256}
 }catch{return fail()}
}
export async function readLotEvidence(client:SupabaseClient,current:()=>boolean):Promise<LotEvidence>{
 const active=()=>{if(!current())throw Error('This collection or signed-in account is no longer selected.')};active()
 const auth=await client.auth.getUser();active();if(auth.error||!auth.data.user?.id)return fail();const ownerId=auth.data.user.id
 const read=async(table:string,order:string)=>{const rows:any[]=[];let total:number|undefined
  do{const r=await client.from(table).select('*',{count:'exact'}).eq('owner_id',ownerId).order(order,{ascending:true}).order('id',{ascending:true}).range(rows.length,rows.length+99).abortSignal(AbortSignal.timeout(20000));active()
   if(r.error||!r.data||r.count===null||r.count<0||r.count>1000||total!==undefined&&r.count!==total||r.data.length!==Math.min(100,r.count-rows.length))return fail()
   total=r.count;rows.push(...r.data)
  }while(rows.length<total)
  if(new Set(rows.map(r=>r.id)).size!==rows.length||rows.some(r=>r.owner_id!==ownerId))return fail();return rows
 }
 const [sources,history]=await Promise.all([read('trusted_lot_comparables_v1','reviewed_at'),read('comparable_lot_composition_reviews','reviewed_at')]);active()
 const comparables=sources.map(row=>parseQualifiedLotComparable(row,ownerId))
 if(history.some(r=>!uuid.test(r.id)||!uuid.test(r.comparable_id)||!uuid.test(r.client_event_id)||!uuid.test(r.reviewer_id)||r.reviewer_id===ownerId||!['CONFIRMED','WITHDRAWN'].includes(r.decision)||!plain(r.composition)||!text(r.rationale,40)||!timestamp(r.reviewed_at)||r.decision==='CONFIRMED'&&(!plain(r.source_snapshot)||!sha.test(r.source_snapshot_sha256))))return fail()
 if(comparables.some(c=>{const latest=history.filter(r=>r.comparable_id===c.id).sort((a,b)=>b.reviewed_at.localeCompare(a.reviewed_at)||b.id.localeCompare(a.id))[0];return !latest||latest.id!==c.compositionReviewId||latest.decision!=='CONFIRMED'||latest.source_snapshot_sha256!==c.sourceSnapshotSha256}))return fail()
 // A withdrawal/source edit between the independently counted reads must not
 // leave a stale qualified projection beside a newer investigation history.
 const sourceConfirmation=await read('trusted_lot_comparables_v1','reviewed_at');active()
 const stable=(v:unknown):string=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x)
 if(stable(sourceConfirmation)!==stable(sources))return fail()
 const confirmed=await client.auth.getUser();active();if(confirmed.error||confirmed.data.user?.id!==ownerId)return fail()
 return {ownerId,comparables,qualifiedComparableIds:comparables.map(c=>c.id),reviews:history as StoredLotCompositionReview[]}
}
