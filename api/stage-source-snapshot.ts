// Private staging for supplied source bytes; NEVER independent source authentication.
// A caller can provide arbitrary bytes. Only a separately verified fetch may claim SOURCE_CONFIRMED.
import { createHash, randomUUID } from 'node:crypto'
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
export default async function handler(req:any,res:any){
 if(req.method!=='POST')return res.status(405).json({error:'POST required'})
 const token=String(req.headers.authorization||'').match(/^Bearer (.+)$/)?.[1]
 if(!token)return res.status(401).json({error:'Sign-in required'})
 const base=process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.VITE_SUPABASE_URL||''
 const publish=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.VITE_SUPABASE_PUBLISHABLE_KEY||''
 const service=process.env.SUPABASE_SERVICE_ROLE_KEY||''
 if(!base||!publish||!service)return res.status(503).json({error:'Secure snapshot staging is not configured'})
 const cid=String(req.body?.comparable_id||'')
 const data=String(req.body?.snapshot_base64||'')
 if(!ID.test(cid)||!data||data.length>360000||!/^[A-Za-z0-9+/]*={0,2}$/.test(data))
   return res.status(400).json({error:'Invalid comparable ID or snapshot bytes'})
 const bytes=Buffer.from(data,'base64')
 if(!bytes.length||bytes.length>262144||bytes.toString('base64')!==data)
   return res.status(413).json({error:'Invalid or oversized source snapshot'})
 const format=String(req.body?.media_type||'')
 if(!['text/html','text/plain'].includes(format))return res.status(415).json({error:'HTML or plain text only'})
 const clientHeaders={apikey:publish,Authorization:`Bearer ${token}`}
 const serviceHeaders={apikey:service,Authorization:`Bearer ${service}`}
 try{
   const userResp=await fetch(`${base}/auth/v1/user`,{headers:clientHeaders})
   if(!userResp.ok)return res.status(401).json({error:'Invalid signed-in session'})
   const user=await userResp.json()
   if(!ID.test(user.id))return res.status(401).json({error:'Invalid owner identity'})
   const query=new URLSearchParams({select:'id,owner_id',id:`eq.${cid}`,limit:'1'})
   const owned=await fetch(`${base}/rest/v1/comparables?${query}`,{headers:clientHeaders})
   if(!owned.ok)return res.status(503).json({error:'Ownership check unavailable'})
   const rows=await owned.json()
   if(!Array.isArray(rows)||rows.length!==1||rows[0].owner_id!==user.id)
     return res.status(403).json({error:'Comparable is not owned by this user'})
   const sha=createHash('sha256').update(bytes).digest('hex')
   const path=`${user.id}/${cid}/${randomUUID()}.snapshot`
   const bucket='comparable-source-snapshots'
   const encodedPath=path.split('/').map(encodeURIComponent).join('/')
   const uri=`${base}/storage/v1/object/${bucket}/${encodedPath}`
   const upload=await fetch(uri,{method:'POST',headers:{...serviceHeaders,'Content-Type':format,'x-upsert':'false'},body:bytes})
   if(!upload.ok)return res.status(502).json({error:'Private snapshot upload failed'})
   const read=await fetch(uri,{headers:serviceHeaders})
   if(!read.ok)return res.status(502).json({error:'Snapshot uploaded but read-back failed; quarantine required'})
   const saved=Buffer.from(await read.arrayBuffer())
   const confirmed=createHash('sha256').update(saved).digest('hex')
   if(confirmed!==sha||saved.length!==bytes.length)
     return res.status(502).json({error:'Snapshot read-back hash mismatch; quarantine required'})
   return res.status(200).json({status:'STAGED_UNVERIFIED',archive_reference:`supabase://${bucket}/${path}`,
     sha256:sha,byte_count:bytes.length,readback_verified:true,source_authenticated:false,
     warning:'User-supplied bytes; does not establish original auction provenance, sale price or source confirmation. Drive primary archive sync still required.'})
 }catch{
   return res.status(502).json({error:'Snapshot staging or verification failed'})
 }
}
