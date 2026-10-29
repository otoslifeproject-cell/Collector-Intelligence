// Google first look: Google Cloud Vision Web Detection on ONE main photograph.
// Everything Google returns is an UNVERIFIED_LEAD for the research step to check.
// It is never a sold comparable, never an authentication and never a price.

export type GoogleLookPage={url:string;title:string}
// Google Lens visual matches, fetched through SerpApi's google_lens engine: the
// same matches the owner sees in Lens. Prices shown are page prices (usually asking).
export type LensMatch={title:string;url:string;source:string;price:string|null}
export type LensLook={status:'CALLED'|'NOT_RUN';reason:string|null;matches:LensMatch[]}
export type GoogleFirstLook={
 status:'CALLED'|'NOT_RUN'
 reason:string|null
 checked_at:string
 evidence_class:'UNVERIFIED_LEAD'
 best_guess:string[]
 entities:Array<{description:string;score:number|null}>
 pages:GoogleLookPage[]
 similar_images:string[]
 lens?:LensLook|null
}

export const GOOGLE_MONTHLY_LIMIT=100
const MAX_INLINE_BYTES=7_000_000

const clean=(value:unknown,limit=200)=>String(value??'')
 .replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'")
 .replace(/\s+/g,' ').trim().slice(0,limit)
const webUrl=(value:unknown)=>{
 const text=String(value??'').trim()
 return /^https?:\/\/[^\s"<>]+$/i.test(text)&&text.length<=600?text:''
}

export function googleNotRun(reason:string,checkedAt=new Date().toISOString()):GoogleFirstLook{
 return {status:'NOT_RUN',reason:clean(reason,160)||'Google check not run',checked_at:checkedAt,
  evidence_class:'UNVERIFIED_LEAD',best_guess:[],entities:[],pages:[],similar_images:[],lens:null}
}
const lensNotRun=(reason:string):LensLook=>({status:'NOT_RUN',reason,matches:[]})

export function normaliseLens(raw:any):LensLook{
 const seen=new Set<string>(),matches:LensMatch[]=[]
 const rows=[...(Array.isArray(raw?.visual_matches)?raw.visual_matches:[]),...(Array.isArray(raw?.exact_matches)?raw.exact_matches:[])]
 for(const m of rows){
  const url=webUrl(m?.link)
  if(!url||seen.has(url))continue
  seen.add(url)
  const p=m?.price
  const price=p?clean(p.value||(Number.isFinite(p.extracted_value)?String(p.extracted_value)+(p.currency?' '+p.currency:''):''),40)||null:null
  matches.push({title:clean(m?.title,160)||url,url,source:clean(m?.source,60),price})
  if(matches.length>=12)break
 }
 return {status:'CALLED',reason:null,matches}
}

async function runLens(serpKey:string,imageUrl:string,fetchImpl:FetchLike):Promise<LensLook>{
 try{
  const qp=new URLSearchParams({engine:'google_lens',url:imageUrl,hl:'en',country:'gb',api_key:serpKey})
  const response=await fetchImpl('https://serpapi.com/search.json?'+qp.toString())
  const payload=await response.json().catch(()=>null)
  if(!response.ok||payload?.error)return lensNotRun('Google Lens service returned an error'+(response.status?' ('+response.status+')':''))
  return normaliseLens(payload)
 }catch{return lensNotRun('Google Lens service could not be reached')}
}

export function normaliseWebDetection(raw:any,checkedAt=new Date().toISOString()):GoogleFirstLook{
 const web=raw?.responses?.[0]?.webDetection||raw?.webDetection||{}
 const seenPages=new Set<string>()
 const pages:GoogleLookPage[]=[]
 for(const page of Array.isArray(web.pagesWithMatchingImages)?web.pagesWithMatchingImages:[]){
  const url=webUrl(page?.url)
  if(!url||seenPages.has(url))continue
  seenPages.add(url)
  pages.push({url,title:clean(page?.pageTitle,160)||url})
  if(pages.length>=10)break
 }
 const entities=(Array.isArray(web.webEntities)?web.webEntities:[])
  .map((e:any)=>({description:clean(e?.description,80),score:Number.isFinite(e?.score)?Math.round(Number(e.score)*100)/100:null}))
  .filter((e:any)=>e.description).slice(0,10)
 const best_guess=(Array.isArray(web.bestGuessLabels)?web.bestGuessLabels:[])
  .map((l:any)=>clean(l?.label,120)).filter(Boolean).slice(0,3)
 const similar_images=(Array.isArray(web.visuallySimilarImages)?web.visuallySimilarImages:[])
  .map((i:any)=>webUrl(i?.url)).filter(Boolean).slice(0,6)
 return {status:'CALLED',reason:null,checked_at:checkedAt,evidence_class:'UNVERIFIED_LEAD',
  best_guess,entities,pages,similar_images}
}

// Text handed to the research model. Leads only; the model must check them.
export function googleLeadsForResearch(look:GoogleFirstLook|null|undefined):string{
 if(!look)return 'GOOGLE FIRST LOOK: not available for this research run.'
 if(look.status!=='CALLED')return 'GOOGLE FIRST LOOK: not run ('+(look.reason||'no reason recorded')+'). Research from the photographs.'
 const lens=look.lens?.status==='CALLED'&&look.lens.matches.length?[
  'GOOGLE LENS VISUAL MATCHES for the main photograph (the same matches the owner sees in Google Lens). UNVERIFIED LEADS: a similar-looking item is not proof of maker; the prices shown are page prices, usually ASKING, never sold unless the page itself proves a sale:',
  ...look.lens.matches.map((m,i)=>(i+1)+'. '+m.title+(m.source?' — '+m.source:'')+(m.price?' — page price '+m.price:'')+' — '+m.url),
  'Where several Lens matches name the same maker or pattern, research that maker and pattern first: confirm or reject it from catalogues, collector references and SOLD results, and say so in identification_update.'
 ]:[]
 return [...lens,
  'GOOGLE FIRST LOOK (Google Cloud Vision Web Detection, run by Collector Intelligence on the main photograph). These are UNVERIFIED LEADS, not facts, not prices and not authentication.',
  'Google best guess: '+(look.best_guess.join('; ')||'none'),
  'Google web entities: '+(look.entities.map(e=>e.description+(e.score!==null?' ('+e.score+')':'')).join('; ')||'none'),
  'Pages Google found with matching images:',
  ...(look.pages.length?look.pages.map((p,i)=>(i+1)+'. '+p.title+' — '+p.url):['none']),
  'START FROM THESE LEADS: open and check the pages Google found; search the makers, patterns and names they suggest; then search eBay SOLD/completed listings, specialist collector forums and UK auction results for the same pattern. In identification_update.rationale and contradictions, say which Google leads your sources support and which they contradict.'
 ].join('\n')
}

type FetchLike=(input:string,init?:any)=>Promise<any>

function toBase64(bytes:Uint8Array):string{
 let binary=''
 for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000))
 return btoa(binary)
}

