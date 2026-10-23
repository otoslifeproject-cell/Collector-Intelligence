import type {SupabaseClient} from '@supabase/supabase-js'
import type {Comparable} from '../types'
import {auditResearch,researchTypes} from './researchSaleDecision.ts'
import type {ResearchReceipt,ResearchType} from './researchSaleDecision'
import {classifyComparables} from './comparableEvidence.ts'
import {inscriptionObjectIndex} from './inscriptionReview.ts'

export type ItemResearchRun={id:string;owner_id:string;mode:string;status:string;model:string|null;created_at:string;input_photo_count:number;user_context:any;result:any}
export type ResearchItemScope={id:string;owner_id:string;source_analysis_run_id?:string|null;source_object_index?:number|null}
export type ItemResearchHistory={runs:ItemResearchRun[];original:ItemResearchRun|null;paired:boolean;lineageUnresolved:boolean;sourceObjectIndex?:number|null}
const plain=(v:any)=>v!==null&&typeof v==='object'&&!Array.isArray(v)
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export class ItemResearchError extends Error{}
const fail=():never=>{throw new ItemResearchError('Complete saved research history could not be verified. Reload history before another paid search.')}
const stop=(current:()=>boolean)=>{if(!current())throw new ItemResearchError('This object or account is no longer selected.')}
const columns='id,owner_id,mode,status,model,created_at,input_photo_count,user_context,result'
// Read only relevant owner/source scopes; stable ordering and exact totals prevent
// a newest-100 cap from erasing older work or making an outage look like no work.
export async function readItemResearch(client:SupabaseClient,item:ResearchItemScope,current:()=>boolean):Promise<ItemResearchHistory>{
 stop(current)
 const auth=await client.auth.getUser();stop(current)
 if(auth.error||auth.data.user?.id!==item.owner_id)return fail()
 let original:ItemResearchRun|null=null,paired=false,lineageUnresolved=false
 const parent=item.source_analysis_run_id
 if(parent){
  const read=await client.from('ai_analysis_runs').select(columns).eq('owner_id',item.owner_id).eq('id',parent).abortSignal(AbortSignal.timeout(20000)).maybeSingle();stop(current)
  if(read.error||!read.data||read.data.owner_id!==item.owner_id||read.data.id!==parent)return fail()
  original=read.data as ItemResearchRun
  const index=item.source_object_index
  const snapshot=original.result?.owner_review?.approved_snapshot?.[String(index)]
  paired=Array.isArray(snapshot?.pair_source_indices)&&JSON.stringify(snapshot.pair_source_indices)==='[0,1]'
  lineageUnresolved=typeof index!=='number'||!Number.isInteger(index)||index<0||!Array.isArray(original.result?.objects)||index>=original.result.objects.length
 }
 async function readScope(key:string,value:string){
  const all:ItemResearchRun[]=[];let total:number|undefined
  do{
   const read=await client.from('ai_analysis_runs').select(columns,{count:'exact'}).eq('owner_id',item.owner_id).eq('mode','research')
    .eq('user_context->>'+key,value).order('created_at',{ascending:false}).order('id',{ascending:false})
    .range(all.length,all.length+99).abortSignal(AbortSignal.timeout(20000));stop(current)
   if(read.error||!read.data||read.count===null||read.count<0||read.count>500||(total!==undefined&&total!==read.count))return fail()
   total=read.count
   if(read.data.length!==Math.min(100,total-all.length))return fail()
   all.push(...read.data as ItemResearchRun[])
  }while(all.length<total)
  if(new Set(all.map(r=>r.id)).size!==all.length||all.some(r=>!uuid.test(r.id)||r.owner_id!==item.owner_id||r.mode!=='research'||!plain(r.result)||!plain(r.user_context)||r.user_context[key]!==value||!Number.isFinite(Date.parse(r.created_at))))return fail()
  return all
 }
 const direct=await readScope('item_id',item.id)
 const inherited=parent&&!lineageUnresolved?await readScope('source_analysis_run_id',parent):[]
 const scoped=inherited.filter(r=>r.user_context.source_object_index===item.source_object_index&&
  JSON.stringify(r.user_context.pair_source_indices??[])===(paired?'[0,1]':'[]'))
 const unique=new Map<string,ItemResearchRun>()
 for(const row of [...direct,...scoped]){
  const previous=unique.get(row.id)
  if(previous&&JSON.stringify(previous)!==JSON.stringify(row))return fail()
  unique.set(row.id,row)
 }
 const finalAuth=await client.auth.getUser();stop(current)
 if(finalAuth.error||finalAuth.data.user?.id!==item.owner_id)return fail()
 return {runs:[...unique.values()].sort((a,b)=>b.created_at.localeCompare(a.created_at)||b.id.localeCompare(a.id)),original,paired,lineageUnresolved,sourceObjectIndex:item.source_object_index}
}

export async function readItemSaleRows(client:SupabaseClient,table:'comparables'|'trusted_comparables_v1'|'listings',item:ResearchItemScope,current:()=>boolean){
 const rows:any[]=[];let total:number|undefined
 do{
  const read=await client.from(table).select('*',{count:'exact'}).eq('owner_id',item.owner_id).eq('item_id',item.id)
   .order('id',{ascending:true}).range(rows.length,rows.length+99).abortSignal(AbortSignal.timeout(20000));stop(current)
  if(read.error||!read.data||read.count===null||read.count>500||read.count<0||(total!==undefined&&read.count!==total))throw new ItemResearchError('Complete source and listing records could not be verified. Reload saved research history.')
  total=read.count
  if(read.data.length!==Math.min(100,total-rows.length))return fail()
  rows.push(...read.data)
 }while(rows.length<total)
 if(new Set(rows.map(row=>row.id)).size!==rows.length||rows.some(row=>!uuid.test(row.id)||row.owner_id!==item.owner_id||row.item_id!==item.id))return fail()
 return rows
}

