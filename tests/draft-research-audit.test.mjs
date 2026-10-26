import assert from 'node:assert/strict'
import {test} from 'node:test'
import {draftResearchDashboard,draftSignatureAssessment} from '../src/lib/draftResearchAudit.ts'
const object=(index)=>({working_title:'Original object '+index,image_indices:[index],identification_confidence:30+index,dating_confidence:20,valuation_confidence:10})
const source=(extra={})=>({id:'report-1',owner_id:'owner-1',mode:'batch',status:'DRAFT',created_at:'2026-10-23T10:00:00Z',input_photo_count:2,owner_review_revision:0,user_context:{},result:{analysis_stage:'COMPLETE',objects:[object(0),object(1)],...extra}})
const row=(index,extra={})=>({id:'research-'+index,owner_id:'owner-1',mode:'research',model:'saved-model',created_at:'2026-10-23T10:10:00Z',user_context:{source_analysis_run_id:'report-1',source_object_index:index,pair_source_indices:[]},result:{analysis_stage:'COMPLETE',research_summary:'Historical provisional result',comparables:[]},...extra})
const mark=(refs)=>({mark_visible:true,candidate_transcription:'MEDINA?',transcription_confidence:78,attribution_confidence:99,evidence_image_indices:refs})
const signature=(dashboard)=>dashboard.audit.receipts.find(r=>r.type==='SIGNATURE_READING')

