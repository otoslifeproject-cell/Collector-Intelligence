import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {itemResearchAudit,readItemResearch,readItemSaleRows} from '../src/lib/itemResearch.ts'
import {researchExecutionReceipt} from '../src/lib/researchExecution.ts'
const owner=randomUUID(),item={id:randomUUID(),owner_id:owner}
const run=(result={},user_context={item_id:item.id})=>({id:randomUUID(),owner_id:owner,mode:'research',status:'DRAFT',model:'fixture',created_at:'2026-10-23T12:00:00Z',input_photo_count:0,user_context,result})
const history=(runs=[],original=null,lineageUnresolved=false)=>({runs,original,paired:false,lineageUnresolved})
const stage=(audit,type)=>audit.receipts.find(r=>r.type===type)
test('empty completely read history distinguishes not run from a stored historical response',()=>{
 assert.ok(itemResearchAudit(history(),[]).receipts.every(r=>r.status==='NOT_RUN'))
 const audit=itemResearchAudit(history([run({analysis_stage:'COMPLETE',research_summary:'Stored old work',identification_update:{}})]),[])
 assert.equal(stage(audit,'MAKER_ARCHIVE').status,'INCONCLUSIVE');assert.equal(stage(audit,'SIGNATURE_READING').status,'RECEIPT_MISSING');assert.equal(audit.complete,0)
})
test('model generated receipt arrays and claimed VERIFIED labels cannot manufacture completed checks',()=>{
 const audit=itemResearchAudit(history([run({analysis_stage:'COMPLETE',research_summary:'AI',research_execution_receipts:[{type:'SIGNATURE_READING',status:'DONE_EVIDENCED',runId:'r',sourceRefs:['made up'],checkedAt:'now'}],comparables:[{price_type:'HAMMER_REALIZED',verification_status:'VERIFIED_DIRECT',source_url:'https://example.org/lot'}]})]),[])
 assert.equal(audit.complete,0);assert.equal(stage(audit,'AUCTION_REALISED').status,'INCONCLUSIVE')
})
test('claimed outcome fresh/stale states remain distinct without allowing paid retries',()=>{
 const row=run({analysis_stage:'PROCESSING',claimed_at:'2026-10-23T12:00:00Z'})
 assert.equal(stage(itemResearchAudit(history([row]),[],Date.parse('2026-10-23T12:05:00Z')),'MAKER_ARCHIVE').status,'RUNNING')
 assert.equal(stage(itemResearchAudit(history([row]),[],Date.parse('2026-10-23T13:00:00Z')),'MAKER_ARCHIVE').status,'BLOCKED')
})
test('unknown original object mapping blocks inheritance instead of claiming never run',()=>{
 assert.ok(itemResearchAudit(history([],run({}),true),[]).receipts.every(r=>r.status==='BLOCKED'))
})
test('trusted sold source review completes only its own category, not maker/condition/whole item',()=>{
 const c={id:randomUUID(),item_id:item.id,venue:'Fixture',sale_date:'2026-09-12',date_checked:'2026-10-23',price_type:'HAMMER_REALIZED',price:50,currency:'GBP',source_url:'https://example.org/lot/1',verification_status:'VERIFIED_DIRECT'}
 const a=itemResearchAudit(history(),[c]);assert.equal(a.complete,1);assert.equal(stage(a,'AUCTION_REALISED').checkedAt,'2026-10-23');assert.equal(stage(a,'MAKER_ARCHIVE').status,'NOT_RUN')
})
test('malformed legacy comparable leads are retained without crashing audit',()=>{
 assert.equal(itemResearchAudit(history([run({analysis_stage:'COMPLETE',research_summary:'Legacy',comparables:[null,42,'text']})]),[]).complete,0)
})
test('server receipt captures actual provider tool metadata and never infers independent source truth',()=>{
 const p={id:'resp-fixture',output:[{type:'web_search_call',id:'tool-1',status:'completed',action:{type:'search',queries:['Mdina signature']}},{type:'message',content:[{type:'output_text',annotations:[{type:'url_citation',url:'https://example.org/source'}]}]}]}
 const r=researchExecutionReceipt(p,'run-fixture','start','finish');assert.equal(r.web_search_calls.length,1);assert.deepEqual(r.citation_urls,['https://example.org/source']);assert.equal(r.independent_source_verification,false);assert.equal(r.category_receipts_available,false)
 assert.equal(researchExecutionReceipt({output_text:'AI says searched'},'r','s','f').web_search_calls.length,0)
})
function client(rows,options={}){
 let authReads=0;const requests=[]
 return {requests,auth:{getUser:async()=>({data:{user:{id:options.switchOwner&&++authReads>1?'other':owner}},error:null})},from(table){
  const filters=[],state={from:0,to:99,single:false};const q={select(){return q},eq(k,v){filters.push([k,v]);return q},order(){return q},range(a,b){state.from=a;state.to=b;return q},abortSignal(){return q},maybeSingle(){state.single=true;return q},then(resolve,reject){
   requests.push({table,filters,range:[state.from,state.to]})
   const selected=rows.filter(r=>filters.every(([k,v])=>k.startsWith('user_context->>')?r.user_context?.[k.slice(15)]===v:r[k]===v))
   const answer={error:options.denied?{message:'Denied'}:null,count:options.missingCount?null:selected.length,data:state.single?selected[0]||null:options.truncated?[]:selected.slice(state.from,state.to+1)}
   return Promise.resolve(answer).then(resolve,reject)
  }};return q
 }}
}
test('owner-scoped stable pagination recovers response older than newest100 and every attempt stage',async()=>{
 const rows=Array.from({length:101},(_,i)=>run({analysis_stage:i===100?'COMPLETE':'STAGED',research_summary:i===100?'Old saved work':undefined}));const db=client(rows)
 const h=await readItemResearch(db,item,()=>true);assert.equal(h.runs.length,101);assert.ok(h.runs.some(r=>r.result.research_summary==='Old saved work'));assert.deepEqual(db.requests.map(r=>r.range),[[0,99],[100,199]])
})
test('count failure, truncated page and account change do not imply empty history',async()=>{
 for(const options of [{missingCount:true},{truncated:true},{denied:true},{switchOwner:true}])await assert.rejects(readItemResearch(client([run({})],options),item,()=>true),/history|selected/)
})
test('original sibling/pair investigations remain separated and unresolved mapping never coerces null to zero',async()=>{
 const parent=run({objects:[{},{}]});parent.mode='batch'
 const a=run({analysis_stage:'COMPLETE'},{source_analysis_run_id:parent.id,source_object_index:0}),b=run({analysis_stage:'COMPLETE'},{source_analysis_run_id:parent.id,source_object_index:1})
 const pair=run({analysis_stage:'COMPLETE'},{source_analysis_run_id:parent.id,source_object_index:0,pair_source_indices:[0,1]})
 const scoped={...item,source_analysis_run_id:parent.id,source_object_index:0}
 assert.deepEqual((await readItemResearch(client([parent,a,b,pair]),scoped,()=>true)).runs.map(r=>r.id),[a.id])
 const unknown=await readItemResearch(client([parent,a,b,pair]),{...scoped,source_object_index:null},()=>true);assert.equal(unknown.lineageUnresolved,true);assert.equal(unknown.runs.length,0)
})
test('source/listing read is counted and fails closed on inaccessible history',async()=>{
 const row={id:randomUUID(),owner_id:owner,item_id:item.id};assert.equal((await readItemSaleRows(client([row]),'listings',item,()=>true)).length,1)
 await assert.rejects(readItemSaleRows(client([row],{denied:true}),'listings',item,()=>true),/could not be verified/)
})
