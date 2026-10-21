import type {SupabaseClient} from '@supabase/supabase-js'
import type {ItemPhoto} from '../types'

export type OwnedPhotograph=ItemPhoto&{owner_id:string}
type PhotoScope={itemId:string;ownerId:string;itemCode:string}
export type PhotographAttempt={request:Readonly<PhotoScope&{id:string;path:string;file:File;position:number;sha256:string}>;stored:boolean}
export class PhotographError extends Error {}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const active=(current:()=>boolean)=>{if(!current())throw new PhotographError('Photograph operation stopped for the previous object.')}
const fail=(message:string):never=>{throw new PhotographError(message)}
const sha256=async(file:Blob)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer())),n=>n.toString(16).padStart(2,'0')).join('')
export async function verifiedPhotographScope(client:SupabaseClient,itemId:string,current:()=>boolean):Promise<PhotoScope>{
 active(current)
 if(!uuid.test(itemId))return fail('This collection object could not be identified.')
 const auth=await client.auth.getUser();active(current)
 if(auth.error||!auth.data.user)return fail('Sign in again before accessing private photographs.')
 const ownerId=auth.data.user.id
 const read=await client.from('items').select('id,owner_id,item_code').eq('id',itemId).eq('owner_id',ownerId).abortSignal(AbortSignal.timeout(20000)).maybeSingle();active(current)
 if(read.error||read.data?.id!==itemId||read.data.owner_id!==ownerId||typeof read.data.item_code!=='string')return fail('This collection object is unavailable for the signed-in account.')
 return {itemId,ownerId,itemCode:read.data.item_code}
}
export async function readItemPhotographs(client:SupabaseClient,itemId:string,current:()=>boolean){
 const scope=await verifiedPhotographScope(client,itemId,current)
 const read=await client.from('item_photos').select('*',{count:'exact'}).eq('item_id',scope.itemId).eq('owner_id',scope.ownerId)
  .order('position').order('id').limit(501).abortSignal(AbortSignal.timeout(20000));active(current)
 if(read.error||!read.data||read.count===null||read.count>500||read.count!==read.data.length)return fail('Complete photograph history could not be loaded. Reload before uploading.')
 const rows=read.data as OwnedPhotograph[]
 if(new Set(rows.map(row=>row.id)).size!==rows.length||rows.some(row=>!uuid.test(row.id)||row.owner_id!==scope.ownerId||row.item_id!==scope.itemId||!Number.isInteger(row.position)||typeof row.storage_path!=='string'||!row.storage_path.startsWith(scope.ownerId+'/')))return fail('The saved photograph records could not be verified. Reload before uploading.')
 return {scope,rows}
}
export async function preparePhotographAttempts(client:SupabaseClient,itemId:string,files:File[],current:()=>boolean):Promise<PhotographAttempt[]>{
 for(const file of files){
  if(!['image/jpeg','image/png','image/webp','image/heic','image/heif'].includes(file.type)||file.size<1)return fail('Choose a non-empty JPEG, PNG, WebP, HEIC or HEIF photograph.')
  if(file.size>26214400)return fail('Each photograph must be no larger than 25 MB.')
 }
 const {scope,rows}=await readItemPhotographs(client,itemId,current)
 const firstPosition=Math.max(-1,...rows.map(row=>row.position))+1
 const attempts:PhotographAttempt[]=[]
 for(const [index,file]of files.entries()){
  const id=crypto.randomUUID(),safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,'_'),safeCode=scope.itemCode.replace(/[^a-zA-Z0-9._-]/g,'_')
  const hash=await sha256(file);active(current)
  attempts.push({request:Object.freeze({...scope,id,path:`${scope.ownerId}/${safeCode}/${id}-${safeName}`,file,position:firstPosition+index,sha256:hash}),stored:false})
 }
 return attempts
}
export async function settlePhotographAttempt(client:SupabaseClient,attempt:PhotographAttempt,current:()=>boolean):Promise<OwnedPhotograph>{
 const request=attempt.request,bucket=client.storage.from('item-images')
 const scope=await verifiedPhotographScope(client,request.itemId,current)
 if(scope.ownerId!==request.ownerId)return fail('Your account changed. The previous photograph request has been stopped.')
 const readBack=async()=>{
  const read=await client.from('item_photos').select('*').eq('id',request.id).eq('owner_id',request.ownerId).eq('item_id',request.itemId).abortSignal(AbortSignal.timeout(20000)).maybeSingle();active(current)
  if(read.error)return fail('The photograph link could not be checked. Keep this page open and retry the same request.')
  if(!read.data)return null
  const row=read.data as OwnedPhotograph
  if(row.id!==request.id||row.owner_id!==request.ownerId||row.item_id!==request.itemId||row.storage_path!==request.path||row.file_name!==request.file.name||row.position!==request.position)return fail('The saved photograph link differs from this request. Review it before continuing.')
  return row
 }
 const verifyOriginal=async()=>{
  const read=await bucket.download(request.path);active(current)
  if(read.error||!read.data)return fail('The original upload is not yet confirmed. Keep this page open and retry the same request.')
  if(read.data.size!==request.file.size||await sha256(read.data)!==request.sha256)return fail('The stored original differs from the selected file. It has been preserved for review.')
  active(current);attempt.stored=true
 }
 const existing=await readBack()
 if(existing){await verifyOriginal();return existing}
 if(!attempt.stored){
  const upload=await bucket.upload(request.path,request.file,{upsert:false,contentType:request.file.type});active(current)
  if(upload.error||upload.data?.path!==request.path)await verifyOriginal()
  else attempt.stored=true
 }else await verifyOriginal()
 const identity=await verifiedPhotographScope(client,request.itemId,current)
 if(identity.ownerId!==request.ownerId)return fail('Your account changed. The stored original has been retained privately.')
 // Client-chosen immutable row ID makes a deliberate retry safe even if the
 // first INSERT committed but its acknowledgement was lost. Never upsert.
 await client.from('item_photos').insert({id:request.id,owner_id:request.ownerId,item_id:request.itemId,storage_path:request.path,file_name:request.file.name,position:request.position}).abortSignal(AbortSignal.timeout(20000))
 active(current)
 const saved=await readBack()
 if(!saved)return fail('The original is stored privately, but its link is not confirmed. Keep this page open and retry the same request.')
 return saved
}
