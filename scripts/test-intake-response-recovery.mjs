// Called only by the existing guarded, initially empty disposable HTTP harness.
// Auth, owner RLS, canonical retrieval and report persistence use genuine services.
// Provider bytes are synthetic. Image URLs/metadata here are not Storage byte proof;
// the separate real Storage/application job verifies original image bytes.
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import intake from '../api/analyse-intake.ts';

export async function exerciseIntakeResponseRecovery({admin,rest,check,A,B,API,key}){
 const env={NEXT_PUBLIC_SUPABASE_URL:API,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:key,COLLECTOR_CANONICAL_SOURCE_MODE:'approved-v1',OPENAI_API_KEY:'synthetic-no-provider',AI_GATEWAY_API_KEY:'',VERCEL_OIDC_TOKEN:''};
 const before=Object.fromEntries(Object.keys(env).map(k=>[k,process.env[k]])),transport=globalThis.fetch;
 Object.assign(process.env,env);let calls=0;
 const raw=' {"id":"synthetic-invalid-output","model":"fixture-intake","output_text":'+JSON.stringify('SYNTHETIC non-JSON model output — '+ 'original response beyond former cutoff '.repeat(100))+'}\n';
 globalThis.fetch=async(input,init)=>{
  if(new URL(input).origin===API)return transport(input,init);
  assert.equal(String(input),'https://api.openai.com/v1/responses','Unexpected external call blocked');calls++;return new Response(raw,{status:200,headers:{'content-type':'application/json'}});
 };
 const stage=async()=>{
  const id=randomUUID(),manifest=[{index:0,file_name:'Synthetic source.png',storage_path:A.id+'/intake/'+id+'/00-source.png',sha256:'a'.repeat(64),byte_count:77}];
  const response=await rest(A.token,'ai_analysis_runs',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({id,mode:'single',model:'PENDING',status:'DRAFT',input_photo_count:1,user_context:{user_notes:'Synthetic owner observation'},result:{image_manifest_version:1,image_manifest:manifest,analysis_stage:'UPLOADED'}})});
  assert.equal(response.status,201);return (await response.json())[0];
 };
 const row=async id=>(await admin.query('select * from public.ai_analysis_runs where id=$1',[id])).rows[0];
 const invoke=async saved=>{const res={code:0,body:null,status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
  await intake({method:'POST',headers:{authorization:'Bearer '+A.token},body:{mode:'single',run_id:saved.id,images:[{index:0,fileName:'Synthetic source.png',url:API+'/storage/v1/synthetic-original.png'}],context:{user_notes:'Synthetic owner observation'}}},res);return res;};
 try{
  await check('intake retains the complete original provider response when structured parsing fails',async()=>{
   const saved=await stage(),reply=await invoke(saved),actual=await row(saved.id);assert.equal(reply.code,502);assert.equal(calls,1);
   assert.equal(typeof actual.result.provider_response_raw,'string','Malformed model output must remain in the original owned photo session');
   assert.equal(createHash('sha256').update(actual.result.provider_response_raw).digest('hex'),createHash('sha256').update(raw).digest('hex'));
   assert.ok(actual.result.provider_response_raw.length>2000);assert.equal(actual.owner_id,A.id);assert.deepEqual(actual.result.image_manifest,saved.result.image_manifest);assert.deepEqual(actual.user_context,saved.user_context);
  });
 }finally{globalThis.fetch=transport;for(const [k,v]of Object.entries(before)){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
}
