// Called only by test-photo-storage after its initially-empty loopback DB guard.
// All file operations below use the real SDK/Storage API and real bytes. No
// storage.objects rows are inserted/updated/deleted through administrative SQL.
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {deflateSync} from 'node:zlib';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export function syntheticStoragePNG(value){
 const crc=bytes=>{let n=0xffffffff;for(const byte of bytes){n^=byte;for(let i=0;i<8;i++)n=(n>>>1)^((n&1)?0xedb88320:0);}return(n^0xffffffff)>>>0;};
 const chunk=(type,body)=>{const content=Buffer.concat([Buffer.from(type),body]),size=Buffer.alloc(4),checksum=Buffer.alloc(4);size.writeUInt32BE(body.length);checksum.writeUInt32BE(crc(content));return Buffer.concat([size,content,checksum]);};
 const header=Buffer.alloc(13);header.writeUInt32BE(2,0);header.writeUInt32BE(2,4);header[8]=8;header[9]=6;
 const line=Buffer.from([0,value,60,90,255,value,90,60,255]);
 return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',header),chunk('IDAT',deflateSync(Buffer.concat([line,line]))),chunk('IEND',Buffer.alloc(0))]);
}
export async function exercisePhotoStorage({admin,check,A,B,anon,API}){
 const a=A.client.storage.from('item-images'),b=B.client.storage.from('item-images'),unowned=anon.storage.from('item-images');
 const folder=`${A.id}/intake/storage-byte-${randomUUID()}`,foreignFolder=`${B.id}/intake/storage-byte-${randomUUID()}`;
 const images=[syntheticStoragePNG(30),syntheticStoragePNG(180)],paths=images.map((_,i)=>`${folder}/source-${i}.png`);
 const hash=images.map(digest),copies=`${A.id}/storage-tests`,scratch=`${copies}/copied-${randomUUID()}.png`;
 const upload=(bucket,path,bytes=images[0],extra={})=>bucket.upload(path,bytes,{contentType:'image/png',upsert:false,...extra});
 const bytes=async(bucket,path)=>{const r=await bucket.download(path);assert.equal(r.error,null);assert.ok(r.data);return Buffer.from(await r.data.arrayBuffer());};
 const intact=async()=>{for(let i=0;i<paths.length;i++)assert.equal(digest(await bytes(a,paths[i])),hash[i]);};
 const absent=async path=>assert.equal((await admin.query("select count(*)::int n from storage.objects where bucket_id='item-images' and name=$1",[path])).rows[0].n,0);
 const sign=async(path,seconds=60)=>{const r=await a.createSignedUrl(path,seconds);assert.equal(r.error,null);const url=new URL(r.data.signedUrl);assert.equal(url.origin,API);assert.ok(url.pathname.startsWith('/storage/v1/object/sign/'));return url;};
 let signed;
 await check('real Storage owns migrated schema and API roles cannot assume postgres',async()=>{
  assert.ok((await admin.query('select count(*)::int n from storage.migrations')).rows[0].n>10);
  assert.equal((await admin.query("select pg_has_role('authenticator','postgres','member') allowed")).rows[0].allowed,false);
  assert.equal((await admin.query("select rolsuper from pg_roles where rolname='supabase_storage_admin'")).rows[0].rolsuper,false);
 });
 await check('two genuine Auth principals resolve distinctly before Storage calls',async()=>{
  assert.notEqual(A.id,B.id);for(const user of [A,B]){const r=await user.client.auth.getUser();assert.equal(r.error,null);assert.equal(r.data.user.id,user.id);}
 });
 await check('original application bucket is private with its original MIME and size limits',async()=>{
  const row=(await admin.query("select * from storage.buckets where id='item-images'")).rows[0];assert.equal(row.public,false);assert.equal(Number(row.file_size_limit),26214400);assert.deepEqual(row.allowed_mime_types,['image/jpeg','image/png','image/webp','image/heic','image/heif']);
 });
 await check('owner uploads two distinct real PNG originals through SDK and Storage API',async()=>{
  assert.notEqual(hash[0],hash[1]);for(let i=0;i<paths.length;i++){const r=await upload(a,paths[i],images[i]);assert.equal(r.error,null);assert.equal(r.data.path,paths[i]);}
 });
 await check('owner downloads byte-identical originals with recorded content size and owner',async()=>{
  await intact();for(let i=0;i<paths.length;i++){const row=(await admin.query("select owner_id,metadata from storage.objects where bucket_id='item-images' and name=$1",[paths[i]])).rows[0];assert.equal(row.owner_id,A.id);assert.equal(Number(row.metadata.size),images[i].length);assert.equal(row.metadata.mimetype,'image/png');}
 });
 await check('owner lists both originals while another owner cannot enumerate the folder',async()=>{
  const own=await a.list(folder);assert.equal(own.error,null);assert.deepEqual(own.data.map(x=>x.name).sort(),['source-0.png','source-1.png']);const other=await b.list(folder);assert.equal(other.error,null);assert.deepEqual(other.data,[]);
 });
 await check('anonymous upload is refused without a metadata row or changed original',async()=>{
  const path=`${folder}/anonymous.png`;assert.ok((await upload(unowned,path)).error);await absent(path);await intact();
 });
 await check('anonymous download and signed-link creation cannot read a private original',async()=>{
  assert.ok((await unowned.download(paths[0])).error);assert.ok((await unowned.createSignedUrl(paths[0],60)).error);await intact();
 });
 await check('other owner cannot upload into the original owner folder',async()=>{
  const path=`${folder}/foreign-upload.png`;assert.ok((await upload(b,path)).error);await absent(path);await intact();
 });
 await check('other owner cannot download a private original',async()=>{assert.ok((await b.download(paths[0])).error);await intact();});
 await check('other owner cannot mint a signed URL for a private original',async()=>{assert.ok((await b.createSignedUrl(paths[0],60)).error);await intact();});
 await check('other owner cannot overwrite original bytes using upsert',async()=>{assert.ok((await upload(b,paths[0],images[1],{upsert:true})).error);await intact();});
 await check('other owner cannot delete original bytes',async()=>{const r=await b.remove([paths[0]]);assert.ok(r.error||r.data.length===0);await intact();});
 await check('other owner cannot copy a private source into their own folder',async()=>{
  const path=`${foreignFolder}/stolen-copy.png`;assert.ok((await b.copy(paths[0],path)).error);await absent(path);await intact();
 });
 await check('owner cannot copy a source into another owner folder',async()=>{
  const path=`${foreignFolder}/cross-owner-copy.png`;assert.ok((await a.copy(paths[0],path)).error);await absent(path);await intact();
 });
 await check('owner copy creates byte-identical scratch file and retains both originals',async()=>{assert.equal((await a.copy(paths[0],scratch)).error,null);assert.equal(digest(await bytes(a,scratch)),hash[0]);await intact();});
 await check('duplicate copy refuses replacement and preserves original and destination bytes',async()=>{assert.ok((await a.copy(paths[1],scratch)).error);assert.equal(digest(await bytes(a,scratch)),hash[0]);await intact();});
 await check('owner cannot move scratch file into another owner folder',async()=>{
  const path=`${foreignFolder}/cross-owner-move.png`;assert.ok((await a.move(scratch,path)).error);await absent(path);assert.equal(digest(await bytes(a,scratch)),hash[0]);await intact();
 });
 await check('authorised scratch replacement uses UPDATE RLS without altering originals',async()=>{assert.equal((await upload(a,scratch,images[1],{upsert:true})).error,null);assert.equal(digest(await bytes(a,scratch)),hash[1]);await intact();});
 await check('authorised scratch removal deletes only that disposable copy',async()=>{const r=await a.remove([scratch]);assert.equal(r.error,null);assert.equal(r.data.length,1);await absent(scratch);assert.ok((await a.download(scratch)).error);await intact();});
 await check('unsupported MIME is refused by the real bucket without an orphan',async()=>{const path=`${folder}/blocked.txt`;const rejected=await a.upload(path,Buffer.from('Synthetic text'),{contentType:'text/plain'});assert.ok(rejected.error);assert.match(rejected.error.message,/mime|type|allowed/i);await absent(path);await intact();});
 await check('over-limit upload is refused by the real bucket without an orphan',async()=>{const path=`${folder}/oversized.png`;const rejected=await upload(a,path,Buffer.alloc(26214401));assert.ok(rejected.error);assert.match(rejected.error.message,/size|limit|large/i);await absent(path);await intact();});
 await check('public URL cannot bypass the private bucket setting',async()=>{const url=a.getPublicUrl(paths[0]).data.publicUrl;assert.equal(new URL(url).origin,API);assert.equal((await fetch(url)).ok,false);await intact();});
 await check('owner creates a time-limited signed URL and unauthenticated GET returns exact bytes',async()=>{signed=await sign(paths[0]);const response=await fetch(signed);assert.equal(response.ok,true);assert.match(response.headers.get('content-type'),/image\/png/);assert.equal(digest(Buffer.from(await response.arrayBuffer())),hash[0]);});
 await check('signed URL is a bearer capability, not evidence of reader ownership',async()=>{const response=await fetch(signed,{headers:{Authorization:'Bearer '+B.token}});assert.equal(response.ok,true);assert.equal(digest(Buffer.from(await response.arrayBuffer())),hash[0]);});
 await check('tampered signature and substituted path cannot read private originals',async()=>{
  const token=new URL(signed),parts=token.searchParams.get('token').split('.');parts[2]=(parts[2][0]==='A'?'B':'A')+parts[2].slice(1);token.searchParams.set('token',parts.join('.'));assert.equal((await fetch(token)).ok,false);
  const path=new URL(signed);path.pathname=path.pathname.replace('source-0.png','source-1.png');assert.equal((await fetch(path)).ok,false);await intact();
 });
 await check('expired signed URL is refused while owner-authenticated download still works',async()=>{
  const url=await sign(paths[0],1);const claims=JSON.parse(Buffer.from(url.searchParams.get('token').split('.')[1],'base64url'));assert.ok(Number.isFinite(claims.exp));
  const wait=claims.exp*1000-Date.now()+1100;assert.ok(wait<5000);await new Promise(r=>setTimeout(r,Math.max(0,wait)));assert.equal((await fetch(url)).ok,false);await intact();
 });
 await check('second owner can independently upload and sign their own private bytes',async()=>{const path=`${foreignFolder}/own.png`;assert.equal((await upload(b,path,images[1])).error,null);assert.equal(digest(await bytes(b,path)),hash[1]);assert.ok((await a.download(path)).error);const r=await b.createSignedUrl(path,60);assert.equal(r.error,null);const response=await fetch(r.data.signedUrl);assert.equal(response.ok,true);assert.equal(digest(Buffer.from(await response.arrayBuffer())),hash[1]);});
 const manifest=paths.map((storage_path,index)=>({index,storage_path,file_name:`source-${index}.png`,content_sha256:hash[index],byte_count:images[index].length}));
 const original={analysis_stage:'COMPLETE',objects:[{working_title:'Synthetic original-photo vessel',material:'Glass',image_indices:[0,1],condition_summary:'Synthetic test image, not evidence about a real object'}],image_manifest:manifest,initial_ai_result:{batch_summary:'Unverified synthetic response'}};
 const stage=async()=>{const r=await A.client.from('ai_analysis_runs').insert({mode:'single',model:'disposable-no-provider',input_photo_count:2,result:original}).select('id').single();assert.equal(r.error,null);return r.data.id;};
 const approve=id=>A.client.rpc('ci_approve_saved_intake_v1',{p_run_id:id,p_object_indices:[0],p_reviews:{}});
 let runId,saved;
 await check('real-photo catalogue approval links original paths and preserves original bytes and source manifest',async()=>{
  runId=await stage();const r=await approve(runId);assert.equal(r.error,null);assert.equal(r.data.length,1);saved=r.data[0];
  const photos=await A.client.from('item_photos').select('*').eq('item_id',saved.item_id).order('position');assert.equal(photos.error,null);assert.equal(photos.data.length,2);assert.deepEqual(photos.data.map(x=>x.storage_path),paths);assert.deepEqual(photos.data.map(x=>x.position),[0,1]);assert.deepEqual(photos.data.map(x=>x.is_hero),[true,false]);
  const source=(await admin.query('select result,status from public.ai_analysis_runs where id=$1',[runId])).rows[0];assert.equal(source.status,'APPROVED');assert.deepEqual(source.result.objects,original.objects);assert.deepEqual(source.result.image_manifest,original.image_manifest);assert.deepEqual(source.result.initial_ai_result,original.initial_ai_result);await intact();
 });
 await check('other owner cannot read real-photo catalogue item or its original photo links',async()=>{for(const [table,column]of [['items','id'],['item_photos','item_id']]){const r=await B.client.from(table).select('*').eq(column,saved.item_id);assert.equal(r.error,null);assert.deepEqual(r.data,[]);}await intact();});
 await check('identical real-photo approval retry returns the same item without duplicating or deleting files',async()=>{const r=await approve(runId);assert.equal(r.error,null);assert.equal(r.data[0].item_id,saved.item_id);assert.equal((await admin.query('select count(*)::int n from public.items where source_analysis_run_id=$1',[runId])).rows[0].n,1);assert.equal((await admin.query('select count(*)::int n from public.item_photos where item_id=$1',[saved.item_id])).rows[0].n,2);await intact();});
 await check('failed real-photo approval rolls back item writes and retains both originals and draft',async()=>{
  const id=await stage();await admin.query('REVOKE INSERT ON public.item_photos FROM authenticated');
  try{assert.ok((await approve(id)).error);assert.equal((await admin.query('select count(*)::int n from public.items where source_analysis_run_id=$1',[id])).rows[0].n,0);assert.equal((await admin.query('select status from public.ai_analysis_runs where id=$1',[id])).rows[0].status,'DRAFT');await intact();}finally{await admin.query('GRANT INSERT ON public.item_photos TO authenticated');}
 });
 console.log('Synthetic PNG byte receipt',JSON.stringify(images.map((image,index)=>({index,bytes:image.length,sha256:hash[index]}))));
}
