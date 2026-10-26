import {test,expect} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import {createHash} from 'node:crypto';
import {syntheticStoragePNG} from '../scripts/test-photo-storage-cases.mjs';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const runs='**/rest/v1/ai_analysis_runs*',api='**/api/analyse-intake';
let client,owner;
test.beforeAll(async()=>{
 client=createClient('http://127.0.0.1:18000',process.env.CI_PHOTO_PUBLIC_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const login=await client.auth.signInWithPassword({email:'photo-ci-a@example.test',password:'Ci-disposable-photo-4826!'});expect(login.error).toBeNull();owner=login.data.user.id;
});
const files=(values=[41,172])=>values.map((value,index)=>({name:`Intake original ${index}.png`,mimeType:'image/png',buffer:syntheticStoragePNG(value)}));
async function read(id){const r=await client.from('ai_analysis_runs').select('*').eq('id',id).single();expect(r.error).toBeNull();return r.data;}
const originalObject=indices=>({working_title:'Synthetic intake vessel',category:'Glass',object_type:'Vessel',material:'Glass',colour:'Synthetic',maker:null,current_attribution:null,period_wording:null,region_country:null,identification_confidence:25,dating_confidence:10,valuation_confidence:5,condition_summary:'Synthetic condition, not real object evidence',marks_signatures_labels:null,rarity_desirability:null,sale_readiness:'RESEARCH_FIRST',status:'RESEARCH',specialist_review:false,image_indices:indices,evidence:[],next_evidence:[],preliminary_value:{currency:'GBP',quick_sale:null,balanced_low:null,balanced_high:null,floor:null,basis:'Synthetic, not a valuation'},catalogue_note:'Synthetic fixture'});
async function complete(id,overrides={}){
 const row=await read(id),result={...row.result,analysis_stage:'COMPLETE',batch_summary:'SYNTHETIC provider fixture; no paid call',objects:[originalObject(row.result.image_manifest.map(p=>p.index))],...overrides};
 const write=await client.from('ai_analysis_runs').update({result,model:'fixture-no-provider'}).eq('id',id);expect(write.error).toBeNull();return result;
}
async function visit(page,theme='light'){
 const events={errors:[],uploads:[],stages:[],api:[]};page.on('pageerror',e=>events.errors.push(e.message));
 page.on('request',r=>{const u=new URL(r.url());if(r.method()==='POST'&&u.pathname.startsWith('/storage/v1/object/item-images/'))events.uploads.push(u.pathname);if(r.method()==='POST'&&u.pathname==='/rest/v1/ai_analysis_runs')events.stages.push(r.postDataJSON());if(r.method()==='POST'&&u.pathname==='/api/analyse-intake')events.api.push(r.postDataJSON());});
 await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.hostname!=='127.0.0.1')return route.abort('blockedbyclient');if(u.pathname.startsWith('/api/'))return route.abort('blockedbyclient');return route.fallback();});
 await page.addInitScript(t=>localStorage.setItem('ci-appearance-v1',t),theme);
 await page.goto('/#/intake');await page.getByLabel('Email',{exact:true}).fill('photo-ci-a@example.test');await page.getByLabel('Password',{exact:true}).fill('Ci-disposable-photo-4826!');await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Add item',exact:true})).toBeVisible();return events;
}
async function choose(page,values){await page.locator('input[type=file]').setInputFiles(files(values));}
const analyse=page=>page.getByRole('button',{name:'Start research',exact:true});
async function mockCompletion(page){await page.route(api,async route=>{const b=route.request().postDataJSON(),result=await complete(b.run_id);return route.fulfill({status:200,json:{saved_run_id:b.run_id,result}});});}
async function saved(page){await expect(page).toHaveURL(/#\/draft\/[0-9a-f-]+/, {timeout:10000});await expect(page.locator('.ci-object-grid .ci-record-title').first()).toHaveText('Synthetic intake vessel');}
async function originals(id,chosen){const row=await read(id);expect(row.owner_id).toBe(owner);expect(row.result.image_manifest).toHaveLength(chosen.length);for(const [index,p]of row.result.image_manifest.entries()){expect(p.index).toBe(index);expect(p.file_name).toBe(chosen[index].name);const r=await client.storage.from('item-images').download(p.storage_path);expect(r.error).toBeNull();expect(digest(Buffer.from(await r.data.arrayBuffer()))).toBe(digest(chosen[index].buffer));}return row;}
const pending=page=>page.getByRole('region',{name:'Held photo session',exact:true});
const status=page=>page.getByRole('status');
const check=page=>pending(page).getByRole('button',{name:'Check saved analysis',exact:true});
const retry=page=>pending(page).getByRole('button',{name:'Retry same photo session',exact:true});

test('lost staging acknowledgement recovers the actual saved photo session before one analysis',async({page})=>{
 const e=await visit(page);let committedId;await mockCompletion(page);await page.route(runs,async route=>{if(route.request().method()!=='POST')return route.fallback();const r=await route.fetch();expect(r.ok()).toBe(true);const text=await r.text(),body=text?JSON.parse(text):null;committedId=route.request().postDataJSON().id||body?.id||body?.[0]?.id;expect(typeof committedId).toBe('string');return route.abort('connectionreset');});
 await choose(page);await analyse(page).click();try{await saved(page);}catch(error){const actual=committedId?await read(committedId):null;console.log('INTAKE_LOST_STAGE_EVIDENCE',JSON.stringify({committedId,actualStage:actual?.result?.analysis_stage,actualPhotos:actual?.result?.image_manifest?.length,analysisRequests:e.api.length,stageInserts:e.stages.length,uploads:e.uploads.length}));throw error;}
 expect(e.api).toHaveLength(1);expect(e.stages).toHaveLength(1);expect(e.uploads).toHaveLength(2);await originals(e.api[0].run_id,files());expect(e.errors).toEqual([]);
});

for(const width of [320,390,1100,1440])for(const theme of ['light','dark'])test(`intake originals and saved report ${width}px ${theme}`,async({page})=>{
 await page.setViewportSize({width,height:900});const e=await visit(page,theme);await mockCompletion(page);
 await page.getByText('Optional details (purchase, size, notes)',{exact:true}).click();await page.getByRole('textbox',{name:'Your notes / hypothesis',exact:true}).fill('Owner hypothesis retained separately');await page.getByRole('spinbutton',{name:'Purchase price',exact:true}).fill('0');
 await choose(page);await analyse(page).click();await saved(page);expect(e.api).toHaveLength(1);expect(e.stages).toHaveLength(1);expect(e.uploads).toHaveLength(2);
 const row=await originals(e.api[0].run_id,files());expect(row.user_context.user_notes).toBe('Owner hypothesis retained separately');expect(row.user_context.purchase_price).toBe('0');expect(e.api[0].context.purchase_price).toBe(0);expect(e.stages[0].id).toBe(row.id);
 row.result.image_manifest.forEach((p,index)=>{expect(p.sha256).toBe(digest(files()[index].buffer));expect(p.byte_count).toBe(files()[index].buffer.length);});
 expect((await client.from('items').select('id').eq('source_analysis_run_id',row.id)).data).toHaveLength(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.screenshot({path:`test-artifacts/intake-app-${width}-${theme}-saved.png`,fullPage:true});
 await page.reload();await expect(page.locator('.ci-object-grid .ci-record-title').first()).toHaveText('Synthetic intake vessel');expect(e.api).toHaveLength(1);expect(e.uploads).toHaveLength(2);expect(e.errors).toEqual([]);
});
test('partial upload retries the same originals without reuploading an already saved file',async({page})=>{
 await page.setViewportSize({width:320,height:900});const e=await visit(page);await mockCompletion(page);let rejected=false;
 const objects='**/storage/v1/object/item-images/**';await page.route(objects,route=>{if(route.request().method()==='POST'&&route.request().url().includes('/01-')){rejected=true;return route.fulfill({status:403,json:{statusCode:'403',error:'Unauthorized',message:'Synthetic second original denied'}});}return route.fallback();});
 await choose(page);await analyse(page).click();await expect(status(page)).toContainText('cannot yet be verified');expect(rejected).toBe(true);expect(e.uploads).toHaveLength(2);expect(e.stages).toHaveLength(0);expect(e.api).toHaveLength(0);await expect(retry(page)).toBeEnabled();await expect(analyse(page)).toBeDisabled();
 const held=await pending(page).getByRole('textbox',{name:'Held session details',exact:true}).inputValue();await check(page).click();await expect(status(page)).toContainText('No saved session');expect(e.uploads).toHaveLength(2);expect(e.stages).toHaveLength(0);expect(e.api).toHaveLength(0);expect(await pending(page).getByRole('textbox',{name:'Held session details',exact:true}).inputValue()).toBe(held);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.screenshot({path:'test-artifacts/intake-app-320-partial.png',fullPage:true});
 await page.unroute(objects);await retry(page).click();await saved(page);expect(e.uploads).toHaveLength(3);expect(e.uploads.filter(p=>p.includes('/00-'))).toHaveLength(1);expect(e.stages).toHaveLength(1);expect(e.api).toHaveLength(1);await originals(e.api[0].run_id,files());expect(e.errors).toEqual([]);
});
test('lost original upload reply is independently confirmed without a second upload',async({page})=>{
 const e=await visit(page);await mockCompletion(page);await page.route('**/storage/v1/object/item-images/**',async route=>{if(route.request().method()!=='POST')return route.fallback();const r=await route.fetch();expect(r.ok()).toBe(true);return route.abort('connectionreset');});
 await choose(page);await analyse(page).click();await saved(page);expect(e.uploads).toHaveLength(2);expect(e.stages).toHaveLength(1);expect(e.api).toHaveLength(1);await originals(e.api[0].run_id,files());expect(e.errors).toEqual([]);
});
test('wrong downloaded bytes stop staging and preserve the selected original for safe recovery',async({page})=>{
 const e=await visit(page);await mockCompletion(page);const download='**/storage/v1/object/item-images/**';let injected=0;
 await page.route(download,async route=>{if(route.request().method()!=='GET')return route.fallback();injected++;const response=await route.fetch(),body=syntheticStoragePNG(222);return route.fulfill({response,status:200,headers:{...response.headers(),'content-type':'image/png','content-length':String(body.length)},body});});
 await choose(page,[41]);await analyse(page).click();await expect(status(page)).toContainText('stored original differs');expect(injected).toBeGreaterThan(0);expect(e.api).toHaveLength(0);expect(e.stages).toHaveLength(0);expect(e.uploads).toHaveLength(1);
 await page.unroute(download);await retry(page).click();await saved(page);expect(e.uploads).toHaveLength(1);await originals(e.api[0].run_id,files([41]));
});
test('lost staging readback holds one identity and a read-only check does not dispatch analysis',async({page})=>{
 const e=await visit(page);await mockCompletion(page);let committed=false;
 await page.route(runs,async route=>{if(route.request().method()==='POST'){const r=await route.fetch();expect(r.ok()).toBe(true);committed=true;return route.fulfill({response:r});}if(committed&&route.request().method()==='GET')return route.fulfill({status:403,json:{message:'Synthetic session read denied'}});return route.fallback();});
 await choose(page,[41]);await analyse(page).click();await expect(status(page)).toContainText('session could not be checked');expect(e.stages).toHaveLength(1);expect(e.api).toHaveLength(0);const first=e.stages[0];
 await page.unroute(runs);await check(page).click();await expect(status(page)).toContainText('analysis is not complete');expect(e.api).toHaveLength(0);expect(e.stages).toHaveLength(1);
 await retry(page).click();await saved(page);expect(e.stages).toHaveLength(1);expect(e.uploads).toHaveLength(1);expect(e.api[0].run_id).toBe(first.id);await originals(first.id,files([41]));
});
test('fabricated analysis success stays unconfirmed and Check only reads the eventual saved result',async({page})=>{
 await page.setViewportSize({width:320,height:900});const e=await visit(page);await page.route(api,route=>route.fulfill({status:200,json:{saved_run_id:route.request().postDataJSON().run_id,result:{objects:[{working_title:'Unsaved invented response'}]}}}));
 await choose(page,[41]);await analyse(page).click();await expect(status(page)).toContainText('complete saved result is not yet confirmed');expect(e.api).toHaveLength(1);await expect(analyse(page)).toBeDisabled();await expect(retry(page)).toHaveCount(0);await expect(page.getByRole('button',{name:/Mixed batch/})).toBeDisabled();await expect(page.getByRole('textbox',{name:'Your notes / hypothesis',exact:true})).toBeDisabled();
 await expect(pending(page).getByRole('textbox',{name:'Held session details',exact:true})).toHaveJSProperty('readOnly',true);await check(page).click();await expect(status(page)).toContainText('No new analysis');expect(e.api).toHaveLength(1);expect(e.stages).toHaveLength(1);expect(e.uploads).toHaveLength(1);expect(e.errors).toEqual([]);
 await pending(page).getByText('Unconfirmed service reply',{exact:true}).click();await expect(pending(page).locator('pre').filter({hasText:'Unsaved invented response'})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.screenshot({path:'test-artifacts/intake-app-320-unconfirmed.png',fullPage:true});
 await complete(e.api[0].run_id);await check(page).click();await saved(page);expect(e.api).toHaveLength(1);await originals(e.api[0].run_id,files([41]));
});
test('lost analysis reply reopens the actual completed report without paying again',async({page})=>{
 const e=await visit(page);await page.route(api,async route=>{await complete(route.request().postDataJSON().run_id);return route.abort('connectionreset');});
 await choose(page);await analyse(page).click();await saved(page);expect(e.api).toHaveLength(1);expect(e.stages).toHaveLength(1);await originals(e.api[0].run_id,files());expect(e.errors).toEqual([]);
});
test('unreadable service response remains inspectable while saved-session recovery stays read-only',async({page})=>{
 const e=await visit(page);await page.route(api,route=>route.fulfill({status:503,contentType:'text/plain',body:'Synthetic service unavailable; response retained <not HTML>'}));
 await choose(page,[41]);await analyse(page).click();await expect(status(page)).toContainText('not yet confirmed');await pending(page).getByText('Unconfirmed service reply',{exact:true}).click();await expect(pending(page).locator('pre').filter({hasText:'response retained <not HTML>'})).toBeVisible();
 await check(page).click();await expect(status(page)).toContainText('No new analysis');expect(e.api).toHaveLength(1);expect(e.stages).toHaveLength(1);expect(e.errors).toEqual([]);
 await complete(e.api[0].run_id);await check(page).click();await saved(page);expect(e.api).toHaveLength(1);
});
test('a misleading response identity cannot replace the actual owned saved report',async({page})=>{
 const e=await visit(page);await page.route(api,async route=>{await complete(route.request().postDataJSON().run_id);return route.fulfill({status:200,json:{saved_run_id:'00000000-0000-4000-8000-000000000099',result:{objects:[{working_title:'False response identity'}]}}});});
 await choose(page,[41]);await analyse(page).click();await saved(page);await expect(page.getByText('False response identity',{exact:true})).toHaveCount(0);expect(e.api).toHaveLength(1);expect(page.url()).toContain(e.api[0].run_id);
});
test('denied completed-result readback is recovered without another dispatch or upload',async({page})=>{
 const e=await visit(page);let finished=false;await page.route(api,async route=>{const result=await complete(route.request().postDataJSON().run_id);finished=true;return route.fulfill({status:200,json:{result}});});
 await page.route(runs,route=>finished&&route.request().method()==='GET'?route.fulfill({status:403,json:{message:'Synthetic completed result denied'}}):route.fallback());
 await choose(page,[41]);await analyse(page).click();await expect(status(page)).toContainText('could not be checked');await expect(retry(page)).toHaveCount(0);expect(e.api).toHaveLength(1);
 await page.unroute(runs);await check(page).click();await saved(page);expect(e.api).toHaveLength(1);expect(e.uploads).toHaveLength(1);expect(e.stages).toHaveLength(1);
});
for(const field of ['user_context','image_manifest'])test(`changed saved ${field} fails closed without another analysis`,async({page})=>{
 const e=await visit(page);await page.route(api,async route=>{const id=route.request().postDataJSON().run_id;await complete(id);const row=await read(id);const change=field==='user_context'?{user_context:{...row.user_context,user_notes:'Changed outside this request'}}:{result:{...row.result,image_manifest:row.result.image_manifest.map(p=>({...p,file_name:'Different original.png'}))}};const w=await client.from('ai_analysis_runs').update(change).eq('id',id);expect(w.error).toBeNull();return route.fulfill({status:200,json:{saved_run_id:id}});});
 await choose(page,[41]);await analyse(page).click();await expect(status(page)).toContainText('saved session differs');await expect(page).toHaveURL(/#\/intake$/);await expect(retry(page)).toHaveCount(0);await check(page).click();await expect(status(page)).toContainText('saved session differs');expect(e.api).toHaveLength(1);expect(e.uploads).toHaveLength(1);expect(e.stages).toHaveLength(1);expect(e.errors).toEqual([]);
});
test('malformed saved model arrays remain raw rather than crashing review or enabling a paid repeat',async({page})=>{
 const e=await visit(page);await page.route(api,async route=>{const id=route.request().postDataJSON().run_id;const result=await complete(id,{objects:[{...originalObject([0]),evidence:'Malformed original array'}]});return route.fulfill({status:200,json:{saved_run_id:id,result}});});
 await choose(page,[41]);await analyse(page).click();await expect(status(page)).toContainText('not yet confirmed');await pending(page).getByText('Saved session data',{exact:true}).click();await expect(pending(page).locator('details').filter({has:page.getByText('Saved session data',{exact:true})}).locator('pre')).toContainText('Malformed original array');await expect(retry(page)).toHaveCount(0);expect(e.errors).toEqual([]);expect(e.api).toHaveLength(1);
});
test('a saved first pass stays available when later enrichment fails and catalogue remains blocked',async({page})=>{
 const e=await visit(page);await page.route(api,async route=>{await complete(route.request().postDataJSON().run_id,{analysis_stage:'FIRST_PASS_SAVED'});return route.fulfill({status:503,json:{error:'Synthetic enrichment failure'}});});
 await choose(page,[41]);await analyse(page).click();await saved(page);await page.getByRole('tab',{name:'catalogue',exact:true}).click();await expect(page.getByRole('button',{name:'Catalogue 1 selected',exact:true})).toBeDisabled();expect((await read(e.api[0].run_id)).result.analysis_stage).toBe('FIRST_PASS_SAVED');expect(e.api).toHaveLength(1);expect(e.errors).toEqual([]);
});
test('double activation holds one analysis request while the same session is busy',async({page})=>{
 const e=await visit(page);let release,started;const gate=new Promise(r=>release=r),seen=new Promise(r=>started=r);await page.route(api,async route=>{started();await gate;const result=await complete(route.request().postDataJSON().run_id);return route.fulfill({status:200,json:{result}});});
 await choose(page,[41]);await analyse(page).evaluate(button=>{button.click();button.click()});await seen;expect(e.api).toHaveLength(1);await expect(analyse(page)).toBeDisabled();await expect(check(page)).toBeDisabled();release();await saved(page);expect(e.api).toHaveLength(1);expect(e.stages).toHaveLength(1);expect(e.uploads).toHaveLength(1);
});
test('changing account during analysis cannot display or recover the previous owner session',async({page})=>{
 const e=await visit(page);let release,started;const gate=new Promise(r=>release=r),seen=new Promise(r=>started=r);await page.route(api,async route=>{const result=await complete(route.request().postDataJSON().run_id);started();await gate;return route.fulfill({status:200,json:{result}});});
 await choose(page,[41]);await analyse(page).click();await seen;await page.evaluate(async()=>{const {supabase}=await import('/src/lib/supabase.ts');const r=await supabase.auth.signInWithPassword({email:'photo-ci-b@example.test',password:'Ci-disposable-photo-4826!'});if(r.error)throw Error(r.error.message);});
 release();await expect(pending(page)).toHaveCount(0);await expect(page.locator('.intakeThumb')).toHaveCount(0);await expect(page).toHaveURL(/#\/intake$/);const row=await originals(e.api[0].run_id,files([41]));expect(row.owner_id).toBe(owner);expect(e.api).toHaveLength(1);expect(e.errors).toEqual([]);
});
test('leaving during a committed upload stops remaining uploads and staging for the old route',async({page})=>{
 const e=await visit(page);let release,started;const gate=new Promise(r=>release=r),seen=new Promise(r=>started=r);await page.route('**/storage/v1/object/item-images/**',async route=>{if(route.request().method()!=='POST')return route.fallback();const r=await route.fetch();expect(r.ok()).toBe(true);started();await gate;return route.fulfill({response:r});});
 await choose(page);await analyse(page).click();await seen;await page.evaluate(()=>{location.hash='/inventory'});await expect(page.getByRole('heading',{name:'Inventory',exact:true})).toBeVisible();release();await expect(pending(page)).toHaveCount(0);expect(e.uploads).toHaveLength(1);expect(e.stages).toHaveLength(0);expect(e.api).toHaveLength(0);
 const path=decodeURIComponent(e.uploads[0].replace('/storage/v1/object/item-images/',''));const r=await client.storage.from('item-images').download(path);expect(r.error).toBeNull();expect(digest(Buffer.from(await r.data.arrayBuffer()))).toBe(digest(files()[0].buffer));
});
test('empty selected file is rejected before any Storage, staging or analysis request',async({page})=>{
 const e=await visit(page);await page.locator('input[type=file]').setInputFiles([{name:'Empty.png',mimeType:'image/png',buffer:Buffer.alloc(0)}]);await analyse(page).click();await expect(status(page)).toContainText('non-empty JPEG');expect(e.uploads).toHaveLength(0);expect(e.stages).toHaveLength(0);expect(e.api).toHaveLength(0);await expect(pending(page)).toHaveCount(0);await expect(analyse(page)).toBeEnabled();
});
test('one intake continues through owner approval, original photos and sales planning without more AI',async({page})=>{
 const e=await visit(page),apiPaths=[];page.on('request',r=>{const u=new URL(r.url());if(r.method()==='POST'&&u.pathname.startsWith('/api/'))apiPaths.push(u.pathname);});await mockCompletion(page);
 await choose(page);await analyse(page).click();await saved(page);const id=e.api[0].run_id;
 const review=page.locator('details.ci-object-review').first();await review.locator('summary').first().click();await review.getByRole('textbox',{name:'Object title',exact:true}).fill('Owner title for sale preparation');
 await page.getByRole('tab',{name:'catalogue',exact:true}).click();await page.getByRole('button',{name:'Catalogue 1 selected',exact:true}).click();await expect(page).toHaveURL(/#\/item\/[0-9a-f-]+/);await expect(page.getByRole('heading',{name:'Owner title for sale preparation',exact:true})).toBeVisible();
 const items=await client.from('items').select('*').eq('source_analysis_run_id',id);expect(items.error).toBeNull();expect(items.data).toHaveLength(1);const item=items.data[0];expect(item.title).toBe('Owner title for sale preparation');expect(item.owner_id).toBe(owner);
 const row=await originals(id,files());expect(row.result.objects[0].working_title).toBe('Synthetic intake vessel');expect(row.status).toBe('APPROVED');
 await page.goto('/#/item/'+item.id+'?tab=photos');const photos=page.getByRole('region',{name:'Original photographs',exact:true});await expect(photos.locator('.photoGrid img')).toHaveCount(2);await expect.poll(()=>photos.locator('.photoGrid img').evaluateAll(images=>images.every(img=>img.complete&&img.naturalWidth===2))).toBe(true);
 const linked=await client.from('item_photos').select('*').eq('item_id',item.id).order('position');expect(linked.error).toBeNull();expect(linked.data.map(p=>p.storage_path)).toEqual(row.result.image_manifest.map(p=>p.storage_path));
 await page.getByRole('button',{name:'Sell / route',exact:true}).click();await expect(page.getByRole('heading',{name:'Sales and listing record',exact:true})).toBeVisible();const sale=page.getByRole('region',{name:'Actual recorded sale outcomes',exact:true});await expect(sale).toHaveAttribute('aria-busy','false');await expect(sale.getByRole('alert')).toHaveCount(0);await expect(sale.getByText('Record an actual completed sale',{exact:true})).toBeVisible();await page.screenshot({path:'test-artifacts/intake-app-approved-sales.png',fullPage:true});
 expect(e.api).toHaveLength(1);expect(apiPaths).toEqual(['/api/analyse-intake']);expect(e.uploads).toHaveLength(2);expect(e.stages).toHaveLength(1);expect(e.errors).toEqual([]);
});
test('invented staging acknowledgement cannot substitute for the committed session',async({page})=>{
 const e=await visit(page);await mockCompletion(page);await page.route(runs,route=>route.request().method()==='POST'?route.fulfill({status:201,json:{id:route.request().postDataJSON().id}}):route.fallback());
 await choose(page,[41]);await analyse(page).click();await expect(status(page)).toContainText('saved session is not confirmed');expect(e.stages).toHaveLength(1);expect(e.api).toHaveLength(0);const held=e.stages[0];
 await page.unroute(runs);await retry(page).click();await saved(page);expect(e.stages).toHaveLength(2);expect(e.stages[1]).toEqual(held);expect(e.uploads).toHaveLength(1);expect(e.api).toHaveLength(1);await originals(held.id,files([41]));
});
test('a falsely empty session read cannot duplicate its explicit staging primary key',async({page})=>{
 const e=await visit(page);await mockCompletion(page);let posted=false;await page.route(runs,async route=>{if(route.request().method()==='POST'){const r=await route.fetch();posted=true;return route.fulfill({response:r});}if(posted&&route.request().method()==='GET'){const r=await route.fetch();return route.fulfill({response:r,status:200,json:[]});}return route.fallback();});
 await choose(page,[41]);await analyse(page).click();await expect(status(page)).toContainText('saved session is not confirmed');const held=e.stages[0];expect((await read(held.id)).id).toBe(held.id);await retry(page).click();await expect(status(page)).toContainText('saved session is not confirmed');expect(e.stages).toHaveLength(2);expect(e.stages[1]).toEqual(held);expect(e.api).toHaveLength(0);expect(e.uploads).toHaveLength(1);
 const actual=await client.from('ai_analysis_runs').select('id').eq('id',held.id);expect(actual.error).toBeNull();expect(actual.data).toHaveLength(1);await page.unroute(runs);await retry(page).click();await saved(page);expect(e.stages).toHaveLength(2);expect(e.api).toHaveLength(1);await originals(held.id,files([41]));
});
