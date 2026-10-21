import {test,expect} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import {createHash,randomUUID} from 'node:crypto';
import {syntheticStoragePNG} from '../scripts/test-photo-storage-cases.mjs';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const approval='**/rest/v1/rpc/ci_approve_saved_intake_v1';
let client,owner;
test.beforeAll(async()=>{
 client=createClient('http://127.0.0.1:18000',process.env.CI_PHOTO_PUBLIC_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const login=await client.auth.signInWithPassword({email:'photo-ci-a@example.test',password:'Ci-disposable-photo-4826!'});expect(login.error).toBeNull();owner=login.data.user.id;
});
const object=(title,indices)=>({working_title:title,object_type:'Vessel',material:'Glass',image_indices:indices,condition_summary:'Synthetic original condition, not real object evidence',evidence:[{claim:'Synthetic visual suggestion',provenance:'INFERENCE',certainty_class:'POSSIBLE_ATTRIBUTION'}]});
async function seed(values={},row={},count=2){
 const images=[45,175,105].slice(0,count).map(syntheticStoragePNG),folder=`${owner}/intake/catalogue-app-${randomUUID()}`;
 const manifest=[];for(const [index,bytes]of images.entries()){
  const storage_path=`${folder}/original-${index}.png`,file_name=`Original catalogue ${index}.png`;
  const upload=await client.storage.from('item-images').upload(storage_path,bytes,{contentType:'image/png',upsert:false});expect(upload.error).toBeNull();
  manifest.push({index,storage_path,file_name,byte_count:bytes.length,content_sha256:digest(bytes)});
 }
 const original={analysis_stage:'COMPLETE',objects:[object('Synthetic original vessel A',[0]),object('Synthetic original vessel B',[1])],image_manifest:manifest,initial_ai_result:{batch_summary:'Original unverified synthetic response'},...values};
 const write=await client.from('ai_analysis_runs').insert({mode:'batch',model:'disposable-no-provider',input_photo_count:count,result:original,...row}).select('id').single();expect(write.error).toBeNull();return {id:write.data.id,original,images,manifest};
}
async function visit(page,id,theme='light',ready=2){
 const errors=[],paid=[],requests=[];page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(request.method()==='POST'&&request.url().includes('/rest/v1/rpc/ci_approve_saved_intake_v1'))requests.push(request.postDataJSON());});
 await page.route('**/*',route=>{const url=new URL(route.request().url());if(url.hostname!=='127.0.0.1')return route.abort('blockedbyclient');if(url.pathname.startsWith('/api/')){if(/\/(research-item|analyse-intake)$/.test(url.pathname))paid.push(url.pathname);return route.abort('blockedbyclient');}return route.fallback();});
 await page.addInitScript(theme=>localStorage.setItem('ci-appearance-v1',theme),theme);await page.goto(`/#/draft/${id}?tab=catalogue`);
 await page.getByLabel('Email',{exact:true}).fill('photo-ci-a@example.test');await page.getByLabel('Password',{exact:true}).fill('Ci-disposable-photo-4826!');await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.locator('.ci-saved-draft')).toBeVisible();if(ready!==null)await expect(page.getByRole('button',{name:`Catalogue ${ready} selected`,exact:true})).toBeEnabled();return {errors,paid,requests};
}
async function children(id){const read=await client.from('items').select('*').eq('source_analysis_run_id',id).order('source_object_index');expect(read.error).toBeNull();return read.data;}
test('lost actual catalogue acknowledgement resolves committed records from independent readback',async({page})=>{
 const run=await seed(),requests=await visit(page,run.id);
 await page.route(approval,async route=>{const response=await route.fetch();expect(response.ok()).toBe(true);return route.abort('connectionreset');});
 await page.getByRole('button',{name:'Catalogue 2 selected',exact:true}).click();await expect.poll(async()=>(await children(run.id)).length).toBe(2);
 await expect(page.getByRole('heading',{name:'Objects safely catalogued',exact:true})).toBeVisible();expect(requests.requests).toHaveLength(1);expect(requests.errors).toEqual([]);expect(requests.paid).toEqual([]);
});
const action=page=>page.getByRole('button',{name:'Catalogue 2 selected',exact:true});
const outcome=page=>page.locator('.ci-catalogue-status');
async function saved(page){await expect(page.getByRole('region',{name:'Saved catalogue records',exact:true})).toBeVisible();await expect(outcome(page)).toContainText('saved and read back');await expect(outcome(page)).toBeFocused();}
async function source(id){const r=await client.from('ai_analysis_runs').select('*').eq('id',id).single();expect(r.error).toBeNull();return r.data;}
async function links(id){const r=await client.from('item_photos').select('*').eq('item_id',id).order('position');expect(r.error).toBeNull();return r.data;}
async function intact(run,indices=[0,1]){
 await expect.poll(async()=>(await children(run.id)).length).toBe(indices.length);
 const items=await children(run.id);expect(items.map(row=>row.source_object_index)).toEqual(indices);const row=await source(run.id);expect(row.status).toBe('APPROVED');
 for(const key of ['objects','image_manifest','initial_ai_result'])expect(row.result[key]).toEqual(run.original[key]);
 for(const [index,photo]of run.manifest.entries()){const r=await client.storage.from('item-images').download(photo.storage_path);expect(r.error).toBeNull();expect(digest(Buffer.from(await r.data.arrayBuffer()))).toBe(digest(run.images[index]));}
 return items;
}
async function review(page,index=0){await page.locator('.ci-object-review').nth(index).locator('summary').first().click();return page.locator('.ci-object-review').nth(index);}
async function reauthenticate(page,letter){await page.evaluate(async letter=>{const {supabase}=await import('/src/lib/supabase.ts');const r=await supabase.auth.signInWithPassword({email:`photo-ci-${letter}@example.test`,password:'Ci-disposable-photo-4826!'});if(r.error)throw Error(r.error.message);},letter);}
for(const width of [320,390,1100,1440])for(const theme of ['light','dark'])test(`actual catalogue route ${width}px ${theme}: review, original links and refresh`,async({page})=>{
 await page.setViewportSize({width,height:900});const run=await seed(),requests=await visit(page,run.id,theme);expect(await children(run.id)).toHaveLength(0);expect(requests.requests).toHaveLength(0);
 await expect(page.locator('.ci-record-card .itemCardImage img')).toHaveCount(2);await expect.poll(()=>page.locator('.ci-record-card .itemCardImage img').evaluateAll(images=>images.every(image=>image.complete&&image.naturalWidth===2))).toBe(true);
 const form=await review(page);await form.getByLabel('Object title',{exact:true}).fill('Owner reviewed title');await form.getByRole('textbox',{name:'Your condition notes',exact:true}).fill('Owner observed condition retained');
 await page.screenshot({path:`test-artifacts/catalogue-app-${width}-${theme}-review.png`,fullPage:true});await action(page).click();await saved(page);
 const items=await intact(run);expect(items[0].title).toBe('Owner reviewed title');expect(items[0].condition_summary).toBe('Owner observed condition retained');
 for(const item of items){const photos=await links(item.id);expect(photos.map(p=>p.position)).toEqual(run.original.objects[item.source_object_index].image_indices);expect(photos[0].storage_path).toBe(run.manifest[item.source_object_index].storage_path);}
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.screenshot({path:`test-artifacts/catalogue-app-${width}-${theme}-saved.png`,fullPage:true});
 const ids=items.map(item=>item.id);await page.reload();await expect(page.getByRole('region',{name:'Saved catalogue records',exact:true})).toBeVisible();expect((await children(run.id)).map(item=>item.id)).toEqual(ids);expect(requests.requests).toHaveLength(1);expect(requests.errors).toEqual([]);expect(requests.paid).toEqual([]);
});
test('denied approval locks reviewed facts; Check is read-only and deliberate retry reuses them',async({page})=>{
 await page.setViewportSize({width:320,height:900});const run=await seed(),requests=await visit(page,run.id);const form=await review(page);await form.getByLabel('Object title',{exact:true}).fill('Held owner title');
 await page.route(approval,route=>route.fulfill({status:403,json:{message:'Synthetic denied approval'}}));await action(page).click();await expect(outcome(page)).toContainText('held unchanged');await expect(outcome(page)).toBeFocused();await expect(form.getByLabel('Object title',{exact:true})).toBeDisabled();await expect(page.getByRole('checkbox',{name:'Include in catalogue'}).first()).toBeDisabled();expect(await children(run.id)).toHaveLength(0);
 await page.getByRole('button',{name:'Check catalogue result',exact:true}).click();await expect(outcome(page)).toContainText('held unchanged');expect(requests.requests).toHaveLength(1);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.screenshot({path:'test-artifacts/catalogue-app-320-pending.png',fullPage:true});
 await page.unroute(approval);await page.getByRole('button',{name:'Retry same catalogue approval',exact:true}).click();await saved(page);expect(requests.requests).toHaveLength(2);expect(requests.requests[1]).toEqual(requests.requests[0]);expect((await intact(run))[0].title).toBe('Held owner title');
});
test('fabricated success response without a committed catalogue never becomes success',async({page})=>{
 const run=await seed(),requests=await visit(page,run.id);await page.route(approval,route=>route.fulfill({status:200,json:[{item_id:randomUUID(),item_code:'FAKE',object_index:0,title:'Not saved'},{item_id:randomUUID(),item_code:'FAKE-2',object_index:1,title:'Not saved'}]}));
 await action(page).click();await expect(outcome(page)).toContainText('No catalogue result is confirmed');await expect(page.getByRole('region',{name:'Saved catalogue records'})).toHaveCount(0);expect(await children(run.id)).toHaveLength(0);expect((await source(run.id)).status).toBe('DRAFT');expect(requests.requests).toHaveLength(1);
 await page.unroute(approval);await page.getByRole('button',{name:'Retry same catalogue approval',exact:true}).click();await saved(page);await intact(run);
});
test('unusable acknowledgement after real commit resolves actual identities, never returned substitutes',async({page})=>{
 const run=await seed(),requests=await visit(page,run.id),falseId=randomUUID();await page.route(approval,async route=>{const r=await route.fetch();expect(r.ok()).toBe(true);return route.fulfill({status:200,json:[{item_id:falseId,item_code:'FALSE',object_index:0,title:'Incorrect response'}]});});
 await action(page).click();await saved(page);const items=await intact(run);const hrefs=await page.locator('.ci-catalogued-links a').evaluateAll(links=>links.map(link=>link.getAttribute('href')));expect(hrefs).toEqual(items.map(item=>'#/item/'+item.id));expect(hrefs.join()).not.toContain(falseId);expect(requests.requests).toHaveLength(1);
});
test('incomplete saved-item readback stays uncertain; Check recovers without another RPC',async({page})=>{
 const run=await seed(),requests=await visit(page,run.id);let committed=false;await page.route(approval,async route=>{const r=await route.fetch();expect(r.ok()).toBe(true);committed=true;return route.fulfill({response:r});});
 const items='**/rest/v1/items?*';await page.route(items,async route=>{if(!committed||route.request().method()!=='GET')return route.fallback();const r=await route.fetch();return route.fulfill({response:r,headers:{...r.headers(),'content-range':'0-1/3'}});});
 await action(page).click();await expect(outcome(page)).toContainText('Complete catalogue history');expect(await children(run.id)).toHaveLength(2);await expect(page.getByRole('region',{name:'Saved catalogue records'})).toHaveCount(0);
 await page.unroute(items);await page.getByRole('button',{name:'Check catalogue result',exact:true}).click();await saved(page);expect(requests.requests).toHaveLength(1);await intact(run);
});
test('unavailable original-link readback prevents success until a read-only check confirms it',async({page})=>{
 const run=await seed(),requests=await visit(page,run.id);const photos='**/rest/v1/item_photos?*';await page.route(photos,route=>route.fulfill({status:403,json:{message:'Synthetic link read denial'}}));await action(page).click();await expect(outcome(page)).toContainText('original photograph links');expect(await children(run.id)).toHaveLength(2);
 await page.unroute(photos);await page.getByRole('button',{name:'Check catalogue result',exact:true}).click();await saved(page);expect(requests.requests).toHaveLength(1);await intact(run);
});
test('selected original sibling alone receives its own photograph and opens its real item route',async({page})=>{
 const run=await seed(),requests=await visit(page,run.id);await page.getByRole('checkbox',{name:'Include in catalogue'}).first().uncheck();await page.getByRole('button',{name:'Catalogue 1 selected',exact:true}).click();const items=await intact(run,[1]);await expect(page.locator('.itemHero')).toBeVisible();expect(page.url()).toContain('/item/'+items[0].id);expect((await links(items[0].id)).map(row=>row.storage_path)).toEqual([run.manifest[1].storage_path]);expect(requests.paid).toEqual([]);
});
test('explicit matched pair keeps two physical originals and owner material correction separate from AI',async({page})=>{
 const run=await seed({objects:[object('Matched decorated glass vase — left example',[0]),object('Matched decorated glass vase — right example',[1])]}, {mode:'single'});
 const feedback=await client.from('ai_verdict_feedback').insert({source_analysis_run_id:run.id,feedback_type:'MATERIAL_CORRECTION',corrected_material:'Metal',owner_statement:'Synthetic direct owner observation, not instrument-tested'});expect(feedback.error).toBeNull();const requests=await visit(page,run.id,'light',1);
 await expect(page.getByRole('checkbox',{name:'One catalogue record for the pair (recommended)'})).toBeChecked();await page.getByRole('button',{name:'Catalogue 1 selected',exact:true}).click();const items=await intact(run,[0]);await expect(page.locator('.itemHero')).toBeVisible();expect(items[0].material).toBe('Metal');expect(items[0].title).toContain('metal');expect(items[0].identification_confidence).toBeNull();expect(items[0].quick_sale_value).toBeNull();expect((await links(items[0].id)).map(p=>p.storage_path)).toEqual(run.manifest.map(p=>p.storage_path));expect((await source(run.id)).result.owner_review.approved_snapshot['0'].pair_source_indices).toEqual([0,1]);expect(requests.paid).toEqual([]);
});
test('non-contiguous batch photo assignments stay with the correct original sibling',async({page})=>{
 const run=await seed({objects:[object('First synthetic sibling',[0,2]),object('Second synthetic sibling',[1])]}, {},3);await visit(page,run.id);await action(page).click();await saved(page);const items=await intact(run);expect((await links(items[0].id)).map(p=>p.position)).toEqual([0,2]);expect((await links(items[1].id)).map(p=>p.position)).toEqual([1]);
});
test('owner confirms a real-file subset without rewriting a model out-of-range reference',async({page})=>{
 const run=await seed({objects:[object('Synthetic invalid model reference',[0,5]),object('Second synthetic sibling',[1])]});await visit(page,run.id,'light',null);await expect(action(page)).toBeDisabled();await page.getByRole('checkbox',{name:'Confirm existing uploaded photos only'}).check();await action(page).click();await saved(page);const items=await intact(run);expect((await links(items[0].id)).map(p=>p.position)).toEqual([0]);const snapshot=(await source(run.id)).result.owner_review.approved_snapshot['0'];expect(snapshot.original_model_photo_indices).toEqual([0,5]);expect(snapshot.approved_photo_indices).toEqual([0]);expect(snapshot.photo_index_owner_confirmed).toBe(true);
});
test('changed original report blocks approval before RPC and retains current owner text',async({page})=>{
 const run=await seed(),requests=await visit(page,run.id);const form=await review(page);await form.getByLabel('Object title',{exact:true}).fill('Unsent owner text');const change=await client.from('ai_analysis_runs').update({result:{...run.original,objects:[object('Changed synthetic source',[0]),run.original.objects[1]]}}).eq('id',run.id);expect(change.error).toBeNull();await action(page).click();await expect(outcome(page)).toContainText('changed in another view');await expect(form.getByLabel('Object title',{exact:true})).toHaveValue('Unsent owner text');await expect(form.getByLabel('Object title',{exact:true})).toBeEnabled();expect(requests.requests).toHaveLength(0);expect(await children(run.id)).toHaveLength(0);
});
test('newer owner review blocks stale approval while retaining the unsaved text',async({page})=>{
 const run=await seed(),requests=await visit(page,run.id);const form=await review(page);await form.getByLabel('Object title',{exact:true}).fill('Unsent current title');const change=await client.rpc('ci_save_owner_review_v1',{p_run_id:run.id,p_expected_revision:0,p_object_changes:{'0':{working_title:'Newer other-tab title'}}});expect(change.error).toBeNull();await action(page).click();await expect(outcome(page)).toContainText('changed in another view');expect(requests.requests).toHaveLength(0);await expect(form.getByLabel('Object title',{exact:true})).toHaveValue('Unsent current title');
});
test('actual owner-review save retains revision history before catalogue approval',async({page})=>{
 const run=await seed();await visit(page,run.id);const form=await review(page);await form.getByLabel('Object title',{exact:true}).fill('Saved revision owner title');await page.getByRole('button',{name:'Save review changes',exact:true}).click();await expect(outcome(page)).toContainText('revision 1 saved');await action(page).click();await saved(page);expect((await intact(run))[0].title).toBe('Saved revision owner title');expect((await source(run.id)).owner_review_revision).toBe(1);const history=await client.from('ai_owner_review_revisions').select('*').eq('source_analysis_run_id',run.id);expect(history.error).toBeNull();expect(history.data).toHaveLength(1);
});
test('lost actual owner-review acknowledgement confirms the committed revision independently',async({page})=>{
 const run=await seed();await visit(page,run.id);const form=await review(page);await form.getByLabel('Object title',{exact:true}).fill('Retained owner review after lost reply');
 let writes=0;await page.route('**/rest/v1/rpc/ci_save_owner_review_v1',async route=>{writes++;const response=await route.fetch();expect(response.ok()).toBe(true);return route.abort('connectionreset');});
 await page.getByRole('button',{name:'Save review changes',exact:true}).click();await expect.poll(async()=>(await source(run.id)).owner_review_revision).toBe(1);
 const history=await client.from('ai_owner_review_revisions').select('*').eq('source_analysis_run_id',run.id);expect(history.error).toBeNull();expect(history.data).toHaveLength(1);expect(history.data[0].object_changes['0'].working_title).toBe('Retained owner review after lost reply');
 await expect(outcome(page)).toContainText('revision 1 saved');expect(writes).toBe(1);await expect(form.getByLabel('Object title',{exact:true})).toHaveValue('Retained owner review after lost reply');expect(await children(run.id)).toHaveLength(0);
});
test('same-owner reauthentication keeps edits; foreign owner and UI sign-out remove private state',async({page})=>{
 await page.setViewportSize({width:390,height:900});const run=await seed();await visit(page,run.id);const form=await review(page);await form.getByLabel('Object title',{exact:true}).fill('Private unsaved catalogue title');await reauthenticate(page,'a');await expect(form.getByLabel('Object title',{exact:true})).toHaveValue('Private unsaved catalogue title');await reauthenticate(page,'b');await expect(page.getByRole('alert')).toContainText('unavailable');await expect(page.locator('.ci-record-card')).toHaveCount(0);await expect(page.getByRole('region',{name:'Saved catalogue records'})).toHaveCount(0);await page.getByRole('button',{name:'Open navigation menu'}).click();await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeVisible();
});
test('late real approval cannot reveal the former owner or navigate after account change',async({page})=>{
 const run=await seed();await visit(page,run.id);let release,started;const gate=new Promise(resolve=>release=resolve),seen=new Promise(resolve=>started=resolve);await page.route(approval,async route=>{const r=await route.fetch();expect(r.ok()).toBe(true);started();await gate;return route.fulfill({response:r});});await action(page).click();await seen;await reauthenticate(page,'b');release();await expect(page.getByRole('alert')).toContainText('unavailable');await expect(page.locator('.ci-record-card')).toHaveCount(0);await expect(page.getByRole('region',{name:'Saved catalogue records'})).toHaveCount(0);expect(page.url()).toContain('/draft/'+run.id);await intact(run);
});
test('changing saved report during approval clears previous edits and ignores the late result',async({page})=>{
 const first=await seed(),second=await seed({objects:[object('New selected synthetic report',[0]),object('New second sibling',[1])]});await visit(page,first.id);const form=await review(page);await form.getByLabel('Object title',{exact:true}).fill('Previous report private edit');let release,started;const gate=new Promise(resolve=>release=resolve),seen=new Promise(resolve=>started=resolve);await page.route(approval,async route=>{const r=await route.fetch();expect(r.ok()).toBe(true);started();await gate;return route.fulfill({response:r});});await action(page).click();await seen;await page.evaluate(id=>{location.hash='/draft/'+id+'?tab=catalogue'},second.id);await expect(page.locator('.ci-report-heading h1')).toHaveText('New selected synthetic report');release();await expect(action(page)).toBeEnabled();await expect(page.getByRole('region',{name:'Saved catalogue records'})).toHaveCount(0);const newForm=await review(page);await expect(newForm.getByLabel('Object title',{exact:true})).toHaveValue('New selected synthetic report');expect(await children(second.id)).toHaveLength(0);expect(await children(first.id)).toHaveLength(2);
});
test('partial analysis cannot be catalogued and makes no approval RPC',async({page})=>{
 const run=await seed({analysis_stage:'STAGED'}),requests=await visit(page,run.id,'light',null);await expect(action(page)).toBeDisabled();expect(requests.requests).toHaveLength(0);expect(await children(run.id)).toHaveLength(0);
});
test('incomplete initial catalogue history fails closed instead of implying no previous records',async({page})=>{
 const run=await seed();await page.route('**/rest/v1/items?*',async route=>{const r=await route.fetch();return route.fulfill({response:r,headers:{...r.headers(),'content-range':'0-0/2'}});});const requests=await visit(page,run.id,'light',null);await expect(page.getByRole('alert')).toContainText('Complete catalogue history');expect(requests.requests).toHaveLength(0);await expect(action(page)).toHaveCount(0);
});
test('unavailable original preview blocks approval with a clear reload instruction',async({page})=>{
 const run=await seed();await page.route('**/storage/v1/object/sign/item-images/**',route=>route.fulfill({status:403,json:{message:'Synthetic denied preview'}}));const requests=await visit(page,run.id,'light',null);await expect(page.getByRole('alert')).toContainText('could not be previewed');await expect(action(page)).toBeDisabled();expect(requests.requests).toHaveLength(0);
});
test('keyboard approval reaches confirmed result focus',async({page})=>{
 const run=await seed();await visit(page,run.id);await action(page).focus();await page.keyboard.press('Enter');await saved(page);await intact(run);
});
