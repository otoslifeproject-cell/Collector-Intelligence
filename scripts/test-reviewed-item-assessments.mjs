// Guarded disposable integration support. All source claims below are SYNTHETIC.
// Genuine existing independent-source view/constraints are installed; no live source
// or private business record is certified by these tests. No production entry point.
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {assertIsolatedDatabaseConfig} from './validate-staging-target.mjs';
import {auditResearch,researchTypes} from '../src/lib/researchSaleDecision.ts';
import {readReviewedAssessment,reviewedAudit,reviewedDecision} from '../src/lib/reviewedAssessment.ts';
import {assessSaleScenario,emptySaleScenario} from '../src/lib/sellFastPlan.ts';

export async function installReviewedAssessmentFixtures(admin,read){
 // Replace the deliberately empty old context fixture with the actual checked-in
 // comparable evidence/source gates. Do so BEFORE review graph functions depend on it.
 await admin.query('DROP VIEW public.trusted_comparables_v1');
 for(const name of ['20261010_trusted_comparables_evidence_review_v1.sql','20261011_comparable_review_promotion_trigger_v1.sql',
  '20261011_comparable_review_amount_snapshot_v3.sql','20261011_comparable_nonnull_source_match_fix_v4.sql',
  '20261011_comparable_original_source_checks_v1.sql','20261011_trusted_comparables_independent_source_gate_v5.sql','20261012_source_checks_archive_unique_v1.sql'])
  await admin.query(await read('supabase/migrations/'+name));
 await admin.query('GRANT SELECT ON public.comparables,public.comparable_evidence_reviews,public.comparable_source_checks,public.trusted_comparables_v1 TO authenticated; GRANT INSERT ON public.comparable_source_checks TO authenticated');
 await admin.query(await read('supabase/proposals/reviewed-item-assessments.sql'));
}

