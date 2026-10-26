import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {auditResearch} from '../src/lib/researchSaleDecision.ts'
import {assessmentIsCurrent,holdPayload,prepareItemAssessment,readAssessmentHistory,settleItemAssessment,validHoldPayload} from '../src/lib/itemAssessment.ts'
const item={id:randomUUID(),owner_id:randomUUID(),title:'A real owner-scoped object'},hash='a'.repeat(64)
const context={item_id:item.id,owner_id:item.owner_id,facts_snapshot:{...item},facts_sha256:hash}
const advice={decision:'DO_NOT_LIST_YET',rationale:'Maker authentication and independently reviewed valuation remain unresolved.',unresolvedIssues:'Two signatures need independent examination.',nextAction:'Review both original base photographs.',routeGuidance:'Do not list while maker and value remain unresolved.',confidence:{identification:null,dating:null,valuation:null},sourceRefs:['original:base-a']}
const audit=auditResearch([])
function db(options={}){
 const calls=[],rows=options.rows||[],state={context:structuredClone(context),rows,calls}
 const client={auth:{getUser:async()=>({error:null,data:{user:{id:options.foreignOwner?'foreign':item.owner_id}}})},from(table){
  const filters=[],paging={a:0,b:99,single:false};const q={select(){return q},eq(k,v){filters.push([k,v]);return q},order(){return q},range(a,b){paging.a=a;paging.b=b;return q},limit(n){paging.b=n-1;return q},abortSignal(){return q},maybeSingle(){paging.single=true;return q},then(resolve,reject){
   calls.push({method:'GET',table,filters});let selected=table==='item_assessment_context_v1'?[state.context]:rows
   selected=selected.filter(r=>filters.every(([k,v])=>r[k]===v))
   return Promise.resolve({error:options.denied?{code:'42501'}:null,data:paging.single?selected[0]||null:selected.slice(paging.a,paging.b+1),count:options.missingCount?null:selected.length}).then(resolve,reject)
  }};return q
 },rpc(name,body){calls.push({method:'POST',name,body});return {abortSignal:async()=>{
  if(options.noCommit)return {error:{message:'No commit'}}
  rows.push({id:randomUUID(),client_event_id:body.p_client_event_id,item_id:item.id,owner_id:item.owner_id,decision:body.p_assessment.decision,review_status:'OWNER_REPORTED_UNVERIFIED',assessment:body.p_assessment,facts_snapshot:structuredClone(context.facts_snapshot),facts_sha256:hash,request_fingerprint:'b'.repeat(64),created_at:'2026-10-23T12:00:00Z'})
  if(options.loseAck)throw Error('Lost acknowledgement')
  return {data:rows.at(-1),error:null}
 }}}}
 return {client,state}
}
test('owner holds preserve all categories but cannot mark them verified or ready to list',()=>{
 const payload=holdPayload(advice,audit);assert.equal(payload.availableChecks.length,7);assert.ok(payload.availableChecks.every(c=>c.status==='REQUIRES_REVIEW'))
 assert.equal(validHoldPayload({...payload,decision:'READY_TO_LIST'}),false)
 assert.equal(validHoldPayload({...payload,availableChecks:payload.availableChecks.map(c=>({...c,status:'VERIFIED'}))}),false)
 assert.equal(validHoldPayload({...payload,confidence:{identification:95,dating:0.5,valuation:null}}),false)
 assert.equal(validHoldPayload({...payload,sourceRefs:['']}),false)
})
test('frozen held request survives lost write acknowledgement through independent readback, without duplicate writes',async()=>{
 const {client,state}=db({loseAck:true});const request=await prepareItemAssessment(client,item,advice,audit,()=>true)
 assert.ok(Object.isFrozen(request.payload.availableChecks));const saved=await settleItemAssessment(client,request,()=>true,true)
 assert.equal(saved.current,true);assert.equal(state.rows.length,1)
 const again=await settleItemAssessment(client,request,()=>true,true);assert.equal(again.row.id,saved.row.id)
 assert.equal(state.calls.filter(c=>c.method==='POST').length,1);assert.ok(state.calls.at(-1).method==='GET')
 const read=await readAssessmentHistory(client,item,()=>true);assert.equal(read.rows.length,1);assert.equal(assessmentIsCurrent(read.rows[0],read.context),true)
})
test('Check saved decision is GET only and an uncommitted response never counts as saved',async()=>{
 const {client,state}=db({noCommit:true}),request=await prepareItemAssessment(client,item,advice,audit,()=>true)
 assert.equal(await settleItemAssessment(client,request,()=>true,false),null);assert.ok(state.calls.every(c=>c.method==='GET'))
 assert.equal(await settleItemAssessment(client,request,()=>true,true),null);assert.equal(state.rows.length,0)
})
test('changed facts refuse a new write and retain an earlier saved decision as stale',async()=>{
 const {client,state}=db(),request=await prepareItemAssessment(client,item,advice,audit,()=>true)
 await settleItemAssessment(client,request,()=>true,true);state.context.facts_snapshot.title='Changed';state.context.facts_sha256='c'.repeat(64)
 const saved=await settleItemAssessment(client,request,()=>true,false);assert.equal(saved.current,false)
 const read=await readAssessmentHistory(client,item,()=>true);assert.equal(assessmentIsCurrent(read.rows[0],read.context),false)
 state.rows.length=0;await assert.rejects(settleItemAssessment(client,request,()=>true,true),/facts changed/)
 assert.equal(state.calls.filter(c=>c.method==='POST').length,1)
})
test('foreign owner, unsaved edits, missing counts and failed histories cannot manufacture an assessment',async()=>{
 await assert.rejects(prepareItemAssessment(db({foreignOwner:true}).client,item,advice,audit,()=>true),/owner/)
 await assert.rejects(prepareItemAssessment(db().client,{...item,title:'Unsaved'},advice,audit,()=>true),/catalogue edits/)
 await assert.rejects(readAssessmentHistory(db({missingCount:true}).client,item,()=>true),/history changed/)
 await assert.rejects(readAssessmentHistory(db({denied:true}).client,item,()=>true),/facts could not/)
 await assert.rejects(prepareItemAssessment(db().client,item,advice,audit,()=>false),/no longer selected/)
})
