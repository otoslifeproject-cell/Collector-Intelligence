import {safeMetImage} from '../src/lib/openAccessVisual'
// Search ONLY the Met Museum's CC0, public-domain object images.
// No owner's original photograph is sent to the museum; only the typed text query.
export default async function handler(req:any,res:any){
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'})
 const url=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL
 const key=process.env.SUPABASE_ANON_KEY||process.env.VITE_SUPABASE_ANON_KEY
 const bearer=String(req.headers.authorization||'')
 if(!url||!key||!bearer.startsWith('Bearer '))return res.status(401).json({error:'Sign in required'})
 const token=bearer.slice(7)
 try{
  const auth=await fetch(url+'/auth/v1/user',{headers:{apikey:key,Authorization:'Bearer '+token},signal:AbortSignal.timeout(7000)})
  if(!auth.ok)return res.status(401).json({error:'Invalid session'})
 }catch{return res.status(503).json({error:'Authentication temporarily unavailable'})}
 const raw=typeof req.query?.q==='string'?req.query.q.trim():''
 if(raw.length<3||raw.length>100)return res.status(400).json({error:'Enter 3–100 characters of material, shape and decoration'})
 const base='https://collectionapi.metmuseum.org/public/collection/'
 try{
  const searchUrl=new URL(base+'v1.1/search')
  searchUrl.searchParams.set('q',raw)
  searchUrl.searchParams.set('hasImages','true')
  searchUrl.searchParams.set('limit','24')
  const sr=await fetch(searchUrl.toString(),{headers:{Accept:'application/json'},signal:AbortSignal.timeout(4800)})
  if(!sr.ok)return res.status(502).json({error:'Met Open Access search temporarily unavailable',upstream_status:sr.status})
  const j=await sr.json()
  if(!Array.isArray(j.objectIDs))return res.status(502).json({error:'Museum search format changed'})
  const ids=j.objectIDs.filter((id:any)=>Number.isSafeInteger(id)&&id>0&&id<=999999999).slice(0,7)
  const checked=await Promise.allSettled(ids.map(async(id:number)=>{
    const response=await fetch(base+'v1/objects/'+id,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(3200)})
    if(!response.ok)return null
    const o=await response.json()
    if(o.isPublicDomain!==true||typeof o.primaryImageSmall!=='string'||!o.primaryImageSmall)return null
    const imageUrl=safeMetImage(o.primaryImageSmall)
    if(!imageUrl)return null
    return {
      id:String(id),title:String(o.title||'Untitled museum object').slice(0,220),
      objectType:String(o.classification||o.objectName||'').slice(0,120),
      maker:String(o.artistDisplayName||o.culture||'').slice(0,160),
      date:String(o.objectDate||'').slice(0,120),
      sourceUrl:'https://www.metmuseum.org/art/collection/search/'+id,
      imageUrl,imageProvider:'The Metropolitan Museum of Art, New York',
      provider:'The Metropolitan Museum of Art',
      accessionNumber:String(o.accessionNumber||'').slice(0,100),
      cataloguedMaterial:String(o.medium||'').slice(0,140),
      imageLicense:'CC0 — Met Open Access',
      evidenceStatus:'MUSEUM_ILLUSTRATED_LEAD_UNVERIFIED_FOR_USER_OBJECT'
    }
  }))
  const results=checked.flatMap(x=>x.status==='fulfilled'&&x.value?[x.value]:[]).slice(0,8)
  res.setHeader('Cache-Control','private, no-store')
  return res.status(200).json({query:raw,provider:'The Metropolitan Museum of Art',records:results,
    rights:'Only isPublicDomain=true, Open Access (CC0) museum images are returned.',
    warning:'Lookalike museum records are research leads. They do not prove maker, period or achieved sale price.'})
 }catch{return res.status(502).json({error:'Met Open Access reference images could not be retrieved; try a narrower query later'})}
}
