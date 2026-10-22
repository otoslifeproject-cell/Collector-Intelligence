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
 Object.assign(process.env,env);let calls=0,denyStage=null,denyKnowledge=false,ackMode=null,firstWritten=false;
 const raw=' {"id":"synthetic-invalid-output","model":"fixture-intake","output_text":'+JSON.stringify('SYNTHETIC non-JSON model output — '+ 'original response beyond former cutoff '.repeat(100))+'}\n';
 let provider=()=>new Response(raw,{status:200,headers:{'content-type':'application/json'}});
 globalThis.fetch=async(input,init)=>{
  const url=new URL(input);
  if(url.origin===API){
   if(denyStage&&url.pathname==='/rest/v1/ai_analysis_runs'&&init?.method==='PATCH'&&JSON.parse(init.body).result?.analysis_stage===denyStage)return new Response(JSON.stringify({message:'Synthetic stage save denied'}),{status:503});
   if(ackMode&&url.pathname==='/rest/v1/ai_analysis_runs'&&init?.method==='PATCH'&&JSON.parse(init.body).result?.analysis_stage==='FIRST_PASS_SAVED'){
    if(ackMode==='fabricated')return new Response(JSON.stringify([{id:url.searchParams.get('id').slice(3),...JSON.parse(init.body)}]),{status:200});
    const actual=await transport(input,init);assert.ok(actual.ok);await actual.arrayBuffer();firstWritten=true;
    if(ackMode==='lost')throw Error('Synthetic lost real commit acknowledgement');
    return new Response(null,{status:204});
   }
   if(ackMode==='denied-read'&&firstWritten&&url.pathname==='/rest/v1/ai_analysis_runs'&&(!init?.method||init.method==='GET'))return new Response(JSON.stringify({message:'Synthetic confirmation read denied'}),{status:403});
   if(denyKnowledge&&url.pathname==='/rest/v1/trusted_knowledge_v1'&&url.searchParams.get('select')!=='id')return new Response(JSON.stringify({message:'Synthetic post-model knowledge failure'}),{status:503});
   return transport(input,init);
  }
  assert.equal(String(input),'https://api.openai.com/v1/responses','Unexpected external call blocked');calls++;return provider();
 };
 const stage=async()=>{
  const id=randomUUID(),manifest=[{index:0,file_name:'Synthetic source.png',storage_path:A.id+'/intake/'+id+'/00-source.png',sha256:'a'.repeat(64),byte_count:77}];
  const response=await rest(A.token,'ai_analysis_runs',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({id,mode:'single',model:'PENDING',status:'DRAFT',input_photo_count:1,user_context:{user_notes:'Synthetic owner observation'},result:{image_manifest_version:1,image_manifest:manifest,analysis_stage:'UPLOADED'}})});
  assert.equal(response.status,201);return (await response.json())[0];
 };
 const row=async id=>(await admin.query('select * from public.ai_analysis_runs where id=$1',[id])).rows[0];
 const invoke=async(saved,user=A,overrides={})=>{const res={code:0,body:null,status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
  await intake({method:'POST',headers:{authorization:'Bearer '+user.token},body:{mode:'single',run_id:saved.id,images:[{index:0,fileName:'Synthetic source.png',url:API+'/storage/v1/synthetic-original.png'}],context:{user_notes:'Synthetic owner observation'},...overrides}},res);return res;};
 const synthetic={batch_summary:'Synthetic intake response, not real object evidence',objects:[{working_title:'Synthetic vase',object_type:'Vase',maker:null,current_attribution:null,marks_signatures_labels:null,image_indices:[0],evidence:[],next_evidence:[]}]};
 const responseRaw=result=>' \n'+JSON.stringify({id:'synthetic-intake-answer',model:'fixture-intake-model',output_text:JSON.stringify(result)})+'\n';
 const goodRaw=responseRaw(synthetic);
 const good=()=>new Response(goodRaw,{status:200});
 try{
  await check('intake retains the complete original provider response when structured parsing fails',async()=>{
   const saved=await stage(),reply=await invoke(saved),actual=await row(saved.id);assert.equal(reply.code,502);assert.equal(calls,1);
   assert.equal(typeof actual.result.provider_response_raw,'string','Malformed model output must remain in the original owned photo session');
   assert.equal(createHash('sha256').update(actual.result.provider_response_raw).digest('hex'),createHash('sha256').update(raw).digest('hex'));
   assert.ok(actual.result.provider_response_raw.length>2000);assert.equal(actual.owner_id,A.id);assert.deepEqual(actual.result.image_manifest,saved.result.image_manifest);assert.deepEqual(actual.user_context,saved.user_context);
  });
  await check('intake malformed saved response cannot be replayed into another provider call',async()=>{
   const saved=await stage();await invoke(saved);const before=await row(saved.id),paid=calls;const reply=await invoke(saved);assert.equal(reply.code,409);assert.equal(calls,paid);assert.deepEqual(await row(saved.id),before);
  });
  await check('actual intake handler saves full provider text, source manifest, first interpretation and completion',async()=>{
   provider=good;const saved=await stage(),paid=calls,reply=await invoke(saved),actual=await row(saved.id);assert.equal(reply.code,200,JSON.stringify(reply.body));assert.equal(calls,paid+1);assert.equal(reply.body.saved_run_id,saved.id);
   assert.equal(actual.result.analysis_stage,'COMPLETE');assert.equal(actual.result.provider_response_raw,goodRaw);assert.equal(actual.result.provider_response_status,200);assert.equal(actual.result.provider_response_id,'synthetic-intake-answer');assert.equal(actual.result.initial_response_id,'synthetic-intake-answer');assert.equal(actual.model,'fixture-intake-model');assert.deepEqual(actual.result.initial_ai_result,synthetic);assert.deepEqual(actual.result.image_manifest,saved.result.image_manifest);assert.deepEqual(actual.user_context,saved.user_context);
   assert.equal(actual.result.canonical_source_audit.resolution_mode,'APPROVED_V1');assert.equal(actual.result.canonical_source_audit.publication_receipts.length,4);
   const replay=await invoke(saved);assert.equal(replay.code,409);assert.equal(calls,paid+1);assert.deepEqual(await row(saved.id),actual);
  });
  for(const [name,replyRaw]of [['non-JSON envelope','<synthetic unavailable> '+ 'x'.repeat(3000)],['null envelope','null'],['refusal without output',JSON.stringify({id:'synthetic-refusal',output:[{type:'message',content:[{type:'refusal',refusal:'Synthetic refusal'}]}]})],['invalid output shape',responseRaw({batch_summary:'Malformed source',objects:null})]]){
   await check('intake preserves '+name+' and its original session without rendering an interpretation',async()=>{
    provider=()=>new Response(replyRaw,{status:200});const saved=await stage(),paid=calls,reply=await invoke(saved),actual=await row(saved.id);assert.equal(reply.code,502);assert.equal(reply.body.code,'PAID_INTAKE_OUTPUT_INVALID');assert.equal(reply.body.run_id,saved.id);assert.equal(reply.body.response_save_confirmed,true);assert.equal(calls,paid+1);assert.equal(actual.result.analysis_stage,'UNPARSED_RESPONSE_SAVED');assert.equal(actual.result.provider_response_raw,replyRaw);assert.deepEqual(actual.result.image_manifest,saved.result.image_manifest);assert.equal(actual.result.objects,undefined);
   });
  }
  await check('intake joins multiple structured output parts without dropping the later source text',async()=>{
   const text=JSON.stringify(synthetic),split=Math.floor(text.length/2),raw=JSON.stringify({id:'synthetic-parts',model:'fixture-part-model',output:[{type:'message',content:[{type:'output_text',text:text.slice(0,split)},{type:'output_text',text:text.slice(split)}]}]});provider=()=>new Response(raw,{status:200});
   const saved=await stage(),reply=await invoke(saved),actual=await row(saved.id);assert.equal(reply.code,200);assert.deepEqual(actual.result.initial_ai_result,synthetic);assert.equal(actual.result.provider_response_raw,raw);assert.equal(actual.model,'fixture-part-model');
  });
  await check('unknown model fields remain in raw response and cannot replace archived source metadata',async()=>{
   const untrusted={...synthetic,provider_response_raw:'FORGED ARCHIVE',image_manifest:[],analysis_stage:'FORGED COMPLETE',owner_review:{approved:true}},raw=responseRaw(untrusted);provider=()=>new Response(raw,{status:200});
   const saved=await stage(),reply=await invoke(saved),actual=await row(saved.id);assert.equal(reply.code,200);assert.equal(actual.result.provider_response_raw,raw);assert.deepEqual(actual.result.image_manifest,saved.result.image_manifest);assert.equal(actual.result.owner_review,undefined);assert.deepEqual(actual.result.initial_ai_result,synthetic);
  });
  await check('intake service-error response is retained and does not silently start another model run',async()=>{
   const raw=JSON.stringify({error:{message:'Synthetic credit or provider refusal'}});provider=()=>new Response(raw,{status:402});const saved=await stage(),paid=calls,reply=await invoke(saved),actual=await row(saved.id);assert.equal(reply.code,402);assert.equal(reply.body.code,'PAID_INTAKE_PROVIDER_ERROR');assert.equal(actual.result.analysis_stage,'PROVIDER_ERROR_SAVED');assert.equal(actual.result.provider_response_raw,raw);assert.equal(actual.result.provider_response_status,402);
   assert.equal((await invoke(saved)).code,409);assert.equal(calls,paid+1);
  });
  await check('intake connection loss returns its saved session identity and explicitly forbids a blind paid repeat',async()=>{
   provider=()=>{throw Error('Synthetic provider connection loss')};const saved=await stage(),paid=calls,reply=await invoke(saved);assert.equal(reply.code,503);assert.equal(reply.body.code,'PAID_INTAKE_OUTCOME_UNCONFIRMED');assert.equal(reply.body.run_id,saved.id);assert.match(reply.body.error,/do not repeat paid analysis/i);assert.equal(calls,paid+1);assert.deepEqual((await row(saved.id)).result,saved.result);
  });
  await check('failed first-pass persistence returns the entire unconfirmed response without claiming it saved',async()=>{
   provider=good;denyStage='FIRST_PASS_SAVED';try{const saved=await stage(),reply=await invoke(saved),actual=await row(saved.id);assert.equal(reply.code,503);assert.equal(reply.body.code,'FIRST_PASS_SAVE_FAILED');assert.equal(reply.body.run_id,saved.id);assert.equal(reply.body.response_save_confirmed,false);assert.equal(reply.body.returned_response.provider_response_raw,goodRaw);assert.deepEqual(actual.result,saved.result);}finally{denyStage=null;}
  });
  await check('lost first-pass acknowledgement resolves the genuine saved result before continuing',async()=>{
   provider=good;ackMode='lost';firstWritten=false;try{const saved=await stage(),paid=calls,reply=await invoke(saved),actual=await row(saved.id);assert.equal(reply.code,200);assert.equal(calls,paid+1);assert.equal(actual.result.analysis_stage,'COMPLETE');assert.equal(actual.result.provider_response_raw,goodRaw);assert.ok(firstWritten);}finally{ackMode=null;}
  });
  await check('fabricated first-pass success without a committed row stops later work and retains the reply locally',async()=>{
   provider=good;ackMode='fabricated';firstWritten=false;try{const saved=await stage(),paid=calls,reply=await invoke(saved);assert.equal(reply.code,503);assert.equal(reply.body.code,'FIRST_PASS_SAVE_FAILED');assert.equal(reply.body.response_save_confirmed,false);assert.equal(reply.body.returned_response.provider_response_raw,goodRaw);assert.deepEqual((await row(saved.id)).result,saved.result);assert.equal(calls,paid+1);}finally{ackMode=null;}
  });
  await check('denied first-pass confirmation keeps the real first answer and does not claim final success',async()=>{
   provider=good;ackMode='denied-read';firstWritten=false;try{const saved=await stage(),paid=calls,reply=await invoke(saved),actual=await row(saved.id);assert.equal(reply.code,503);assert.equal(reply.body.code,'FIRST_PASS_SAVE_FAILED');assert.equal(actual.result.analysis_stage,'FIRST_PASS_SAVED');assert.equal(actual.result.provider_response_raw,goodRaw);assert.equal(calls,paid+1);}finally{ackMode=null;}
  });
  await check('failed raw-response persistence returns complete text for page-local recovery and no false save claim',async()=>{
   provider=()=>new Response(raw,{status:200});denyStage='UNPARSED_RESPONSE_SAVED';try{const saved=await stage(),reply=await invoke(saved);assert.equal(reply.code,502);assert.equal(reply.body.response_save_confirmed,false);assert.equal(reply.body.returned_response.provider_response_raw,raw);assert.deepEqual((await row(saved.id)).result,saved.result);}finally{denyStage=null;}
  });
  await check('failed final enrichment persistence preserves the saved first interpretation and original provider text',async()=>{
   provider=good;denyStage='COMPLETE';try{const saved=await stage(),reply=await invoke(saved),actual=await row(saved.id);assert.equal(reply.code,503);assert.equal(reply.body.code,'FINAL_SAVE_FAILED');assert.equal(actual.result.analysis_stage,'FIRST_PASS_SAVED');assert.equal(actual.result.provider_response_raw,goodRaw);assert.deepEqual(actual.result.initial_ai_result,synthetic);assert.deepEqual(actual.result.image_manifest,saved.result.image_manifest);}finally{denyStage=null;}
  });
  await check('post-model knowledge failure retains the first interpretation without another provider request',async()=>{
   provider=good;denyKnowledge=true;try{const saved=await stage(),paid=calls,reply=await invoke(saved),actual=await row(saved.id);assert.equal(reply.code,503);assert.equal(reply.body.code,'TRUST_GATE_UNAVAILABLE_503');assert.equal(actual.result.analysis_stage,'FIRST_PASS_SAVED');assert.equal(actual.result.provider_response_raw,goodRaw);assert.deepEqual(actual.result.initial_ai_result,synthetic);assert.equal(calls,paid+1);}finally{denyKnowledge=false;}
  });
  await check('intake rejects another owner and mismatched photo facts before provider dispatch',async()=>{
   provider=good;const saved=await stage(),paid=calls;assert.equal((await invoke(saved,B)).code,503);assert.equal((await invoke(saved,A,{images:[{index:0,fileName:'Different filename.png',url:API+'/storage/v1/synthetic-original.png'}]})).code,409);assert.equal(calls,paid);assert.deepEqual((await row(saved.id)).result,saved.result);
  });
 }finally{globalThis.fetch=transport;for(const [k,v]of Object.entries(before)){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
}