async function asReviewer(admin,actor,fn){
 await admin.query('BEGIN');
 try{
  await admin.query('SET LOCAL ROLE ci_item_assessment_reviewer');
  await admin.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[actor]);
  const r=await fn(admin);await admin.query('COMMIT');return r;
 }catch(e){await admin.query('ROLLBACK');throw e;}
}
// On an unexpected fixture failure, surface the exact validator branch or SQL
// error in the isolated test DB. The production validator remains fail-closed.
async function diagnoseReviewedFixture(admin,owner,item,payload,actor){
 const original=(await admin.query("SELECT pg_get_functiondef('public.ci_reviewed_item_payload_valid_v1(uuid,uuid,jsonb)'::regprocedure) definition")).rows[0].definition;
 let branch=0;const definition=original.replace('public.ci_reviewed_item_payload_valid_v1(', 'ci_private.ci_reviewed_item_fixture_diagnostic_v1(')
  .replace('exception when others then return false;', 'exception when others then raise;')
  .replaceAll('return false;',()=>`raise exception 'DISPOSABLE_REVIEW_VALIDATOR_BRANCH_${++branch}';`);
 await admin.query(definition);await admin.query('REVOKE ALL ON FUNCTION ci_private.ci_reviewed_item_fixture_diagnostic_v1(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role');
 try{
  const diagnostic={...payload,reviewerId:actor,verificationMethod:'INDEPENDENT_SOURCE_REVIEW'};
  const graph=(await admin.query("SELECT encode(sha256(convert_to(public.ci_item_review_graph_v1($1,$2)::text,'UTF8')),'hex') digest",[owner,item])).rows[0].digest;
  diagnostic.sourceGraphSha256=graph;
  const result=(await admin.query('SELECT ci_private.ci_reviewed_item_fixture_diagnostic_v1($1,$2,$3) valid',[owner,item,diagnostic])).rows[0].valid;
  return 'validator='+result;
 }catch(error){return error.message;}finally{await admin.query('DROP FUNCTION ci_private.ci_reviewed_item_fixture_diagnostic_v1(uuid,uuid,jsonb)');}
}
export async function seedReviewedAssessmentFixture(admin,owner,{client,title='Synthetic reviewed acceptance fixture'}={}){
 const actor=(await admin.query('SELECT id FROM auth.users WHERE id<>$1 ORDER BY id LIMIT 1',[owner])).rows[0]?.id;
 assert.ok(actor,'Independent disposable reviewer fixture required');
 const item=(await admin.query("INSERT INTO public.items(owner_id,title,currency,material,object_type,condition_summary) VALUES($1,$2,'GBP','Glass','Vase','Synthetic condition inspected; not a real object') RETURNING to_jsonb(items) item",[owner,title])).rows[0].item;
 const path=`${owner}/reviewed-fixture/${randomUUID()}/original.png`;
 // When the genuine Storage service is present upload actual fixture bytes.
 // The HTTP-only harness instead uses its existing explicit metadata stand-in.
 const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9XsAAAAASUVORK5CYII=','base64');
 if(client){const up=await client.storage.from('item-images').upload(path,bytes,{contentType:'image/png'});assert.equal(up.error,null);}
 else await admin.query("INSERT INTO storage.objects(bucket_id,name) VALUES('item-images',$1)",[path]);
 const photo=(await admin.query("INSERT INTO public.item_photos(owner_id,item_id,storage_path,file_name,photo_role) VALUES($1,$2,$3,'synthetic-original.png','Synthetic original fixture') RETURNING *",[owner,item.id,path])).rows[0];
 const evidence=(await admin.query("INSERT INTO public.item_evidence(owner_id,item_id,claim,provenance,source_reference,source_url,verification_status) VALUES($1,$2,'Synthetic independent documentary and fee inspection fixture','DOCUMENTARY_SOURCE','SYNTHETIC reviewed source','https://example.test/synthetic/document','UNVERIFIED') RETURNING *",[owner,item.id])).rows[0];
 const comps=[];
 for(const [kind,result] of [['HAMMER_REALIZED','HAMMER'],['MARKETPLACE_SOLD','MARKETPLACE_SOLD']]){
  const ref='SYNTHETIC-'+randomUUID(),url='https://example.test/synthetic/'+ref;
  const comp=(await admin.query("INSERT INTO public.comparables(owner_id,item_id,venue,source_reference,source_url,sale_date,price_type,price,currency,description,comparability_grade,verification_status) VALUES($1,$2,'Synthetic venue',$3,$4,current_date-1,$5,100,'GBP','Synthetic achieved sale for integration only','HIGH','UNVERIFIED') RETURNING to_jsonb(comparables) comp",[owner,item.id,ref,url,kind])).rows[0].comp;
  await admin.query("INSERT INTO public.comparable_evidence_reviews(owner_id,comparable_id,reviewer_id,decision,result_observed,original_lot_url,original_lot_reference,sale_date_checked,evidence_explanation,reviewed_price,reviewed_currency,reviewed_price_type) VALUES($1,$2,$3,'APPROVED',$4,$5,$6,current_date,'SYNTHETIC independent test review; no live sale was verified',100,'GBP',$7)",[owner,comp.id,actor,result==='MARKETPLACE_SOLD'?'CONFIRMED_MARKETPLACE_SOLD':result,url,ref,kind]);
  await admin.query("INSERT INTO public.comparable_source_checks(owner_id,comparable_id,source_url,fetch_status,source_publisher,original_lot_reference,observed_result,observed_amount,observed_currency,evidence_quote,archive_reference,snapshot_sha256,verification_method,verification_decision) VALUES($1,$2,$3,'FETCHED','SYNTHETIC example.test',$4,$5,100,'GBP','SYNTHETIC fixture observed amount: GBP100',$6,$7,'INDEPENDENT_FETCH','SOURCE_CONFIRMED')",[owner,comp.id,url,ref,result,'SYNTHETIC-ARCHIVE-'+randomUUID(),createHash('sha256').update(ref).digest('hex')]);
  await admin.query("UPDATE public.comparables SET verification_status='VERIFIED_DIRECT' WHERE id=$1",[comp.id]);comps.push({...comp,verification_status:'VERIFIED_DIRECT'});
 }
 const anchors=[];
 for(const [kind,id] of [['PHOTO',photo.id],['EVIDENCE',evidence.id],...comps.map(c=>['COMPARABLE',c.id])])anchors.push((await admin.query('SELECT public.ci_item_review_anchor_v1($1,$2,$3,$4) anchor',[owner,item.id,kind,id])).rows[0].anchor);
 const checks=[];
 for(const id of researchTypes){
  const run=(await admin.query("INSERT INTO public.ai_analysis_runs(owner_id,mode,model,user_context,result) VALUES($1,'research','SYNTHETIC independent review fixture',$2,$3) RETURNING *",[owner,{item_id:item.id,research_category:id},{analysis_stage:'COMPLETE',research_summary:'SYNTHETIC actual stored category execution; not live research'}])).rows[0];
  const refs=['PHOTOGRAPH_EXAM','SIGNATURE_READING','CONDITION_REVIEW'].includes(id)?[path]:id==='AUCTION_REALISED'?[comps[0].source_url]:id==='MARKETPLACE_SOLD'?[comps[1].source_url]:[evidence.source_url];
  checks.push({id,status:'COMPLETE',sourceRefs:refs,executionRef:run.id,checkedAt:new Date().toISOString(),detail:'SYNTHETIC independently reviewed category fixture; actual record, no authentication of a real collectable.',confidence:null});
 }
 const sources=anchors.map(a=>a.reference);
 const payload={decision:'READY_TO_LIST',rationale:'SYNTHETIC comprehensive independent final assessment for disposable acceptance only. No real object has been authenticated or valued.',nextAction:'Inspect the synthetic workflow only.',routeGuidance:'Compare all three synthetic cost scenarios before preparing a draft.',unresolvedIssues:'None in this synthetic fixture; real research is separate.',confidence:{identification:null,dating:null,valuation:null},sourceRefs:sources,
  availabilityScope:{checkIds:[...researchTypes],sourceRefs:sources,rationale:'SYNTHETIC all seven available category executions are included for this disposable fixture. No real source research is asserted.'},availableChecks:checks,evidenceSources:anchors,reviewReference:'SYNTHETIC independent reviewer acceptance record'};
 const context=(await admin.query('SELECT * FROM public.item_assessment_context_v1 WHERE item_id=$1',[item.id])).rows[0];
 const event=randomUUID();
 const append=async(p=payload,e=event)=>asReviewer(admin,actor,async db=>(await db.query('SELECT * FROM ci_private.record_reviewed_item_assessment_v1($1,$2,$3,$4,$5)',[owner,item.id,e,context.facts_sha256,p])).rows[0]);
 let row;try{row=await append();}catch(error){const diagnostic=await diagnoseReviewedFixture(admin,owner,item.id,payload,actor);throw Error('Disposable reviewed fixture append rejected: '+diagnostic,{cause:error});}
 return {item,photo,evidence,comps,anchors,payload,context,event,actor,row,append};
}

