import type {SupabaseClient} from '@supabase/supabase-js'

export type CatalogueSource={id:string;owner_id:string;status:string;mode:string;created_at:string;result:any;input_photo_count:number;owner_review_revision:number;user_context:any}
export type CatalogueRecord={item_id:string;item_code:string;object_index:number;title:string}
type Review={working_title?:string;condition_summary?:string;pair_source_indices?:number[];confirmed_photo_indices?:number[]}
export type CatalogueRequest={readonly source:CatalogueSource;readonly indices:number[];readonly reviews:Record<string,Review>}
export class CatalogueError extends Error{}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const plain=(v:any)=>v!==null&&typeof v==='object'&&!Array.isArray(v)
const stop=(current:()=>boolean)=>{if(!current())throw new CatalogueError('The previous saved report is no longer selected.')}
const fail=(message:string):never=>{throw new CatalogueError(message)}
const stable=(v:any):string=>JSON.stringify(v,(_key,value)=>plain(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,value[key]])):value)
const equal=(a:any,b:any)=>stable(a)===stable(b)
const sorted=(values:number[])=>[...values].sort((a,b)=>a-b)
const text=(value:any)=>typeof value==='string'?value.trim()||null:null
const original=(source:CatalogueSource)=>{const {owner_review:_review,...result}=source.result;return {owner:source.owner_id,id:source.id,mode:source.mode,count:source.input_photo_count,result,context:source.user_context}}
const freeze=<T,>(value:T):T=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value)}return value}

