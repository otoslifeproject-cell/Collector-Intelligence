import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {armyRoles,emptyArmyReport,validArmyReport,parseArmyRecord,projectArmyWorkflows,prepareArmyPlan,prepareArmyEvent,settleArmyRequest,readResearchArmy} from '../src/lib/researchArmy.ts'

const item={id:randomUUID(),owner_id:randomUUID(),item_code:'CI-ARMY-TEST',title:'Synthetic physical object'},hash='a'.repeat(64)
const photo={id:randomUUID(),item_id:item.id,owner_id:item.owner_id,storage_path:item.owner_id+'/original/base.png',file_name:'base.png',position:0}
const context={item_id:item.id,owner_id:item.owner_id,facts_snapshot:{...item},facts_sha256:hash}
const objective='Compare physical features against documentary sources, preserve rivals and actual price bases.'
function plan(){const eventId=randomUUID();return{version:1,kind:'PLAN',eventId,workflowId:eventId,ownerId:item.owner_id,itemId:item.id,factsSha256:hash,role:null,taskId:null,status:'NOT_RUN',createdAt:'2026-10-24T07:00:00.000Z',executorId:item.owner_id,providerAmount:0,providerCalls:0,payload:{objective,photoIds:[photo.id],tasks:armyRoles.map(role=>({role,taskId:randomUUID()}))}}}
function report(overrides={}){return{...emptyArmyReport([photo.id]),categoryIds:['PHOTOGRAPH_EXAM'],question:'Does this exact object show a documented pattern discriminator?',query:'three handles elongated star documentary comparison',summary:'Original profile and base require a direct check; no maker has been authenticated.',unresolvedIssues:'Measurements and each mark remain unconfirmed.',hypotheses:[{candidate:'Documented candidate',status:'UNRESOLVED',reason:'A matching colour alone does not establish pattern or maker.',sourceUrls:['https://example.test/documentary-source']}],...overrides}}
function event(p,kind='START',overrides={}){const role='PHOTO_EXAMINER',start=overrides.start;return{version:1,eventId:randomUUID(),workflowId:p.workflowId,ownerId:item.owner_id,itemId:item.id,factsSha256:hash,kind,role,taskId:p.payload.tasks.find(t=>t.role===role).taskId,status:kind==='START'?'RUNNING':'INCONCLUSIVE',createdAt:kind==='START'?'2026-10-24T07:01:00.000Z':'2026-10-24T07:02:00.000Z',startedAt:start?.startedAt||'2026-10-24T07:01:00.000Z',finishedAt:kind==='START'?null:'2026-10-24T07:02:00.000Z',executorId:item.owner_id,providerAmount:0,providerCalls:0,payload:{report:report(),startEventId:start?.eventId||null},...Object.fromEntries(Object.entries(overrides).filter(([k])=>k!=='start'))}}
function row(r){return{id:r.eventId,owner_id:r.ownerId,mode:'research',model:'NATIVE_MANUAL_WORKFLOW_V1',status:'DRAFT',input_photo_count:r.payload.photoIds?.length??r.payload.report.photoIds.length,user_context:{item_id:r.itemId,research_army_event_id:r.eventId,research_army_workflow_id:r.workflowId},result:{analysis_stage:r.kind==='PLAN'?'ARMY_PLAN':'ARMY_ROLE',research_army_v1:r},created_at:r.createdAt}}
function db(options={}){
 const state={context:structuredClone(context),rows:options.records?.map(row)||[],calls:[],photos:[photo],owner:item.owner_id}
 const client={auth:{getUser:async()=>({data:{user:{id:state.owner}},error:null})},from(table){
  const filters=[];let a=0,b=99,single=false
  const q={select(){return q},eq(k,v){filters.push([k,v]);return q},not(k,_op,_value){filters.push([k,'NOT_NULL']);return q},order(){return q},range(x,y){a=x;b=y;return q},limit(n){b=n-1;return q},abortSignal(){return q},maybeSingle(){single=true;return q},then(resolve,reject){
   state.calls.push({method:'GET',table,filters});let data=table==='item_assessment_context_v1'?[state.context]:table==='items'?[state.context.facts_snapshot]:table==='item_photos'?state.photos:state.rows
   const value=(r,k)=>k.includes('->>')?r[k.split('->>')[0]]?.[k.split('->>')[1]]:r[k]
   data=data.filter(r=>filters.every(([k,v])=>v==='NOT_NULL'?value(r,k)!=null:value(r,k)===v))
   return Promise.resolve({data:single?data[0]||null:data.slice(a,b+1),count:options.missingCount?null:data.length,error:options.denied?{code:'42501'}:null}).then(resolve,reject)
  }};return q
 },rpc(name,body){state.calls.push({method:'POST',name,body});return{abortSignal:async()=>{
   if(options.noCommit)return{error:{message:'Unconfirmed'}}
   const p=state.rows.map(r=>r.result.research_army_v1).find(p=>p.eventId===body.p_workflow_id),kind=body.p_kind
   const start=state.rows.map(r=>r.result.research_army_v1).find(e=>e.eventId===body.p_payload.startEventId)
   const made=kind==='PLAN'?{...plan(),eventId:body.p_event_id,workflowId:body.p_workflow_id,payload:body.p_payload}:event(p,kind,{eventId:body.p_event_id,role:body.p_role,taskId:p.payload.tasks.find(t=>t.role===body.p_role).taskId,payload:body.p_payload,start})
   made.factsSha256=body.p_expected_facts_sha256;state.rows.push(row(made));if(options.loseAck)throw Error('Synthetic lost acknowledgement');return{data:state.rows.at(-1),error:null}
  }}}
 }
 return{client,state}
}

