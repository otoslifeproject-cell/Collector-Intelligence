import type {SupabaseClient} from '@supabase/supabase-js'

export type IntakeContext={purchase_price:string;currency:string;weight_g:string;dimensions:string;storage_location:string;user_notes:string}
type Original={readonly index:number;readonly file:File;readonly storage_path:string;readonly file_name:string;readonly sha256:string;readonly byte_count:number}
export type IntakeRequest={readonly id:string;readonly ownerId:string;readonly mode:'single'|'batch';readonly context:Readonly<IntakeContext>;readonly originals:ReadonlyArray<Original>}
export type IntakeAttempt={readonly request:IntakeRequest;readonly uploaded:Set<number>;dispatched:boolean}
export type IntakeRow={id:string;owner_id:string;mode:string;status:string;input_photo_count:number;user_context:any;result:any;model:string}
export class IntakeError extends Error{}
const plain=(v:any)=>v!==null&&typeof v==='object'&&!Array.isArray(v)
const stable=(v:any):string=>JSON.stringify(v,(_key,x)=>plain(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x)
const stop=(current:()=>boolean)=>{if(!current())throw new IntakeError('The previous private photo session has been stopped.')}
const fail=(message:string):never=>{throw new IntakeError(message)}
const digest=async(file:Blob)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer())),n=>n.toString(16).padStart(2,'0')).join('')
const manifest=(r:IntakeRequest)=>r.originals.map(({index,storage_path,file_name,sha256,byte_count})=>({index,storage_path,file_name,sha256,byte_count}))
async function owner(client:SupabaseClient,current:()=>boolean,expected?:string){
 stop(current);const auth=await client.auth.getUser();stop(current)
 if(auth.error||!auth.data.user)return fail('Sign in again before continuing with your private photographs.')
 if(expected&&auth.data.user.id!==expected)return fail('Your account changed. The original photo session has been retained for its owner.')
 return auth.data.user.id
}
export async function prepareIntake(client:SupabaseClient,mode:'single'|'batch',files:File[],context:IntakeContext,current:()=>boolean):Promise<IntakeAttempt>{
 if(!files.length||files.length>(mode==='single'?20:40))return fail('Choose between one and '+(mode==='single'?20:40)+' photographs for this mode.')
 if(files.some(f=>!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size<1||f.size>26214400))return fail('Choose non-empty JPEG, PNG or WebP files, each no larger than 25 MB.')
 const ownerId=await owner(client,current),id=crypto.randomUUID(),originals:Original[]=[]
 for(const [index,file]of files.entries()){
  const sha256=await digest(file);stop(current)
  originals.push(Object.freeze({index,file,file_name:file.name,storage_path:`${ownerId}/intake/${id}/${String(index).padStart(2,'0')}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`,sha256,byte_count:file.size}))
 }
 return {request:Object.freeze({id,ownerId,mode,context:Object.freeze({...context}),originals:Object.freeze(originals)}),uploaded:new Set(),dispatched:false}
}
export async function readIntake(client:SupabaseClient,attempt:IntakeAttempt,current:()=>boolean):Promise<IntakeRow|null>{
 const r=attempt.request;await owner(client,current,r.ownerId)
 const read=await client.from('ai_analysis_runs').select('id,owner_id,mode,status,input_photo_count,user_context,result,model')
  .eq('id',r.id).eq('owner_id',r.ownerId).abortSignal(AbortSignal.timeout(20000)).maybeSingle();stop(current)
 if(read.error)return fail('The saved photo session could not be checked. Keep this page open and check the same session.')
 if(!read.data)return null
 const row=read.data as IntakeRow
 if(row.id!==r.id||row.owner_id!==r.ownerId||row.mode!==r.mode||!['DRAFT','APPROVED'].includes(row.status)||row.input_photo_count!==r.originals.length||!plain(row.result)||stable(row.user_context)!==stable(r.context)||stable(row.result.image_manifest)!==stable(manifest(r)))return fail('The saved session differs from these original photographs or notes. It has been retained for review; no new analysis was sent.')
 return row
}
async function verifyOriginal(client:SupabaseClient,photo:Original,current:()=>boolean){
 const read=await client.storage.from('item-images').download(photo.storage_path);stop(current)
 if(read.error||!read.data)return fail('An original photograph cannot yet be verified. Keep this page open and retry the same photo session.')
 if(read.data.size!==photo.byte_count||await digest(read.data)!==photo.sha256)return fail('A stored original differs from the selected file. Both have been retained for review; no analysis was sent.')
 stop(current)
}
export async function settleIntake(client:SupabaseClient,attempt:IntakeAttempt,current:()=>boolean):Promise<IntakeRow>{
 const r=attempt.request,existing=await readIntake(client,attempt,current)
 // Reuse any already committed session. Never overwrite model output or a
 // competing saved envelope merely because an earlier reply was lost.
 if(existing)return existing
 if(attempt.dispatched)return fail('An analysis was already requested. Check saved analysis; do not send another paid request to recover it.')
 for(const photo of r.originals){
  await owner(client,current,r.ownerId)
  if(attempt.uploaded.has(photo.index)){
   // Even a failed/lost acknowledgement can hide a committed object. A retry
   // first reads its exact immutable path; only a definite absence permits POST.
   const read=await client.storage.from('item-images').download(photo.storage_path);stop(current)
   if(!read.error&&read.data){
    if(read.data.size!==photo.byte_count||await digest(read.data)!==photo.sha256)return fail('A stored original differs from the selected file. It has been retained for review.')
    stop(current);continue
   }
   if(!read.error||!['400','404'].includes(String((read.error as any).statusCode))||!/not found/i.test(read.error.message))return fail('The original upload is uncertain. Keep this page open and retry the same photo session.')
  }
  attempt.uploaded.add(photo.index)
  try{await client.storage.from('item-images').upload(photo.storage_path,photo.file,{upsert:false,contentType:photo.file.type})}catch{/* Independently verify even when the acknowledgement is lost. */}
  stop(current);await verifyOriginal(client,photo,current)
 }
 await owner(client,current,r.ownerId)
 try{await client.from('ai_analysis_runs').insert({id:r.id,owner_id:r.ownerId,mode:r.mode,model:'PENDING',status:'DRAFT',input_photo_count:r.originals.length,user_context:r.context,
  result:{image_manifest_version:1,image_manifest:manifest(r),analysis_stage:'UPLOADED'}}).abortSignal(AbortSignal.timeout(20000))}catch{/* The selected UUID, not the INSERT reply, identifies the saved session. */}
 stop(current)
 const saved=await readIntake(client,attempt,current)
 if(!saved)return fail('The original files are retained, but the saved session is not confirmed. Retry the same photo session; no analysis has been requested.')
 return saved
}
export function hasIntakeReport(row:IntakeRow){
 const result=row.result
 const text=(v:any)=>v==null||typeof v==='string'
 const initial=result.initial_ai_result
 return (initial===undefined||(plain(initial)&&Array.isArray(initial.objects)&&initial.objects.every((o:any)=>plain(o)&&text(o.working_title)&&text(o.current_attribution))))&&
  ['FIRST_PASS_SAVED','COMPLETE'].includes(result.analysis_stage)&&typeof result.batch_summary==='string'&&Array.isArray(result.objects)&&result.objects.length>0&&result.objects.length<=5&&result.objects.every((o:any)=>
  plain(o)&&typeof o.working_title==='string'&&typeof o.condition_summary==='string'&&Array.isArray(o.image_indices)&&o.image_indices.every(Number.isInteger)&&
  ['object_type','material','colour','category','sale_readiness','status'].every(k=>typeof o[k]==='string')&&
  ['maker','current_attribution','period_wording','region_country','marks_signatures_labels','rarity_desirability','catalogue_note'].every(k=>o[k]==null||typeof o[k]==='string')&&
  ['identification_confidence','dating_confidence','valuation_confidence'].every(k=>o[k]==null||(typeof o[k]==='number'&&Number.isFinite(o[k])))&&
  Array.isArray(o.evidence)&&o.evidence.every((e:any)=>plain(e)&&typeof e.claim==='string'&&text(e.certainty_class))&&Array.isArray(o.next_evidence)&&o.next_evidence.every((e:any)=>plain(e)&&typeof e.title==='string'&&text(e.why))&&plain(o.preliminary_value)&&/^[A-Z]{3}$/.test(o.preliminary_value.currency)&&text(o.preliminary_value.basis)&&['quick_sale','balanced_low','balanced_high','floor'].every(k=>o.preliminary_value[k]==null||(typeof o.preliminary_value[k]==='number'&&Number.isFinite(o.preliminary_value[k]))))
}
export async function verifyIntakeOriginals(client:SupabaseClient,attempt:IntakeAttempt,current:()=>boolean){
 await owner(client,current,attempt.request.ownerId)
 for(const photo of attempt.request.originals)await verifyOriginal(client,photo,current)
}
export async function intakeDispatch(client:SupabaseClient,attempt:IntakeAttempt,current:()=>boolean){
 const row=await readIntake(client,attempt,current),r=attempt.request
 if(attempt.dispatched||!row||row.status!=='DRAFT'||row.result.analysis_stage!=='UPLOADED'||row.result.objects!==undefined)return fail('This saved session is not eligible for another analysis. Check its saved result.')
 const images=[]
 for(const photo of r.originals){
  await verifyOriginal(client,photo,current)
  const signed=await client.storage.from('item-images').createSignedUrl(photo.storage_path,1800);stop(current)
  if(signed.error||!signed.data?.signedUrl)return fail('A private photograph link could not be prepared. Retry the same photo session before analysis.')
  images.push({index:photo.index,fileName:photo.file_name,url:signed.data.signedUrl})
 }
 await owner(client,current,r.ownerId)
 const session=await client.auth.getSession();stop(current)
 if(session.error||session.data.session?.user.id!==r.ownerId)return fail('Sign in again before analysing these private photographs.')
 return {token:session.data.session.access_token,body:{mode:r.mode,run_id:r.id,images,context:{...r.context,purchase_price:r.context.purchase_price?Number(r.context.purchase_price):null,weight_g:r.context.weight_g?Number(r.context.weight_g):null}}}
}
