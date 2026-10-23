// Invoked only inside test-continuity-http's guarded, initially empty loopback DB.
// Auth, gateway, PostgREST, owner RLS and the two RPCs are real. Provider replies
// and empty evidence-context views are explicit fixtures; no AI/network spend.
import assert from 'node:assert/strict';
import researchHandler from '../api/research-item.ts';
import {createClient} from '@supabase/supabase-js';
import {readItemResearch,readItemSaleRows,itemResearchAudit} from '../src/lib/itemResearch.ts';
import {exerciseItemAssessments} from './test-item-assessments.mjs';
import {installReviewedAssessmentFixtures,exerciseReviewedItemAssessments} from './test-reviewed-item-assessments.mjs';
import {exercisePaidScopeClaims} from './test-paid-scope-claims.mjs';

export async function installResearchSessionFixtures(admin,read){
  await admin.query(await read('tests/fixtures/catalogue-storage-metadata.sql'));
  await admin.query(await read('supabase/migrations/001_core_schema.sql'));
  await admin.query(await read('supabase/migrations/002_rls_and_storage.sql'));
  await admin.query(`GRANT SELECT,INSERT ON public.items,public.item_photos,public.item_evidence,
    public.attribution_history,public.research_tasks TO authenticated;
    GRANT USAGE,SELECT ON SEQUENCE public.item_code_seq TO authenticated`);
  await admin.query(await read('tests/fixtures/research-session-support.sql'));
  await admin.query(await read('supabase/proposals/item-research-assessments.sql'));
  await admin.query(await read('supabase/migrations/004_ai_intake.sql'));
  await admin.query('GRANT SELECT,INSERT,UPDATE ON public.ai_analysis_runs TO authenticated');
  await admin.query(await read('supabase/migrations/20261017_paid_research_claim_gate_v1.sql'));
  await admin.query(await read('supabase/migrations/20261017_owner_review_revision_cas_v1.sql'));
  await admin.query(await read('supabase/migrations/20261017_append_only_owner_verdict_feedback.sql'));
  await admin.query(await read('supabase/migrations/20261016_atomic_photo_first_approval_v1.sql'));
  await admin.query(await read('supabase/migrations/20261017_reviewed_material_evidence_on_catalogue_v6.sql'));
  await admin.query(await read('supabase/migrations/20261016_block_partial_analysis_catalogue_approval.sql'));
  await admin.query(await read('supabase/proposals/scoped-paid-research-claim.sql'));
  await admin.query(`GRANT SELECT,INSERT,UPDATE ON public.sale_outcomes,public.listings TO authenticated;
    GRANT UPDATE ON public.items TO authenticated`);
  for(const file of ['20261017_atomic_actual_sale_capture_v1.sql','20261017_actual_sale_source_integrity_v2.sql',
    '20261017_allow_loss_making_sales_v3.sql','20261017_sales_listing_item_owner_rls_hardening.sql'])
    await admin.query(await read('supabase/migrations/'+file));
  await installReviewedAssessmentFixtures(admin,read);
}

