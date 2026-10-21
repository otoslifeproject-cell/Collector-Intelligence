import {test,expect} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import {mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {syntheticStoragePNG} from '../scripts/test-photo-storage-cases.mjs';
mkdirSync('test-artifacts',{recursive:true});
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
let client,owner;
test.beforeAll(async()=>{
 client=createClient('http://127.0.0.1:18000',process.env.CI_PHOTO_PUBLIC_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const login=await client.auth.signInWithPassword({email:'photo-ci-a@example.test',password:'Ci-disposable-photo-4826!'});expect(login.error).toBeNull();owner=login.data.user.id;
});
test('actual application uploads, renders and orders two private originals',async({page})=>{
 await page.setViewportSize({width:390,height:900});const errors=[],paid=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>{const url=new URL(route.request().url());if(url.hostname!=='127.0.0.1')return route.abort('blockedbyclient');if(url.pathname.startsWith('/api/')){paid.push(url.pathname);return route.abort('blockedbyclient');}return route.fallback();});
 const seeded=await client.from('items').insert({owner_id:owner,title:'Synthetic photo workflow',currency:'GBP',acquisition_currency:'GBP'}).select('id').single();expect(seeded.error).toBeNull();const id=seeded.data.id;
 await page.goto(`/item/${id}?tab=photos`);await page.getByLabel('Email',{exact:true}).fill('photo-ci-a@example.test');await page.getByLabel('Password',{exact:true}).fill('Ci-disposable-photo-4826!');await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Photographs',exact:true})).toBeVisible();await expect(page.getByText('No photographs uploaded yet.',{exact:true})).toBeVisible();
 const originals=[syntheticStoragePNG(40),syntheticStoragePNG(170)];
 await page.locator('input[type=file]').setInputFiles(originals.map((buffer,index)=>({name:`Original ${index}.png`,mimeType:'image/png',buffer})));
 await expect(page.locator('.photoGrid img')).toHaveCount(2);await expect.poll(()=>page.locator('.photoGrid img').evaluateAll(images=>images.every(image=>image.complete&&image.naturalWidth===2))).toBe(true);
 await page.screenshot({path:'test-artifacts/photo-app-390-light.png',fullPage:true});
 const rows=await client.from('item_photos').select('owner_id,storage_path,file_name,position').eq('item_id',id).order('position').order('file_name');expect(rows.error).toBeNull();expect(rows.data).toHaveLength(2);expect(rows.data.map(row=>row.position)).toEqual([0,1]);
 for(let index=0;index<rows.data.length;index++){const row=rows.data[index];expect(row.owner_id).toBe(owner);expect(row.file_name).toBe(`Original ${index}.png`);const read=await client.storage.from('item-images').download(row.storage_path);expect(read.error).toBeNull();expect(digest(Buffer.from(await read.data.arrayBuffer()))).toBe(digest(originals[index]));}
 expect(errors).toEqual([]);expect(paid).toEqual([]);
});
