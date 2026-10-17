// Public museum reference lookup only. Records are leads, NEVER authentication or sold comparables.
import {vamImageFromRecord} from '../src/lib/vamVisual'
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
  const source=req.query?.source==='europeana'?'europeana':'vam';
  if(source==='vam'){
    return res.status(403).json({
      error:'The V&A requires a separate licence for commercial API/image use. Until a licence is confirmed, use the Met Open Access reference search or open the V&A catalogue website manually.',
      original_catalogue:'https://collections.vam.ac.uk/'
    });
  }

  if(source==='europeana'&&!process.env.EUROPEANA_API_KEY)return res.status(503).json({error:'Europeana connector awaits an official API key. V&A is available now.'});
  try {
    if(source==='europeana'){
      const endpoint=new URL('https://api.europeana.eu/record/v2/search.json');
      endpoint.searchParams.set('wskey',String(process.env.EUROPEANA_API_KEY));
      endpoint.searchParams.set('query',raw);
      endpoint.searchParams.set('rows','10');
      const reply=await fetch(endpoint,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(10000)});
      if(!reply.ok)return res.status(502).json({error:'Europeana service unavailable',upstream_status:reply.status});
      const body=await reply.json();
      if(!Array.isArray(body.items))return res.status(502).json({error:'Europeana response format changed'});
      const textField=(v:any):string=>typeof v==='string'?v:Array.isArray(v)?String(v.find((x:any)=>typeof x==='string')||''):''; 
      const results=body.items.slice(0,10).map((x:any)=>({
        id:String(x.id||''),
        title:textField(x.title)||'Untitled museum object',
        objectType:textField(x.type),
        maker:textField(x.dcCreator),
        date:textField(x.year),
        sourceUrl:typeof x.guid==='string'&&x.guid.startsWith('https://www.europeana.eu/')?x.guid:null,
        provider:'Europeana',
        evidenceStatus:'REFERENCE_LEAD_UNVERIFIED_FOR_USER_OBJECT'
      })).filter((x:any)=>x.id&&x.sourceUrl);
      res.setHeader('Cache-Control','private, no-store');
      return res.status(200).json({provider:'Europeana',query:raw,records:results,warning:'Museum records are leads only; not object authentication or sold-price evidence.'});
    }
    const endpoint=new URL('https://api.vam.ac.uk/v2/objects/search');
    endpoint.searchParams.set('q',raw);
    endpoint.searchParams.set('page_size','20');
    if(req.query?.visual==='1')endpoint.searchParams.set('images_exist','1');
    const reply=await fetch(endpoint,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(10000)});
    if(!reply.ok)return res.status(502).json({error:'V&A catalogue unavailable',upstream_status:reply.status});
    const body=await reply.json();
    if(!Array.isArray(body.records))return res.status(502).json({error:'V&A response format changed; no records accepted'});
    const readable=(value:any):string => typeof value==='string'?value:typeof value?.name==='string'?value.name:'';
    const results=body.records.slice(0,20).map((x:any)=>{
      const id=String(x.systemNumber||'');
      return {
        id,title:(readable(x._primaryTitle)||readable(x.objectType)||'Untitled museum object').slice(0,220),
        objectType:readable(x.objectType).slice(0,120),
        maker:readable(x._primaryMaker).slice(0,160),
        date:readable(x._primaryDate).slice(0,120),
        imageUrl:vamImageFromRecord(x),
        imageProvider:'Victoria and Albert Museum, London',
        accessionNumber:String(x.accessionNumber||'').slice(0,100),
        cataloguedMaterial:readable(x._sampleMaterial).slice(0,140),
        sourceUrl:/^O\d+$/.test(id)?'https://collections.vam.ac.uk/item/'+encodeURIComponent(id)+'/':null,
        provider:'Victoria and Albert Museum',
        evidenceStatus:'REFERENCE_LEAD_UNVERIFIED_FOR_USER_OBJECT'
      };
    }).filter((r:any)=>r.id && r.sourceUrl).filter((r:any,i:number,a:any[])=>a.findIndex((p:any)=>p.id===r.id)===i).slice(0,8);
    res.setHeader('Cache-Control','private, no-store');
    return res.status(200).json({provider:'Victoria and Albert Museum',query:raw,records:results,
      imageRightsNote:'Museum reference images courtesy of the V&A. Consult the linked V&A item record for reuse terms.',
      warning:'Museum catalogue records are reference leads only; they do not authenticate your object or verify market prices.'});
  }catch{return res.status(502).json({error:'Museum lookup unavailable; try again later'})}
}