export async function readCatalogueContext(client:SupabaseClient,runId:string,current:()=>boolean){
 stop(current)
 if(!uuid.test(runId))return fail('This saved report could not be identified.')
 const auth=await client.auth.getUser();stop(current)
 if(auth.error||!auth.data.user)return fail('Sign in again to read your private saved report.')
 const owner=auth.data.user.id
 const read=await client.from('ai_analysis_runs').select('id,owner_id,status,mode,created_at,result,input_photo_count,owner_review_revision,user_context')
  .eq('id',runId).eq('owner_id',owner).abortSignal(AbortSignal.timeout(20000)).maybeSingle();stop(current)
 const source=read.data as CatalogueSource|null
 if(read.error||!source||source.id!==runId||source.owner_id!==owner)return fail('Saved report unavailable for the signed-in account.')
 if(!['single','batch'].includes(source.mode)||!plain(source.result)||!Array.isArray(source.result.objects)||source.result.objects.length<1||source.result.objects.length>100||source.result.objects.some((o:any)=>!plain(o)||!Array.isArray(o.image_indices))||!Number.isInteger(source.owner_review_revision)||source.owner_review_revision<0)return fail('The original saved report needs review before cataloguing.')
 const saved=await client.from('items').select('id,owner_id,source_analysis_run_id,source_object_index,item_code,title,condition_summary,catalogue_review_status',{count:'exact'})
  .eq('owner_id',owner).eq('source_analysis_run_id',runId).order('source_object_index').order('id').limit(101).abortSignal(AbortSignal.timeout(20000));stop(current)
 if(saved.error||!saved.data||saved.count===null||saved.count>100||saved.count!==saved.data.length)return fail('Complete catalogue history could not be checked. Reload the saved report before approving.')
 const items=saved.data
 if(new Set(items.map(row=>row.id)).size!==items.length||new Set(items.map(row=>row.source_object_index)).size!==items.length||items.some(row=>!uuid.test(row.id)||row.owner_id!==owner||row.source_analysis_run_id!==runId||!Number.isInteger(row.source_object_index)||row.source_object_index<0||row.source_object_index>=source.result.objects.length||typeof row.title!=='string'||typeof row.item_code!=='string'))return fail('The saved catalogue identities could not be verified.')
 return {source,items}
}
function manifest(source:CatalogueSource){
 const photos=source.result.image_manifest
 if(source.result.analysis_stage!=='COMPLETE'||!Number.isInteger(source.input_photo_count)||source.input_photo_count<1||source.input_photo_count>500||!Array.isArray(photos)||photos.length!==source.input_photo_count||new Set(photos.map((p:any)=>p?.index)).size!==photos.length||photos.some((p:any)=>!plain(p)||!Number.isInteger(p.index)||p.index<0||typeof p.storage_path!=='string'||!p.storage_path.startsWith(source.owner_id+'/intake/')))return fail('The complete original photograph manifest needs review before cataloguing.')
 return photos as Array<{index:number;storage_path:string;file_name?:string|null}>
}
function facts(source:CatalogueSource,index:number,review:Review){
 const pair=review.pair_source_indices
 if(pair&&(!equal(pair,[0,1])||source.mode!=='single'||source.result.objects.length!==2||index!==0))return fail('The pair must preserve both original objects.')
 const object=source.result.objects[index]
 const raw=pair?[...new Set<number>([...object.image_indices,...source.result.objects[1].image_indices])]:object.image_indices
 const approved=review.confirmed_photo_indices??raw
 const photos=manifest(source)
 if(!Array.isArray(approved)||!approved.length||new Set(approved).size!==approved.length||approved.some((n:any)=>!Number.isInteger(n)||n<0||!raw.includes(n)||!photos.some(p=>p.index===n)))return fail('Confirm a unique set of existing original photographs before cataloguing.')
 return {raw,approved,pair:pair??null,title:text(review.working_title)??text(object.working_title)??'Unidentified object',condition:review.condition_summary!==undefined?text(review.condition_summary):text(object.condition_summary)}
}
export async function prepareCatalogueRequest(client:SupabaseClient,expected:CatalogueSource,indices:number[],reviews:Record<string,Review>,current:()=>boolean):Promise<CatalogueRequest>{
 const {source,items}=await readCatalogueContext(client,expected.id,current)
 if(!equal(original(source),original(expected))||source.owner_review_revision!==expected.owner_review_revision)return fail('The saved report changed in another view. Your edits remain here; copy them before reloading.')
 if(source.status!=='DRAFT'||items.length)return fail('This report already has catalogue activity. Reload and review its saved records before approving.')
 if(!indices.length||indices.length>100||new Set(indices).size!==indices.length||indices.some(i=>!Number.isInteger(i)||i<0||i>=source.result.objects.length)||!plain(reviews)||!equal(Object.keys(reviews).sort(),indices.map(String).sort()))return fail('Choose valid original objects to catalogue.')
 for(const index of indices){
  const review=reviews[String(index)]
  if(!plain(review)||Object.keys(review).some(k=>!['working_title','condition_summary','pair_source_indices','confirmed_photo_indices'].includes(k))||['working_title','condition_summary'].some(k=>k in review&&(typeof (review as any)[k]!=='string'||(review as any)[k].length>2000)))return fail('Review text must be no longer than 2,000 characters.')
  facts(source,index,review)
 }
 return freeze(JSON.parse(JSON.stringify({source,indices:sorted(indices),reviews})))
}
async function confirmed(client:SupabaseClient,context:Awaited<ReturnType<typeof readCatalogueContext>>,current:()=>boolean,request?:CatalogueRequest){
 const {source,items}=context,snapshots=source.result.owner_review?.approved_snapshot
 if(source.status!=='APPROVED'||!items.length||!plain(snapshots))return fail('The catalogue result is not yet confirmed. Keep this page open to check the same approval.')
 const indices=items.map(row=>row.source_object_index)
 if(!equal(Object.keys(snapshots).sort(),indices.map(String).sort())||(request&&!equal(indices,request.indices)))return fail('The saved objects differ from the selected approval. Review Inventory before continuing.')
 const photos=manifest(source),records:CatalogueRecord[]=[]
 for(const row of items){
  const snapshot=snapshots[String(row.source_object_index)]
  const approved=snapshot?.approved_photo_indices
  if(!plain(snapshot)||!Array.isArray(approved)||!approved.length||approved.some((n:any)=>!Number.isInteger(n)||!photos.some(p=>p.index===n))||new Set(approved).size!==approved.length||row.catalogue_review_status!=='OWNER_REVIEWED')return fail('The saved photograph mapping needs review before confirming this catalogue.')
  if(request){
   const expected=facts(request.source,row.source_object_index,request.reviews[String(row.source_object_index)])
   if(!Array.isArray(snapshot.original_model_photo_indices)||!equal(sorted(approved),sorted(expected.approved))||!equal(sorted(snapshot.original_model_photo_indices),sorted(expected.raw))||!equal(snapshot.pair_source_indices,expected.pair)||snapshot.photo_index_owner_confirmed!==(request.reviews[String(row.source_object_index)].confirmed_photo_indices!==undefined)||text(snapshot.working_title)!==expected.title||row.title!==expected.title||text(snapshot.condition_summary)!==expected.condition||text(row.condition_summary)!==expected.condition)return fail('The saved catalogue facts differ from your approval. Your original review is held unchanged; inspect Inventory.')
  }
  const links=await client.from('item_photos').select('id,owner_id,item_id,storage_path,file_name,position,is_hero',{count:'exact'})
   .eq('owner_id',source.owner_id).eq('item_id',row.id).order('position').order('id').limit(501).abortSignal(AbortSignal.timeout(20000));stop(current)
  if(links.error||!links.data||links.count===null||links.count>500||links.count!==links.data.length||(request&&links.count!==approved.length)||new Set(links.data.map(link=>link.id)).size!==links.data.length||links.data.some(link=>!uuid.test(link.id)||link.owner_id!==source.owner_id||link.item_id!==row.id)||approved.some((position:number)=>{const photo=photos.find(p=>p.index===position),matching=links.data!.filter(link=>link.position===position&&link.storage_path===photo?.storage_path&&(link.file_name??null)===(photo?.file_name??null));return matching.length!==1||(request&&matching[0].is_hero!==(position===Math.min(...approved)))}))return fail('Complete original photograph links could not be confirmed. Keep this page open and check the same approval.')
  records.push({item_id:row.id,item_code:row.item_code,object_index:row.source_object_index,title:row.title})
 }
 return records
}
export async function readApprovedCatalogue(client:SupabaseClient,runId:string,current:()=>boolean){
 const context=await readCatalogueContext(client,runId,current)
 return {source:context.source,records:context.source.status==='APPROVED'?await confirmed(client,context,current):[]}
}
export async function settleCatalogueApproval(client:SupabaseClient,request:CatalogueRequest,current:()=>boolean,submit:boolean){
 let context=await readCatalogueContext(client,request.source.id,current)
 const unchanged=()=>{if(!equal(original(context.source),original(request.source)))return fail('The original report differs from this approval. Inspect it before continuing.')}
 unchanged()
 if(context.source.status==='APPROVED')return {source:context.source,records:await confirmed(client,context,current,request)}
 if(context.source.status!=='DRAFT'||context.items.length)return fail('This report has different catalogue activity. Inspect Inventory before continuing.')
 if(!submit)return null
 if(context.source.owner_review_revision!==request.source.owner_review_revision)return fail('A newer owner review exists. The held approval was not sent; copy your edits before reloading.')
 // Exactly one mutation per deliberate action. Even an unusable/lost response
 // must be resolved from owner-scoped source/items/photos, never from its payload.
 try{await client.rpc('ci_approve_saved_intake_v1',{p_run_id:request.source.id,p_object_indices:request.indices,p_reviews:request.reviews}).abortSignal(AbortSignal.timeout(20000))}catch{/* Read the real committed result below. */}
 stop(current);context=await readCatalogueContext(client,request.source.id,current);unchanged()
 if(context.source.status!=='APPROVED')return null
 return {source:context.source,records:await confirmed(client,context,current,request)}
}
