// Photo 1 is the main listing photo. Dean drags to reorder; the order is saved
// in its own table (ci_photo_order_v1) and never changes the saved analysis.
export function applyPhotoOrder(indices:number[],saved:number[]|null|undefined):number[]{
 const have=new Set(indices)
 const first=(saved||[]).filter((i,n,a)=>have.has(i)&&a.indexOf(i)===n)
 return [...first,...indices.filter(i=>!first.includes(i))]
}
export function movePhoto<T>(order:T[],from:number,to:number):T[]{
 if(from===to||from<0||to<0||from>=order.length||to>=order.length)return order
 const next=[...order];const [moved]=next.splice(from,1);next.splice(to,0,moved);return next
}
const missingTable=(e:any)=>e?.code==='PGRST205'||e?.code==='42P01'||/ci_photo_order_v1/.test(String(e?.message||''))&&/not find|does not exist/i.test(String(e?.message||''))
export async function readPhotoOrder(client:any,runId:string,scope:string):Promise<{order:number[]|null;ready:boolean}>{
 const {data,error}=await client.from('ci_photo_order_v1').select('photo_order').eq('run_id',runId).eq('scope',scope).maybeSingle()
 if(error)return {order:null,ready:!missingTable(error)}
 return {order:Array.isArray(data?.photo_order)?data.photo_order:null,ready:true}
}
export async function savePhotoOrder(client:any,runId:string,ownerId:string,scope:string,order:number[]):Promise<string|null>{
 const {error}=await client.from('ci_photo_order_v1').upsert({run_id:runId,scope,owner_id:ownerId,photo_order:order,updated_at:new Date().toISOString()},{onConflict:'run_id,scope'})
 if(!error)return null
 return missingTable(error)?'Photo order not saved: the database change for photo order has not been applied yet.':'Photo order not saved: '+String(error.message||'database refused')
}
