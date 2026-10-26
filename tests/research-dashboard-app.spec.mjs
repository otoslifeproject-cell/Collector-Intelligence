import {test,expect} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import {randomUUID,createHash} from 'node:crypto';
import {syntheticStoragePNG} from '../scripts/test-photo-storage-cases.mjs';
let client,owner;
test.beforeAll(async()=>{
 client=createClient('http://127.0.0.1:18000',process.env.CI_PHOTO_PUBLIC_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const login=await client.auth.signInWithPassword({email:'photo-ci-a@example.test',password:'Ci-disposable-photo-4826!'});expect(login.error).toBeNull();owner=login.data.user.id;
});
async function seedItem(){const r=await client.from('items').insert({title:'MEDINA audit fixture',object_type:'Vase',material:'Glass',colour:'Red',currency:'GBP',marks_signatures_labels:'MEDINA — owner reading, unverified',condition_summary:'Synthetic condition to review'}).select('*').single();expect(r.error).toBeNull();return r.data;}
async function research(itemId,result={analysis_stage:'COMPLETE',research_summary:'Stored MEDINA investigation; maker unverified',identification_update:{attribution:'Candidate only'},comparables:[]},context={item_id:itemId}){const r=await client.from('ai_analysis_runs').insert({mode:'research',model:'synthetic-no-provider',input_photo_count:0,result,user_context:context}).select('*').single();expect(r.error).toBeNull();return r.data;}
async function login(page,path,theme='light'){
 const errors=[],paid=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.hostname!=='127.0.0.1')return route.abort('blockedbyclient');if(u.pathname.startsWith('/api/')){paid.push(u.pathname);return route.abort('blockedbyclient');}return route.fallback();});
 await page.addInitScript(t=>localStorage.setItem('ci-appearance-v1',t),theme);
 await page.goto(path);await page.getByLabel('Email',{exact:true}).fill('photo-ci-a@example.test');await page.getByLabel('Password',{exact:true}).fill('Ci-disposable-photo-4826!');await page.getByRole('button',{name:'Sign in',exact:true}).click();return {errors,paid};
}
const dashboard=(page,item)=>page.getByRole('region',{name:'Research dashboard — '+item.item_code,exact:true});
for(const width of [320,390,1100,1440])for(const theme of ['light','dark'])test(`persistent object research dashboard ${width}px ${theme}`,async({page})=>{
 await page.setViewportSize({width,height:900});const item=await seedItem(),saved=await research(item.id);const events=await login(page,'/#/item/'+item.id,theme);const panel=dashboard(page,item);
 await expect(panel).toContainText('1 saved research executions');await expect(panel.getByRole('progressbar')).toHaveAttribute('max','7');await expect(panel).toContainText('Inconclusive — historical receipt missing');await expect(panel).toContainText('Next action:');await expect(panel).toContainText('Do not list yet');
 await panel.getByText('Stored execution history (1)',{exact:true}).click();await expect(panel).toContainText(saved.id);await expect(panel).toContainText('maker unverified');
 await page.reload();await expect(panel).toContainText('1 saved research executions');await expect(panel).toContainText('0 / 7 categories complete');
 const overflow=await page.evaluate(()=>({ok:document.documentElement.scrollWidth<=innerWidth+1,offenders:[...document.querySelectorAll('body *')].filter(el=>el.getBoundingClientRect().right>innerWidth+1).slice(0,8).map(el=>({tag:el.tagName,class:el.className,text:el.textContent?.slice(0,90)}))}));if(!overflow.ok)console.log('RESEARCH_DASHBOARD_OVERFLOW',JSON.stringify(overflow));expect(overflow.ok).toBe(true);expect(events.errors).toEqual([]);expect(events.paid).toEqual([]);await page.screenshot({path:`test-artifacts/research-dashboard-${width}-${theme}.png`,fullPage:true});
});
test('denied history is blocked rather than zero progress and GET-only recovery reopens original work',async({page})=>{
 const item=await seedItem();await research(item.id);await page.route('**/rest/v1/ai_analysis_runs*',route=>route.request().method()==='GET'?route.fulfill({status:403,json:{message:'Synthetic history denied'}}):route.fallback());
 const events=await login(page,'/#/item/'+item.id+'?tab=market');const panel=dashboard(page,item);await expect(panel.getByRole('alert')).toContainText('Missing history is not evidence');await expect(panel.getByRole('progressbar')).toHaveCount(0);await expect(page.getByRole('button',{name:'Research online',exact:true})).toBeDisabled();
 await page.unroute('**/rest/v1/ai_analysis_runs*');await panel.getByRole('button',{name:'Reload saved research history',exact:true}).click();await expect(panel).toContainText('1 saved research executions');expect(events.paid).toEqual([]);
});
test('final hold survives a committed save with denied readback, GET-only Check and refresh',async({page})=>{
 const item=await seedItem();await research(item.id);const events=await login(page,'/#/item/'+item.id);const panel=page.getByRole('region',{name:'Owner hold decision — '+item.item_code,exact:true});
 await expect(panel).toContainText('No stored decision was found.');await panel.getByText('Record a hold decision and guidance',{exact:true}).click();
 await panel.getByLabel('Decision',{exact:true}).selectOption('SPECIALIST_REVIEW');
 await panel.getByLabel('Decision rationale (at least 40 characters)',{exact:true}).fill('Both signatures require independent review and maker authentication remains unresolved.');
 await panel.getByLabel('Unresolved identification / value issues',{exact:true}).fill('The faint bubble-base signature and the condition of each piece.');
 await panel.getByLabel('Next recommended action',{exact:true}).fill('Inspect both original bases and measure each vase.');
 await panel.getByLabel('Selling route guidance while research is incomplete',{exact:true}).fill('Hold all sale routes pending researched valuation and actual net costs.');
 let writes=0,deny=false;
 await page.route('**/rest/v1/rpc/ci_record_item_hold_assessment_v1',async route=>{writes++;const response=await route.fetch();expect(response.ok()).toBe(true);deny=true;return route.fulfill({status:503,json:{message:'Synthetic lost acknowledgement after real commit'}});});
 await page.route('**/rest/v1/item_research_assessments*',route=>deny&&new URL(route.request().url()).searchParams.has('client_event_id')?route.fulfill({status:403,json:{message:'Synthetic readback denial'}}):route.fallback());
 await panel.getByRole('button',{name:'Save hold decision',exact:true}).click();await expect(panel.getByRole('button',{name:'Check saved decision',exact:true})).toBeEnabled();await expect(panel.getByRole('button',{name:'Retry same held decision',exact:true})).toBeDisabled();
 deny=false;await panel.getByRole('button',{name:'Check saved decision',exact:true}).click();await expect(panel).toContainText('Final hold decision confirmed by stored readback.');expect(writes).toBe(1);
 await page.reload();await expect(panel).toContainText('Both signatures require independent review');await expect(panel).toContainText('Final decision history (1)');await expect(panel).toContainText('Owner-reported, unverified');
 await page.getByRole('button',{name:'sales',exact:true}).click();await expect(page.getByText('DO NOT LIST YET — research / final assessment incomplete',{exact:true})).toBeVisible();const rows=await client.from('item_research_assessments').select('*').eq('item_id',item.id);expect(rows.error).toBeNull();expect(rows.data).toHaveLength(1);expect(rows.data[0].decision).toBe('SPECIALIST_REVIEW');expect(events.paid).toEqual([]);expect(events.errors).toEqual([]);
 await page.screenshot({path:'test-artifacts/final-item-hold-readback.png',fullPage:true});
});
test('catalogue facts changing preserve earlier final hold and require a fresh decision',async({page})=>{
 const item=await seedItem();await research(item.id);const context=await client.from('item_assessment_context_v1').select('*').eq('item_id',item.id).single();expect(context.error).toBeNull();
 const {holdPayload}=await import('../src/lib/itemAssessment.ts');const {auditResearch}=await import('../src/lib/researchSaleDecision.ts');
 const payload=holdPayload({decision:'DO_NOT_LIST_YET',rationale:'Condition and maker attribution require investigation before sale is appropriate.',unresolvedIssues:'Condition and maker.',nextAction:'Review original bases.',routeGuidance:'Do not list until valuation is evidenced.',confidence:{identification:null,dating:null,valuation:null},sourceRefs:[]},auditResearch([]));
 const saved=await client.rpc('ci_record_item_hold_assessment_v1',{p_item_id:item.id,p_client_event_id:randomUUID(),p_expected_facts_sha256:context.data.facts_sha256,p_assessment:payload});expect(saved.error).toBeNull();
 const events=await login(page,'/#/item/'+item.id),panel=page.getByRole('region',{name:'Owner hold decision — '+item.item_code,exact:true});await expect(panel).toContainText('Condition and maker attribution require investigation');
 expect((await client.from('items').update({condition_summary:'New condition observation'}).eq('id',item.id)).error).toBeNull();await page.reload();await expect(panel).toContainText('Earlier decisions remain in history.');await panel.getByText('Final decision history (1)',{exact:true}).click();await expect(panel).toContainText('earlier catalogue facts');await expect(panel).toContainText(payload.rationale);expect(events.paid).toEqual([]);
});
test('oldest persisted item investigation survives more than100 newer attempts',async({page})=>{
 const item=await seedItem();const rows=Array.from({length:101},(_,i)=>({mode:'research',model:'fixture-no-provider',input_photo_count:0,user_context:{item_id:item.id},result:{analysis_stage:'COMPLETE',research_summary:'Historical item response '+i}}));
 const insert=await client.from('ai_analysis_runs').insert(rows);expect(insert.error).toBeNull();const e=await login(page,'/#/item/'+item.id);const panel=dashboard(page,item);await expect(panel).toContainText('101 saved research executions');await panel.getByText('Stored execution history (101)',{exact:true}).click();await expect(panel).toContainText('Historical item response 0');await expect(panel).toContainText('Historical item response 100');expect(e.paid).toEqual([]);
});
test('stored processing outcome remains blocked and late completion is recovered without another paid request',async({page})=>{
 const item=await seedItem(),pending=await research(item.id,{analysis_stage:'PROCESSING',claimed_at:'2026-01-01T00:00:00Z'});const e=await login(page,'/#/item/'+item.id+'?tab=market');const panel=dashboard(page,item);await expect(panel).toContainText('Blocked');await expect(page.getByRole('button',{name:'Research online',exact:true})).toBeDisabled();
 const update=await client.from('ai_analysis_runs').update({result:{analysis_stage:'COMPLETE',research_summary:'Late preserved original result',identification_update:{},comparables:[]}}).eq('id',pending.id);expect(update.error).toBeNull();await panel.getByRole('button',{name:'Reload saved research history',exact:true}).click();await expect(panel).toContainText('1 saved research executions');await panel.getByText('Stored execution history (1)',{exact:true}).click();await expect(panel).toContainText('Late preserved original result');expect(e.paid).toEqual([]);
});
const obj=(name,index)=>({working_title:name,object_type:'Vase',category:'Glass',material:'Glass',colour:'Red',maker:null,current_attribution:null,period_wording:null,region_country:null,rarity_desirability:null,specialist_review:false,catalogue_note:'Synthetic fixture, not real research',image_indices:[index],condition_summary:'Synthetic observation only',marks_signatures_labels:'MEDINA (owner spelling)',identification_confidence:25,dating_confidence:10,valuation_confidence:5,evidence:[],next_evidence:[],sale_readiness:'RESEARCH_FIRST',status:'RESEARCH',preliminary_value:{currency:'GBP',quick_sale:null,balanced_low:null,balanced_high:null,floor:null,basis:'Synthetic'}});
async function seedBatch(){
 const manifest=[];for(let index=0;index<2;index++){const bytes=syntheticStoragePNG(40+index*100),path=`${owner}/intake/dashboard-${randomUUID()}/${index}.png`;expect((await client.storage.from('item-images').upload(path,bytes,{contentType:'image/png'})).error).toBeNull();manifest.push({index,storage_path:path,file_name:`Original${index}.png`,byte_count:bytes.length,content_sha256:createHash('sha256').update(bytes).digest('hex')});}
 const write=await client.from('ai_analysis_runs').insert({mode:'batch',model:'fixture-no-provider',input_photo_count:2,result:{analysis_stage:'COMPLETE',objects:[obj('MEDINA clear-mark fixture',0),obj('MEDINA bubble-base fixture',1)],image_manifest:manifest,inscription_review:{candidate_transcription:'Mdina?',transcription_confidence:60,evidence_image_indices:[0,1]}}}).select('*').single();expect(write.error).toBeNull();return write.data;
}
test('each batch member keeps its own persisted research through refresh and catalogue approval to listing review',async({page})=>{
 const source=await seedBatch();const saved=await research(null,undefined,{source_analysis_run_id:source.id,source_object_index:0,pair_source_indices:[]});const events=await login(page,'/#/draft/'+source.id);
 const cards=page.locator('.ci-record-card');await expect(cards).toHaveCount(2);await expect(cards.nth(0).locator('.ci-research-progress')).toContainText('1 saved research executions');await expect(cards.nth(1).locator('.ci-research-progress')).toContainText('0 saved research executions');
 await page.reload();await expect(cards.nth(0).locator('.ci-research-progress')).toContainText('1 saved research executions');await expect(cards.nth(1).locator('.ci-research-progress')).toContainText('0 saved research executions');
 await page.getByRole('tab',{name:'catalogue',exact:true}).click();await page.getByRole('button',{name:'Catalogue 2 selected',exact:true}).click();await expect(page.getByRole('region',{name:'Saved catalogue records',exact:true})).toBeVisible();
 const items=await client.from('items').select('*').eq('source_analysis_run_id',source.id).order('source_object_index');expect(items.error).toBeNull();expect(items.data).toHaveLength(2);
 await page.goto('/#/item/'+items.data[0].id);const panel=dashboard(page,items.data[0]);await expect(panel).toContainText('1 saved research executions');await panel.getByText('Stored execution history (1)',{exact:true}).click();await expect(panel).toContainText(saved.id);
 await page.getByRole('button',{name:'sales',exact:true}).click();await expect(page.getByText('DO NOT LIST YET — research / final assessment incomplete',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Prepare review draft',exact:true}).click();await expect(page.getByRole('region',{name:'Listing review draft',exact:true})).toContainText('Not published.');await expect(page.getByRole('region',{name:'Listing review draft',exact:true})).toContainText('Price recommendation blocked');
 const listingRows=await client.from('listings').select('id').eq('item_id',items.data[0].id);expect(listingRows.error).toBeNull();expect(listingRows.data).toEqual([]);expect(events.paid).toEqual([]);expect(events.errors).toEqual([]);
});
test('owner uploads original bytes, reopens stored research, approves catalogue and exports unpublished review draft',async({page})=>{
 await page.setViewportSize({width:390,height:900});const events=await login(page,'/#/intake');let sourceId;const originalBytes=syntheticStoragePNG(72);
 await page.route('**/api/analyse-intake',async route=>{
  const body=route.request().postDataJSON();sourceId=body.run_id;const read=await client.from('ai_analysis_runs').select('*').eq('id',sourceId).single();expect(read.error).toBeNull();
  const result={...read.data.result,analysis_stage:'COMPLETE',batch_summary:'Synthetic upload acceptance; no provider call',objects:[obj('Upload to sale review fixture',0)]};const write=await client.from('ai_analysis_runs').update({result,model:'synthetic-no-provider'}).eq('id',sourceId);expect(write.error).toBeNull();return route.fulfill({status:200,json:{saved_run_id:sourceId,result}});
 });
 await page.locator('input[type=file]').setInputFiles({name:'Owner original.png',mimeType:'image/png',buffer:originalBytes});await page.getByRole('button',{name:'Analyse & draft catalogue',exact:true}).click();await expect(page).toHaveURL(/#\/draft\//);
 const r=await client.from('ai_analysis_runs').select('result').eq('id',sourceId).single();expect(r.error).toBeNull();const storagePath=r.data.result.image_manifest[0].storage_path;const bytes=await client.storage.from('item-images').download(storagePath);expect(bytes.error).toBeNull();expect(Buffer.from(await bytes.data.arrayBuffer())).toEqual(originalBytes);
 await research(null,undefined,{source_analysis_run_id:sourceId,source_object_index:0,pair_source_indices:[]});await page.reload();await expect(page.locator('.ci-record-card .ci-research-progress')).toContainText('1 saved research executions');
 await page.getByRole('tab',{name:'market',exact:true}).click();await expect(page.getByRole('region',{name:'Provisional market research',exact:true})).toContainText('Stored MEDINA investigation');await page.getByRole('tab',{name:'catalogue',exact:true}).click();await page.getByRole('button',{name:'Catalogue 1 selected',exact:true}).click();await expect(page).toHaveURL(/#\/item\//);
 await page.getByRole('button',{name:'sales',exact:true}).click();await page.getByRole('button',{name:'Prepare review draft',exact:true}).click();await expect(page.getByRole('region',{name:'Listing review draft',exact:true})).toContainText('Not published.');
 const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Export sale plan',exact:true}).click();const download=await downloadEvent;await download.saveAs('test-artifacts/owner-workflow-sale-review.json');
 const prepared=JSON.parse(await (await import('node:fs/promises')).readFile('test-artifacts/owner-workflow-sale-review.json','utf8'));expect(prepared.listing.publicationStatus).toBe('NOT_PUBLISHED');expect(prepared.listing.status).toBe('REVIEW_REQUIRED');expect(prepared.listing.recommendedPrice).toBeNull();expect(events.errors).toEqual([]);expect(events.paid).toEqual([]);
 await page.screenshot({path:'test-artifacts/owner-workflow-390-sale-review.png',fullPage:true});
});
