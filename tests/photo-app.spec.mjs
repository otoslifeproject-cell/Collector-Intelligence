import {test,expect} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import {mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {syntheticStoragePNG} from '../scripts/test-photo-storage-cases.mjs';
mkdirSync('test-artifacts',{recursive:true});
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const metadata='**/rest/v1/item_photos*',objects='**/storage/v1/object/item-images/**';
let client,owner;
test.beforeAll(async()=>{
 client=createClient('http://127.0.0.1:18000',process.env.CI_PHOTO_PUBLIC_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const login=await client.auth.signInWithPassword({email:'photo-ci-a@example.test',password:'Ci-disposable-photo-4826!'});expect(login.error).toBeNull();owner=login.data.user.id;
});
async function seed(values={}){const result=await client.from('items').insert({owner_id:owner,title:'Synthetic photo workflow',currency:'GBP',acquisition_currency:'GBP',acquisition_price:20.50,...values}).select('id,item_code').single();expect(result.error).toBeNull();return result.data;}
const panel=page=>page.getByRole('region',{name:'Original photographs',exact:true});
const uploadButton=page=>panel(page).getByRole('button',{name:'Upload photos',exact:true});
async function visit(page,id,theme='light'){
 const errors=[],paid=[],uploads=[],posts=[];page.on('pageerror',error=>errors.push(error.message));
 page.on('request',request=>{const url=new URL(request.url());if(request.method()==='POST'&&/^\/storage\/v1\/object\/item-images\//.test(url.pathname))uploads.push(url.pathname);if(request.method()==='POST'&&url.pathname==='/rest/v1/item_photos')posts.push(request.postDataJSON());});
 await page.route('**/*',route=>{const url=new URL(route.request().url());if(url.hostname!=='127.0.0.1')return route.abort('blockedbyclient');if(url.pathname.startsWith('/api/')){paid.push(url.pathname);return route.abort('blockedbyclient');}return route.fallback();});
 await page.addInitScript(theme=>localStorage.setItem('ci-appearance-v1',theme),theme);
 await page.goto(`/#/item/${id}?tab=photos`);await page.getByLabel('Email',{exact:true}).fill('photo-ci-a@example.test');await page.getByLabel('Password',{exact:true}).fill('Ci-disposable-photo-4826!');await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Photographs',exact:true})).toBeVisible();return {errors,paid,uploads,posts};
}
const inputFiles=(values=[40,170])=>values.map((value,index)=>({name:`Original ${index}.png`,mimeType:'image/png',buffer:syntheticStoragePNG(value)}));
async function choose(page,values){await expect(uploadButton(page)).toBeEnabled();const files=inputFiles(values);await panel(page).locator('input[type=file]').setInputFiles(files);return files;}
async function confirmed(page,count=1){await expect(panel(page).getByRole('status')).toHaveText(`${count} original photographs saved and linked to this item.`);await expect(panel(page).getByRole('status')).toBeFocused();}
async function decoded(page,count){await expect(panel(page).locator('img')).toHaveCount(count);await expect.poll(()=>panel(page).locator('img').evaluateAll(images=>images.every(image=>image.complete&&image.naturalWidth===2))).toBe(true);}
async function rows(id){const read=await client.from('item_photos').select('*').eq('item_id',id).order('position').order('file_name');expect(read.error).toBeNull();return read.data;}
async function original(path,expected){const read=await client.storage.from('item-images').download(path);expect(read.error).toBeNull();expect(digest(Buffer.from(await read.data.arrayBuffer()))).toBe(digest(expected));}
async function reauthenticate(page,letter){await page.evaluate(async letter=>{const {supabase}=await import('/src/lib/supabase.ts');const result=await supabase.auth.signInWithPassword({email:`photo-ci-${letter}@example.test`,password:'Ci-disposable-photo-4826!'});if(result.error)throw Error(result.error.message);},letter);}
for(const width of [320,390,1100,1440])for(const theme of ['light','dark'])test(`actual photo route ${width}px ${theme}`,async({page})=>{
 await page.setViewportSize({width,height:900});const item=await seed();const requests=await visit(page,item.id,theme);await expect(page.getByText('No photographs linked to this item yet.',{exact:true})).toBeVisible();
 const files=await choose(page);await confirmed(page,2);await decoded(page,2);
 const saved=await rows(item.id);expect(saved.map(row=>row.position)).toEqual([0,1]);expect(saved.map(row=>row.file_name)).toEqual(files.map(file=>file.name));
 for(let index=0;index<saved.length;index++){expect(saved[index].owner_id).toBe(owner);await original(saved[index].storage_path,files[index].buffer);}
 const geometry=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));expect(geometry.scroll).toBeLessThanOrEqual(geometry.width+1);
 const colours=await panel(page).locator('.photoTile>div span').first().evaluate(element=>({text:getComputedStyle(element).color,background:getComputedStyle(element.parentElement).backgroundColor}));
 const luminance=colour=>colour.match(/[\d.]+/g).slice(0,3).map(Number).map(value=>value/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0);
 const light=luminance(colours.text),background=luminance(colours.background);expect((Math.max(light,background)+.05)/(Math.min(light,background)+.05)).toBeGreaterThanOrEqual(4.5);
 await page.screenshot({path:`test-artifacts/photo-app-${width}-${theme}.png`,fullPage:true});
 await page.reload();await decoded(page,2);expect((await rows(item.id)).map(row=>row.id)).toEqual(saved.map(row=>row.id));expect(requests.uploads).toHaveLength(2);expect(requests.posts).toHaveLength(2);expect(requests.errors).toEqual([]);expect(requests.paid).toEqual([]);
});
test('keyboard reaches native file chooser and completion status',async({page})=>{
 const item=await seed();await visit(page,item.id);await uploadButton(page).focus();const event=page.waitForEvent('filechooser');await page.keyboard.press('Enter');const chooser=await event;await chooser.setFiles(inputFiles([40]));await confirmed(page);await decoded(page,1);
});
test('lost metadata acknowledgement resolves from real readback without another INSERT or upload',async({page})=>{
 const item=await seed();const requests=await visit(page,item.id);
 await page.route(metadata,async route=>{if(route.request().method()!=='POST')return route.fallback();const response=await route.fetch();expect(response.ok()).toBe(true);return route.abort('connectionreset');});
 await choose(page,[40]);await confirmed(page);await decoded(page,1);expect(requests.uploads).toHaveLength(1);expect(requests.posts).toHaveLength(1);expect(await rows(item.id)).toHaveLength(1);
});
test('failed metadata INSERT retains original and deliberate retry reuses identity without reupload',async({page})=>{
 const item=await seed();const requests=await visit(page,item.id);
 await page.route(metadata,route=>route.request().method()==='POST'?route.fulfill({status:403,json:{code:'42501',message:'Synthetic denied link'}}):route.fallback());
 await choose(page,[40]);await expect(panel(page).getByRole('status')).toContainText('1 still need confirmation');expect(await rows(item.id)).toHaveLength(0);expect(requests.posts).toHaveLength(1);await original(requests.posts[0].storage_path,syntheticStoragePNG(40));
 await page.unroute(metadata);await panel(page).getByRole('button',{name:'Retry pending photographs',exact:true}).click();await confirmed(page);await decoded(page,1);expect(requests.uploads).toHaveLength(1);expect(requests.posts).toHaveLength(2);expect(requests.posts[1]).toEqual(requests.posts[0]);expect(await rows(item.id)).toHaveLength(1);
});
test('unavailable saved-link readback stays uncertain until deliberate retry, with one real INSERT',async({page})=>{
 const item=await seed();const requests=await visit(page,item.id);let committed=false;
 await page.route(metadata,async route=>{const request=route.request(),url=new URL(request.url());if(request.method()==='POST'){const response=await route.fetch();expect(response.ok()).toBe(true);committed=true;return route.fulfill({response});}if(committed&&request.method()==='GET'&&url.searchParams.has('id'))return route.fulfill({status:403,json:{code:'42501',message:'Synthetic readback denial'}});return route.fallback();});
 await choose(page,[40]);await expect(panel(page).getByRole('status')).toContainText('1 still need confirmation');expect(await rows(item.id)).toHaveLength(1);
 await page.unroute(metadata);await panel(page).getByRole('button',{name:'Retry pending photographs',exact:true}).click();await confirmed(page);expect(requests.posts).toHaveLength(1);expect(requests.uploads).toHaveLength(1);
});
test('lost Storage acknowledgement recovers exact committed original before linking it',async({page})=>{
 const item=await seed();const requests=await visit(page,item.id);
 await page.route(objects,async route=>{if(route.request().method()!=='POST')return route.fallback();const response=await route.fetch();expect(response.ok()).toBe(true);return route.abort('connectionreset');});
 await choose(page,[40]);await confirmed(page);await decoded(page,1);const saved=await rows(item.id);expect(saved).toHaveLength(1);await original(saved[0].storage_path,syntheticStoragePNG(40));expect(requests.uploads).toHaveLength(1);expect(requests.posts).toHaveLength(1);
});
test('denied or incomplete photograph history blocks uploads and never implies an empty collection',async({page})=>{
 const item=await seed();await page.route(metadata,route=>route.request().method()==='GET'?route.fulfill({status:403,json:{message:'Synthetic read denial'}}):route.fallback());await visit(page,item.id);
 await expect(panel(page).getByRole('alert')).toContainText('Complete photograph history');await expect(uploadButton(page)).toBeDisabled();await expect(page.getByText('No photographs linked to this item yet.',{exact:true})).not.toBeVisible();
 await page.unroute(metadata);await page.route(metadata,async route=>{if(route.request().method()!=='GET')return route.fallback();const response=await route.fetch();return route.fulfill({response,headers:{...response.headers(),'content-range':'0-0/2'},json:[]});});
 await panel(page).getByRole('button',{name:'Reload photographs'}).click();await expect(panel(page).getByRole('alert')).toContainText('Complete photograph history');await expect(uploadButton(page)).toBeDisabled();
 await page.unroute(metadata);await panel(page).getByRole('button',{name:'Reload photographs'}).click();await expect(uploadButton(page)).toBeEnabled();await expect(page.getByText('No photographs linked to this item yet.',{exact:true})).toBeVisible();
});
test('secure preview failure is explicit and reload restores the real stored image',async({page})=>{
 const item=await seed();const requests=await visit(page,item.id);const signed='**/storage/v1/object/sign/item-images/**';
 await page.route(signed,route=>route.request().method()==='POST'?route.fulfill({status:403,json:{message:'Synthetic denied preview'}}):route.fallback());
 await choose(page,[40]);await confirmed(page);await expect(panel(page).getByRole('alert')).toContainText('new secure preview');await expect(panel(page).getByText('Preview unavailable',{exact:true})).toBeVisible();
 await page.unroute(signed);await panel(page).getByRole('button',{name:'Reload photographs'}).click();await decoded(page,1);expect(requests.uploads).toHaveLength(1);expect(await rows(item.id)).toHaveLength(1);
});
test('unsupported and oversized selected files are refused before Storage writes',async({page})=>{
 const item=await seed();const requests=await visit(page,item.id);await expect(uploadButton(page)).toBeEnabled();
 await panel(page).locator('input[type=file]').setInputFiles({name:'Not an original.txt',mimeType:'text/plain',buffer:Buffer.from('Synthetic text')});await expect(panel(page).getByRole('status')).toContainText('Choose a non-empty');
 await panel(page).locator('input[type=file]').setInputFiles({name:'Oversized.png',mimeType:'image/png',buffer:Buffer.alloc(26214401)});await expect(panel(page).getByRole('status')).toContainText('25 MB');expect(requests.uploads).toHaveLength(0);expect(await rows(item.id)).toHaveLength(0);
});
async function edit(page){await page.locator('.tabBar').getByRole('button',{name:'overview',exact:true}).click();await page.getByText('Edit full item record, commercial details and values',{exact:true}).click();}
test('photo upload and recorded sale preserve an unsaved edit; Save changes keeps real SOLD status',async({page})=>{
 const item=await seed({sale_readiness:'SELL_NOW'});const requests=await visit(page,item.id);await edit(page);await page.getByLabel('Working title',{exact:true}).fill('Unsaved original owner title');
 await page.locator('.tabBar').getByRole('button',{name:'photos',exact:true}).click();await choose(page,[40]);await confirmed(page);await page.locator('.tabBar').getByRole('button',{name:'sales',exact:true}).click();
 await page.locator('.ci-sale-outcome summary').click();const date=page.getByLabel('Actual sale date');await date.fill(await date.getAttribute('max'));await page.getByLabel('Actual selling venue').fill('Synthetic owner sale');await page.getByLabel('Gross amount received').fill('100.25');await page.locator('.ci-sale-outcome').getByRole('checkbox').check();await page.getByRole('button',{name:'Record actual sale and mark SOLD',exact:true}).click();await expect(page.locator('.ci-sale-outcome').getByRole('status')).toContainText('recorded and read back');await expect(page.locator('.itemHero .pill')).toHaveText('SOLD');
 await edit(page);await expect(page.getByLabel('Working title',{exact:true})).toHaveValue('Unsaved original owner title');await page.getByRole('button',{name:'Save changes',exact:true}).click();await expect(page.getByText('Saved',{exact:true})).toBeVisible();
 const read=await client.from('items').select('status,title').eq('id',item.id).single();expect(read.error).toBeNull();expect(read.data).toEqual({status:'SOLD',title:'Unsaved original owner title'});expect(await rows(item.id)).toHaveLength(1);expect(requests.paid).toEqual([]);
 await page.screenshot({path:'test-artifacts/photo-app-sold-editor.png',fullPage:true});
});
test('same-owner reauthentication retains edits; different owner and sign-out remove private item state',async({page})=>{
 await page.setViewportSize({width:390,height:900});const item=await seed();await visit(page,item.id);await choose(page,[40]);await confirmed(page);await edit(page);await page.getByLabel('Working title',{exact:true}).fill('Private unsaved owner title');await reauthenticate(page,'a');await expect(page.getByLabel('Working title',{exact:true})).toHaveValue('Private unsaved owner title');
 await reauthenticate(page,'b');await expect(page.getByRole('alert')).toContainText('unavailable');await expect(page.getByText('Private unsaved owner title',{exact:true})).not.toBeVisible();await expect(page.locator('.photoGrid img')).toHaveCount(0);
 await page.getByRole('button',{name:'Open navigation menu'}).click();await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeVisible();await expect(page.locator('.itemHero')).toHaveCount(0);
});
test('late committed photo-link response cannot render the former owner after account change',async({page})=>{
 const item=await seed();await visit(page,item.id);let release,started;const gate=new Promise(resolve=>release=resolve),seen=new Promise(resolve=>started=resolve);
 await page.route(metadata,async route=>{if(route.request().method()!=='POST')return route.fallback();const response=await route.fetch();expect(response.ok()).toBe(true);started();await gate;return route.fulfill({response});});
 await choose(page,[40]);await seen;await reauthenticate(page,'b');release();await expect(page.getByRole('alert')).toContainText('unavailable');await expect(page.locator('.photoGrid img')).toHaveCount(0);await expect(page.getByRole('status')).toHaveCount(0);const saved=await rows(item.id);expect(saved).toHaveLength(1);await original(saved[0].storage_path,syntheticStoragePNG(40));
});
test('changing item during a real upload retains its original without attaching it to the new item',async({page})=>{
 const first=await seed(),second=await seed({title:'Second synthetic photo workflow'});const requests=await visit(page,first.id);let release,started;const gate=new Promise(resolve=>release=resolve),seen=new Promise(resolve=>started=resolve);
 await page.route(objects,async route=>{if(route.request().method()!=='POST')return route.fallback();const response=await route.fetch();expect(response.ok()).toBe(true);started();await gate;return route.fulfill({response});});
 await choose(page,[40]);await seen;await page.evaluate(id=>{location.hash='/item/'+id+'?tab=photos'},second.id);await expect(page.locator('.itemHero h1')).toHaveText('Second synthetic photo workflow');release();await expect(uploadButton(page)).toBeEnabled();await expect(panel(page).getByRole('status')).toHaveCount(0);expect(await rows(first.id)).toHaveLength(0);expect(await rows(second.id)).toHaveLength(0);expect(requests.posts).toHaveLength(0);
 const path=decodeURIComponent(requests.uploads[0].replace('/storage/v1/object/item-images/',''));await original(path,syntheticStoragePNG(40));
});
