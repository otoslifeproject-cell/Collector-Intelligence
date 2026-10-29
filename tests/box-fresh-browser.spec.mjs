import {test,expect} from '@playwright/test'
import {randomUUID} from 'node:crypto'
import {syntheticStoragePNG} from '../scripts/test-photo-storage-cases.mjs'

// Every backend response is an in-memory disposable fixture. No production secrets,
// owner records, paid research, or real external services are touched.
test('brand-new owner: Home → Add item → photo → Analyse → Answer → Copy listing',async({page,context})=>{
 test.setTimeout(90000)
 const owner=randomUUID(),bytes=syntheticStoragePNG(40),created_at=new Date().toISOString()
 const user={id:owner,aud:'authenticated',role:'authenticated',email:'fresh@example.test',
   created_at,app_metadata:{provider:'email',providers:['email']},user_metadata:{}}
 const token=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+
  Buffer.from(JSON.stringify({sub:owner,role:'authenticated',aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.c2ln'
 const session={access_token:token,token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,refresh_token:'test-refresh',user}
 let saved=null,uploads=0,analyses=0
 const json=(route,data,status=200,headers={})=>route.fulfill({status,contentType:'application/json',headers,body:JSON.stringify(data)})
 const empty=route=>json(route,[],200,{'content-range':'0-0/0'})
 await context.grantPermissions(['clipboard-read','clipboard-write'])
 await page.route('**/api/analyse-intake',async route=>{
  analyses++
  if(!saved)return json(route,{error:'No saved original'},400)
  const input=route.request().postDataJSON()
  if(input.run_id!==saved.id)return json(route,{error:'Wrong run ID'},400)
  const obj={
   working_title:'Fresh clear glass bowl',object_type:'Small bowl',material:'Glass',
   colour:'Clear',category:'Glass',sale_readiness:'RESEARCH_FIRST',status:'RESEARCH',
   maker:null,current_attribution:null,period_wording:null,region_country:null,
   marks_signatures_labels:null,rarity_desirability:null,catalogue_note:null,
   identification_confidence:65,dating_confidence:0,valuation_confidence:0,
   condition_summary:'Photograph shows a bowl. Chips and cracks need physical inspection.',
   image_indices:[0],evidence:[],next_evidence:[],
   preliminary_value:{currency:'GBP',basis:'Visual-only guess; no sold comps',floor:null,quick_sale:null,balanced_low:null,balanced_high:null}
  }
  saved.result={...saved.result,analysis_stage:'COMPLETE',batch_summary:'Visual identification, unverified',objects:[obj]}
  return json(route,{status:'saved'})
 })
 await page.route('**/fake/**',async route=>{
  const req=route.request(),url=new URL(req.url()),path=url.pathname,method=req.method()
  if(path.includes('/auth/v1/token')&&method==='POST')return json(route,session)
  if(path.includes('/auth/v1/user'))return json(route,user)
  if(path.includes('/storage/v1/object/sign/')&&method==='POST'){
   const target=path.split('/object/sign/')[1]
   return json(route,{signedURL:'/storage/v1/object/sign/'+target+'?token=test'})
  }
  if(path.includes('/storage/v1/object/sign/')&&method==='GET')return route.fulfill({status:200,contentType:'image/png',body:bytes})
  if(path.includes('/storage/v1/object/item-images/')){
   if(method==='POST'){uploads++;return json(route,{Key:path.split('/item-images/')[1]})}
   if(method==='GET')return route.fulfill({status:200,contentType:'image/png',body:bytes})
  }
  if(path.endsWith('/rest/v1/ai_analysis_runs')){
   const query=url.searchParams
   if(method==='POST'){
    saved={...req.postDataJSON(),owner_review_revision:0,created_at}
    return json(route,[],201)
   }
   if(method==='GET'&&query.has('id')&&saved&&query.get('id')==='eq.'+saved.id)
    return json(route,saved,200,{'content-range':'0-0/1'})
   if(method==='GET'&&query.has('id'))return empty(route)
   return empty(route)
  }
  if(path.startsWith('/fake/rest/v1/')){
   if(method==='GET')return empty(route)
   return json(route,[],201,{'content-range':'0-0/0'})
  }
  return json(route,{message:'Missing disposable stub for '+path},404)
 })
 await page.goto('http://127.0.0.1:4173/#/')
 await page.getByLabel('Email',{exact:true}).fill('fresh@example.test')
 await page.getByLabel('Password',{exact:true}).fill('synthetic-password')
 await page.getByRole('button',{name:'Sign in',exact:true}).click()
 await expect(page.getByRole('heading',{name:'What would you like to do?'})).toBeVisible()
 await expect(page.getByText('Fresh clear glass bowl')).toHaveCount(0)
 await page.getByRole('link',{name:/Add item/}).first().click()
 await expect(page.getByRole('heading',{name:'Add photos'})).toBeVisible()
 await page.locator('.intakeDrop input[type=file]').setInputFiles({name:'brand-new-bowl.png',mimeType:'image/png',buffer:bytes})
 await expect(page.getByRole('button',{name:'Analyse photos'})).toBeEnabled()
 await page.getByRole('button',{name:'Analyse photos'}).click()
 try{await expect(page).toHaveURL(new RegExp('#/draft/[0-9a-f-]{36}'),{timeout:15000})}
 catch(error){
  const messages=await page.locator('[role="status"],[role="alert"],.note').allTextContents()
  throw new Error('Fresh intake remained on '+page.url()+'; messages='+JSON.stringify(messages.slice(0,12))+
   '; saved='+JSON.stringify(saved&&{id:saved.id,stage:saved.result?.analysis_stage})+
   '; uploads='+uploads+'; analyses='+analyses+'; cause='+String(error).slice(0,160))
 }
 const answer=page.getByRole('region',{name:'Your answer'})
 await expect(answer).toBeVisible()
 await expect(answer).toContainText('Small bowl')
 await expect(answer).toContainText('No sold prices found yet')
 await expect(answer).toContainText('eBay')
 await page.getByRole('button',{name:'Copy listing draft'}).click()
 await expect(answer).toContainText('Draft copied')
 const copied=await page.evaluate(()=>navigator.clipboard.readText())
 expect(copied).toContain('Original photo positions (1-based): 1')
 expect(copied).toContain('NOT PUBLISHED')
 expect(copied).toContain('Asking price: NOT ESTABLISHED')
 expect(uploads).toBe(1)
 expect(analyses).toBe(1)
 await page.screenshot({path:'test-artifacts/box-fresh-answer.png',fullPage:true})
})
