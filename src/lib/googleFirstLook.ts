// Google first look: Google Cloud Vision Web Detection on ONE main photograph.
// Everything Google returns is an UNVERIFIED_LEAD for the research step to check.
// It is never a sold comparable, never an authentication and never a price.

export type GoogleLookPage={url:string;title:string}
export type GoogleFirstLook={
 status:'CALLED'|'NOT_RUN'
 reason:string|null
 checked_at:string
 evidence_class:'UNVERIFIED_LEAD'
 best_guess:string[]
 entities:Array<{description:string;score:number|null}>
 pages:GoogleLookPage[]
 similar_images:string[]
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
  evidence_class:'UNVERIFIED_LEAD',best_guess:[],entities:[],pages:[],similar_images:[]}
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
 return [
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
 imageUrl:string|undefined
 usedThisMonth:number|null
 limit?:number
 fetchImpl?:FetchLike
 now?:()=>string
}):Promise<GoogleFirstLook>{
 const now=opts.now||(()=>new Date().toISOString())
 const fetchImpl:FetchLike=opts.fetchImpl||((input,init)=>fetch(input,init))
 const limit=opts.limit??GOOGLE_MONTHLY_LIMIT
 if(!opts.apiKey)return googleNotRun('Google key not configured',now())
 if(!opts.imageUrl)return googleNotRun('No main photograph available',now())
 if(opts.usedThisMonth===null||!Number.isFinite(opts.usedThisMonth))return googleNotRun('Monthly Google limit could not be checked',now())
 if(opts.usedThisMonth>=limit)return googleNotRun('Monthly Google limit of '+limit+' checks reached',now())
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
