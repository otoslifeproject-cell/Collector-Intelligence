// Additive to existing guarded disposable Auth/REST/Storage harness. All source
// claims are labelled SYNTHETIC; no live object or sale is certified by fixtures.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {seedReviewedAssessmentFixture} from './test-reviewed-item-assessments.mjs';
import {readLotEvidence} from '../src/lib/lotEvidence.ts';
import {emptyLotCosts,prepareSaleGroupRevision,prepareSaleGroupEvent,settleSaleGroupRequest} from '../src/lib/lotOptimizer.ts';

export async function installLotEvidenceFixtures(admin,read){await admin.query(await read('supabase/proposals/lot-comparable-composition.sql'));}
async function reviewer(admin,actor,fn){await admin.query('BEGIN');try{await admin.query('SET LOCAL ROLE ci_item_assessment_reviewer');await admin.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[actor]);const r=await fn(admin);await admin.query('COMMIT');return r;}catch(e){await admin.query('ROLLBACK');throw e}}
async function snapshotHash(admin,owner,comp,composition){
 await admin.query('BEGIN');try{await admin.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[owner]);const r=(await admin.query("SELECT encode(sha256(convert_to(public.ci_lot_evidence_snapshot_v1($1,$2,$3)::text,'UTF8')),'hex') digest",[owner,comp,composition])).rows[0].digest;await admin.query('COMMIT');return r}catch(e){await admin.query('ROLLBACK');throw e}
}
export async function recordLotCompositionFixture(admin,owner,comp,composition,actor,{decision='CONFIRMED',event=randomUUID(),rationale='SYNTHETIC distinct authorised reviewer inspected the original published whole-lot composition and its exact target physical comparison. No real source or object is authenticated.'}={}){
 const digest=await snapshotHash(admin,owner,comp,composition);
 return reviewer(admin,actor,async db=>(await db.query('SELECT * FROM ci_private.record_lot_composition_review_v1($1,$2,$3,$4,$5,$6,$7)',[owner,comp,event,decision,composition,rationale,digest])).rows[0]);
}
export async function seedLotEvidenceFixture(admin,owner,{client,title='SYNTHETIC reviewed lot evidence fixture',quantity=3}={}){
 assert.ok(Number.isInteger(quantity)&&quantity>=2&&quantity<=5,'Bounded synthetic collection only');const members=[];
 for(let i=0;i<quantity;i++)members.push(await seedReviewedAssessmentFixture(admin,owner,{client,title:title+' member '+(i+1)}));
 const composition=(targets,relationship)=>({quantity:targets.length,targetItemIds:targets.map(f=>f.item.id),relationship,members:targets.map((f,i)=>({description:'SYNTHETIC exact original sale component '+(i+1)+' for '+f.item.item_code,condition:'SYNTHETIC condition inspected in original source photograph and compared with this target.',makerConfidence:'SYNTHETIC attribution remains explicitly bounded; reading and authentication are separate.'}))});
 const sources=[],soloSourceIds=[];
 for(const member of members){sources.push(await recordLotCompositionFixture(admin,owner,member.comps[0].id,composition([member],'SINGLE_OBJECT'),member.actor));soloSourceIds.push(member.comps[0].id)}
 const groupSourceId=members[0].comps[1].id;sources.push(await recordLotCompositionFixture(admin,owner,groupSourceId,composition(members,'THEMED_CURATED'),members[0].actor));
 return {members,sources,groupSourceId,soloSourceIds,composition};
}