test('batch dashboard retains only exact original object research and its own model confidence',()=>{
 const d=draftResearchDashboard(source(),[row(0),row(1)],1)
 assert.deepEqual(d.history.runs.map(r=>r.id),['research-1']);assert.equal(d.confidence.identification,31);assert.equal(d.audit.complete,0)
})
test('older completed work survives newer staged request and chronology is deterministic',()=>{
 const d=draftResearchDashboard(source(),[row(0,{id:'old',created_at:'2026-10-21T10:00:00Z'}),row(0,{id:'staged',result:{analysis_stage:'STAGED'}})],0)
 assert.deepEqual(d.history.runs.map(r=>r.id),['staged','old']);assert.equal(d.audit.complete,0);assert.match(d.audit.receipts.find(r=>r.type==='MAKER_ARCHIVE').detail,/provisional/)
})
test('historical report without category receipts is not work never attempted',()=>{
 const d=draftResearchDashboard(source(),[],0)
 assert.equal(d.audit.receipts.find(r=>r.type==='AUCTION_REALISED').status,'RECEIPT_MISSING');assert.equal(d.audit.complete,0)
})
test('explicitly untriggered inscription is not run when there is no later research',()=>{
 assert.equal(signature(draftResearchDashboard(source({inscription_review_status:'NOT_TRIGGERED'}),[],0)).status,'NOT_RUN')
})
test('one exclusively assigned source image permits only candidate transcription confidence',()=>{
 const d=draftResearchDashboard(source({inscription_review:mark([1])}),[],1)
 assert.equal(d.signature.assigned,true);assert.equal(d.signature.candidate,'MEDINA?');assert.equal(signature(d).confidence,78);assert.equal(d.confidence.identification,31);assert.equal(signature(d).status,'INCONCLUSIVE')
})
test('single-object inscription does not bleed into sibling dashboard',()=>{
 const d=draftResearchDashboard(source({inscription_review:mark([1])}),[],0)
 assert.equal(d.signature.assigned,false);assert.equal(d.signature.candidate,null);assert.equal(signature(d).confidence,null);assert.equal(signature(d).status,'RECEIPT_MISSING')
})
test('global review touching two physical pieces remains unassigned for both',()=>{
 const s=source({inscription_review:mark([0,1])})
 for(const i of [0,1]){const d=draftResearchDashboard(s,[],i);assert.equal(d.signature.assigned,false);assert.equal(d.signature.candidate,null);assert.equal(signature(d).status,'RECEIPT_MISSING')}
})
test('a shared pair photograph cannot assign its global reading to either piece',()=>{
 const s=source({objects:[{...object(0),image_indices:[0,2]},{...object(1),image_indices:[1,2]}],inscription_review:mark([2])})
 for(const i of [0,1])assert.equal(draftSignatureAssessment(s,i).assigned,false)
})
test('invalid or absent inscription evidence indices never produce a scoped reading',()=>{
 for(const refs of [[],[-1],[9],['1'],null])assert.equal(draftSignatureAssessment(source({inscription_review:mark(refs)}),1).assigned,false)
})
test('invalid confidence is not coerced and maker confidence never substitutes for reading',()=>{
 for(const transcription_confidence of [-1,101,'90',Infinity,null]){
  const s=source({inscription_review:{...mark([1]),transcription_confidence}})
  assert.equal(draftSignatureAssessment(s,1).confidence,null)
 }
})
test('original object mark note alone is preserved as unverified with no invented reading score',()=>{
 const s=source({objects:[{...object(0),marks_signatures_labels:'Owner reading MEDINA'},object(1)]})
 const d=draftResearchDashboard(s,[],0);assert.equal(d.signature.candidate,null);assert.equal(signature(d).confidence,null);assert.match(d.signature.detail,/original object notes|Original object notes/)
})
test('pair market execution remains lot-level and never authenticates its physical pieces',()=>{
 const s={...source({inscription_review:mark([0,1])}),mode:'single'}
 const pair=row(0,{id:'pair',user_context:{source_analysis_run_id:s.id,source_object_index:0,pair_source_indices:[0,1]}})
 const lot=draftResearchDashboard(s,[pair,row(0),row(1)],0,true)
 assert.deepEqual(lot.history.runs.map(r=>r.id),['pair']);assert.equal(lot.confidence,undefined);assert.equal(lot.signature.assigned,false)
 for(const i of [0,1])assert.deepEqual(draftResearchDashboard(s,[pair,row(0),row(1)],i).history.runs.map(r=>r.id),['research-'+i])
})
test('history failure blocks categories and retains previous stored execution records',()=>{
 const d=draftResearchDashboard(source(),[row(0)],0,false,'History read failed')
 assert.equal(d.history.runs.length,1);assert.ok(d.audit.receipts.every(r=>r.status==='BLOCKED'));assert.equal(d.audit.complete,0)
})
test('cross-owner or cross-report records never become scoped evidence',()=>{
 for(const foreign of [row(0,{owner_id:'other-owner'}),row(0,{user_context:{source_analysis_run_id:'other-report',source_object_index:0}})]){
  const d=draftResearchDashboard(source(),[foreign],0);assert.equal(d.history.runs.length,0);assert.ok(d.audit.receipts.every(r=>r.status==='BLOCKED'))
 }
})
test('invalid object or pair scope fails closed instead of showing sibling progress',()=>{
 for(const [i,pair] of [[-1,false],[2,false],[1,true],[0,true]]){
  const d=draftResearchDashboard(source(),[row(0),row(1)],i,pair);assert.ok(d.audit.receipts.every(r=>r.status==='BLOCKED'))
 }
})
test('processing execution can be shown as in progress only for its exact scope',()=>{
 const now=Date.parse('2026-10-23T10:11:00Z'),processing=row(1,{result:{analysis_stage:'PROCESSING',claimed_at:'2026-10-23T10:10:00Z'}})
 const d=draftResearchDashboard(source(),[processing],1,false,'',now)
 assert.ok(d.audit.receipts.some(r=>r.status==='RUNNING'));assert.ok(!draftResearchDashboard(source(),[processing],0,false,'',now).audit.receipts.some(r=>r.status==='RUNNING'))
})
test('model-generated completion array never creates verified category completion',()=>{
 const r=row(0,{result:{analysis_stage:'COMPLETE',research_summary:'provisional',research_execution_receipts:[{type:'MAKER_ARCHIVE',status:'DONE_EVIDENCED',runId:'fake',checkedAt:'2026-10-23',sourceRefs:['fake']}]}})
 assert.equal(draftResearchDashboard(source(),[r],0).audit.complete,0)
})
test('deriving a dashboard preserves original global review and historical input bytes',()=>{
 const s=source({inscription_review:mark([0,1])}),rows=[row(1),row(0)],before=JSON.stringify({s,rows})
 draftResearchDashboard(s,rows,0);assert.equal(JSON.stringify({s,rows}),before)
})
