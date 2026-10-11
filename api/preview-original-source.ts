// Read-only original-source preview. Never marks a result verified or writes an evidence row.
// Operator must configure comma-separated SOURCE_FETCH_ALLOWED_HOSTS. No unrestricted URL fetching.
import { lookup } from 'node:dns/promises'
import { createHash } from 'node:crypto'
import { isIP } from 'node:net'

function publicAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const n=ip.split('.').map(Number)
    if(n[0]===0||n[0]===10||n[0]===127||n[0]>=224||n[0]===169&&n[1]===254||
       n[0]===172&&n[1]>=16&&n[1]<=31||n[0]===192&&n[1]===168||
       n[0]===100&&n[1]>=64&&n[1]<=127||n[0]===192&&n[1]===0&&n[2]===0||
       n[0]===198&&n[1]>=18&&n[1]<=19) return false
    return true
  }
  if (isIP(ip) === 6) {
    const x=ip.toLowerCase()
    return !(x==='::'||x==='::1'||x.startsWith('fe80:')||x.startsWith('fc')||x.startsWith('fd')||x.startsWith('ff')||x.startsWith('::ffff:'))
  }
  return false
}
export default async function handler(req:any,res:any) {
  if(req.method!=='POST') return res.status(405).json({error:'POST required'})
  const token=String(req.headers.authorization||'').replace(/^Bearer /,'')
  if(!token) return res.status(401).json({error:'Authentication required'})
  const base=process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.VITE_SUPABASE_URL||''
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.VITE_SUPABASE_PUBLISHABLE_KEY||''
  if(!base||!key) return res.status(503).json({error:'Owner database configuration missing'})
  const headers={apikey:key,Authorization:`Bearer ${token}`}
  try {
    const userResponse=await fetch(`${base}/auth/v1/user`,{headers})
    if(!userResponse.ok) return res.status(401).json({error:'Invalid session'})
    const id=String(req.body?.comparable_id||'')
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
      return res.status(400).json({error:'Invalid comparable ID'})
    const query=new URLSearchParams({select:'id,source_url,source_reference',id:`eq.${id}`,limit:'1'})
    const rowResponse=await fetch(`${base}/rest/v1/comparables?${query}`,{headers})
    if(!rowResponse.ok) return res.status(503).json({error:'Owner lookup unavailable'})
    const rows=await rowResponse.json()
    if(!Array.isArray(rows)||rows.length!==1) return res.status(403).json({error:'Comparable not accessible'})
    const raw=rows[0].source_url
    if(!raw) return res.status(422).json({error:'No original source URL'})
    const u=new URL(raw)
    const allowed=(process.env.SOURCE_FETCH_ALLOWED_HOSTS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean)
    if(u.protocol!=='https:'||u.port||u.username||u.password||!allowed.includes(u.hostname.toLowerCase())||isIP(u.hostname))
      return res.status(422).json({error:'Source host is not explicitly permitted for retrieval'})
    const addresses=await lookup(u.hostname,{all:true,verbatim:true})
    if(!addresses.length||addresses.some(a=>!publicAddress(a.address)))
      return res.status(422).json({error:'Source DNS includes non-public address'})
    const controller=new AbortController()
    const timeout=setTimeout(()=>controller.abort(),7000)
    let response:Response
    try {
      response=await fetch(u.toString(),{method:'GET',redirect:'manual',signal:controller.signal,
        headers:{Accept:'text/html, text/plain;q=0.8','User-Agent':'CollectorIntelligenceEvidencePreview/1.0'}})
      if(response.status>=300&&response.status<400) return res.status(422).json({error:'Redirect not followed; separate original URL review required'})
      if(!response.ok) return res.status(502).json({error:'Original source unavailable',http_status:response.status})
      const type=response.headers.get('content-type')||''
      if(!/^(text\/html|text\/plain)\b/i.test(type)) return res.status(422).json({error:'Only HTML or plain text source preview supported'})
      const reader=response.body?.getReader()
      if(!reader) return res.status(502).json({error:'Empty original response'})
      const chunks:Uint8Array[]=[];let size=0
      while(true){
        const next=await reader.read()
        if(next.done) break
        size+=next.value.length
        if(size>262144){await reader.cancel();return res.status(413).json({error:'Source exceeds 256 KiB preview limit'})}
        chunks.push(next.value)
      }
      const bytes=Buffer.concat(chunks.map(x=>Buffer.from(x)))
      const digest=createHash('sha256').update(bytes).digest('hex')
      const excerpt=bytes.toString('utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ')
         .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ')
         .replace(/\s+/g,' ').trim().slice(0,1800)
      return res.status(200).json({source_url:u.toString(),retrieved_at:new Date().toISOString(),
        sha256:digest,byte_count:bytes.length,excerpt,classification:'UNKNOWN',
        verification_decision:'UNVERIFIED',archived:false,
        warning:'Preview only: hash is of retrieved bytes, which are NOT archived. No sale is verified.'})
    } finally {clearTimeout(timeout)}
  } catch {
    return res.status(502).json({error:'Could not safely retrieve source preview'})
  }
}
