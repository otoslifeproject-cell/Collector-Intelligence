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
async function seed(values={}){
 const images=[syntheticStoragePNG(45),syntheticStoragePNG(175)],folder=`${owner}/intake/catalogue-app-${randomUUID()}`;
 const manifest=[];for(const [index,bytes]of images.entries()){
  const storage_path=`${folder}/original-${index}.png`,file_name=`Original catalogue ${index}.png`;
  const upload=await client.storage.from('item-images').upload(storage_path,bytes,{contentType:'image/png',upsert:false});expect(upload.error).toBeNull();
  manifest.push({index,storage_path,file_name,byte_count:bytes.length,content_sha256:digest(bytes)});
 }
 const original={analysis_stage:'COMPLETE',objects:[object('Synthetic original vessel A',[0]),object('Synthetic original vessel B',[1])],image_manifest:manifest,initial_ai_result:{batch_summary:'Original unverified synthetic response'},...values};
 const write=await client.from('ai_analysis_runs').insert({mode:'batch',model:'disposable-no-provider',input_photo_count:2,result:original}).select('id').single();expect(write.error).toBeNull();return {id:write.data.id,original,images,manifest};
}
async function visit(page,id,theme='light'){
 const errors=[],paid=[],requests=[];page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(request.url().includes('/rest/v1/rpc/ci_approve_saved_intake_v1'))requests.push(request.postDataJSON());});
 await page.route('**/*',route=>{const url=new URL(route.request().url());if(url.hostname!=='127.0.0.1')return route.abort('blockedbyclient');if(url.pathname.startsWith('/api/')){paid.push(url.pathname);return route.abort('blockedbyclient');}return route.fallback();});
 await page.addInitScript(theme=>localStorage.setItem('ci-appearance-v1',theme),theme);await page.goto(`/#/draft/${id}?tab=catalogue`);
 await page.getByLabel('Email',{exact:true}).fill('photo-ci-a@example.test');await page.getByLabel('Password',{exact:true}).fill('Ci-disposable-photo-4826!');await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.getByRole('button',{name:'Catalogue 2 selected',exact:true})).toBeEnabled();return {errors,paid,requests};
}
async function children(id){const read=await client.from('items').select('*').eq('source_analysis_run_id',id).order('source_object_index');expect(read.error).toBeNull();return read.data;}
test('lost actual catalogue acknowledgement resolves committed records from independent readback',async({page})=>{
 const run=await seed(),requests=await visit(page,run.id);
 await page.route(approval,async route=>{const response=await route.fetch();expect(response.ok()).toBe(true);return route.abort('connectionreset');});
 await page.getByRole('button',{name:'Catalogue 2 selected',exact:true}).click();await expect.poll(async()=>(await children(run.id)).length).toBe(2);
 await expect(page.getByRole('heading',{name:'Objects safely catalogued',exact:true})).toBeVisible();expect(requests.requests).toHaveLength(1);expect(requests.errors).toEqual([]);expect(requests.paid).toEqual([]);
});
