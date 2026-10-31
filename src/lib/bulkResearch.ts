// CATCH-UP (Dean, 31 Oct): bring every uploaded item to the same point in bulk.
// Each item (one object of a finished photo analysis, saved or not) gets a
// state from its research history, and the page can start the next step for
// many items at once: a quick check (writes the questions), then deep research
// with the owner's answers. Every run is staged first, exactly like the item page.
import {applyPhotoOrder} from './photoOrder.ts'

export type CatchUpState='WORKING'|'NEEDS_CHECK'|'QUESTIONS'|'READY_FOR_DEEP'|'DONE'
export type CatchUpItem={
 key:string;runId:string;ownerId:string;index:number;title:string;saved:boolean
 photoPaths:string[];state:CatchUpState;questions:any[];price:number|null;researchedAt:string|null
}
const STAGED_STALE_MS=6*60*1000

// The research rows for one object, newest first, decide where it stands.
export function catchUpState(rows:any[]):{state:CatchUpState;questions:any[];price:number|null;at:string|null}{
 const now=Date.now()
 const live=rows.find(r=>{
  const stage=r.stage,age=now-Date.parse(r.created_at)
  if(stage==='STAGED')return age<=STAGED_STALE_MS
  if(stage==='PROCESSING')return typeof r.job==='string'?age<=2*3600*1000:age<=10*60*1000
  return false
 })
 if(live)return {state:'WORKING',questions:[],price:null,at:live.created_at}
 const done=rows.find(r=>r.stage==='COMPLETE')
 if(!done)return {state:'NEEDS_CHECK',questions:[],price:null,at:null}
 const price=typeof done.listing?.price==='number'?done.listing.price:null
 // Research from before the standard elements existed is brought up to date.
 if(!Array.isArray(done.specifics))return {state:'NEEDS_CHECK',questions:[],price,at:done.created_at}
 if(done.depth==='quick'){
  const qs=(Array.isArray(done.questions)?done.questions:[]).filter((q:any)=>q&&typeof q.question==='string'&&q.question.trim()).slice(0,3)
  return {state:qs.length?'QUESTIONS':'READY_FOR_DEEP',questions:qs,price,at:done.created_at}
 }
 return {state:'DONE',questions:[],price,at:done.created_at}
}

export async function loadCatchUp(client:any):Promise<CatchUpItem[]>{
 const {data:{session}}=await client.auth.getSession()
 if(!session)throw Error('Sign in again.')
 const uid=session.user.id
 const [runs,research,orders]=await Promise.all([
  client.from('ai_analysis_runs').select('id,owner_id,status,created_at,mode,objects:result->objects,manifest:result->image_manifest,stage:result->>analysis_stage')
   .eq('owner_id',uid).in('mode',['single','batch']).in('status',['DRAFT','APPROVED']).order('created_at',{ascending:false}).limit(300),
  client.from('ai_analysis_runs').select('id,created_at,user_context,stage:result->>analysis_stage,depth:result->>research_depth,job:result->>openai_response_id,questions:result->questions,specifics:result->specifics,listing:result->listing')
   .eq('owner_id',uid).eq('mode','research').order('created_at',{ascending:false}).limit(3000),
  client.from('ci_photo_order_v1').select('run_id,scope,photo_order')
 ])
 for(const r of [runs,research])if(r.error)throw Error(r.error.message)
 const out:CatchUpItem[]=[]
 for(const run of runs.data||[]){
  if(run.stage!=='COMPLETE'||!Array.isArray(run.objects))continue
  const manifest=Array.isArray(run.manifest)?run.manifest:[]
  run.objects.forEach((o:any,i:number)=>{
   const rows=(research.data||[]).filter((r:any)=>r.user_context?.source_analysis_run_id===run.id&&r.user_context?.source_object_index===i&&!(r.user_context?.pair_source_indices||[]).length)
   const s=catchUpState(rows)
   const keys:number[]=Array.isArray(o?.image_indices)?o.image_indices:[]
   const order=(orders.data||[]).find((x:any)=>x.run_id===run.id&&x.scope===String(i))?.photo_order||null
   const paths=applyPhotoOrder(keys,order).map(n=>manifest.find((p:any)=>p.index===n)?.storage_path).filter((p:any)=>typeof p==='string'&&p.startsWith(run.owner_id+'/intake/'))
   out.push({key:run.id+':'+i,runId:run.id,ownerId:run.owner_id,index:i,title:String(o?.working_title||o?.object_type||'Item '+(i+1)),saved:run.status==='APPROVED',
    photoPaths:paths,state:s.state,questions:s.questions,price:s.price,researchedAt:s.at})
  })
 }
 return out
}

export type Answer={question:string;answer:'YES'|'NO'|'NOT_SURE';note?:string}
// Stage one research run and send it. Deep runs come back at once (no_wait);
// the result is collected later. Returns a plain message on failure.
export async function startResearch(client:any,item:CatchUpItem,depth:'quick'|'deep_dive',extra:{answers?:Answer[];note?:string}={}):Promise<string|null>{
 const {data:{session}}=await client.auth.getSession()
 if(!session)return 'Sign in again.'
 const signed=item.photoPaths.length?await client.storage.from('item-images').createSignedUrls(item.photoPaths.slice(0,12),1800):{data:[],error:null}
 if(signed.error)return 'Photos could not be read: '+signed.error.message
 const urls=(signed.data||[]).map((x:any)=>x.signedUrl).filter(Boolean)
 if(!urls.length)return 'No photos found for this item.'
 const staged=await client.from('ai_analysis_runs').insert({mode:'research',model:'PENDING',status:'DRAFT',input_photo_count:urls.length,
  user_context:{source_analysis_run_id:item.runId,source_object_index:item.index,pair_source_indices:[],research_depth:depth},
  result:{analysis_stage:'STAGED',source_analysis_run_id:item.runId,source_object_index:item.index}}).select('id').single()
 if(staged.error||!staged.data?.id)return 'Could not start: '+(staged.error?.message||'not confirmed')
 try{
  const r=await fetch('/api/research-item',{method:'POST',signal:AbortSignal.timeout(295000),headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},
   body:JSON.stringify({draft_run_id:item.runId,draft_index:item.index,pair_source_indices:[],research_run_id:staged.data.id,depth,images:urls,
    owner_answers:extra.answers||[],owner_note:extra.note||'',previous_price:depth==='deep_dive'&&item.price!==null?{price:item.price,basis:'last suggested price'}:null,rerun_lens:false,no_wait:true})})
  if(r.ok)return null
  const j=await r.json().catch(()=>({}))
  return String(j.error||'Research refused ('+r.status+')')
 }catch{return 'No reply in time. It may still be working: check again in a few minutes.'}
}

// Free: ask the server to collect finished deep runs.
export async function collectAll(client:any,runIds:string[]):Promise<number>{
 const {data:{session}}=await client.auth.getSession()
 if(!session)return 0
 let done=0
 for(const id of runIds){
  try{
   const r=await fetch('/api/research-item',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify({collect:true,research_run_id:id})})
   if(r.status===200)done++
  }catch{/* next time */}
 }
 return done
}
export async function workingRunIds(client:any):Promise<string[]>{
 const {data}=await client.from('ai_analysis_runs').select('id,created_at,job:result->>openai_response_id,stage:result->>analysis_stage').eq('mode','research').eq('result->>analysis_stage','PROCESSING').order('created_at',{ascending:false}).limit(200)
 return (data||[]).filter((r:any)=>typeof r.job==='string'&&Date.now()-Date.parse(r.created_at)<2*3600*1000).map((r:any)=>r.id)
}
