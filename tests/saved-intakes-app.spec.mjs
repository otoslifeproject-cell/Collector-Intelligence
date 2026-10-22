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
async function visit(page,path){
 const observed={errors:[],writes:[],paid:[]};page.on('pageerror',e=>observed.errors.push(e.message));
 page.on('request',r=>{const u=new URL(r.url());if(u.pathname.startsWith('/rest/v1/')&&r.method()!=='GET'&&r.method()!=='OPTIONS')observed.writes.push(u.pathname);if(u.pathname.startsWith('/api/'))observed.paid.push(u.pathname);});
 await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname!=='127.0.0.1'||u.pathname.startsWith('/api/'))return r.abort('blockedbyclient');return r.fallback();});
 await page.goto('/#'+path);await page.getByLabel('Email',{exact:true}).fill('photo-ci-a@example.test');await page.getByLabel('Password',{exact:true}).fill('Ci-disposable-photo-4826!');await page.getByRole('button',{name:'Sign in',exact:true}).click();return observed;
}
test('a saved raw intake can be bookmarked and reopened after refresh without another paid request',async({page})=>{
 const run=await seed(),e=await visit(page,'/uploads/'+run.id);
 await expect(page.getByRole('heading',{name:'Saved photo session',exact:true})).toBeVisible();
 await page.getByText('Saved session data',{exact:true}).click();await expect(page.locator('pre')).toContainText(run.result.provider_response_raw);
 await page.reload();await expect(page.getByRole('heading',{name:'Saved photo session',exact:true})).toBeVisible();
 await page.getByText('Saved session data',{exact:true}).click();await expect(page.locator('pre')).toContainText(run.result.provider_response_raw);
 expect(e.writes).toEqual([]);expect(e.paid).toEqual([]);expect(e.errors).toEqual([]);
});
