import type {SupabaseClient} from '@supabase/supabase-js'
import {hasIntakeReport,type IntakeRow} from './intakeSession'

export type SavedIntake=IntakeRow&{created_at:string}
export class SavedIntakeError extends Error{}
export const intakePageSize=20
const fields='id,owner_id,mode,status,model,input_photo_count,created_at,user_context,result'
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const plain=(value:any)=>value!==null&&typeof value==='object'&&!Array.isArray(value)
const stop=(current:()=>boolean)=>{if(!current())throw new SavedIntakeError('The previous private view has been stopped.')}
const fail=(message:string):never=>{throw new SavedIntakeError(message)}
async function checkedOwner(client:SupabaseClient,current:()=>boolean,expected?:string){
 stop(current);const auth=await client.auth.getUser();stop(current)
 if(auth.error||!auth.data.user)return fail('Sign in again to check your saved uploads.')
 if(expected&&auth.data.user.id!==expected)return fail('Your account changed. Reopen saved uploads for the current account.')
 return auth.data.user.id
}
function validRow(row:any,owner:string):row is SavedIntake{
 return plain(row)&&uuid.test(row.id)&&row.owner_id===owner&&['single','batch'].includes(row.mode)&&['DRAFT','APPROVED'].includes(row.status)&&typeof row.model==='string'&&
  Number.isInteger(row.input_photo_count)&&row.input_photo_count>=0&&row.input_photo_count<=40&&typeof row.created_at==='string'&&Number.isFinite(Date.parse(row.created_at))
}
export async function listSavedIntakes(client:SupabaseClient,page:number,current:()=>boolean){
 if(!Number.isInteger(page)||page<1||page>25000)return fail('This saved upload page is invalid. Return to the first page.')
 const owner=await checkedOwner(client,current),offset=(page-1)*intakePageSize
 const result=await client.from('ai_analysis_runs').select(fields,{count:'exact'}).eq('owner_id',owner).in('mode',['single','batch']).in('status',['DRAFT','APPROVED'])
  .order('created_at',{ascending:false}).order('id',{ascending:false}).range(offset,offset+intakePageSize-1).abortSignal(AbortSignal.timeout(20000));stop(current)
 if(result.error||!Array.isArray(result.data)||!Number.isSafeInteger(result.count)||result.count!<0)return fail('Saved uploads could not be checked. Try checking again; no new analysis is needed.')
 const total=result.count!,rows=result.data
 if(rows.length!==Math.max(0,Math.min(intakePageSize,total-offset))||rows.some(row=>!validRow(row,owner))||new Set(rows.map(row=>row.id)).size!==rows.length)
  return fail('This saved upload page is incomplete or inconsistent. Check it again before continuing.')
 if(offset>=total&&page>1)return fail('The saved upload list changed. Return to the first page and check again.')
 return {owner,rows:rows as SavedIntake[],total,page}
}
export async function readSavedIntake(client:SupabaseClient,id:string,current:()=>boolean){
 if(!uuid.test(id))return fail('This saved session link is invalid.')
 const owner=await checkedOwner(client,current)
 const result=await client.from('ai_analysis_runs').select(fields).eq('id',id).eq('owner_id',owner).in('mode',['single','batch']).in('status',['DRAFT','APPROVED'])
  .abortSignal(AbortSignal.timeout(20000)).maybeSingle();stop(current)
 if(result.error)return fail('This saved session could not be checked. Try checking again; no new analysis is needed.')
 if(!result.data)return null
 if(!validRow(result.data,owner)||result.data.id.toLowerCase()!==id.toLowerCase())return fail('This saved session has inconsistent identity or metadata. It has not been opened.')
 return result.data as SavedIntake
}
export function savedReportAvailable(row:SavedIntake){return plain(row.result)&&hasIntakeReport(row)}
export function savedIntakeTitle(row:SavedIntake){
 const title=plain(row.result)&&Array.isArray(row.result.objects)&&row.result.objects[0]?.working_title
 return typeof title==='string'&&title.trim()?title.slice(0,160):'Photo upload awaiting review'
}
export function savedIntakeState(row:SavedIntake){
 if(row.status==='APPROVED')return 'Approved upload'
 if(savedReportAvailable(row))return row.result.analysis_stage==='COMPLETE'?'Draft ready to review':'First result saved — needs review'
 return row.result?.analysis_stage==='UPLOADED'?'Awaiting saved analysis':'Saved response needs review'
}
// Legacy uploads used a separate folder UUID, so the folder must not be guessed
// from the analysis ID. Only paths explicitly retained in a complete own manifest
// may be signed. A preview is not independent authentication of the photograph.
function savedManifest(row:SavedIntake){
 const manifest=row.result?.image_manifest
 if(!Array.isArray(manifest)||manifest.length!==row.input_photo_count||!manifest.length)return []
 const seen=new Set<string>()
 const valid=manifest.every((photo:any,index:number)=>{
  if(!plain(photo)||photo.index!==index||typeof photo.file_name!=='string'||typeof photo.storage_path!=='string')return false
  const path=photo.storage_path,parts=path.split('/')
  if(parts.length!==4||parts[0]!==row.owner_id||parts[1]!=='intake'||! /^[a-zA-Z0-9_-]{1,120}$/.test(parts[2])||!parts[3]||/[\\%\u0000-\u001f]/.test(path)||parts.some((part:string)=>part==='.'||part==='..')||seen.has(path))return false
  seen.add(path);return true
 })
 return valid?manifest:[]
}
export async function savedIntakePreviews(client:SupabaseClient,rows:SavedIntake[],allPhotos:boolean,current:()=>boolean){
 if(!rows.length)return {} as Record<string,{index:number;name:string;url:string}[]>
 await checkedOwner(client,current,rows[0].owner_id)
 const results=await Promise.all(rows.map(async row=>{
  if(row.owner_id!==rows[0].owner_id)return fail('Saved uploads from different accounts cannot share a preview.')
  const manifest=savedManifest(row),selected=allPhotos?manifest:manifest.slice(0,1)
  const photos=await Promise.all(selected.map(async(photo:any)=>{
   stop(current);const signed=await client.storage.from('item-images').createSignedUrl(photo.storage_path,900);stop(current)
   return {index:photo.index,name:photo.file_name,url:signed.error?'':signed.data?.signedUrl||''}
  }));return [row.id,photos] as const
 }));stop(current)
 return Object.fromEntries(results)
}