export async function exerciseReviewedItemAssessments({admin,rest,check,A,B,anon,API,key,sdk}){
 let fixture;
 await check('independent reviewer append stores current source-backed final decision via existing real comparable gates',async()=>{
  fixture=await seedReviewedAssessmentFixture(admin,A.id);const r=await readReviewedAssessment(sdk,fixture.item,()=>true);assert.equal(r.id,fixture.row.id);assert.equal(r.assessment.verificationMethod,'INDEPENDENT_SOURCE_REVIEW');
  const audit=reviewedAudit(auditResearch([]),r);assert.equal(audit.complete,7);assert.equal(reviewedDecision(r).status,'READY_TO_LIST');
  for(const mode of ['FAST_CASH','BALANCED','MAX_VALUE']){
   const s={...emptySaleScenario(mode,'GBP'),grossLow:100,grossHigh:120,grossBasis:'SELLER_GROSS',priceAdjustment:'Synthetic matching form and condition; reviewed actual gross amount without buyer premium.',feePercent:10,fixedFee:0,packing:5,delivery:10,insurance:1,returnAllowance:0,daysLow:1,daysHigh:14,workHours:1,comparableId:fixture.comps[0].id,feeSource:'https://example.test/synthetic/fees',eligibilitySource:'https://example.test/synthetic/eligibility',checkedAt:new Date().toISOString().slice(0,10),sellerStatus:'PRIVATE',eligibilityConfirmed:true,shippingReviewed:true};
   const review={conditionReviewed:true,comparableReviewed:true,photosReviewed:true,attribution:'GENERIC',makerSource:'',specialistRisk:false,shippingInstructions:'Synthetic insured packing and delivery only.'};
   const result=assessSaleScenario(s,fixture.item,fixture.comps,review,new Date().toISOString().slice(0,10),fixture.comps.map(c=>c.id),{audit,finalDecision:reviewedDecision(r)});assert.equal(result.ready,true,JSON.stringify(result.blockers));assert.equal(result.netLow,74);
  }
 });
 await check('owner/anonymous cannot append positive assessments, grant private review or read another owner projection',async()=>{
  for(const token of [A.token,B.token,anon]){
   const r=await rest(token,'rpc/record_reviewed_item_assessment_v1',{method:'POST',body:JSON.stringify({p_item:fixture.item.id})});assert.ok([400,401,403,404].includes(r.status));
  }
  assert.equal((await rest(B.token,'item_reviewed_assessments_v1?item_id=eq.'+fixture.item.id)).status,200);
  assert.deepEqual(await (await rest(B.token,'item_reviewed_assessments_v1?item_id=eq.'+fixture.item.id)).json(),[]);
  for(const role of ['anon','authenticated','service_role']){assert.equal((await admin.query("SELECT has_function_privilege($1,'ci_private.record_reviewed_item_assessment_v1(uuid,uuid,uuid,text,jsonb)','EXECUTE') ok",[role])).rows[0].ok,false);assert.equal((await admin.query("SELECT has_schema_privilege($1,'ci_private','USAGE') ok",[role])).rows[0].ok,false);assert.equal((await admin.query("SELECT pg_has_role($1,'ci_item_assessment_reviewer','MEMBER') ok",[role])).rows[0].ok,false);}
  const direct=await rest(A.token,'item_research_assessments',{method:'POST',body:JSON.stringify({item_id:fixture.item.id,client_event_id:randomUUID(),decision:'READY_TO_LIST',review_status:'SOURCE_REVIEWED',assessment:fixture.payload,facts_snapshot:fixture.item})});assert.equal(direct.status,403);
 });
 await check('same independent reviewed event is idempotent and conflicting content cannot replace history',async()=>{
  assert.equal((await fixture.append()).id,fixture.row.id);await assert.rejects(fixture.append({...fixture.payload,rationale:fixture.payload.rationale+'Conflicting replacement.'}),/immutable|qualified/);
 });
 for(const [label,edit] of [
  ['unreviewed maker authentication',p=>({...p,makerApproval:{maker:'Mdina',sourceRefs:[p.sourceRefs[0]]}})],
  ['null source anchor',p=>({...p,evidenceSources:[null,...p.evidenceSources.slice(1)]})],
  ['unconfirmed execution',p=>({...p,availableChecks:p.availableChecks.map((c,i)=>i?c:{...c,executionRef:randomUUID()})})],
  ['missing category',p=>({...p,availableChecks:p.availableChecks.slice(1)})],
  ['duplicate category',p=>({...p,availableChecks:p.availableChecks.map(()=>p.availableChecks[0])})],
  ['invented source',p=>({...p,sourceRefs:[...p.sourceRefs,'https://example.test/invented']})],
  ['wrong evidence fingerprint',p=>({...p,evidenceSources:p.evidenceSources.map((a,i)=>i? a:{...a,snapshotSha256:'0'.repeat(64)})})],
  ['unsupported per-piece substitution',p=>({...p,evidenceSources:p.evidenceSources.map((a,i)=>i? a:{...a,id:randomUUID()})})],
 ])await check('private final reviewer rejects '+label,async()=>{await assert.rejects(fixture.append(edit(fixture.payload),randomUUID()),/qualified/);});
 await check('six actual independent reviewer connections converge on one append-only event',async()=>{
  assertIsolatedDatabaseConfig(process.env.CI_STAGING_DATABASE_URL,process.env.CI_ISOLATED_STAGING_CONFIRMED);const {default:pg}=await import('pg');const event=randomUUID();
  const rows=await Promise.all(Array.from({length:6},async()=>{const db=new pg.Client({connectionString:process.env.CI_STAGING_DATABASE_URL,connectionTimeoutMillis:5000});await db.connect();try{return await asReviewer(db,fixture.actor,async c=>(await c.query('SELECT * FROM ci_private.record_reviewed_item_assessment_v1($1,$2,$3,$4,$5)',[A.id,fixture.item.id,event,fixture.context.facts_sha256,fixture.payload])).rows[0]);}finally{await db.end()}}));
  assert.equal(new Set(rows.map(r=>r.id)).size,1);assert.equal((await admin.query('SELECT count(*)::int n FROM public.item_research_assessments WHERE item_id=$1 AND client_event_id=$2',[fixture.item.id,event])).rows[0].n,1);
 });
 await check('new source execution invalidates prior reviewed decision while preserving its immutable history',async()=>{
  await admin.query("INSERT INTO public.ai_analysis_runs(owner_id,mode,model,user_context,result) VALUES($1,'research','SYNTHETIC pending',$2,'{\"analysis_stage\":\"PROCESSING\"}')",[A.id,{item_id:fixture.item.id}]);assert.equal(await readReviewedAssessment(sdk,fixture.item,()=>true),null);assert.equal((await fixture.append()).id,fixture.row.id);
  assert.equal((await admin.query('SELECT count(*)::int n FROM public.item_research_assessments WHERE item_id=$1',[fixture.item.id])).rows[0].n,2);
 });
 await check('source rejection and mutation revoke qualified assessment without deleting previous evidence',async()=>{
  const f=await seedReviewedAssessmentFixture(admin,A.id,{title:'Synthetic source revocation fixture'});assert.ok(await readReviewedAssessment(sdk,f.item,()=>true));
  await admin.query("INSERT INTO public.comparable_source_checks(owner_id,comparable_id,source_url,fetch_status,observed_result,verification_method,verification_decision) VALUES($1,$2,$3,'UNAVAILABLE','UNKNOWN','INDEPENDENT_FETCH','REJECTED')",[A.id,f.comps[0].id,f.comps[0].source_url]);assert.equal(await readReviewedAssessment(sdk,f.item,()=>true),null);
  const q=await seedReviewedAssessmentFixture(admin,A.id,{title:'Synthetic source archive mutation fixture'});await admin.query("UPDATE public.comparable_source_checks SET archive_reference='SYNTHETIC-CHANGED-'||id::text WHERE comparable_id=$1",[q.comps[0].id]);assert.equal((await admin.query('SELECT count(*)::int n FROM public.trusted_comparables_v1 WHERE item_id=$1',[q.item.id])).rows[0].n,2);assert.equal(await readReviewedAssessment(sdk,q.item,()=>true),null);
  const m=await seedReviewedAssessmentFixture(admin,A.id,{title:'Synthetic source mutation fixture'});await admin.query("UPDATE public.item_evidence SET claim='Changed synthetic inspected claim' WHERE id=$1",[m.evidence.id]);assert.equal(await readReviewedAssessment(sdk,m.item,()=>true),null);
 });
 await check('paired-lot positive review is refused until each physical member can be independently certified',async()=>{
  const f=await seedReviewedAssessmentFixture(admin,A.id,{title:'Synthetic paired source scope fixture'});
  const original=(await admin.query("INSERT INTO public.ai_analysis_runs(owner_id,mode,model,status,result) VALUES($1,'batch','SYNTHETIC paired original','APPROVED',$2) RETURNING id",[A.id,{analysis_stage:'COMPLETE',objects:[{image_indices:[0]},{image_indices:[1]}],owner_review:{approved_snapshot:{'0':{pair_source_indices:[0,1]}}}}])).rows[0];
  await admin.query('UPDATE public.items SET source_analysis_run_id=$1,source_object_index=0 WHERE id=$2',[original.id,f.item.id]);const ctx=(await admin.query('SELECT * FROM public.item_assessment_context_v1 WHERE item_id=$1',[f.item.id])).rows[0];
  await assert.rejects(asReviewer(admin,f.actor,db=>db.query('SELECT * FROM ci_private.record_reviewed_item_assessment_v1($1,$2,$3,$4,$5)',[A.id,f.item.id,randomUUID(),ctx.facts_sha256,f.payload])),/qualified/);assert.equal(await readReviewedAssessment(sdk,ctx.facts_snapshot,()=>true),null);
 });
 await check('new owner hold or changed catalogue facts prevents old positive readiness',async()=>{
  const f=await seedReviewedAssessmentFixture(admin,A.id,{title:'Synthetic catalogue mutation fixture'});await admin.query("UPDATE public.items SET condition_summary='New synthetic condition evidence' WHERE id=$1",[f.item.id]);assert.equal(await readReviewedAssessment(sdk,f.item,()=>true),null);
  const h=await seedReviewedAssessmentFixture(admin,A.id,{title:'Synthetic subsequent hold fixture'});const {holdPayload}=await import('../src/lib/itemAssessment.ts');const p=holdPayload({decision:'DO_NOT_LIST_YET',rationale:'New synthetic concern requires renewed independent source inspection before any sale.',unresolvedIssues:'New synthetic concern.',nextAction:'Inspect current synthetic evidence.',routeGuidance:'Do not list this synthetic object.',confidence:{identification:null,dating:null,valuation:null},sourceRefs:[]},auditResearch([]));
  const r=await sdk.rpc('ci_record_item_hold_assessment_v1',{p_item_id:h.item.id,p_client_event_id:randomUUID(),p_expected_facts_sha256:h.context.facts_sha256,p_assessment:p});assert.equal(r.error,null);assert.equal(await readReviewedAssessment(sdk,h.item,()=>true),null);
 });
}