export async function exerciseLotEvidence({admin,rest,check,A,B,anon,sdk,storageClient}){
 let fixture,history,group;
 await check('whole-lot evidence uses current existing achieved-source qualification plus private exact composition',async()=>{
  fixture=await seedLotEvidenceFixture(admin,A.id,{client:storageClient,title:'SYNTHETIC source composition HTTP acceptance',quantity:2});history=await readLotEvidence(sdk,()=>true);group=history.comparables.find(c=>c.id===fixture.groupSourceId);assert.ok(group);assert.equal(group.quantity,2);assert.equal(group.totalPrice,100);assert.equal(group.unitPrice,null);assert.equal(group.compositionReviewId,fixture.sources.at(-1).id);assert.deepEqual([...group.targetItemIds].sort(),fixture.members.map(f=>f.item.id).sort());assert.equal(group.compositionRelationship,'THEMED_CURATED');
 });
 await check('composition sources and immutable history survive reload without unit allocations',async()=>{
  const resumed=await readLotEvidence(sdk,()=>true);assert.equal(resumed.comparables.find(c=>c.id===group.id).compositionReviewId,group.compositionReviewId);assert.ok(resumed.reviews.some(r=>r.id===group.compositionReviewId));assert.ok(resumed.comparables.every(c=>c.unitPrice===null));
 });
 await check('owner/anonymous cannot manufacture composition review and foreign account cannot read it',async()=>{
  const row=fixture.sources[0];for(const token of [A.token,B.token,anon])assert.ok((await rest(token,'rpc/record_lot_composition_review_v1',{method:'POST',body:'{}'})).status>=400);
  for(const table of ['trusted_lot_comparables_v1','comparable_lot_composition_reviews']){const r=await rest(B.token,table+'?owner_id=eq.'+A.id);assert.equal(r.status,200);assert.deepEqual(await r.json(),[])}
  assert.equal((await rest(A.token,'comparable_lot_composition_reviews',{method:'POST',body:JSON.stringify({...row,id:randomUUID(),reviewer_id:A.id})})).status,403);
  for(const method of ['PATCH','DELETE'])assert.equal((await rest(A.token,'comparable_lot_composition_reviews?id=eq.'+row.id,{method,...(method==='PATCH'?{body:JSON.stringify({decision:'CONFIRMED'})}:{})})).status,403);
  for(const role of ['authenticated','anon','service_role'])assert.equal((await admin.query("SELECT has_function_privilege($1,'ci_private.record_lot_composition_review_v1(uuid,uuid,uuid,text,jsonb,text,text)','EXECUTE') allowed",[role])).rows[0].allowed,false);
 });
 await check('private composition rejects self-review, incomplete components, foreign target mapping and stale source digest',async()=>{
  const original=fixture.sources.at(-1);await assert.rejects(recordLotCompositionFixture(admin,A.id,group.id,original.composition,A.id),/Distinct independently/);
  for(const bad of [{...original.composition,members:[original.composition.members[0]]},{...original.composition,targetItemIds:[fixture.members[0].item.id,randomUUID()]},{...original.composition,targetItemIds:[fixture.members[0].item.id,fixture.members[0].item.id]}])await assert.rejects(recordLotCompositionFixture(admin,A.id,group.id,bad,fixture.members[0].actor),/Current independently/);
  await assert.rejects(reviewer(admin,fixture.members[0].actor,db=>db.query('SELECT * FROM ci_private.record_lot_composition_review_v1($1,$2,$3,$4,$5,$6,$7)',[A.id,group.id,randomUUID(),'CONFIRMED',original.composition,original.rationale,'0'.repeat(64)])),/Current independently/);
 });
 await check('server source eligibility checks exact immutable source pins and the same physical portfolio',async()=>{
  const line={itemIds:group.targetItemIds,comparableId:group.id,compositionReviewId:group.compositionReviewId,sourceSnapshotSha256:group.sourceSnapshotSha256},plan={currency:'GBP',lines:[line]};
  const rpc=async p=>{const r=await sdk.rpc('ci_lot_plan_sources_current_v1',{p_owner:A.id,p_plan:p});assert.equal(r.error,null);return r.data};assert.equal(await rpc(plan),true);assert.equal(await rpc({...plan,lines:[{...line,itemIds:[fixture.members[0].item.id]}]}),false);assert.equal(await rpc({...plan,lines:[{...line,compositionReviewId:randomUUID()}]}),false);
 });
 await check('commercial group reservation accepts current exact reviewed plan and rejects forged pins or portfolio',async()=>{
  const members=fixture.members,ids=members.map(f=>f.item.id),planId=randomUUID(),line={id:randomUUID(),itemIds:ids,groupId:null,venue:'SYNTHETIC comparison only',comparableId:group.id,compositionReviewId:group.compositionReviewId,sourceSnapshotSha256:group.sourceSnapshotSha256,priceAdjustment:'SYNTHETIC exact reviewed physical composition and full original condition comparison; no real sale is proposed.',grossLow:100,grossHigh:100,grossBasis:'SELLER_GROSS',costs:Object.fromEntries(Object.keys(emptyLotCosts()).map(k=>[k,0])),saleProbability:1,daysLow:1,daysHigh:14,workHours:1,feeSource:'https://example.test/synthetic/fees',eligibilitySource:'https://example.test/synthetic/eligibility',checkedAt:new Date().toISOString().slice(0,10),shippingInstructions:'SYNTHETIC insured local collection by arrangement.'};
  const draft=(editPlan=p=>p)=>{const groupId=randomUUID();return {format:'collector-sale-group-v1',ownerId:A.id,groupId,revision:1,title:'SYNTHETIC source-pinned commercial plan',relation:'THEMED_CURATED',members:members.map(f=>({itemId:f.item.id,photoIds:[f.photo.id]})),rationale:'SYNTHETIC exact physical target portfolio; no original matched-set claim or live marketplace publication.',sourceRefs:[group.sourceUrl],uncertainty:'SYNTHETIC disposable evidence only; actual objects and sale source are not certified.',plans:[editPlan({id:planId,strategy:'CURATED_BUNDLES',objective:'FAST_CASH',currency:'GBP',itemIds:ids,lines:[{...line,groupId}]})]}};
  const save=async value=>settleSaleGroupRequest(sdk,await prepareSaleGroupRevision(sdk,value,()=>true),()=>true,true),approve=async row=>prepareSaleGroupEvent(sdk,row,'APPROVE',{ownerConfirmed:true,rationale:'SYNTHETIC explicit owner approval of current reviewed source-pinned exact physical plan only.',planId},()=>true);
  const valid=await save(draft());await settleSaleGroupRequest(sdk,await approve(valid),()=>true,true);await settleSaleGroupRequest(sdk,await prepareSaleGroupEvent(sdk,valid,'RELEASE',{reason:'SYNTHETIC release after exact source-pinned reservation test.'},()=>true),()=>true,true);
  for(const edit of [p=>({...p,lines:[{...p.lines[0],compositionReviewId:randomUUID()}]}),p=>({...p,itemIds:[ids[0]]})]){const row=await save(draft(edit)),r=await approve(row),response=await rest(A.token,'rpc/'+r.rpc,{method:'POST',body:JSON.stringify(r.args)});assert.equal(response.status,400,await response.clone().text())}
  const pending=await save(draft());await recordLotCompositionFixture(admin,A.id,group.id,{},members[0].actor,{decision:'WITHDRAWN',rationale:'SYNTHETIC deliberate independent composition withdrawal between saved draft and commercial reservation.'});const stale=await approve(pending),blocked=await rest(A.token,'rpc/'+stale.rpc,{method:'POST',body:JSON.stringify(stale.args)});assert.equal(blocked.status,400,await blocked.clone().text());
  // Restore the deliberate fixture source with a NEW independent review; old
  // saved source pins remain stale and history remains append-only.
  const restored=await recordLotCompositionFixture(admin,A.id,group.id,fixture.sources.at(-1).composition,members[0].actor);history=await readLotEvidence(sdk,()=>true);group=history.comparables.find(c=>c.id===group.id);assert.equal(group.compositionReviewId,restored.id);
 });
 await check('source amount edits revoke composition without rewriting the verified whole-lot total or history',async()=>{
  const comp=fixture.members[0].comps[0];assert.ok((await readLotEvidence(sdk,()=>true)).qualifiedComparableIds.includes(comp.id));await admin.query('UPDATE public.comparables SET price=101 WHERE id=$1',[comp.id]);const next=await readLotEvidence(sdk,()=>true);assert.ok(!next.qualifiedComparableIds.includes(comp.id));assert.ok(next.reviews.some(r=>r.comparable_id===comp.id&&r.source_snapshot.source.comparable.price===100));await admin.query('UPDATE public.comparables SET price=100 WHERE id=$1',[comp.id]);assert.ok((await readLotEvidence(sdk,()=>true)).qualifiedComparableIds.includes(comp.id));
 });
 await check('changed exact target facts revoke composition applicability while preserving old review',async()=>{
  const member=fixture.members[1];await admin.query("UPDATE public.items SET condition_summary='SYNTHETIC new observed chip requires target comparison again' WHERE id=$1",[member.item.id]);const next=await readLotEvidence(sdk,()=>true);assert.ok(!next.qualifiedComparableIds.includes(group.id));assert.ok(next.reviews.some(r=>r.id===group.compositionReviewId));
 });
 await check('newer independently fetched source withdrawal revokes whole-lot eligibility, not merely a price edit',async()=>{
  const comp=fixture.members[0].comps[0],prior=(await admin.query('SELECT * FROM public.comparable_source_checks WHERE comparable_id=$1 ORDER BY checked_at DESC,id DESC LIMIT 1',[comp.id])).rows[0];
  assert.ok((await readLotEvidence(sdk,()=>true)).qualifiedComparableIds.includes(comp.id));
  await admin.query("INSERT INTO public.comparable_source_checks(owner_id,comparable_id,source_url,fetch_status,source_publisher,original_lot_reference,observed_result,observed_amount,observed_currency,evidence_quote,archive_reference,snapshot_sha256,verification_method,verification_decision,checked_at) VALUES($1,$2,$3,'FETCHED','SYNTHETIC source withdrawal',$4,'UNKNOWN',null,'GBP','SYNTHETIC newer original source no longer confirms a sold amount',$5,$6,'INDEPENDENT_FETCH','REVIEW_REQUIRED',clock_timestamp()+interval '1 second')",[A.id,comp.id,prior.source_url,prior.original_lot_reference,'SYNTHETIC-RETRACTION-'+randomUUID(),'d'.repeat(64)]);
  const next=await readLotEvidence(sdk,()=>true);assert.ok(!next.qualifiedComparableIds.includes(comp.id));assert.ok(next.reviews.some(r=>r.comparable_id===comp.id));
 });
 await check('independent composition withdrawal is append-only and cannot be replaced by an owner flag',async()=>{
  const comp=fixture.members[1].comps[0];await recordLotCompositionFixture(admin,A.id,comp.id,{},fixture.members[1].actor,{decision:'WITHDRAWN',rationale:'SYNTHETIC independent composition comparison withdrawn after new physical condition evidence; retain all prior records.'});const next=await readLotEvidence(sdk,()=>true);assert.ok(!next.qualifiedComparableIds.includes(comp.id));assert.equal(next.reviews.filter(r=>r.comparable_id===comp.id).length,2);
 });
}
