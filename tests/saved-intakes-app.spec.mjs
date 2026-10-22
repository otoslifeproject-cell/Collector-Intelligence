import {test,expect} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import {randomUUID,createHash} from 'node:crypto';
import {syntheticStoragePNG} from '../scripts/test-photo-storage-cases.mjs';
let client,owner;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
test.beforeAll(async()=>{
 client=createClient('http://127.0.0.1:18000',process.env.CI_PHOTO_PUBLIC_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const login=await client.auth.signInWithPassword({email:'photo-ci-a@example.test',password:'Ci-disposable-photo-4826!'});expect(login.error).toBeNull();owner=login.data.user.id;
});
async function seed(result={},extra={}){
 const id=randomUUID(),bytes=syntheticStoragePNG(125),storage_path=`${owner}/intake/${randomUUID()}/original.png`;
 const upload=await client.storage.from('item-images').upload(storage_path,bytes,{contentType:'image/png',upsert:false});expect(upload.error).toBeNull();
 const record={id,mode:'single',model:'fixture-no-provider',status:'DRAFT',input_photo_count:1,user_context:{user_notes:'Original owner observation'},result:{analysis_stage:'UNPARSED_RESPONSE_SAVED',image_manifest:[{index:0,storage_path,file_name:'Original.png',sha256:hash(bytes),byte_count:bytes.length}],provider_response_raw:'<script>untrusted response</script> '+('Original returned text '.repeat(150)),...result},...extra};
 const write=await client.from('ai_analysis_runs').insert(record);expect(write.error).toBeNull();return {...record,bytes,storage_path};
}
async function visit(page,path,theme='light',email='photo-ci-a@example.test'){
 const observed={errors:[],writes:[],paid:[]};page.on('pageerror',e=>observed.errors.push(e.message));
 page.on('request',r=>{const u=new URL(r.url());if(u.pathname.startsWith('/rest/v1/')&&r.method()!=='GET'&&r.method()!=='OPTIONS')observed.writes.push(u.pathname);if(u.pathname.startsWith('/api/'))observed.paid.push(u.pathname);});
 await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname!=='127.0.0.1'||u.pathname.startsWith('/api/'))return r.abort('blockedbyclient');return r.fallback();});
 await page.addInitScript(value=>localStorage.setItem('ci-appearance-v1',value),theme);
 await page.goto('/#'+path);await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel('Password',{exact:true}).fill('Ci-disposable-photo-4826!');await page.getByRole('button',{name:'Sign in',exact:true}).click();return observed;
}
test('a saved raw intake can be bookmarked and reopened after refresh without another paid request',async({page})=>{
 const run=await seed(),e=await visit(page,'/uploads/'+run.id);
 await expect(page.getByRole('heading',{name:'Saved photo session',exact:true})).toBeVisible();
 await page.getByText('Saved session data',{exact:true}).click();await expect(page.locator('pre')).toContainText(run.result.provider_response_raw);
 await page.reload();await expect(page.getByRole('heading',{name:'Saved photo session',exact:true})).toBeVisible();
 await page.getByText('Saved session data',{exact:true}).click();await expect(page.locator('pre')).toContainText(run.result.provider_response_raw);
 expect(e.writes).toEqual([]);expect(e.paid).toEqual([]);expect(e.errors).toEqual([]);
});
const body=page=>page.getByRole('region',{name:'Saved photo session',exact:true});
const noWrites=e=>{expect(e.writes).toEqual([]);expect(e.paid).toEqual([]);expect(e.errors).toEqual([]);};
const photoReady=page=>expect.poll(()=>body(page).locator('.photoGrid img').evaluateAll(images=>images.length>0&&images.every(img=>img.complete&&img.naturalWidth===2))).toBe(true);
const object=()=>({working_title:'Recovered saved vessel',condition_summary:'Synthetic only',image_indices:[0],object_type:'Vessel',material:'Glass',colour:'Synthetic',category:'Glass',sale_readiness:'RESEARCH_FIRST',status:'RESEARCH',maker:null,current_attribution:null,period_wording:null,region_country:null,marks_signatures_labels:null,rarity_desirability:null,catalogue_note:'Synthetic original',identification_confidence:20,dating_confidence:10,valuation_confidence:5,evidence:[],next_evidence:[],preliminary_value:{currency:'GBP',quick_sale:null,balanced_low:null,balanced_high:null,floor:null,basis:'Not a valuation'}});
const report=(stage='COMPLETE')=>({analysis_stage:stage,batch_summary:'Synthetic original output; no provider',objects:[object()]});
for(const width of [320,390,1100,1440])for(const theme of ['light','dark'])test(`saved raw session and private original ${width}px ${theme}`,async({page})=>{
 const run=await seed();await page.setViewportSize({width,height:900});const e=await visit(page,'/uploads/'+run.id,theme);
 await expect(body(page)).toHaveAttribute('aria-busy','false');await photoReady(page);
 await page.getByText('Saved session data',{exact:true}).click();await expect(body(page).locator('pre')).toContainText(run.result.provider_response_raw);
 await expect(page.getByRole('link',{name:'Open saved draft',exact:true})).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await expect(body(page).locator('script')).toHaveCount(0);
 await page.screenshot({path:`test-artifacts/saved-upload-${width}-${theme}.png`,fullPage:true});
 const stored=await client.from('ai_analysis_runs').select('result').eq('id',run.id).single();expect(stored.error).toBeNull();expect(stored.data.result).toEqual(run.result);
 const image=await client.storage.from('item-images').download(run.storage_path);expect(image.error).toBeNull();expect(hash(Buffer.from(await image.data.arrayBuffer()))).toBe(hash(run.bytes));noWrites(e);
});
test('older uploads beyond the former twelve-session view remain reachable by counted pages',async({page})=>{
 const prefix=randomUUID(),records=Array.from({length:25},(_,index)=>({id:randomUUID(),mode:'single',model:'fixture-no-provider',status:'DRAFT',input_photo_count:0,created_at:new Date(Date.UTC(2040,0,1,0,0,25-index)).toISOString(),result:{analysis_stage:'UPLOADED',objects:[{working_title:`${prefix} saved upload ${index}`}]}}));
 expect((await client.from('ai_analysis_runs').insert(records)).error).toBeNull();const e=await visit(page,'/uploads');
 const list=page.getByRole('region',{name:'Saved uploads',exact:true});await expect(list.locator('.itemCard')).toHaveCount(20);await expect(page.getByText(`${prefix} saved upload 24`,{exact:true})).toHaveCount(0);
 await page.getByRole('link',{name:'Older uploads',exact:true}).click();await expect(page).toHaveURL(/uploads\?page=2$/);await expect(page.getByRole('heading',{name:`${prefix} saved upload 24`,exact:true})).toBeVisible();await expect(list).toContainText('Showing 21–');
 await page.getByRole('link',{name:new RegExp(prefix+' saved upload 24')}).click();await expect(page.getByRole('heading',{name:'Saved photo session',exact:true})).toBeVisible();await expect(body(page)).toContainText(`${prefix} saved upload 24`);
 noWrites(e);
});
test('saved upload entry is available from intake and research without starting another analysis',async({page})=>{
 const e=await visit(page,'/intake');await page.getByRole('link',{name:'Saved uploads',exact:true}).click();await expect(page.getByRole('heading',{name:'Saved uploads',exact:true})).toBeVisible();await expect(page.getByRole('region',{name:'Saved uploads',exact:true})).toHaveAttribute('aria-busy','false');
 await page.goto('/#/research');await page.getByRole('link',{name:'All saved uploads',exact:true}).click();await expect(page.getByRole('heading',{name:'Saved uploads',exact:true})).toBeVisible();noWrites(e);
});
test('read-only checking recovers an independently completed session',async({page})=>{
 const run=await seed({analysis_stage:'UPLOADED'}),e=await visit(page,'/uploads/'+run.id);await expect(body(page)).toContainText('Awaiting saved analysis');
 const result={...run.result,...report()};expect((await client.from('ai_analysis_runs').update({result}).eq('id',run.id)).error).toBeNull();
 await page.getByRole('button',{name:'Check saved session',exact:true}).click();await expect(page.getByRole('link',{name:'Open saved draft',exact:true})).toBeVisible();await page.getByRole('link',{name:'Open saved draft',exact:true}).click();await expect(page).toHaveURL(new RegExp('/draft/'+run.id+'$'));await expect(page.locator('.ci-record-title').first()).toHaveText('Recovered saved vessel');noWrites(e);
});
for(const status of ['DRAFT','APPROVED'])test(`complete ${status} session reopens existing saved-report workflow`,async({page})=>{
 const run=await seed(report(),{status}),e=await visit(page,'/uploads/'+run.id);await expect(body(page)).toContainText(status==='APPROVED'?'Approved upload':'Draft ready to review');await page.getByRole('link',{name:'Open saved draft',exact:true}).click();await expect(page.locator('.ci-record-title').first()).toHaveText('Recovered saved vessel');noWrites(e);
});
test('retained first pass opens review while catalogue approval stays blocked',async({page})=>{
 const run=await seed(report('FIRST_PASS_SAVED')),e=await visit(page,'/uploads/'+run.id);await expect(body(page)).toContainText('First result saved');await page.getByRole('link',{name:'Open saved draft',exact:true}).click();await page.getByRole('tab',{name:'catalogue',exact:true}).click();await expect(page.getByRole('button',{name:'Catalogue 1 selected',exact:true})).toBeDisabled();noWrites(e);
});
for(const area of ['list','session'])test(`denied ${area} read remains explicit and recovers through GET only`,async({page})=>{
 const run=await seed(),pattern='**/rest/v1/ai_analysis_runs*';await page.route(pattern,async route=>{if(route.request().method()!=='GET')return route.fallback();const response=await route.fetch();return route.fulfill({response,status:403,json:{message:'Synthetic read denied'}});});
 const e=await visit(page,area==='list'?'/uploads':'/uploads/'+run.id);await expect(page.getByRole('alert')).toContainText('could not be checked');await expect(page.getByText('No saved photo uploads for this account.',{exact:true})).toHaveCount(0);await expect(page.getByRole('link',{name:'Open saved draft',exact:true})).toHaveCount(0);
 await page.unroute(pattern);await page.getByRole('button',{name:area==='list'?'Check saved uploads':'Check saved session',exact:true}).click();await expect(page.getByRole('alert')).toHaveCount(0);await expect(page.getByRole('region',{name:area==='list'?'Saved uploads':'Saved photo session',exact:true})).toHaveAttribute('aria-busy','false');noWrites(e);
});
for(const fault of ['truncated','missing count','foreign owner'])test(`inconsistent saved list ${fault} never appears as an empty or trusted history`,async({page})=>{
 let injected=0;await page.route('**/rest/v1/ai_analysis_runs*',async route=>{
  if(route.request().method()!=='GET')return route.fallback();const response=await route.fetch(),rows=await response.json();if(!Array.isArray(rows))return route.fulfill({response});injected++;
  const headers={...response.headers()};let data=rows;
  if(fault==='truncated'){data=rows.slice(1);headers['content-range']='0-19/999999';}
  if(fault==='missing count')delete headers['content-range'];
  if(fault==='foreign owner')data=rows.map((row,index)=>index?row:{...row,owner_id:randomUUID()});
  const text=JSON.stringify(data);headers['content-length']=String(Buffer.byteLength(text));return route.fulfill({response,headers,body:text});
 });
 const e=await visit(page,'/uploads');await expect(page.getByRole('alert')).toBeVisible();expect(injected).toBeGreaterThan(0);await expect(page.locator('.itemCard')).toHaveCount(0);noWrites(e);
});
for(const fault of ['foreign path','duplicate path','missing original'])test(`malformed manifest ${fault} stays raw and does not mint private previews`,async({page})=>{
 const run=await seed(),manifest=run.result.image_manifest;
 if(fault==='foreign path')manifest[0].storage_path=manifest[0].storage_path.replace(owner,randomUUID());
 if(fault==='duplicate path')manifest.push({...manifest[0],index:1});
 if(fault==='missing original')manifest.length=0;
 expect((await client.from('ai_analysis_runs').update({result:run.result,input_photo_count:fault==='duplicate path'?2:1}).eq('id',run.id)).error).toBeNull();let signed=0;page.on('request',r=>{if(r.url().includes('/object/sign/'))signed++;});
 const e=await visit(page,'/uploads/'+run.id);await expect(body(page)).toHaveAttribute('aria-busy','false');await expect(body(page)).toContainText('manifest needs review');await page.getByText('Saved session data',{exact:true}).click();await expect(body(page).locator('pre')).toContainText('image_manifest');expect(signed).toBe(0);noWrites(e);
});
test('another actual account cannot open a saved private session',async({page})=>{
 const run=await seed(),e=await visit(page,'/uploads/'+run.id,'light','photo-ci-b@example.test');await expect(body(page)).toContainText('unavailable for your account');await expect(page.locator('pre')).toHaveCount(0);await expect(page.locator('.photoGrid img')).toHaveCount(0);noWrites(e);
});
test('late previous-account readback cannot display the original private response',async({page})=>{
 const run=await seed();let release,started,held=false;const gate=new Promise(r=>release=r),seen=new Promise(r=>started=r);
 await page.route('**/rest/v1/ai_analysis_runs*',async route=>{if(held||new URL(route.request().url()).searchParams.get('id')!=='eq.'+run.id)return route.fallback();held=true;const response=await route.fetch();started();await gate;return route.fulfill({response});});
 const e=await visit(page,'/uploads/'+run.id);await seen;await page.evaluate(async()=>{const {supabase}=await import('/src/lib/supabase.ts');const login=await supabase.auth.signInWithPassword({email:'photo-ci-b@example.test',password:'Ci-disposable-photo-4826!'});if(login.error)throw Error(login.error.message);});release();await expect(body(page)).toContainText('unavailable for your account');await expect(page.locator('pre')).toHaveCount(0);noWrites(e);
});
test('late previous-session response cannot replace the current route',async({page})=>{
 const a=await seed({provider_response_raw:'Previous private response A'}),b=await seed({provider_response_raw:'Current private response B'});let release,started;const gate=new Promise(r=>release=r),seen=new Promise(r=>started=r);
 await page.route('**/rest/v1/ai_analysis_runs*',async route=>{if(new URL(route.request().url()).searchParams.get('id')!=='eq.'+a.id)return route.fallback();const response=await route.fetch();started();await gate;return route.fulfill({response});});
 const e=await visit(page,'/uploads/'+a.id);await seen;await page.evaluate(id=>{location.hash='/uploads/'+id},b.id);release();await expect(body(page)).toHaveAttribute('aria-busy','false');await page.getByText('Saved session data',{exact:true}).click();await expect(body(page).locator('pre')).toContainText('Current private response B');await expect(body(page).locator('pre')).not.toContainText('Previous private response A');noWrites(e);
});
test('a fresh actual account sees an explicitly empty private upload history',async({page})=>{
 const email='empty-'+randomUUID()+'@example.test',other=createClient('http://127.0.0.1:18000',process.env.CI_PHOTO_PUBLIC_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});expect((await other.auth.signUp({email,password:'Ci-disposable-photo-4826!'})).error).toBeNull();
 const e=await visit(page,'/uploads','light',email);await expect(page.getByRole('region',{name:'Saved uploads',exact:true})).toContainText('No saved photo uploads for this account.');await expect(page.getByRole('alert')).toHaveCount(0);noWrites(e);
});
test('invalid session link is refused without an unsafe database query',async({page})=>{
 let reads=0;page.on('request',r=>{if(r.url().includes('/rest/v1/ai_analysis_runs'))reads++;});const e=await visit(page,'/uploads/not-an-id');await expect(page.getByRole('alert')).toContainText('link is invalid');expect(reads).toBe(0);noWrites(e);
});
test('malformed model data stays inspectable without opening an unsafe report',async({page})=>{
 const run=await seed({...report(),objects:[{...object(),evidence:'Malformed original evidence'}]}),e=await visit(page,'/uploads/'+run.id);await expect(body(page)).toHaveAttribute('aria-busy','false');await expect(page.getByRole('link',{name:'Open saved draft',exact:true})).toHaveCount(0);await page.getByText('Saved session data',{exact:true}).click();await expect(body(page).locator('pre')).toContainText('Malformed original evidence');noWrites(e);
});
test('expired or denied photo links can be refreshed without losing the saved response',async({page})=>{
 const run=await seed(),pattern='**/storage/v1/object/sign/item-images/**';await page.route(pattern,async route=>{const response=await route.fetch();return route.fulfill({response,status:403,json:{error:'Synthetic signed preview denied'}});});
 const e=await visit(page,'/uploads/'+run.id);await expect(body(page).getByText('Preview unavailable',{exact:true})).toBeVisible();await page.getByText('Saved session data',{exact:true}).click();await expect(body(page).locator('pre')).toContainText(run.result.provider_response_raw);
 await page.unroute(pattern);await page.getByRole('button',{name:'Check saved session',exact:true}).click();await photoReady(page);noWrites(e);
});