// One call per research run, one photograph, fail closed on the monthly limit.
export async function runGoogleFirstLook(opts:{
 apiKey:string|undefined
 serpKey?:string|undefined
 imageUrl:string|undefined
 usedThisMonth:number|null
 limit?:number
 fetchImpl?:FetchLike
 now?:()=>string
}):Promise<GoogleFirstLook>{
 const now=opts.now||(()=>new Date().toISOString())
 const fetchImpl:FetchLike=opts.fetchImpl||((input,init)=>fetch(input,init))
 const limit=opts.limit??GOOGLE_MONTHLY_LIMIT
 if(!opts.apiKey&&!opts.serpKey)return googleNotRun('Google key not configured',now())
 if(!opts.imageUrl)return googleNotRun('No main photograph available',now())
 if(opts.usedThisMonth===null||!Number.isFinite(opts.usedThisMonth))return googleNotRun('Monthly Google limit could not be checked',now())
 if(opts.usedThisMonth>=limit)return googleNotRun('Monthly Google limit of '+limit+' checks reached',now())
 const [web,lens]=await Promise.all([
  opts.apiKey?webDetection(opts.apiKey,opts.imageUrl,fetchImpl,now):Promise.resolve(googleNotRun('Google key not configured',now())),
  opts.serpKey?runLens(opts.serpKey,opts.imageUrl,fetchImpl):Promise.resolve(lensNotRun('Google Lens key not configured'))
 ])
 if(web.status==='CALLED'||lens.status==='CALLED')return {...web,status:'CALLED',reason:web.status==='CALLED'?null:web.reason,lens}
 return {...web,lens}
}

async function webDetection(apiKey:string,imageUrl:string,fetchImpl:FetchLike,now:()=>string):Promise<GoogleFirstLook>{
 const opts={apiKey,imageUrl}
 let image:any
 try{
  const photo=await fetchImpl(opts.imageUrl)
  if(!photo?.ok)return googleNotRun('Main photograph could not be read',now())
  const bytes=new Uint8Array(await photo.arrayBuffer())
  image=bytes.length>0&&bytes.length<=MAX_INLINE_BYTES?{content:toBase64(bytes)}:{source:{imageUri:opts.imageUrl}}
 }catch{return googleNotRun('Main photograph could not be read',now())}
 try{
  const response=await fetchImpl('https://vision.googleapis.com/v1/images:annotate?key='+encodeURIComponent(opts.apiKey),{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({requests:[{image,features:[{type:'WEB_DETECTION',maxResults:20}],
    imageContext:{webDetectionParams:{includeGeoResults:false}}}]})
  })
  const payload=await response.json().catch(()=>null)
  if(!response.ok)return googleNotRun('Google returned an error ('+response.status+')',now())
  if(payload?.responses?.[0]?.error)return googleNotRun('Google could not read the photograph',now())
  return normaliseWebDetection(payload,now())
 }catch{return googleNotRun('Google could not be reached',now())}
}

// Lens link for the owner's own look. Google Lens opens a public image URL;
// a signed private URL expires, so the link is only offered while it is valid.
export function googleLensLink(imageUrl:string|null|undefined):string{
 if(!imageUrl||!/^https:\/\//i.test(imageUrl))return 'https://lens.google.com/'
 return 'https://lens.google.com/uploadbyurl?url='+encodeURIComponent(imageUrl)
}
