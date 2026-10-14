// Public museum reference lookup only. Records are leads, NEVER authentication or sold comparables.
export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({error:'Method not allowed'});
  const url=process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key=process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const bearer=String(req.headers.authorization||'');
  if(!url||!key||!bearer.startsWith('Bearer '))return res.status(401).json({error:'Sign in required'});
  const token=bearer.slice(7);
  try {
    const auth=await fetch(url+'/auth/v1/user',{headers:{apikey:key,Authorization:'Bearer '+token},signal:AbortSignal.timeout(7000)});
    if(!auth.ok)return res.status(401).json({error:'Invalid session'});
  } catch{return res.status(503).json({error:'Authentication temporarily unavailable'})}
  const raw=typeof req.query?.q==='string'?req.query.q.trim():'';
  if(raw.length<3||raw.length>100)return res.status(400).json({error:'Enter a search term of 3–100 characters'});
  try {
    const endpoint=new URL('https://api.vam.ac.uk/v2/objects/search');
    endpoint.searchParams.set('q',raw);
    endpoint.searchParams.set('page_size','8');
    const reply=await fetch(endpoint,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(10000)});
    if(!reply.ok)return res.status(502).json({error:'V&A catalogue unavailable',upstream_status:reply.status});
    const body=await reply.json();
    if(!Array.isArray(body.records))return res.status(502).json({error:'V&A response format changed; no records accepted'});
    const results=body.records.slice(0,8).map((x:any)=>{
      const id=String(x.systemNumber||'');
      return {
        id,title:String(x._primaryTitle||x._objectType||'Untitled museum object').slice(0,220),
        objectType:String(x._objectType||'').slice(0,120),
        maker:String(x._primaryMaker?.name||x._primaryMaker||'').slice(0,160),
        date:String(x._primaryDate||'').slice(0,120),
        sourceUrl:/^O\d+$/.test(id)?'https://collections.vam.ac.uk/item/'+encodeURIComponent(id)+'/':null,
        provider:'Victoria and Albert Museum',
        evidenceStatus:'REFERENCE_LEAD_UNVERIFIED_FOR_USER_OBJECT'
      };
    }).filter((r:any)=>r.id && r.sourceUrl);
    res.setHeader('Cache-Control','private, no-store');
    return res.status(200).json({provider:'Victoria and Albert Museum',query:raw,records:results,warning:'Museum catalogue records are reference leads only; they do not authenticate your object or verify market prices.'});
  }catch{return res.status(502).json({error:'Museum lookup unavailable; try again later'})}
}
