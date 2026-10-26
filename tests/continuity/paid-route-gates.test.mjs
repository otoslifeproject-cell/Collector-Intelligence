// Cost-free endpoint tests. Every fetch is intercepted; no provider is contacted.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import intake from '../../api/analyse-intake.ts';
import research from '../../api/research-item.ts';
import {canonicalCallerKeys} from '../../src/lib/approvedCanonicalSources.ts';

const A='00000000-0000-4000-8000-000000000001',D='00000000-0000-4000-8000-000000000002';
const E='00000000-0000-4000-8000-000000000003',I='00000000-0000-4000-8000-000000000004';
const cfg={url:'https://synthetic.invalid',key:'fixture',token:'fixture'};
const intakePath=A+'/intake/'+D+'/00-fixture.jpg';
const intakeUrl=cfg.url+'/storage/v1/object/sign/item-images/'+intakePath+'?token=fixture';
const intakeContext={};
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers});
async function setup(t,caller,options={}){
  const env={NEXT_PUBLIC_SUPABASE_URL:cfg.url,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:cfg.key,
    COLLECTOR_CANONICAL_SOURCE_MODE:options.mode??'approved-v1',OPENAI_API_KEY:'not-a-real-key',AI_GATEWAY_API_KEY:'',VERCEL_OIDC_TOKEN:''};
  const original=Object.fromEntries(Object.keys(env).map(k=>[k,process.env[k]])),originalFetch=globalThis.fetch;
  Object.assign(process.env,env);
  t.after(()=>{globalThis.fetch=originalFetch;for(const [k,v] of Object.entries(original)){if(v===undefined)delete process.env[k];else process.env[k]=v;}});
  const keys=canonicalCallerKeys[caller],sources=[];
  for(const key of keys){
    const content=key==='02_MASTER_PROJECT_BRIEF.md'||key==='03_SOURCE_AND_EVIDENCE_POLICY.md'
      ?await readFile(new URL('../fixtures/governing-v4/'+key,import.meta.url),'utf8'):'SYNTHETIC WORKFLOW. '+'x'.repeat(500);
    sources.push({id:D,owner_id:A,document_key:key,source_version:key.includes('MASTER')||key.includes('EVIDENCE_POLICY')?'4.0':'fixture',content,content_sha256:createHash('sha256').update(content).digest('hex'),approval_event_id:E});
  }
  const state={paid:0,claims:0,reads:0,saves:[],urls:[]};
  globalThis.fetch=async(input,init={})=>{
    const url=new URL(input);state.urls.push(url.pathname);
    if(url.hostname==='ai-gateway.vercel.sh'||url.hostname==='api.openai.com'){
      state.paid++;
      if(options.providerFailure==='connection')throw Error('Injected lost connection');
      if(options.providerFailure==='non-json')return new Response('fixture outage',{status:502});
      if(options.providerFailure==='error')return json({error:{message:'Fixture outage'}},503);
      if(options.providerFailure==='output')return json({output_text:'not JSON'});
      if(options.providerFailure==='null')return json(null);
      const result=caller==='intake'?{batch_summary:'synthetic',objects:[{image_indices:[0],working_title:'Synthetic object',marks_signatures_labels:options.inscription?'engraved candidate':'none',evidence:[],next_evidence:[]}]}
        :{identification_update:{},comparables:[],valuation:{},routing:{},research_summary:'synthetic'};
      return json({id:'fake-provider-response',output_text:JSON.stringify(result)});
    }
    assert.equal(url.origin,cfg.url,'Unexpected network request was intercepted');
    if(url.pathname==='/auth/v1/user')return json({id:A},options.invalidAuth?401:200);
    if(init.method==='POST'&&url.pathname==='/storage/v1/object/sign/item-images/'+intakePath)
      return json({signedURL:'/storage/v1/object/sign/item-images/'+intakePath+'?token=fixture'});
    if(url.pathname==='/rest/v1/ci_canonical_approved_v1'){
      state.reads++;let data=sources;
      if(options.missing || (options.revokeAfterRead && state.reads>1) || (options.revokeBeforeSecondPass && state.reads>2))data=[];
      if(options.changeAfterRead && state.reads>1)data=sources.map(r=>({...r,approval_event_id:I}));
      return json(data,options.unavailable?503:200,{'Content-Range':data.length?`0-${data.length-1}/${data.length}`:'*/0'});
    }
    if(url.pathname==='/rest/v1/canonical_documents')return json(sources);
    if(url.pathname==='/rest/v1/trusted_knowledge_v1'||url.pathname==='/rest/v1/ai_verdict_feedback'||url.pathname==='/rest/v1/trusted_comparables_v1')return json([]);
    if(url.pathname==='/rest/v1/items')return json([{id:I}]);
    if(url.pathname==='/rest/v1/ai_visual_reference_reviews')return json([],options.visualUnavailable?503:200);
    if(url.pathname==='/rest/v1/rpc/ci_claim_scoped_paid_research_v1'||url.pathname==='/rest/v1/rpc/ci_claim_intake_paid_v1'){
      if(url.pathname.endsWith('ci_claim_intake_paid_v1')){
        const posted=JSON.parse(init.body);
        assert.equal(posted.p_expected_mode,'single');
        assert.equal(posted.p_expected_photo_count,1);
        assert.deepEqual(posted.p_expected_context,intakeContext);
        assert.equal(posted.p_expected_manifest[0].storage_path,intakePath);
      }
      state.claims++;return json('CLAIMED');
    }
    if(url.pathname==='/rest/v1/ai_analysis_runs'){
      if(init.method==='PATCH'){const body=JSON.parse(init.body);state.saves.push(body.result);if(caller==='intake'&&!options.saveUnavailable)state.intakeSaved=body;return json([{id:D,...body}],options.saveUnavailable?503:200);}
      if(caller==='intake')return json([{id:D,owner_id:A,status:'DRAFT',mode:'single',input_photo_count:1,user_context:intakeContext,result:{analysis_stage:'UPLOADED',image_manifest:[{index:0,file_name:'fixture.jpg',storage_path:intakePath,sha256:'a'.repeat(64),byte_count:100}]},...state.intakeSaved}]);
      const result=options.savedComplete?{analysis_stage:'COMPLETE',research_summary:'Saved fixture',response_id:'saved-response'}:{analysis_stage:'STAGED'};
      return json([{id:D,status:'DRAFT',mode:'research',...(url.searchParams.get('select').split(',').includes('model')?{model:'saved-model'}:{}),input_photo_count:0,result,user_context:{item_id:I}}]);
    }
    throw Error('Unhandled synthetic request: '+url.pathname);
  };
  const req={method:'POST',headers:{authorization:'Bearer '+cfg.token},body:caller==='intake'
    ?{mode:'single',run_id:D,context:intakeContext,images:[{index:0,fileName:'fixture.jpg',url:intakeUrl}]}
    :{item:{id:I},research_run_id:D,images:[]}};
  const res={code:0,body:null,status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
  await (caller==='intake'?intake:research)(req,res);
  return {...state,res};
}
for(const caller of ['intake','research']){
  test(`${caller}: missing approval returns 503 with zero provider calls`,async t=>{
    const r=await setup(t,caller,{missing:true});assert.equal(r.res.code,503);assert.equal(r.paid,0);assert.equal(r.claims,0);
  });
  test(`${caller}: inaccessible approved view never falls back to archive`,async t=>{
    const r=await setup(t,caller,{unavailable:true});assert.equal(r.res.code,503);assert.equal(r.paid,0);assert.ok(!r.urls.includes('/rest/v1/canonical_documents'));
  });
  test(`${caller}: revocation during preflight stops paid dispatch`,async t=>{
    const r=await setup(t,caller,{revokeAfterRead:true});assert.equal(r.res.code,503);assert.equal(r.paid,0);assert.equal(r.claims,0);
  });
  test(`${caller}: changed approval of same bytes stops paid dispatch`,async t=>{
    const r=await setup(t,caller,{changeAfterRead:true});assert.equal(r.res.code,503);assert.equal(r.res.body.code,'CANONICAL_APPROVAL_CHANGED');assert.equal(r.paid,0);assert.equal(r.claims,0);
  });
  test(`${caller}: verified approved set reaches one mocked call and persists receipts`,async t=>{
    const r=await setup(t,caller);assert.equal(r.res.code,200);assert.equal(r.paid,1);assert.ok(r.saves.length>=1);
    for(const result of r.saves){assert.equal(result.canonical_source_audit.resolution_mode,'APPROVED_V1');assert.equal(result.canonical_source_audit.publication_receipts.length,canonicalCallerKeys[caller].length);}
  });
  test(`${caller}: legacy mode preserves existing source path without false approval receipts`,async t=>{
    const r=await setup(t,caller,{mode:'legacy'});assert.equal(r.res.code,200);assert.equal(r.paid,1);assert.equal(r.reads,0);
    assert.ok(r.saves.every(x=>x.canonical_source_audit.resolution_mode==='LEGACY_PINNED' && x.canonical_source_audit.publication_receipts.length===0));
  });
  test(`${caller}: invalid Auth stops before source and provider reads`,async t=>{
    const r=await setup(t,caller,{invalidAuth:true});assert.equal(r.res.code,401);assert.equal(r.reads,0);assert.equal(r.paid,0);
  });
}
test('intake: inscription never starts a second paid pass without explicit owner consent',async t=>{
  // The former implicit HIGH pass was removed. A changed approval cannot
  // trigger another request because no optional paid pass is dispatched.
  const r=await setup(t,'intake',{inscription:true,revokeBeforeSecondPass:true});
  assert.equal(r.res.code,200,JSON.stringify(r.res.body));
  assert.equal(r.paid,1);assert.equal(r.claims,1);assert.equal(r.saves.length,2);
  assert.equal(r.res.body.inscription_review_status,'OWNER_OPT_IN_REQUIRED');
  assert.ok(r.saves[0].initial_ai_result);assert.ok(r.saves[1].initial_ai_result);
});
test('research: failed visual preflight does not consume a paid-run claim',async t=>{
  const r=await setup(t,'research',{visualUnavailable:true});assert.equal(r.res.code,503);assert.equal(r.claims,0);assert.equal(r.paid,0);
});
test('research: saved result replay retains model and response identity without a paid call',async t=>{
  const r=await setup(t,'research',{savedComplete:true});assert.equal(r.res.code,200);assert.equal(r.paid,0);assert.equal(r.claims,0);
  assert.equal(r.res.body.model,'saved-model');assert.equal(r.res.body.response_id,'saved-response');assert.equal(r.res.body.reused_saved_result,true);
});
for(const [failure,code] of [['connection','PAID_RESEARCH_OUTCOME_UNCONFIRMED'],['non-json','PAID_RESEARCH_OUTCOME_UNCONFIRMED'],['error','PAID_RESEARCH_PROVIDER_ERROR'],['output','PAID_RESEARCH_OUTPUT_INVALID'],['null','PAID_RESEARCH_OUTPUT_INVALID']]){
  test('research: '+failure+' returns an explicit claimed-run recovery response',async t=>{
    const r=await setup(t,'research',{providerFailure:failure});assert.ok(r.res.code>=500);assert.equal(r.res.body.code,code);
    assert.equal(r.res.body.research_run_id,D);assert.match(r.res.body.error,/do not repeat paid research/i);assert.equal(r.claims,1);assert.equal(r.paid,1);assert.equal(r.saves.length,0);
  });
}
test('research: failed save retains complete output and identifies the claimed run',async t=>{
  const r=await setup(t,'research',{saveUnavailable:true});assert.equal(r.res.code,503);assert.equal(r.res.body.code,'PAID_RESEARCH_SAVE_NOT_CONFIRMED');
  assert.equal(r.res.body.research_run_id,D);assert.equal(r.res.body.result.analysis_stage,'COMPLETE');assert.equal(r.res.body.result.research_summary,'synthetic');assert.equal(r.paid,1);
});
