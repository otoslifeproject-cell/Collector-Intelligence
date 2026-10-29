import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {normaliseWebDetection,runGoogleFirstLook,googleLeadsForResearch,googleLensLink,GOOGLE_MONTHLY_LIMIT} from '../src/lib/googleFirstLook.ts'

const research=readFileSync(new URL('../api/research-item.ts',import.meta.url),'utf8')
const sample={responses:[{webDetection:{
 bestGuessLabels:[{label:'whitefriars glass bowl'}],
 webEntities:[{description:'Whitefriars Glass',score:0.81},{description:'Bowl',score:0.4},{score:0.2}],
 pagesWithMatchingImages:[
  {url:'https://www.ebay.co.uk/itm/1',pageTitle:'<b>WHITEFRIARS</b> TINTED &amp; THREADED BOWL'},
  {url:'https://www.ebay.co.uk/itm/1',pageTitle:'duplicate'},
  {url:'javascript:alert(1)',pageTitle:'bad'}],
 visuallySimilarImages:[{url:'https://example.com/a.jpg'}]}}]}
const okPhoto=async()=>({ok:true,arrayBuffer:async()=>new Uint8Array([1,2,3]).buffer})

test('web detection becomes clean, de-duplicated unverified leads',()=>{
 const look=normaliseWebDetection(sample,'2026-10-29T00:00:00.000Z')
 assert.equal(look.status,'CALLED')
 assert.equal(look.evidence_class,'UNVERIFIED_LEAD')
 assert.deepEqual(look.best_guess,['whitefriars glass bowl'])
 assert.equal(look.pages.length,1)
 assert.equal(look.pages[0].title,'WHITEFRIARS TINTED & THREADED BOWL')
 assert.equal(look.entities.length,2)
})

test('missing key, unknown count and the monthly limit all fail closed without calling Google',async()=>{
 let calls=0
 const fetchImpl=async()=>{calls++;return {ok:true,json:async()=>sample}}
 const noKey=await runGoogleFirstLook({apiKey:'',imageUrl:'https://x/y.jpg',usedThisMonth:0,fetchImpl})
 const unknown=await runGoogleFirstLook({apiKey:'k',imageUrl:'https://x/y.jpg',usedThisMonth:null,fetchImpl})
 const full=await runGoogleFirstLook({apiKey:'k',imageUrl:'https://x/y.jpg',usedThisMonth:GOOGLE_MONTHLY_LIMIT,fetchImpl})
 for(const look of [noKey,unknown,full])assert.equal(look.status,'NOT_RUN')
 assert.match(noKey.reason,/not configured/)
 assert.match(full.reason,/limit/)
 assert.equal(calls,0)
})

test('one photograph is sent once to Web Detection and Google errors become "not run"',async()=>{
 const sent=[]
 const fetchImpl=async(url,init)=>{
  if(!init)return okPhoto()
  sent.push(JSON.parse(init.body))
  return {ok:true,json:async()=>sample}
 }
 const look=await runGoogleFirstLook({apiKey:'k',imageUrl:'https://x/y.jpg',usedThisMonth:3,fetchImpl})
 assert.equal(look.status,'CALLED')
 assert.equal(sent.length,1)
 assert.equal(sent[0].requests.length,1)
 assert.equal(sent[0].requests[0].features[0].type,'WEB_DETECTION')
 const failed=await runGoogleFirstLook({apiKey:'k',imageUrl:'https://x/y.jpg',usedThisMonth:3,
  fetchImpl:async(url,init)=>init?{ok:false,status:403,json:async()=>({})}:okPhoto()})
 assert.equal(failed.status,'NOT_RUN')
})

