// Called only after the guarded disposable HTTP harness installs the proposal.
// Genuine GoTrue, PostgREST, owner RLS and server-generated snapshots; no provider.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {auditResearch} from '../src/lib/researchSaleDecision.ts';
import {assessmentIsCurrent,holdPayload,prepareItemAssessment,readAssessmentHistory,settleItemAssessment} from '../src/lib/itemAssessment.ts';
export async function exerciseItemAssessments({admin,rest,check,A,B,anon,API,key,sdk}){
 const made=await rest(A.token,'items',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({title:'Disposable final assessment object',currency:'GBP'})});assert.equal(made.status,201);const item=(await made.json())[0];
 const advice={decision:'SPECIALIST_REVIEW',rationale:'Both marks and the achieved-sale comparability require independent specialist review.',unresolvedIssues:'Maker authentication and condition remain unresolved.',nextAction:'Compare both original bases separately.',routeGuidance:'Hold all sale routes until the evidence and net-value review is complete.',confidence:{identification:null,dating:null,valuation:null},sourceRefs:['fixture:original-a','fixture:original-b']},audit=auditResearch([]);
 const rpc=(token,request,payload=request.payload)=>rest(token,'rpc/ci_record_item_hold_assessment_v1',{method:'POST',body:JSON.stringify({p_item_id:request.itemId,p_client_event_id:request.eventId,p_expected_facts_sha256:request.context.facts_sha256,p_assessment:payload})});
 let request,saved;
 await check('final item hold uses genuine owner snapshot and GET-only missing-event check',async()=>{
  request=await prepareItemAssessment(sdk,item,advice,audit,()=>true);assert.deepEqual(request.context.facts_snapshot,item);assert.match(request.context.facts_sha256,/^[a-f0-9]{64}$/);
  assert.equal(await settleItemAssessment(sdk,request,()=>true,false),null);assert.equal((await admin.query('select count(*)::int n from public.item_research_assessments where item_id=$1',[item.id])).rows[0].n,0);
 });
 await check('real committed hold survives lost RPC acknowledgement and is not duplicated on retry',async()=>{
  let writes=0;const lossClient=createClient(API,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:async(url,init)=>{const response=await fetch(url,init);if(String(url).includes('/rpc/ci_record_item_hold_assessment_v1')){writes++;assert.equal(response.status,200,await response.clone().text());throw Error('Synthetic lost acknowledgement after actual commit');}return response;}}});
  assert.equal((await lossClient.auth.signInWithPassword({email:'collector-ci-a@example.test',password:'Ci-disposable-fixture-4826!'})).error,null);
  saved=await settleItemAssessment(lossClient,request,()=>true,true);assert.equal(saved.current,true);assert.equal(saved.row.decision,'SPECIALIST_REVIEW');assert.equal(saved.row.review_status,'OWNER_REPORTED_UNVERIFIED');
  assert.equal((await settleItemAssessment(lossClient,request,()=>true,true)).row.id,saved.row.id);assert.equal(writes,1);
  const h=await readAssessmentHistory(sdk,item,()=>true);assert.equal(h.rows.length,1);assert.equal(h.rows[0].id,saved.row.id);assert.ok(h.rows[0].assessment.availableChecks.every(c=>c.status==='REQUIRES_REVIEW'));
 });
 await check('final hold denies anonymous and other-owner access and reveals no private history',async()=>{
  for(const token of [B.token,anon]){const r=await rpc(token,request);assert.ok([400,401,403].includes(r.status),await r.text());}
  const foreign=await rest(B.token,'item_research_assessments?item_id=eq.'+item.id);assert.equal(foreign.status,200);assert.deepEqual(await foreign.json(),[]);
  const context=await rest(B.token,'item_assessment_context_v1?item_id=eq.'+item.id);assert.equal(context.status,200);assert.deepEqual(await context.json(),[]);
 });
 const base=holdPayload(advice,audit);
 for(const [label,payload] of [
  ['client READY_TO_LIST',{...base,decision:'READY_TO_LIST'}],
  ['verified category substitution',{...base,availableChecks:base.availableChecks.map(c=>({...c,status:'COMPLETE'}))}],
  ['missing category',{...base,availableChecks:base.availableChecks.slice(1)}],
  ['duplicate category',{...base,availableChecks:base.availableChecks.map(()=>base.availableChecks[0])}],
  ['fabricated confidence',{...base,confidence:{identification:101,dating:null,valuation:null}}],
  ['blank source reference',{...base,sourceRefs:[' ']}],
  ['missing rationale',{...base,rationale:''}],
 ])await check('server rejects final hold '+label,async()=>{
  const invalid={...request,eventId:randomUUID()};const r=await rpc(A.token,invalid,payload);assert.equal(r.status,400,await r.clone().text());
  assert.equal((await admin.query('select count(*)::int n from public.item_research_assessments where item_id=$1',[item.id])).rows[0].n,1);
 });
 await check('owner cannot promote hold source review or alter/delete historical decisions',async()=>{
  for(const method of ['PATCH','DELETE']){const r=await rest(A.token,'item_research_assessments?id=eq.'+saved.row.id,{method,...(method==='PATCH'?{body:JSON.stringify({decision:'READY_TO_LIST'})}:{})});assert.equal(r.status,403);}
  const direct=await rest(A.token,'item_research_assessments',{method:'POST',body:JSON.stringify({item_id:item.id,client_event_id:randomUUID(),decision:'SPECIALIST_REVIEW',review_status:'SOURCE_REVIEWED',assessment:base,facts_snapshot:item})});assert.equal(direct.status,403);
  assert.equal((await readAssessmentHistory(sdk,item,()=>true)).rows[0].id,saved.row.id);
 });
 await check('same-event races return one immutable hold and changed payload cannot replace it',async()=>{
  const race={...request,eventId:randomUUID()},responses=await Promise.all(Array.from({length:6},()=>rpc(A.token,race)));
  const ids=[];for(const r of responses){assert.equal(r.status,200,await r.clone().text());const body=await r.json(),row=Array.isArray(body)?body[0]:body;assert.match(row.id,/^[a-f0-9-]{36}$/);ids.push(row.id)}assert.equal(new Set(ids).size,1);
  const changed=await rpc(A.token,race,{...race.payload,nextAction:'A conflicting replacement must not persist.'});assert.equal(changed.status,400);
  assert.equal((await admin.query('select count(*)::int n from public.item_research_assessments where item_id=$1',[item.id])).rows[0].n,2);
 });
 await check('catalogue change makes earlier holds stale and rejects a new decision from old facts',async()=>{
  const changed=await rest(A.token,'items?id=eq.'+item.id,{method:'PATCH',body:JSON.stringify({condition_summary:'Newly inspected damage changes the facts'})});assert.equal(changed.status,204);
  const h=await readAssessmentHistory(sdk,item,()=>true);assert.equal(h.rows.length,2);assert.ok(h.rows.every(row=>!assessmentIsCurrent(row,h.context)));
  assert.equal((await settleItemAssessment(sdk,request,()=>true,false)).current,false);
  const stale={...request,eventId:randomUUID()};assert.equal((await rpc(A.token,stale)).status,400);
  await assert.rejects(settleItemAssessment(sdk,stale,()=>true,true),/facts changed/);
 });
}
