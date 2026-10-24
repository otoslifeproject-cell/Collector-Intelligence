// Reuses the guarded disposable Auth/PostgREST/storage harness. SYNTHETIC
// receipts only: no kit install, provider dispatch, live source or production use.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {seedReviewedAssessmentFixture} from './test-reviewed-item-assessments.mjs';
import {armyRoles,emptyArmyReport,prepareArmyPlan,prepareArmyEvent,settleArmyRequest,readResearchArmy} from '../src/lib/researchArmy.ts';

async function reviewer(admin,actor,fn){
 await admin.query('BEGIN');try{await admin.query('SET LOCAL ROLE ci_item_assessment_reviewer');await admin.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[actor]);const r=await fn(admin);await admin.query('COMMIT');return r;}catch(error){await admin.query('ROLLBACK');throw error;}
}
export async function exerciseResearchArmy({admin,rest,check,A,B,anon,anonToken=typeof anon==='string'?anon:undefined,sdk=A.client,storageClient}){
 assert.ok(sdk?.auth,'Existing authenticated owner SDK is required; this exercise does not sign in or create accounts.');
 assert.equal(typeof anonToken,'string','Pass the harness anonymous bearer JWT as anonToken when anon is a Storage SDK.');
 let f,planRequest,plan,startRequest,start,resultRequest,result,history,entry,attestation;
 const current=()=>true;
 const report=()=>({...emptyArmyReport([f.photo.id]),categoryIds:['PHOTOGRAPH_EXAM','SIGNATURE_READING'],question:'What features are actually visible on this exact original object photograph?',query:'SYNTHETIC original base and signature comparison; reading is not maker authentication',tool:'Owner manual inspection; no provider call',summary:'SYNTHETIC original was examined, but neither maker nor signature attribution is authenticated.',unresolvedIssues:'SYNTHETIC documentary comparison and an independently reviewed signature reading remain required.',sourceUrls:[f.evidence.source_url],hypotheses:[{candidate:'Synthetic provisional attribution',status:'UNRESOLVED',reason:'A visible mark must be independently read and compared before any maker authentication.',sourceUrls:[f.evidence.source_url]}],disagreements:['SYNTHETIC colour resemblance is not independent provenance.']});
 const rpc=async(token,body)=>rest(token,'rpc/ci_record_research_army_event_v1',{method:'POST',body:JSON.stringify(body)});
 const args=(r,changes={})=>({p_item_id:r.itemId,p_event_id:r.eventId,p_workflow_id:r.workflowId,p_kind:r.kind,p_role:r.role,p_expected_facts_sha256:r.factsSha256,p_payload:r.payload,...changes});
 const attest=entries=>reviewer(admin,f.actor,db=>db.query('SELECT * FROM ci_private.attest_research_army_v1($1,$2,$3,$4)',[A.id,f.item.id,f.row.id,entries]));
 await check('native seven-role plan persists exact owner/item/photo/task scope without marking research complete',async()=>{
  f=await seedReviewedAssessmentFixture(admin,A.id,{title:'SYNTHETIC bounded Research Army acceptance',client:storageClient});
  planRequest=await prepareArmyPlan(sdk,f.item,[f.photo.id],'Examine this exact original, preserve rival hypotheses and distinguish signature reading from maker authentication.',current);
  plan=await settleArmyRequest(sdk,planRequest,current,true);assert.equal(plan.kind,'PLAN');assert.equal(plan.status,'NOT_RUN');
  history=await readResearchArmy(sdk,f.item,current);assert.equal(history.workflows.length,1);assert.equal(history.workflows[0].roles.length,7);assert.ok(history.workflows[0].roles.every(r=>r.status==='NOT_RUN'));assert.deepEqual(plan.payload.photoIds,[f.photo.id]);
  const read=await rpc(A.token,args(planRequest));assert.equal(read.status,200);const body=await read.json();assert.equal((Array.isArray(body)?body[0]:body).id,plan.eventId);
  assert.equal((await admin.query('SELECT count(*)::int n FROM public.ai_analysis_runs WHERE id=$1',[plan.eventId])).rows[0].n,1);
 });
 await check('foreign owners, anonymous clients and forged direct native receipts cannot mutate persistent research',async()=>{
  for(const token of [B.token,anonToken])assert.ok((await rpc(token,args(planRequest,{p_event_id:randomUUID()}))).status>=400);
  assert.deepEqual(await(await rest(B.token,'research_army_receipts_v1?user_context->>item_id=eq.'+f.item.id)).json(),[]);
  assert.ok((await rest(anonToken,'research_army_receipts_v1')).status>=400);
  const native={owner_id:A.id,mode:'research',model:'NATIVE_MANUAL_WORKFLOW_V1',user_context:{item_id:f.item.id,research_army_workflow_id:randomUUID()},result:{analysis_stage:'ARMY_PLAN'}};
  assert.ok((await rest(A.token,'ai_analysis_runs',{method:'POST',body:JSON.stringify(native)})).status>=400);
  for(const method of ['PATCH','DELETE'])assert.ok((await rest(A.token,'ai_analysis_runs?id=eq.'+plan.eventId,{method,...(method==='PATCH'?{body:JSON.stringify({result:{analysis_stage:'COMPLETE'}})}:{})})).status>=400);
  assert.equal((await admin.query('SELECT count(*)::int n FROM public.ai_analysis_runs WHERE id=$1',[plan.eventId])).rows[0].n,1);
 });
 await check('native plan rejects crossed photographs, duplicated task scope and conflicting immutable replay',async()=>{
  const payload=structuredClone(planRequest.payload);payload.photoIds=[randomUUID()];let event=randomUUID();assert.ok((await rpc(A.token,args(planRequest,{p_event_id:event,p_workflow_id:event,p_payload:payload}))).status>=400);
  payload.photoIds=[f.photo.id];payload.tasks[1].taskId=payload.tasks[0].taskId;event=randomUUID();assert.ok((await rpc(A.token,args(planRequest,{p_event_id:event,p_workflow_id:event,p_payload:payload}))).status>=400);
  assert.ok((await rpc(A.token,args(planRequest,{p_payload:{...planRequest.payload,objective:'Different immutable objective for the same event'}}))).status>=400);
 });
 await check('actual native START/RESULT survives refresh with explicit categories and independent reading uncertainty',async()=>{
  history=await readResearchArmy(sdk,f.item,current);startRequest=await prepareArmyEvent(sdk,f.item,history.workflows[0],'PHOTO_EXAMINER','START',report(),current);start=await settleArmyRequest(sdk,startRequest,current,true);
  history=await readResearchArmy(sdk,f.item,current);assert.equal(history.workflows[0].roles.find(r=>r.role==='PHOTO_EXAMINER').status,'RUNNING');
  await assert.rejects(prepareArmyEvent(sdk,f.item,history.workflows[0],'PHOTO_EXAMINER','START',report(),current),/Resume/);
  resultRequest=await prepareArmyEvent(sdk,f.item,history.workflows[0],'PHOTO_EXAMINER','RESULT',report(),current);result=await settleArmyRequest(sdk,resultRequest,current,true);
  history=await readResearchArmy(sdk,f.item,current);const role=history.workflows[0].roles.find(r=>r.role==='PHOTO_EXAMINER');assert.equal(role.status,'INCONCLUSIVE');assert.equal(role.history.length,2);assert.deepEqual(role.latest.payload.report.categoryIds,['PHOTOGRAPH_EXAM','SIGNATURE_READING']);
  assert.ok(history.workflows[0].roles.filter(r=>r.role!=='PHOTO_EXAMINER').every(r=>r.status==='NOT_RUN'));assert.equal(result.providerCalls,0);assert.equal(result.providerAmount,0);
  assert.equal((await settleArmyRequest(sdk,resultRequest,current,true)).eventId,result.eventId);
 });
 await check('server rejects false evidenced outcomes, unknown or duplicate categories and results lacking exact prior START',async()=>{
  for(const edit of [r=>({...r,outcome:'EVIDENCED'}),r=>({...r,categoryIds:['SOURCE_VERIFIER']}),r=>({...r,categoryIds:['SIGNATURE_READING','SIGNATURE_READING']})]){
   assert.ok((await rpc(A.token,args(resultRequest,{p_event_id:randomUUID(),p_payload:{...resultRequest.payload,report:edit(report())}}))).status>=400);
  }
  assert.ok((await rpc(A.token,args(resultRequest,{p_event_id:randomUUID(),p_payload:{...resultRequest.payload,startEventId:randomUUID()}}))).status>=400);
  assert.equal((await admin.query("SELECT count(*)::int n FROM public.ai_analysis_runs WHERE user_context->>'research_army_workflow_id'=$1",[plan.workflowId])).rows[0].n,3);
 });
 await check('owner cannot call private role attestation or obtain independent reviewer authority',async()=>{
  for(const role of ['anon','authenticated','service_role']){
   assert.equal((await admin.query("SELECT has_function_privilege($1,'ci_private.attest_research_army_v1(uuid,uuid,uuid,jsonb)','EXECUTE') ok",[role])).rows[0].ok,false);
   assert.equal((await admin.query("SELECT pg_has_role($1,'ci_item_assessment_reviewer','MEMBER') ok",[role])).rows[0].ok,false);
  }
  assert.ok((await rest(A.token,'rpc/attest_research_army_v1',{method:'POST',body:'{}'})).status>=400);
 });
 await check('private attestation requires current existing review and exact actual role source context',async()=>{
  entry={eventId:randomUUID(),resultEventId:result.eventId,rationale:'SYNTHETIC separate reviewer inspected this exact recorded original-photo result, including its uncertainty; no real maker is authenticated.',sourceRefs:[f.photo.storage_path]};
  await assert.rejects(attest([entry]),/qualified/); // original assessment predates actual role execution
  f.row=await f.append(f.payload,randomUUID());
  await assert.rejects(attest([{...entry,rationale:null}]),/role-specific|Role-specific/);
  await assert.rejects(attest([{...entry,resultEventId:randomUUID()}]),/actual prior/);
  await assert.rejects(attest([{...entry,sourceRefs:[f.comps[0].source_url]}]),/role-specific/);
  await assert.rejects(attest([{...entry,sourceRefs:[f.photo.storage_path,f.photo.storage_path]}]),/Role-specific/);
  const r=await attest([entry]);attestation=r.rows[0];assert.equal(attestation.result.research_army_v1.status,'EVIDENCED');assert.equal(attestation.result.research_army_v1.executorId,f.actor);
  assert.equal((await attest([entry])).rows[0].id,attestation.id);
  history=await readResearchArmy(sdk,f.item,current);assert.equal(history.workflows[0].roles.find(r=>r.role==='PHOTO_EXAMINER').status,'EVIDENCED');assert.equal(history.workflows[0].roles.find(r=>r.role==='SOURCE_VERIFIER').status,'NOT_RUN');
 });
 await check('source mutation withdraws current role evidence while preserving original independent and owner receipts',async()=>{
  await admin.query("UPDATE public.item_evidence SET claim='SYNTHETIC changed documentary source after independent inspection' WHERE id=$1",[f.evidence.id]);
  history=await readResearchArmy(sdk,f.item,current);const role=history.workflows[0].roles.find(r=>r.role==='PHOTO_EXAMINER');assert.equal(role.status,'BLOCKED');assert.equal(role.latest.status,'EVIDENCED');assert.equal(role.history.length,3);
  assert.equal((await attest([entry])).rows[0].id,attestation.id); // lost acknowledgement remains recoverable

 });
 // Paid-claim exclusion is exercised only where the existing paid harness is
 // installed (HTTP). Missing RPCs are never accepted as proof of stage safety.
 const claimNames=['ci_claim_paid_research_v1','ci_claim_scoped_paid_research_v1'];
 const claimInstalled=await Promise.all(claimNames.map(async name=>(await admin.query('SELECT to_regprocedure($1) existing',['public.'+name+'(uuid)'])).rows[0].existing));
 if(claimInstalled.every(Boolean))await check('actual installed paid claims reject reserved native receipts without dispatch',async()=>{
  for(const name of claimNames){const r=await sdk.rpc(name,{p_run_id:plan.eventId});assert.ok(r.error,'Reserved native plan must never be dispatched as paid STAGED analysis');}
  assert.equal((await admin.query('SELECT result FROM public.ai_analysis_runs WHERE id=$1',[plan.eventId])).rows[0].result.analysis_stage,'ARMY_PLAN');
 });else console.log('LIMITATION native paid-claim exclusion not exercised in this Storage-only harness; covered by the HTTP harness with actual installed paid functions.');
 await check('changed catalogue facts preserve old native history but prevent new work against stale scope',async()=>{
  await admin.query("UPDATE public.items SET condition_summary='SYNTHETIC new condition facts requiring a new current research plan' WHERE id=$1",[f.item.id]);
  history=await readResearchArmy(sdk,f.item,current);assert.equal(history.workflows[0].currentFacts,false);assert.equal(history.workflows[0].events.length,3);
  const event=randomUUID();assert.ok((await rpc(A.token,args(startRequest,{p_event_id:event}))).status>=400);
  assert.equal((await rpc(A.token,args(resultRequest))).status,200); // exact prior history remains recoverable
 });
 await check('concurrent native owner RPC replays converge on one exact persistent plan without a paid claim',async()=>{
  const f2=await seedReviewedAssessmentFixture(admin,A.id,{title:'SYNTHETIC concurrent native event fixture',client:storageClient});
  const held=await prepareArmyPlan(sdk,f2.item,[f2.photo.id],'SYNTHETIC six acknowledgements for one immutable exact object and photograph plan.',current);
  const responses=await Promise.all(Array.from({length:6},()=>rpc(A.token,args(held))));
  for(const response of responses){assert.equal(response.status,200,await response.clone().text());const body=await response.json();assert.equal((Array.isArray(body)?body[0]:body).id,held.eventId);}
  assert.equal((await admin.query('SELECT count(*)::int n FROM public.ai_analysis_runs WHERE id=$1',[held.eventId])).rows[0].n,1);
  const read=await readResearchArmy(sdk,f2.item,current);assert.deepEqual(read.workflows[0].plan.payload.tasks.map(t=>t.role),[...armyRoles]);assert.ok(read.workflows[0].roles.every(r=>r.status==='NOT_RUN'));
 });
 await check('native photo scope allows exact selected set and proper subset, rejects a foreign original without writing',async()=>{
  const scoped=await seedReviewedAssessmentFixture(admin,A.id,{title:'SYNTHETIC Issue5 exact/subset photo scope',client:storageClient}),path=`${A.id}/issue5/${randomUUID()}/second-original.png`;
  const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9XsAAAAASUVORK5CYII=','base64');
  if(storageClient)assert.equal((await storageClient.storage.from('item-images').upload(path,bytes,{contentType:'image/png'})).error,null);
  else await admin.query("INSERT INTO storage.objects(bucket_id,name) VALUES('item-images',$1)",[path]);
  const second=(await admin.query("INSERT INTO public.item_photos(owner_id,item_id,storage_path,file_name) VALUES($1,$2,$3,'SYNTHETIC second original.png') RETURNING *",[A.id,scoped.item.id,path])).rows[0];
  const request=await prepareArmyPlan(sdk,scoped.item,[scoped.photo.id,second.id],'SYNTHETIC Issue5 two selected originals: exact set, strict subset and foreign photograph rejection.',current);
  await settleArmyRequest(sdk,request,current,true);
  for(const [role,photoIds]of [['COORDINATOR',[scoped.photo.id,second.id]],['PHOTO_EXAMINER',[second.id]]]){
   const before=await readResearchArmy(sdk,scoped.item,current),r={...report(),photoIds};
   const start=await prepareArmyEvent(sdk,scoped.item,before.workflows[0],role,'START',r,current);
   const forged=args(start,{p_event_id:randomUUID(),p_payload:{...start.payload,report:{...r,photoIds:[f.photo.id]}}});
   const count=(await admin.query("SELECT count(*)::int n FROM public.ai_analysis_runs WHERE user_context->>'research_army_workflow_id'=$1",[request.workflowId])).rows[0].n;
   const denied=await rpc(A.token,forged);assert.equal(denied.status,400);assert.match((await denied.json()).message,/unselected photograph/);
   assert.equal((await admin.query("SELECT count(*)::int n FROM public.ai_analysis_runs WHERE user_context->>'research_army_workflow_id'=$1",[request.workflowId])).rows[0].n,count);
   await settleArmyRequest(sdk,start,current,true);let recovered=await readResearchArmy(sdk,scoped.item,current);assert.equal(recovered.workflows[0].roles.find(r=>r.role===role).status,'RUNNING');
   const result=await prepareArmyEvent(sdk,scoped.item,recovered.workflows[0],role,'RESULT',r,current);await settleArmyRequest(sdk,result,current,true);recovered=await readResearchArmy(sdk,scoped.item,current);assert.equal(recovered.workflows[0].roles.find(r=>r.role===role).status,'INCONCLUSIVE');
   assert.equal(recovered.workflows[0].roles.length,7);assert.equal(recovered.workflows[0].roles.filter(r=>r.status==='EVIDENCED').length,0);
  }
 });

}
