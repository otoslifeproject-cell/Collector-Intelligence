import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bindSavedIntakePhotos,bindSavedIntakeContext} from '../src/lib/intakeSourceBinding.ts';
const owner='ab529675-993e-41a8-ac26-8ea52bebd2f7',id='75f96018-4017-4d20-9a5d-3d6fb8e6cc30';
const sha='a'.repeat(64);
const p=(index)=>({index,file_name:'Image '+index+'.jpg',storage_path:owner+'/intake/'+id+'/'+String(index).padStart(2,'0')+'-image.jpg',sha256:sha,byte_count:100});
const src=(manifest=[p(0),p(1)])=>({id,owner_id:owner,mode:'batch',status:'DRAFT',input_photo_count:2,user_context:{user_notes:'Original retained notes'},result:{analysis_stage:'UPLOADED',image_manifest:manifest}});
const origin='http://127.0.0.1:18000';
const images=(a=[0,1])=>a.map(index=>({index,fileName:'Image '+index+'.jpg',url:origin+'/storage/v1/object/sign/item-images/'+p(index).storage_path+'?token=fixture'}));
test('accepts ordered owner-saved photo identity and matching input URLs',()=>{const a=bindSavedIntakePhotos(src(),images(),'batch',origin);assert.deepEqual(a.map(x=>x.index),[0,1]);assert.equal(a[0].storage_path,p(0).storage_path)});
test('rejects repeated request index 0,0 before dispatch',()=>{assert.throws(()=>bindSavedIntakePhotos(src(),images([0,0]),'batch',origin),/Duplicate/ )});
test('rejects repeated index in saved manifest',()=>{assert.throws(()=>bindSavedIntakePhotos(src([p(0),p(0)]),images(),'batch',origin),/Duplicate/ )});
test('rejects saved path for another owner',()=>{assert.throws(()=>bindSavedIntakePhotos(src([p(0),{...p(1),storage_path:'other-owner/intake/'+id+'/01.jpg'}]),images(),'batch',origin),/owner/ )});
test('rejects missing original content hash',()=>{assert.throws(()=>bindSavedIntakePhotos(src([p(0),{...p(1),sha256:''}]),images(),'batch',origin),/hash/ )});
test('rejects changed client-side filename',()=>{assert.throws(()=>bindSavedIntakePhotos(src(),[{...images()[0],fileName:'other.jpg'},images()[1]],'batch',origin),/does not match/ )});
test('rejects advanced/paid session replay',()=>{assert.throws(()=>bindSavedIntakePhotos({...src(),result:{...src().result,analysis_stage:'PROCESSING'}},images(),'batch',origin),/progressed/ )});
test('rejects mismatched object count',()=>{assert.throws(()=>bindSavedIntakePhotos({...src(),input_photo_count:3},images(),'batch',origin),/count/ )});
test('rejects missing owner context',()=>{assert.throws(()=>bindSavedIntakePhotos({...src(),user_context:null},images(),'batch',origin),/notes/ )});

test('rejects two swapped signed URLs',()=>{const a=images();assert.throws(()=>bindSavedIntakePhotos(src(),[{...a[0],url:a[1].url},{...a[1],url:a[0].url}],'batch',origin),/signed photo URL/)});
test('rejects unrelated offsite signed URL',()=>{const a=images();assert.throws(()=>bindSavedIntakePhotos(src(),[{...a[0],url:'https://attacker.invalid/storage/v1/object/sign/item-images/'+p(0).storage_path+'?token=fixture'},a[1]],'batch',origin),/signed photo URL/)});

test('saved notes are authoritative despite numeric formatting of submitted context',()=>{
 const a={currency:'GBP',purchase_price:'12.00',weight_g:'1250',dimensions:'10 cm',storage_location:'B07',user_notes:'Owner says maybe Mdina'};
 const b={...a,purchase_price:12,weight_g:1250};assert.deepEqual(bindSavedIntakeContext(a,b),a);
});
test('changed incoming notes are rejected',()=>{
 const a={currency:'GBP',purchase_price:'12.00',weight_g:'1250',dimensions:'10 cm',storage_location:'B07',user_notes:'Owner says maybe Mdina'};
 assert.throws(()=>bindSavedIntakeContext(a,{...a,user_notes:'Different supposed mark'}),/differ/);
 assert.throws(()=>bindSavedIntakeContext(a,{...a,weight_g:999}),/differ/);
});