test('seven workflow roles start NOT_RUN and cannot authenticate a maker or establish a value',()=>{
 const p=plan(),w=projectArmyWorkflows([p],context)[0]
 assert.equal(w.roles.length,7);assert.ok(w.roles.every(r=>r.status==='NOT_RUN'));assert.equal(w.events.length,0)
 assert.equal(w.currentFacts,true);assert.equal(w.recommendation,undefined);assert.equal(w.maker,undefined);assert.equal(w.valuation,undefined)
 assert.ok(!armyRoles.includes('SIGNATURE_READING'));assert.equal(p.providerCalls,0)
})
test('actual manual start, inconclusive result and rejected alternatives survive projection and resume',()=>{
 const p=plan(),s=event(p),r=event(p,'RESULT',{start:s});r.payload.report.hypotheses.push({candidate:'Alternative pattern',status:'REJECTED',reason:'The original handle profile disagrees with this documented alternative.',sourceUrls:['https://example.test/rival']})
 const w=projectArmyWorkflows([p,s,r],context)[0],role=w.roles.find(r=>r.role==='PHOTO_EXAMINER')
 assert.equal(role.status,'INCONCLUSIVE');assert.equal(role.history.length,2);assert.equal(role.latest.payload.report.hypotheses[1].status,'REJECTED');assert.equal(w.roles.find(r=>r.role==='SOURCE_VERIFIER').status,'NOT_RUN')
 assert.ok(w.nextAction.includes('Coordinator'));assert.equal(projectArmyWorkflows([p,s],context)[0].roles.find(r=>r.role==='PHOTO_EXAMINER').status,'RUNNING')
})
test('reported category scope is explicit, deduplicated and never inferred from a role title',()=>{
 assert.equal(validArmyReport(report({categoryIds:[]})),true)
 assert.equal(validArmyReport(report({categoryIds:['SIGNATURE_READING','SIGNATURE_READING']})),false)
 assert.equal(validArmyReport(report({categoryIds:['SOURCE_VERIFIER']})),false)
 assert.equal(validArmyReport(report({outcome:'EVIDENCED'})),false)
})
test('foreign item/photo/task and orphaned or duplicate role receipts fail closed',()=>{
 const p=plan(),s=event(p),r=event(p,'RESULT',{start:s})
 for(const bad of [{...s,itemId:randomUUID()},{...s,taskId:randomUUID()},{...s,payload:{...s.payload,report:report({photoIds:[randomUUID()]})}},{...s,factsSha256:'b'.repeat(64)}])assert.throws(()=>projectArmyWorkflows([p,bad],context))
 assert.throws(()=>projectArmyWorkflows([p,r],context));assert.throws(()=>projectArmyWorkflows([p,s,s],context))
 assert.equal(parseArmyRecord({...row(p),owner_id:randomUUID()},item),null)
})
test('owner or model cannot self-certify EVIDENCED and a withdrawn source anchor blocks current role evidence',()=>{
 const p=plan(),s=event(p),r=event(p,'RESULT',{start:s}),reviewer=randomUUID()
 const att=event(p,'ATTESTATION',{start:s,status:'EVIDENCED',executorId:reviewer,createdAt:'2026-10-24T07:03:00Z',payload:{...r.payload,resultEventId:r.eventId,assessmentId:randomUUID(),reviewerId:reviewer,rationale:'An actual separate reviewer checked these original execution sources against existing qualified evidence.',sourceRefs:['https://example.test/documentary-source']}})
 assert.equal(parseArmyRecord({...row(att),result:{...row(att).result,research_army_v1:{...att,executorId:item.owner_id}}},item),null)
 const historic=parseArmyRecord(row(att),item);assert.equal(historic.status,'EVIDENCED');assert.equal(historic.attestationCurrent,false)
 assert.equal(projectArmyWorkflows([p,s,r,historic],context)[0].roles.find(r=>r.role==='PHOTO_EXAMINER').status,'BLOCKED')
 const qualified=parseArmyRecord({...row(att),army_attestation_current:true},item);assert.equal(projectArmyWorkflows([p,s,r,qualified],context)[0].roles.find(r=>r.role==='PHOTO_EXAMINER').status,'EVIDENCED')
 assert.equal(projectArmyWorkflows([p,s,r,qualified],context)[0].roles.find(r=>r.role==='SELLING_REVIEWER').status,'NOT_RUN')
})
test('Jobling and MEDINA held-out notes preserve uncertainty, separate photos and whole-lot prices without recognition rules',()=>{
 for(const name of ['Jobling2077','Fostoria American2056','Bagley Honeycomb','Jeannette Cube','Davidson Georgian','MEDINA','Mdina','Unlabelled rival']){
  const p=plan();p.payload.objective='Investigate '+name+' from source evidence, not a name-based recognition rule.'
  const s=event(p),r=event(p,'RESULT',{start:s});r.payload.report.summary='Candidate '+name+' remains provisional. £320 is a THREE-piece lot; £38 is FOUR pieces; £58 is an asking price, not a sold comp.'
  const w=projectArmyWorkflows([p,s,r],context)[0];assert.equal(w.roles.find(r=>r.role==='PHOTO_EXAMINER').status,'INCONCLUSIVE');assert.equal(w.expectedNet,undefined);assert.equal(w.identityConfidence,undefined)
 }
 const p=plan(),s=event(p);s.payload.report.categoryIds=['SIGNATURE_READING'];s.payload.report.photoIds=[randomUUID()];assert.throws(()=>projectArmyWorkflows([p,s],context))
})
test('unsafe URL, false costs and source-free synthetic success are rejected',()=>{
 for(const u of ['javascript:alert(1)','http://example.test','https://name:secret@example.test/','https://localhost/base'])assert.equal(validArmyReport(report({sourceUrls:[u]})),false)
 const p=plan();for(const bad of [{...p,providerAmount:10},{...p,providerCalls:1},{...p,status:'EVIDENCED'},{...p,executorId:randomUUID()}])assert.equal(parseArmyRecord(row(bad),item),null)
})
test('frozen plan settles a lost acknowledgement by exact GET and retries without duplicate writes or inference',async()=>{
 const{client,state}=db({loseAck:true}),request=await prepareArmyPlan(client,item,[photo.id],objective,()=>true)
 assert.ok(Object.isFrozen(request.payload.tasks));assert.equal(await settleArmyRequest(client,request,()=>true,false),null)
 const saved=await settleArmyRequest(client,request,()=>true,true);assert.equal(saved.kind,'PLAN');assert.equal((await settleArmyRequest(client,request,()=>true,true)).eventId,saved.eventId)
 assert.equal(state.calls.filter(c=>c.method==='POST').length,1);assert.equal(state.calls.find(c=>c.method==='POST').name,'ci_record_research_army_event_v1')
 assert.ok(state.calls.filter(c=>c.method==='GET'&&c.table==='research_army_receipts_v1').length>=3);assert.equal(state.rows.length,1)
 const history=await readResearchArmy(client,item,()=>true);assert.equal(history.workflows.length,1);assert.equal(history.photos[0].id,photo.id)
})
test('manual role result requires a recorded start and held work is not overwritten by another event',async()=>{
 const p=plan(),{client,state}=db({records:[p]}),w=projectArmyWorkflows([p],context)[0]
 await assert.rejects(()=>prepareArmyEvent(client,item,w,'PHOTO_EXAMINER','RESULT',report(),()=>true),/recorded manual start/)
 const request=await prepareArmyEvent(client,item,w,'PHOTO_EXAMINER','START',report(),()=>true),start=await settleArmyRequest(client,request,()=>true,true)
 const running=projectArmyWorkflows([p,start],context)[0];await assert.rejects(()=>prepareArmyEvent(client,item,running,'PHOTO_EXAMINER','START',report(),()=>true),/Resume/)
 const finish=await prepareArmyEvent(client,item,running,'PHOTO_EXAMINER','RESULT',report(),()=>true);await settleArmyRequest(client,finish,()=>true,true)
 assert.equal(state.rows.length,3);const conflicts={...request,payload:{...request.payload,report:report({query:'different immutable query'})}};await assert.rejects(()=>settleArmyRequest(client,conflicts,()=>true,true),/different immutable/)
})
test('old facts retain history but block new work; foreign or incompletely read histories never become empty progress',async()=>{
 const p=plan(),{client,state}=db({records:[p]}),request=await prepareArmyPlan(client,item,[photo.id],objective,()=>true)
 state.context.facts_sha256='b'.repeat(64);assert.equal(projectArmyWorkflows([p],state.context)[0].currentFacts,false)
 await assert.rejects(()=>settleArmyRequest(client,request,()=>true,true),/facts changed/);assert.equal(state.calls.filter(c=>c.method==='POST').length,0)
 const other=db({records:[p],missingCount:true});await assert.rejects(()=>readResearchArmy(other.client,item,()=>true),/incomplete|verified/)
 state.owner=randomUUID();await assert.rejects(()=>readResearchArmy(client,item,()=>true),/owner/)
})
test('more than one page of saved workflows remains recoverable and account cancellation blocks writes',async()=>{
 const records=Array.from({length:101},()=>plan()),{client,state}=db({records}),h=await readResearchArmy(client,item,()=>true)
 assert.equal(h.workflows.length,101);assert.ok(state.calls.filter(c=>c.table==='research_army_receipts_v1').length>=2)
 await assert.rejects(()=>prepareArmyPlan(client,item,[photo.id],objective,()=>false),/no longer selected/);assert.equal(state.calls.filter(c=>c.method==='POST').length,0)
})
test('superseded starts/results cannot be reordered into later native verification',()=>{
 const p=plan(),s=event(p),r=event(p,'RESULT',{start:s}),s2=event(p,'START',{createdAt:'2026-10-24T07:03:00Z',startedAt:'2026-10-24T07:03:00Z'})
 const old=event(p,'RESULT',{start:s,createdAt:'2026-10-24T07:04:00Z'})
 assert.throws(()=>projectArmyWorkflows([p,s,r,s2,old],context),/latest actual/)
 const reviewer=randomUUID(),att={...old,kind:'ATTESTATION',status:'EVIDENCED',executorId:reviewer,payload:{...r.payload,resultEventId:r.eventId,assessmentId:randomUUID(),reviewerId:reviewer,rationale:'The separate reviewer cannot attest old work while a newer actual role execution is running.',sourceRefs:['https://example.test/documentary-source']}}
 assert.throws(()=>projectArmyWorkflows([p,s,r,s2,att],context),/latest actual/)
})
test('invalid held payload cannot post even if all outer event UUIDs look valid',async()=>{
 const{client,state}=db(),request=await prepareArmyPlan(client,item,[photo.id],objective,()=>true)
 for(const bad of [{...request,kind:'ATTESTATION'},{...request,payload:null},{...request,role:'PHOTO_EXAMINER'},{...request,kind:'START',role:'PHOTO_EXAMINER',payload:{report:report({categoryIds:['SOURCE_VERIFIER']}),startEventId:null}}])await assert.rejects(settleArmyRequest(client,bad,()=>true,true),/invalid/)
 assert.equal(state.calls.filter(c=>c.method==='POST').length,0)
})
