// Extra photos (Dean, 31 Oct): final photos added after the first analysis, for
// the follow-up research and the listing. Own table; originals never change.
export type ExtraPhoto={run_id:string;object_index:number;photo_key:number;storage_path:string}
const missing=(e:any)=>e?.code==='PGRST205'||e?.code==='42P01'||/ci_extra_photos_v1/.test(String(e?.message||''))
export const NOT_READY='Adding photos needs one database change first (ask HQ for the "extra photos" SQL).'

export async function readExtraPhotos(client:any,runIds:string[]):Promise<{rows:ExtraPhoto[];ready:boolean}>{
 if(!runIds.length)return {rows:[],ready:true}
 const {data,error}=await client.from('ci_extra_photos_v1').select('run_id,object_index,photo_key,storage_path').in('run_id',runIds).order('photo_key')
 if(error)return {rows:[],ready:!missing(error)}
 return {rows:(data||[]) as ExtraPhoto[],ready:true}
}

export async function addExtraPhotos(client:any,ownerId:string,runId:string,objectIndex:number,files:File[]):Promise<{added:number;error:string|null}>{
 if(!files.length)return {added:0,error:null}
 const have=await readExtraPhotos(client,[runId])
 if(!have.ready)return {added:0,error:NOT_READY}
 let key=Math.max(999,...have.rows.map(r=>r.photo_key))
 let added=0
 for(const f of files.slice(0,12)){
  if(!/^image\/(jpeg|png|webp|heic|heif)$/.test(f.type))return {added,error:f.name+' is not a photo (JPEG, PNG, WebP or HEIC).'}
  key++
  const safe=f.name.replace(/[^A-Za-z0-9._-]+/g,'-').slice(-80)
  const path=ownerId+'/extra/'+runId+'/'+crypto.randomUUID()+'-'+safe
  const up=await client.storage.from('item-images').upload(path,f,{contentType:f.type,upsert:false})
  if(up.error)return {added,error:'Upload failed for '+f.name+': '+up.error.message}
  const ins=await client.from('ci_extra_photos_v1').insert({run_id:runId,object_index:objectIndex,photo_key:key,storage_path:path,file_name:f.name.slice(0,200)})
  if(ins.error)return {added,error:missing(ins.error)?NOT_READY:'Saved the file but not its link: '+ins.error.message}
  added++
 }
 return {added,error:null}
}

// Listing photos for a saved item, in the owner's order, without hidden ones:
// original photos (item_photos.position = analysis photo index) + extra photos.
export function listingPhotoPaths(itemPhotos:{storage_path:string;position:number}[],extras:{photo_key:number;storage_path:string}[],orderRow:{photo_order?:number[]|null;hidden?:number[]|null}|null|undefined):string[]{
 const keyed=new Map<number,string>()
 for(const p of itemPhotos)keyed.set(p.position,p.storage_path)
 for(const e of extras)keyed.set(e.photo_key,e.storage_path)
 const hidden=new Set(orderRow?.hidden||[])
 const saved=orderRow?.photo_order||[]
 const keys=[...keyed.keys()].sort((a,b)=>a-b)
 const first=saved.filter((k,i,a)=>keyed.has(k)&&a.indexOf(k)===i)
 return [...first,...keys.filter(k=>!first.includes(k))].filter(k=>!hidden.has(k)).map(k=>keyed.get(k) as string)
}
export async function readPhotoOrders(client:any,runIds:string[]){
 if(!runIds.length)return [] as any[]
 let r=await client.from('ci_photo_order_v1').select('run_id,scope,photo_order,hidden').in('run_id',runIds)
 if(r.error&&/hidden/.test(String(r.error.message||'')))r=await client.from('ci_photo_order_v1').select('run_id,scope,photo_order').in('run_id',runIds)
 return (r.data||[]) as any[]
}