export async function exerciseResearchSessions({admin,rest,check,A,B,anon,API,key}){
  const post=(token,path,body)=>rest(token,path,{method:'POST',body:JSON.stringify(body),headers:{Prefer:'return=representation'}});
  const rpc=(token,name,body)=>post(token,'rpc/'+name,body);
  const row=async id=>(await admin.query('select * from public.ai_analysis_runs where id=$1',[id])).rows[0];
  const insert=async(token,body)=>{
    const r=await post(token,'ai_analysis_runs',body);assert.equal(r.status,201,await r.clone().text());return (await r.json())[0];
  };
  const original={analysis_stage:'COMPLETE',objects:[{working_title:'Original AI title',condition_summary:'Original AI condition',image_indices:[0,2],evidence:['UNVERIFIED AI fixture']},{working_title:'Second object',image_indices:[1]}],image_manifest:[{index:0,storage_path:'fixture/original-a.jpg'},{index:1,storage_path:'fixture/original-b.jpg'},{index:2,storage_path:'fixture/original-c.jpg'}]};
  const draft=await insert(A.token,{mode:'single',model:'fixture-intake',input_photo_count:3,result:original});
  const edit=(token,id,revision,changes)=>rpc(token,'ci_save_owner_review_v1',{p_run_id:id,p_expected_revision:revision,p_object_changes:changes});
  const claim=(token,id)=>rpc(token,'ci_claim_paid_research_v1',{p_run_id:id});
  const itemResponse=await post(A.token,'items',{});assert.equal(itemResponse.status,201);
  const item=(await itemResponse.json())[0];
  const stage=(overrides={})=>insert(A.token,{mode:'research',model:'PENDING',status:'DRAFT',input_photo_count:0,user_context:{item_id:item.id},result:{analysis_stage:'STAGED',preserved_fixture:'original envelope'},...overrides});
  const sdk=createClient(API,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const sdkLogin=await sdk.auth.signInWithPassword({email:'collector-ci-a@example.test',password:'Ci-disposable-fixture-4826!'});assert.equal(sdkLogin.error,null);
  await exerciseItemAssessments({admin,rest,check,A,B,anon,API,key,sdk});
  await exercisePaidScopeClaims({admin,rest,check,A,B,anon});
  await exerciseReviewedItemAssessments({admin,rest,check,A,B,anon,API,key,sdk});
  const historyItem=await post(A.token,'items',{source_analysis_run_id:draft.id,source_object_index:1});assert.equal(historyItem.status,201);const target=(await historyItem.json())[0];
  let directHistory;
  await check('item history SDK recovers101 real owner-scoped responses with exact pagination',async()=>{
    const batch=Array.from({length:101},(_,i)=>({mode:'research',model:'fixture-history',status:'DRAFT',input_photo_count:0,user_context:{item_id:target.id},result:{analysis_stage:'COMPLETE',research_summary:'Stored original history '+i}}));
    const r=await post(A.token,'ai_analysis_runs',batch);assert.equal(r.status,201,await r.clone().text());directHistory=await r.json();
    const history=await readItemResearch(sdk,target,()=>true);assert.equal(history.runs.length,101);assert.equal(new Set(history.runs.map(r=>r.id)).size,101);assert.ok(history.runs.every(r=>r.owner_id===A.id));assert.equal(history.original.id,draft.id);
  });
  await check('item lineage SDK retains only matching original sibling and never inherits pair investigations',async()=>{
    const inherited=[];for(const [index,pair] of [[0,[]],[1,[]],[0,[0,1]]])inherited.push(await insert(A.token,{mode:'research',model:'fixture-source',input_photo_count:0,user_context:{source_analysis_run_id:draft.id,source_object_index:index,pair_source_indices:pair},result:{analysis_stage:'COMPLETE',research_summary:'Original sibling '+index}}));
    const history=await readItemResearch(sdk,target,()=>true);assert.equal(history.runs.length,102);assert.ok(history.runs.some(r=>r.id===inherited[1].id));assert.ok(!history.runs.some(r=>[inherited[0].id,inherited[2].id].includes(r.id)));
  });
  await check('legacy item null object mapping is blocked rather than assigned to sibling zero',async()=>{
    const history=await readItemResearch(sdk,{...target,source_object_index:null},()=>true);assert.equal(history.lineageUnresolved,true);assert.equal(history.runs.length,101);assert.ok(itemResearchAudit(history,[]).receipts.every(r=>r.status==='BLOCKED'));
  });
  await check('item research helper refuses other-owner identity before revealing private history',async()=>{
    await assert.rejects(readItemResearch(sdk,{...target,owner_id:B.id},()=>true),/history could not be verified/);
    const other=await rest(B.token,'ai_analysis_runs?id=eq.'+directHistory[0].id);assert.equal(other.status,200);assert.deepEqual(await other.json(),[]);
  });
  await check('real owner listing and trusted comparable reads preserve counted empty states',async()=>{
    assert.deepEqual(await readItemSaleRows(sdk,'listings',target,()=>true),[]);assert.deepEqual(await readItemSaleRows(sdk,'trusted_comparables_v1',target,()=>true),[]);
  });
  await check('review RPC rejects anonymous and other-owner edits without changing draft',async()=>{
    assert.ok([401,403].includes((await edit(anon,draft.id,0,{'0':{working_title:'Anonymous'}})).status));
    const foreign=await edit(B.token,draft.id,0,{'0':{working_title:'Wrong owner'}});assert.equal(foreign.status,400);
    assert.equal((await row(draft.id)).owner_review_revision,0);assert.deepEqual((await row(draft.id)).result,original);
  });
  await check('owner review saves one revision while preserving original AI and photo manifest',async()=>{
    const r=await edit(A.token,draft.id,0,{'0':{working_title:'Owner corrected title',condition_summary:'Owner observed chip'}});
    assert.equal(r.status,200,await r.clone().text());assert.equal((await r.json())[0].revision,1);
    const saved=await row(draft.id);assert.equal(saved.owner_review_revision,1);
    assert.deepEqual(saved.result.objects,original.objects);assert.deepEqual(saved.result.image_manifest,original.image_manifest);
    assert.equal(saved.result.owner_review.objects['0'].working_title,'Owner corrected title');
  });
  await check('stale-tab owner review is rejected and cannot overwrite newer text',async()=>{
    const r=await edit(A.token,draft.id,0,{'0':{working_title:'Stale overwrite'}});assert.equal(r.status,400);
    assert.match((await r.json()).message,/REVIEW_REVISION_CONFLICT/);
    assert.equal((await row(draft.id)).result.owner_review.objects['0'].working_title,'Owner corrected title');
  });
  await check('concurrent owner revisions have exactly one winner and one audit entry',async()=>{
    const replies=await Promise.all(['Tab A title','Tab B title'].map(working_title=>edit(A.token,draft.id,1,{'0':{working_title}})));
    assert.deepEqual(replies.map(r=>r.status).sort(),[200,400]);
    const winner=(await replies.find(r=>r.status===200).json())[0];const saved=await row(draft.id);
    assert.equal(saved.owner_review_revision,2);assert.deepEqual(saved.result.owner_review,winner.owner_review);
    assert.equal(saved.result.owner_review.objects['0'].condition_summary,'Owner observed chip');
    assert.deepEqual(saved.result.objects,original.objects);assert.deepEqual(saved.result.image_manifest,original.image_manifest);
    const audit=await admin.query('select revision from public.ai_owner_review_revisions where source_analysis_run_id=$1 order by revision',[draft.id]);assert.deepEqual(audit.rows,[{revision:1},{revision:2}]);
  });
  for(const [name,changes] of [
    ['unapproved field',{'0':{maker:'Invented maker'}}],['non-text value',{'0':{condition_summary:42}}],
    ['oversized value',{'0':{condition_summary:'x'.repeat(2001)}}],['blank title',{'0':{working_title:' '}}],
    ['invalid object index',{'2':{working_title:'Missing object'}}],['empty edit',{'0':{}}],
    ['non-object changes',[]],['empty changes',{}]
  ])await check('review rejects '+name+' atomically',async()=>{
    const before=await row(draft.id);const r=await edit(A.token,draft.id,2,changes);assert.equal(r.status,400);
    assert.deepEqual(await row(draft.id),before);
    assert.equal((await admin.query('select count(*)::int n from public.ai_owner_review_revisions where source_analysis_run_id=$1',[draft.id])).rows[0].n,2);
  });
  await check('review revision history is owner-scoped and denies client update/delete',async()=>{
    const own=await rest(A.token,'ai_owner_review_revisions?source_analysis_run_id=eq.'+draft.id);assert.equal(own.status,200);assert.equal((await own.json()).length,2);
    const foreign=await rest(B.token,'ai_owner_review_revisions?source_analysis_run_id=eq.'+draft.id);assert.equal(foreign.status,200);assert.deepEqual(await foreign.json(),[]);
    for(const method of ['PATCH','DELETE'])assert.equal((await rest(A.token,'ai_owner_review_revisions?source_analysis_run_id=eq.'+draft.id,{method,...(method==='PATCH'?{body:JSON.stringify({revision:99})}:{})})).status,403);
  });
  await check('audit insertion failure rolls back both owner review and revision increment',async()=>{
    const before=await row(draft.id);
    await admin.query('REVOKE INSERT ON public.ai_owner_review_revisions FROM authenticated');
    try{assert.equal((await edit(A.token,draft.id,2,{'0':{working_title:'Must roll back'}})).status,403);}
    finally{await admin.query('GRANT INSERT ON public.ai_owner_review_revisions TO authenticated');}
    assert.deepEqual(await row(draft.id),before);
    assert.equal((await admin.query('select count(*)::int n from public.ai_owner_review_revisions where source_analysis_run_id=$1',[draft.id])).rows[0].n,2);
  });
  for(const [name,overrides] of [['approved intake',{mode:'single',status:'APPROVED',result:original}],['research run',{result:original}]]){
    const invalid=await stage(overrides);
    await check('review refuses '+name,async()=>{assert.equal((await edit(A.token,invalid.id,0,{'0':{working_title:'Blocked edit'}})).status,400);assert.equal((await row(invalid.id)).owner_review_revision,0);});
  }
  const owned=await stage();
  await check('paid claim rejects anonymous and other-owner access without consuming staged run',async()=>{
    assert.ok([401,403].includes((await claim(anon,owned.id)).status));assert.equal((await claim(B.token,owned.id)).status,400);
    assert.equal((await row(owned.id)).result.analysis_stage,'STAGED');
  });
  await check('12 concurrent real HTTP claims admit exactly one paid-run winner',async()=>{
    const replies=await Promise.all(Array.from({length:12},()=>claim(A.token,owned.id)));
    assert.equal(replies.filter(r=>r.status===200).length,1);assert.equal(replies.filter(r=>r.status===400).length,11);
    assert.equal(await replies.find(r=>r.status===200).json(),'CLAIMED');
    const saved=await row(owned.id);assert.equal(saved.result.analysis_stage,'PROCESSING');assert.ok(Date.parse(saved.result.claimed_at));
    assert.equal(saved.result.preserved_fixture,'original envelope');assert.deepEqual(saved.user_context,{item_id:item.id});
  });
  for(const [name,overrides] of [
    ['processing',{result:{analysis_stage:'PROCESSING'}}],['missing stage',{result:{}}],
    ['malformed envelope',{result:[]}],['missing source',{user_context:{}}],
    ['non-draft',{status:'APPROVED'}],['non-research',{mode:'single'}]
  ]){
    const invalid=await stage(overrides);
    await check('paid claim refuses '+name+' without resetting or changing record',async()=>{
      const before=await row(invalid.id);assert.equal((await claim(A.token,invalid.id)).status,400);assert.deepEqual(await row(invalid.id),before);
    });
  }
  await check('complete paid claim returns COMPLETE without changing saved response',async()=>{
    const complete=await stage({result:{analysis_stage:'COMPLETE',research_summary:'Existing saved response'}});const before=await row(complete.id);
    const r=await claim(A.token,complete.id);assert.equal(r.status,200);assert.equal(await r.json(),'COMPLETE');assert.deepEqual(await row(complete.id),before);
  });

  // Call the actual server handler, with only the external provider intercepted.
  const env={NEXT_PUBLIC_SUPABASE_URL:API,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:key,
    COLLECTOR_CANONICAL_SOURCE_MODE:'approved-v1',OPENAI_API_KEY:'fixture-no-provider',AI_GATEWAY_API_KEY:'',VERCEL_OIDC_TOKEN:''};
  const before=Object.fromEntries(Object.keys(env).map(k=>[k,process.env[k]])),transport=globalThis.fetch;
  Object.assign(process.env,env);
  let providerCalls=0,providerReply,saveFailure=false;
  const synthetic={identification_update:{},comparables:[],valuation:{},routing:{},research_summary:'SYNTHETIC PROVIDER FIXTURE — not real research'};
  const reply=()=>new Response(JSON.stringify({id:'fixture-response-1',model:'fixture-research-model',output_text:JSON.stringify(synthetic)}),{status:200});
  globalThis.fetch=async(input,init)=>{
    const url=new URL(input);
    if(url.origin===API){
      if(saveFailure&&url.pathname==='/rest/v1/ai_analysis_runs'&&init?.method==='PATCH')return new Response(JSON.stringify({message:'Injected save outage'}),{status:503});
      return transport(input,init);
    }
    assert.equal(url.href,'https://api.openai.com/v1/responses','Unknown external call blocked');
    providerCalls++;return providerReply?providerReply():reply();
  };
  const handlerItems=new Map();
  const stageHandler=async(overrides={})=>{const r=await post(A.token,'items',{});assert.equal(r.status,201);const fresh=(await r.json())[0];const run=await stage({...overrides,user_context:{item_id:fresh.id,...overrides.user_context}});handlerItems.set(run.id,fresh.id);return run;};
  const invoke=async(id,user=A)=>{
    const res={code:0,body:null,status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
    await researchHandler({method:'POST',headers:{authorization:'Bearer '+user.token},body:{item:{id:handlerItems.get(id)||item.id},research_run_id:id,images:[]}},res);return res;
  };
  try{
    const concurrent=await stageHandler();let successful;
    await check('concurrent real research handlers dispatch only one mocked provider request',async()=>{
      const callsBefore=providerCalls;let release,entered;
      const waiting=new Promise(resolve=>{entered=resolve;});const hold=new Promise(resolve=>{release=resolve;});
      providerReply=async()=>{entered();await hold;return reply();};
      const first=invoke(concurrent.id);let timer;
      try{
        await Promise.race([waiting,first.then(res=>{throw Error('Handler stopped before fixture provider: '+JSON.stringify(res));}),
          new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Handler did not reach fixture provider')),10000);timer.unref();})]);
        assert.equal((await row(concurrent.id)).result.analysis_stage,'PROCESSING');
        const duplicate=await invoke(concurrent.id);assert.equal(duplicate.code,409);assert.equal(providerCalls-callsBefore,1);
      }finally{clearTimeout(timer);release();successful=await first;providerReply=null;}
      assert.equal(successful.code,200,JSON.stringify(successful.body));assert.equal(successful.body.saved_run_id,concurrent.id);
      const saved=await row(concurrent.id);assert.equal(saved.result.analysis_stage,'COMPLETE');assert.equal(saved.model,'fixture-research-model');
      assert.equal(saved.result.canonical_source_audit.resolution_mode,'APPROVED_V1');assert.equal(saved.result.canonical_source_audit.publication_receipts.length,3);
      assert.deepEqual(saved.result,successful.body.result);assert.equal(saved.result.source_audit.independent_source_verification,false);
      assert.equal(saved.result.research_execution_v1.run_id,concurrent.id);assert.equal(saved.result.research_execution_v1.provider_response_id,'fixture-response-1');
      assert.equal(saved.result.research_execution_v1.independent_source_verification,false);assert.equal(saved.result.research_execution_v1.category_receipts_available,false);assert.deepEqual(saved.result.research_execution_v1.web_search_calls,[]);
    });
    await check('saved research replay preserves model response identity and makes zero new provider calls',async()=>{
      const callsBefore=providerCalls;const replay=await invoke(concurrent.id);assert.equal(replay.code,200);
      assert.equal(replay.body.reused_saved_result,true);assert.equal(replay.body.model,'fixture-research-model');assert.equal(replay.body.response_id,'fixture-response-1');
      assert.deepEqual(replay.body.result,successful.body.result);assert.equal(providerCalls,callsBefore);
    });
    await check('research handler rejects other-owner source and staging before provider dispatch',async()=>{
      const callsBefore=providerCalls;assert.equal((await invoke(concurrent.id,B)).code,403);assert.equal(providerCalls,callsBefore);
    });
    for(const [name,overrides] of [['photo count',{input_photo_count:1}],['source object',{user_context:{item_id:draft.id}}],['research depth',{user_context:{research_depth:'deep_dive'}}]]){
      const mismatch=await stageHandler(overrides);
      await check('research handler refuses mismatched '+name+' before claiming or provider dispatch',async()=>{
        const callsBefore=providerCalls;assert.equal((await invoke(mismatch.id)).code,409);assert.equal(providerCalls,callsBefore);
        assert.equal((await row(mismatch.id)).result.analysis_stage,'STAGED');
      });
    }
    for(const [name,provider,code] of [
      ['lost provider connection',()=>{throw Error('Injected connection loss');},'PAID_RESEARCH_OUTCOME_UNCONFIRMED'],
      ['non-JSON provider response',()=>new Response('<html>fixture outage</html>',{status:502}),'PAID_RESEARCH_OUTCOME_UNCONFIRMED'],
      ['provider error response',()=>new Response(JSON.stringify({error:{message:'Injected provider outage'}}),{status:503}),'PAID_RESEARCH_PROVIDER_ERROR'],
      ['invalid structured output',()=>new Response(JSON.stringify({output_text:'not JSON'}),{status:200}),'PAID_RESEARCH_OUTPUT_INVALID'],
      ['null provider envelope',()=>new Response('null',{status:200}),'PAID_RESEARCH_OUTPUT_INVALID']
    ])await check(name+' retains claim and blocks a repeated provider dispatch',async()=>{
      const run=await stageHandler(),callsBefore=providerCalls;providerReply=provider;
      const failed=await invoke(run.id);assert.ok(failed.code>=500);assert.equal(failed.body.code,code);assert.equal(failed.body.research_run_id,run.id);assert.match(failed.body.error,/do not repeat paid research/i);
      assert.equal((await row(run.id)).result.analysis_stage,'PROCESSING');providerReply=null;
      const retry=await invoke(run.id);assert.equal(retry.code,409);assert.equal(providerCalls-callsBefore,1);
    });
    await check('unconfirmed result save returns recoverable output and never automatically pays again',async()=>{
      const run=await stageHandler(),callsBefore=providerCalls;saveFailure=true;
      let failed;try{failed=await invoke(run.id);}finally{saveFailure=false;}
      assert.equal(failed.code,503);assert.equal(failed.body.code,'PAID_RESEARCH_SAVE_NOT_CONFIRMED');assert.equal(failed.body.research_run_id,run.id);
      assert.equal(failed.body.result.research_summary,synthetic.research_summary);assert.equal(failed.body.result.analysis_stage,'COMPLETE');
      assert.equal((await row(run.id)).result.analysis_stage,'PROCESSING');assert.equal((await invoke(run.id)).code,409);assert.equal(providerCalls-callsBefore,1);
    });
  }finally{
    globalThis.fetch=transport;for(const [k,v] of Object.entries(before)){if(v===undefined)delete process.env[k];else process.env[k]=v;}
  }
}