// Stored execution is distinct from an independently verified finding. Legacy
// results and arbitrary model receipt arrays never create completion certificates.
export function itemResearchAudit(history:ItemResearchHistory,trustedComparables:Comparable[],now=Date.now()){
 const attempts=history.runs.filter(r=>r.result?.analysis_stage!=='STAGED')
 const newest=attempts[0],hasHistory=!!history.original||attempts.length>0
 const receipts:ResearchReceipt[]=researchTypes.map(type=>{
  const base={type,runId:newest?.id||history.original?.id,checkedAt:newest?.created_at||history.original?.created_at}
  if(newest?.result?.analysis_stage==='PROCESSING'){
   const at=Date.parse(newest.result.claimed_at||newest.created_at)
   return {...base,status:Number.isFinite(at)&&now-at>=0&&now-at<15*60*1000?'RUNNING':'BLOCKED',detail:'A stored research request was dispatched. Category outcomes are unconfirmed; recover the same run before any paid retry.'} as ResearchReceipt
  }
  if(history.lineageUnresolved)return {...base,status:'BLOCKED',detail:'Original report retained, but its object-to-catalogue mapping is incomplete. Earlier category work cannot be safely assigned.'}
  if(hasHistory)return {...base,status:'RECEIPT_MISSING',detail:'Historical research is stored. No separate verified category receipt was retained; this does not mean never attempted.'}
  return {type,status:'NOT_RUN',detail:history.runs.length?'Request staged but no stored dispatch or result.':'No stored attempt found in the completely read item history.'}
 })
 const set=(type:ResearchType,receipt:Omit<ResearchReceipt,'type'>)=>{const i=receipts.findIndex(r=>r.type===type);receipts[i]={type,...receipt}}
 const completed=attempts.find(r=>r.result?.analysis_stage==='COMPLETE'&&typeof r.result.research_summary==='string')
 if(completed){
  const candidates=(Array.isArray(completed.result.comparables)?completed.result.comparables:[]).filter(plain)
  const refs=candidates.map((c:any)=>c.source_url||c.source_reference).filter((x:any)=>typeof x==='string'&&x.trim())
  for(const type of ['MAKER_ARCHIVE','AUCTION_REALISED','MARKETPLACE_SOLD'] as const){
   if(type!=='MAKER_ARCHIVE'&&!candidates.some((c:any)=>type==='MARKETPLACE_SOLD'?['MARKETPLACE_SOLD','DEALER_SOLD_CONFIRMED'].includes(c.price_type):['HAMMER_REALIZED','REALIZED_INCL_BP','AUCTION_ESTIMATE'].includes(c.price_type)))continue
   set(type,{status:'INCONCLUSIVE',runId:completed.id,checkedAt:completed.created_at,sourceRefs:refs,detail:'Stored model research produced provisional findings. Original source verification and physical comparability remain separate.'})
  }
 }
 if(history.original&&!history.lineageUnresolved){
  const original=history.original
  if(original.result?.analysis_stage==='COMPLETE')set('PHOTOGRAPH_EXAM',{status:'INCONCLUSIVE',runId:original.id,checkedAt:original.created_at,detail:'Original photographic analysis is retained. Its observations are provisional, not physical inspection or maker authentication.'})
  const mark=original.result?.inscription_review
  if(mark){
   const scoped=!history.paired&&inscriptionObjectIndex(original.result?.objects,mark.evidence_image_indices)===history.sourceObjectIndex
   set('SIGNATURE_READING',{status:scoped?'INCONCLUSIVE':'RECEIPT_MISSING',runId:original.id,checkedAt:original.created_at,
    confidence:scoped&&typeof mark.transcription_confidence==='number'&&Number.isFinite(mark.transcription_confidence)?mark.transcription_confidence:null,
    detail:scoped?`Stored candidate reading: ${typeof mark.candidate_transcription==='string'?mark.candidate_transcription:'illegible'}. This is provisional reading, not maker authentication.`:'The original report has an inscription review, but it is not independently scoped to this physical piece. Do not copy another piece’s reading or confidence.'})
  }
 }
 // Caller must supply actual trusted-view rows, not the model's comparable array.
 for(const type of ['AUCTION_REALISED','MARKETPLACE_SOLD'] as const){
  const matched=classifyComparables(trustedComparables).filter(c=>c.verified&&(type==='AUCTION_REALISED'?['HAMMER_REALIZED','REALIZED_INCL_BP'].includes(c.row.price_type):['MARKETPLACE_SOLD','DEALER_SOLD_CONFIRMED'].includes(c.row.price_type)))
  if(matched.length)set(type,{status:'DONE_EVIDENCED',runId:'source-review:'+matched[0].row.id,checkedAt:matched[0].row.date_checked||matched[0].row.sale_date!,sourceRefs:matched.map(c=>c.row.source_url!),detail:'Source-reviewed achieved-sale records recovered. Check size, condition, maker and whole-lot relevance before valuation.'})
 }
 return auditResearch(receipts)
}
