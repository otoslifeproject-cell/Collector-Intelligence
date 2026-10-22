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
 await expect(page.getByRole('heading',{name:'Photographs in. Catalogue out.',exact:true})).toBeVisible();return events;
}
async function choose(page,values){await page.locator('input[type=file]').setInputFiles(files(values));}
const analyse=page=>page.getByRole('button',{name:'Analyse & draft catalogue',exact:true});
async function mockCompletion(page){await page.route(api,async route=>{const b=route.request().postDataJSON(),result=await complete(b.run_id);return route.fulfill({status:200,json:{saved_run_id:b.run_id,result}});});}
async function saved(page){await expect(page).toHaveURL(/#\/draft\/[0-9a-f-]+/, {timeout:10000});await expect(page.locator('.ci-object-grid .ci-record-title').first()).toHaveText('Synthetic intake vessel');}
async function originals(id,chosen){const row=await read(id);expect(row.owner_id).toBe(owner);expect(row.result.image_manifest).toHaveLength(chosen.length);for(const [index,p]of row.result.image_manifest.entries()){expect(p.index).toBe(index);expect(p.file_name).toBe(chosen[index].name);const r=await client.storage.from('item-images').download(p.storage_path);expect(r.error).toBeNull();expect(digest(Buffer.from(await r.data.arrayBuffer()))).toBe(digest(chosen[index].buffer));}return row;}

test('lost staging acknowledgement recovers the actual saved photo session before one analysis',async({page})=>{
 const e=await visit(page);let committedId;await mockCompletion(page);await page.route(runs,async route=>{if(route.request().method()!=='POST')return route.fallback();const r=await route.fetch();expect(r.ok()).toBe(true);committedId=(await r.json())[0].id;return route.abort('connectionreset');});
 await choose(page);await analyse(page).click();try{await saved(page);}catch(error){const actual=committedId?await read(committedId):null;console.log('INTAKE_LOST_STAGE_EVIDENCE',JSON.stringify({committedId,actualStage:actual?.result?.analysis_stage,actualPhotos:actual?.result?.image_manifest?.length,analysisRequests:e.api.length,stageInserts:e.stages.length,uploads:e.uploads.length}));throw error;}
 expect(e.api).toHaveLength(1);expect(e.stages).toHaveLength(1);expect(e.uploads).toHaveLength(2);await originals(e.api[0].run_id,files());expect(e.errors).toEqual([]);
});