test('research is told to start from Google leads, as leads only',()=>{
 const text=googleLeadsForResearch(normaliseWebDetection(sample))
 assert.match(text,/UNVERIFIED LEADS/)
 assert.match(text,/eBay SOLD/)
 assert.match(googleLeadsForResearch(null),/not available/)
 assert.match(research,/runGoogleFirstLook\(/)
 assert.match(research,/google_first_look:googleLook/)
 assert.doesNotMatch(research,/useGateway|ai-gateway\.vercel\.sh|AI_GATEWAY_API_KEY|VERCEL_OIDC_TOKEN/)
 assert.match(research,/https:\/\/api\.openai\.com\/v1\/responses/)
})

test('Lens link opens the main photograph when a signed link exists',()=>{
 assert.match(googleLensLink('https://abc.supabase.co/storage/v1/object/sign/x.jpg?token=1'),/uploadbyurl\?url=https%3A/)
 assert.equal(googleLensLink(null),'https://lens.google.com/')
})

test('Lens visual matches come through as leads, with page prices never treated as sales',async()=>{
 const lensPayload={visual_matches:[
  {title:'WHITEFRIARS TINTED & THREADED ART GLASS BOWL 1930s',link:'https://www.ebay.co.uk/itm/9',source:'eBay UK',price:{value:'£249',extracted_value:249,currency:'£'}},
  {title:'A Stevens and Williams Threaded Vase c1930',link:'https://scottishantiques.com/x',source:'Scottish Antiques'},
  {title:'dup',link:'https://www.ebay.co.uk/itm/9'}]}
 const calls=[]
 const fetchImpl=async(url,init)=>{
  calls.push(url)
  if(String(url).startsWith('https://serpapi.com/'))return {ok:true,json:async()=>lensPayload}
  if(!init)return okPhoto()
  return {ok:true,json:async()=>({responses:[{webDetection:{bestGuessLabels:[{label:'circle'}]}}]})}
 }
 const look=await runGoogleFirstLook({apiKey:'k',serpKey:'s',imageUrl:'https://x/y.jpg',usedThisMonth:0,fetchImpl})
 assert.equal(look.status,'CALLED')
 assert.equal(look.lens.matches.length,2)
 assert.equal(look.lens.matches[0].price,'£249')
 assert.ok(calls.some(u=>String(u).includes('engine=google_lens')))
 const text=googleLeadsForResearch(look)
 assert.match(text,/GOOGLE LENS VISUAL MATCHES/)
 assert.match(text,/usually ASKING, never sold/)
 assert.match(text,/WHITEFRIARS TINTED/)
 const lensOnly=await runGoogleFirstLook({apiKey:'',serpKey:'s',imageUrl:'https://x/y.jpg',usedThisMonth:0,fetchImpl})
 assert.equal(lensOnly.status,'CALLED')
 const lensDown=await runGoogleFirstLook({apiKey:'',serpKey:'s',imageUrl:'https://x/y.jpg',usedThisMonth:0,
  fetchImpl:async()=>({ok:false,status:401,json:async()=>({error:'Invalid API key'})})})
 assert.equal(lensDown.status,'NOT_RUN')
})

test('Lens runs on up to 3 photos and ranks matches found from several photos first',async()=>{
 const byPhoto={'https://x/1.jpg':[{title:'Etsy green bowl',link:'https://etsy/a'},{title:"VSL coupe 'Duplex' E.L.52",link:'https://pin/vsl'}],
  'https://x/2.jpg':[{title:"VSL coupe 'Duplex' E.L.52",link:'https://pin/vsl'}],
  'https://x/3.jpg':[{title:"VSL coupe 'Duplex' E.L.52",link:'https://pin/vsl'},{title:'Orrefors',link:'https://ebay/o'}]}
 let lensCalls=0
 const fetchImpl=async(url)=>{
  if(String(url).startsWith('https://serpapi.com/')){lensCalls++
   const photo=new URL(url).searchParams.get('url')
   return {ok:true,json:async()=>({visual_matches:byPhoto[photo]||[]})}}
  return okPhoto()
 }
 const look=await runGoogleFirstLook({apiKey:'',serpKey:'s',imageUrl:'https://x/1.jpg',
  lensImageUrls:['https://x/1.jpg','https://x/2.jpg','https://x/3.jpg','https://x/4.jpg'],usedThisMonth:0,fetchImpl})
 assert.equal(lensCalls,3)
 assert.equal(look.lens.matches[0].title,"VSL coupe 'Duplex' E.L.52")
 assert.equal(look.lens.matches[0].seen_in,3)
 assert.match(googleLeadsForResearch(look),/found from 3 photographs/)
})
test('research must test a named Lens maker/model before calling an object unattributed',()=>{
 assert.match(research,/LEADING HYPOTHESIS/)
 assert.match(research,/Only call the object unattributed after checking every specific maker\/model named in the Lens matches/)
 assert.match(research,/lensImageUrls:images\.slice\(0,3\)/)
})

test('quick depth: no web search tool, low reasoning, 3 small photos, triage required',()=>{
 assert.match(research,/depth!=='quick'\)return res\.status\(400\)/)
 assert.match(research,/\.\.\.\(depth==='quick'\?\{\}:\{tools:/)
 assert.match(research,/depth==='quick' \? "low"/)
 assert.match(research,/"next_evidence","triage","listing"\]/)
 assert.match(research,/listing\.ebay_title: up to 80 characters/)
 assert.match(research,/Etsy vintage rule/)
 assert.match(research,/Never mark a quick-check price as sold/)
})

test('research reads legible marks in every photo and never asks to verify them',()=>{
 assert.match(research,/MARKS IN THE PHOTOGRAPHS: read every legible backstamp/)
 assert.match(research,/Never add a title_check asking the owner to verify a mark that is legible in a photograph/)
 assert.match(research,/detail:depth==='quick'\?"low":depth==='deep_dive'\?"original":"high"/)
})

test('one object mode returns one record for an item with several parts',()=>{
 const intake=readFileSync(new URL('../api/analyse-intake.ts',import.meta.url),'utf8')
 assert.match(intake,/ONE OBJECT MODE: the owner says every photograph shows ONE item for sale/)
 assert.match(intake,/return EXACTLY ONE object record/)
})

test('Google Lens runs first, in the photo analysis, and research reuses it',()=>{
 const intake=readFileSync(new URL('../api/analyse-intake.ts',import.meta.url),'utf8')
 assert.match(intake,/GOOGLE FIRST \(Dean, 29 Oct\)/)
 assert.match(intake,/lensImageUrls:images\.slice\(0,3\)\.map/)
 assert.match(intake,/analysis_stage:'COMPLETE',google_first_look:googleLook/)
 assert.match(research,/if\(intakeLook\?\.status==='CALLED'\)googleLook=intakeLook/)
})

test('research lists what the photos prove separately from what to check',()=>{
 assert.match(research,/"title_checks","seen_in_photos","description"\]/)
 assert.match(research,/these are confirmed facts, not checks/)
 assert.match(research,/never repeat anything in seen_in_photos/)
})

test('a check must change the price, title or description',()=>{
 assert.match(research,/whose answer would change the price, the title or the description/)
 assert.match(research,/never add general care checks/)
})
