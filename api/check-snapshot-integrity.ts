// Owner-authenticated integrity check for provisional source snapshots.
// Never authenticates the source publisher, sale amount, or comparable attribution.
import {createHash} from 'node:crypto'
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export default async function handler(req:any,res:any) {
 if(req.method!=='POST')return res.status(405).json({error:'POST required'})
 const bearer=String(req.headers.authorization||'').match(/^Bearer (.+)$/)?.[1]
 const id=String(req.body?.source_check_id||'')
 if(!bearer)return res.status(401).json({error:'Sign-in required'})
 if(!uuid.test(id))return res.status(400).json({error:'Invalid source check ID'})
 const base=process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.VITE_SUPABASE_URL||''
 const publicKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.VITE_SUPABASE_PUBLISHABLE_KEY||''
 const service=process.env.SUPABASE_SERVICE_ROLE_KEY||''
 if(!base||!publicKey||!service)return res.status(503).json({error:'Archive integrity service not configured'})
 const ownerHeaders={apikey:publicKey,Authorization:`Bearer ${bearer}`}
 try{
  const auth=await fetch(`${base}/auth/v1/user`,{headers:ownerHeaders})
  if(!auth.ok)return res.status(401).json({error:'Invalid session'})
  const user=await auth.json()
  const query=new URLSearchParams({select:'id,owner_id,comparable_id,archive_reference,snapshot_sha256,verification_decision',id:`eq.${id}`,limit:'1'})
  const rowsResponse=await fetch(`${base}/rest/v1/comparable_source_checks?${query}`,{headers:ownerHeaders})
  if(!rowsResponse.ok)return res.status(503).json({error:'Cannot inspect source-check ledger'})
  const rows=await rowsResponse.json()
  if(!Array.isArray(rows)||rows.length!==1||rows[0].owner_id!==user.id)
   return res.status(404).json({error:'Source check not accessible'})
  const row=rows[0]
  const prefix=`supabase://comparable-source-snapshots/${user.id}/${row.comparable_id}/`
  if(!row.archive_reference?.startsWith(prefix)||!/^supabase:\/\/comparable-source-snapshots\/[0-9a-f/-]+\.snapshot$/i.test(row.archive_reference))
   return res.status(422).json({error:'Unrecognised archive reference'})
  if(!/^[a-f0-9]{64}$/.test(row.snapshot_sha256||''))
   return res.status(422).json({error:'Missing valid snapshot SHA-256'})
  const objectPath=row.archive_reference.slice('supabase://comparable-source-snapshots/'.length)
  const escaped=objectPath.split('/').map(encodeURIComponent).join('/')
  const fetchResult=await fetch(`${base}/storage/v1/object/comparable-source-snapshots/${escaped}`,{
    headers:{apikey:service,Authorization:`Bearer ${service}`}})
  if(!fetchResult.ok)return res.status(404).json({status:'MISSING_OR_UNREADABLE',integrity_verified:false})
  const limit=262144
  if(Number(fetchResult.headers.get('content-length'))>limit) return res.status(413).json({error:'Snapshot larger than archive limit'})
  const reader=fetchResult.body?.getReader()
  if(!reader)return res.status(502).json({error:'No archive response body'})
  const parts:Buffer[]=[];let length=0
  while(true){const part=await reader.read();if(part.done)break;length+=part.value.byteLength
    if(length>limit){await reader.cancel();return res.status(413).json({error:'Snapshot exceeded permitted archive size'})}
    parts.push(Buffer.from(part.value))
  }
  const computed=createHash('sha256').update(Buffer.concat(parts)).digest('hex')
  const matches=computed===row.snapshot_sha256
  return res.status(200).json({source_check_id:id,integrity_verified:matches,
    status:matches?'ARCHIVE_HASH_MATCH':'ARCHIVE_HASH_MISMATCH',byte_count:length,
    source_authenticated:false,sale_verified:false,
    note:'This check confirms archived-byte integrity only, not original-page authenticity.'})
 }catch{return res.status(502).json({error:'Archive integrity check unavailable'})}
}
