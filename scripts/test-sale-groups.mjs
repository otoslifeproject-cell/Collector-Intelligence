// Reused by the guarded disposable Auth/PostgREST/Storage harness, after the
// real reviewed-item qualification fixtures and sale-groups.sql are installed.
// All objects and source assertions are SYNTHETIC; no provider or production I/O.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {seedReviewedAssessmentFixture} from './test-reviewed-item-assessments.mjs';
import {prepareSaleGroupRevision,prepareSaleGroupEvent,settleSaleGroupRequest,readSaleGroups} from '../src/lib/lotOptimizer.ts';
export async function exerciseSaleGroups({admin,rest,check,A,B,anon,API,key,sdk,storageClient,credentials={email:'collector-ci-a@example.test',password:'Ci-disposable-fixture-4826!'}}){
 const one=await seedReviewedAssessmentFixture(admin,A.id,{client:storageClient,title:'SYNTHETIC lot member one'}),two=await seedReviewedAssessmentFixture(admin,A.id,{client:storageClient,title:'SYNTHETIC lot member two'});
 const inventory=[one,two],groupId=randomUUID();
 const draft=(id=groupId,members=inventory)=>({format:'collector-sale-group-v1',ownerId:A.id,groupId:id,revision:1,title:'Synthetic provisional lot',relation:'THEMED_CURATED',members:members.map(f=>({itemId:f.item.id,photoIds:[f.photo.id]})),rationale:'Synthetic shared collection theme only; this is not evidence of a matching original set.',sourceRefs:[],uncertainty:'Maker and original-set relationships remain unasserted.',plans:[]});
 const rpc=(token,request)=>rest(token,'rpc/'+request.rpc,{method:'POST',body:JSON.stringify(request.args)});
 const event=async(row,kind,payload)=>prepareSaleGroupEvent(sdk,row,kind,payload,()=>true);
 const actual=(itemId)=>rest(A.token,'rpc/ci_record_actual_sale_v1',{method:'POST',body:JSON.stringify({p_item_id:itemId,p_client_event_id:randomUUID(),p_sale:{owner_confirmed:true,sale_date:new Date().toISOString().slice(0,10),gross_sale:100,currency:'GBP',venue:'SYNTHETIC independent sale route',platform_fees:0,payment_fees:0,packing_cost:0,shipping_cost:0,insurance_cost:0,source_reference:'SYNTHETIC not real sale',notes:'Disposable exclusivity check'}})});
 const approve={ownerConfirmed:true,rationale:'Synthetic owner plan reservation only; independently reviewed member decisions are checked by the server.'};
 let request,first,other,approved;
 await check('lot draft pins exact originals and evidence graph; GET-only check does not write',async()=>{
  request=await prepareSaleGroupRevision(sdk,draft(),()=>true);assert.ok(Object.isFrozen(request.args.p_group.members));assert.equal(await settleSaleGroupRequest(sdk,request,()=>true,false),null);
  assert.equal((await admin.query('select count(*)::int n from sale_group_revisions where group_id=$1',[groupId])).rows[0].n,0);
 });
 await check('lot committed save survives actual lost acknowledgement and same-event retry',async()=>{
  let writes=0;const loss=createClient(API,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:async(url,init)=>{const r=await fetch(url,init);if(String(url).includes('/rpc/ci_save_sale_group_revision_v1')){writes++;assert.equal(r.status,200,await r.clone().text());throw Error('Synthetic response lost after actual commit');}return r;}}});
  assert.equal((await loss.auth.signInWithPassword(credentials)).error,null);
  first=await settleSaleGroupRequest(loss,request,()=>true,true);assert.equal(first.group_id,groupId);assert.equal((await settleSaleGroupRequest(loss,request,()=>true,true)).id,first.id);assert.equal(writes,1);
  const overlap=await prepareSaleGroupRevision(sdk,draft(randomUUID()),()=>true);other=await settleSaleGroupRequest(sdk,overlap,()=>true,true);assert.notEqual(other.group_id,first.group_id);
 });
 await check('lot same-event concurrent saves produce one immutable revision',async()=>{
  const r=await prepareSaleGroupRevision(sdk,draft(randomUUID()),()=>true),responses=await Promise.all(Array.from({length:6},()=>rpc(A.token,r))),ids=[];
  for(const response of responses){assert.equal(response.status,200,await response.clone().text());const body=await response.json();ids.push((Array.isArray(body)?body[0]:body).id)}assert.equal(new Set(ids).size,1);
  const conflict={...r,args:{...r.args,p_group:{...r.args.p_group,title:'Cannot replace this event'}}};assert.equal((await rpc(A.token,conflict)).status,400);
 });
 await check('lot owner/anonymous isolation and append-only history survive direct REST attempts',async()=>{
  for(const token of [B.token,anon])assert.ok([400,401,403].includes((await rpc(token,request)).status));
  for(const table of ['sale_group_revisions','sale_group_events','active_item_sale_claims_v1']){const r=await rest(B.token,table+'?owner_id=eq.'+A.id);assert.equal(r.status,200);assert.deepEqual(await r.json(),[])}
  for(const method of ['PATCH','DELETE'])assert.equal((await rest(A.token,'sale_group_revisions?id=eq.'+first.id,{method,...(method==='PATCH'?{body:JSON.stringify({revision:99})}:{})})).status,403);
  assert.equal((await rest(A.token,'sale_group_revisions',{method:'POST',body:JSON.stringify({...first,id:randomUUID()})})).status,403);
  assert.equal((await rest(A.token,'active_item_sale_claims_v1',{method:'POST',body:JSON.stringify({owner_id:A.id,item_id:one.item.id,source_kind:'GROUP',source_id:first.id,state:'RESERVED'})})).status,403);
 });
 await check('server rejects cross-item photos, duplicate members and invented expected graph',async()=>{
  for(const change of [g=>({...g,members:[{...g.members[0],photoIds:[two.photo.id]}]}),g=>({...g,members:[g.members[0],g.members[0]]})]){
   const g=change(draft(randomUUID())),r=await prepareSaleGroupRevision(sdk,g,()=>true);assert.equal((await rpc(A.token,r)).status,400);
  }
  const r=await prepareSaleGroupRevision(sdk,draft(randomUUID()),()=>true);const invalid={...r,args:{...r.args,p_expected_graphs:{...r.args.p_expected_graphs,[one.item.id]:'0'.repeat(64)}}};assert.equal((await rpc(A.token,invalid)).status,400);
 });
 await check('approved owner plan reserves every physical object atomically and conflicts with group and individual sales',async()=>{
  const r=await event(first,'APPROVE',approve),responses=await Promise.all(Array.from({length:6},()=>rpc(A.token,r))),ids=[];
  for(const response of responses){assert.equal(response.status,200,await response.clone().text());const body=await response.json();ids.push((Array.isArray(body)?body[0]:body).id)}assert.equal(new Set(ids).size,1);approved=await settleSaleGroupRequest(sdk,r,()=>true,false);
  assert.equal((await readSaleGroups(sdk,()=>true)).claims.filter(c=>c.source_id===first.id).length,2);
  assert.equal((await rpc(A.token,await event(other,'APPROVE',approve))).status,400);
  const listing=await rest(A.token,'listings',{method:'POST',body:JSON.stringify({owner_id:A.id,item_id:one.item.id,platform:'eBay',listing_status:'READY'})});assert.equal(listing.status,400);
  assert.equal((await actual(one.item.id)).status,400);assert.equal((await admin.query('select count(*)::int n from sale_outcomes where item_id=$1',[one.item.id])).rows[0].n,0);
  const malformed=await event(first,'APPROVE',{...approve,ownerConfirmed:'true'});assert.equal((await rpc(A.token,malformed)).status,400);
 });
 await check('release keeps history and permits a different overlapping owner plan without altering originals',async()=>{
  await settleSaleGroupRequest(sdk,await event(first,'RELEASE',{reason:'Synthetic switch to another provisional strategy'}),()=>true,true);
  await settleSaleGroupRequest(sdk,await event(other,'APPROVE',approve),()=>true,true);
  assert.equal((await readSaleGroups(sdk,()=>true)).claims.filter(c=>c.source_id===other.id).length,2);
  assert.equal((await admin.query('select count(*)::int n from item_photos where id=any($1::uuid[])',[[one.photo.id,two.photo.id]])).rows[0].n,2);
  await settleSaleGroupRequest(sdk,await event(other,'RELEASE',{reason:'Synthetic release before individual route test'}),()=>true,true);
 });
 await check('individual READY listing excludes overlapping group and second active individual listing',async()=>{
  const r=await rest(A.token,'listings',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({owner_id:A.id,item_id:one.item.id,platform:'eBay',listing_status:'READY'})});assert.equal(r.status,201,await r.clone().text());const listing=(await r.json())[0];
  assert.equal((await rpc(A.token,await event(first,'APPROVE',approve))).status,400);
  assert.equal((await rest(A.token,'listings',{method:'POST',body:JSON.stringify({owner_id:A.id,item_id:one.item.id,platform:'Local collection',listing_status:'READY'})})).status,400);
  assert.equal((await rest(A.token,'listings?id=eq.'+listing.id,{method:'PATCH',body:JSON.stringify({listing_status:'PAUSED'})})).status,204);
  await settleSaleGroupRequest(sdk,await event(first,'APPROVE',approve),()=>true,true);
 });
 await check('whole-lot SOLD retains one total, forbids component allocation and marks members sold without individual prices',async()=>{
  const base={ownerConfirmed:true,currency:'GBP',grossTotal:120,sourceReference:'SYNTHETIC paid whole-lot receipt; not a real sale'};
  for(const bad of [{...base,componentPrices:{[one.item.id]:60}},{...base,perPiece:60},{...base,currency:'USD'}])assert.equal((await rpc(A.token,await event(first,'SOLD',bad))).status,400);
  const sold=await settleSaleGroupRequest(sdk,await event(first,'SOLD',base),()=>true,true);assert.equal(sold.payload.grossTotal,120);
  assert.deepEqual((await admin.query('select distinct status from items where id=any($1::uuid[])',[inventory.map(f=>f.item.id)])).rows.map(x=>x.status),['SOLD']);
  assert.equal((await readSaleGroups(sdk,()=>true)).claims.filter(c=>c.source_id===first.id&&c.state==='SOLD').length,2);
  assert.equal((await admin.query('select count(*)::int n from sale_outcomes where item_id=any($1::uuid[])',[inventory.map(f=>f.item.id)])).rows[0].n,0);
 });
 await check('individual SOLD status keeps an exclusive claim and cannot be reopened or deleted',async()=>{
  const f=await seedReviewedAssessmentFixture(admin,A.id,{client:storageClient,title:'SYNTHETIC individually sold claim'}),r=await rest(A.token,'listings',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({owner_id:A.id,item_id:f.item.id,platform:'eBay',listing_status:'SOLD'})});assert.equal(r.status,201,await r.clone().text());const listing=(await r.json())[0];
  assert.equal((await actual(f.item.id)).status,400);
  for(const method of ['PATCH','DELETE'])assert.equal((await rest(A.token,'listings?id=eq.'+listing.id,{method,...(method==='PATCH'?{body:JSON.stringify({listing_status:'DRAFT'})}:{})})).status,method==='DELETE'?403:400);
  assert.equal((await admin.query('select listing_status from public.listings where id=$1',[listing.id])).rows[0].listing_status,'SOLD');
  assert.equal((await admin.query('select state from ci_sale_private.active_item_sale_claims where owner_id=$1 and item_id=$2',[A.id,f.item.id])).rows[0].state,'SOLD');
  const held=await prepareSaleGroupRevision(sdk,draft(randomUUID(),[f]),()=>true),row=await settleSaleGroupRequest(sdk,held,()=>true,true);assert.equal((await rpc(A.token,await event(row,'APPROVE',approve))).status,400);
 });
 await check('individual outcome and group approval races serialize to exactly one physical sale route',async()=>{
  const f=await seedReviewedAssessmentFixture(admin,A.id,{client:storageClient,title:'SYNTHETIC outcome race'}),request=await prepareSaleGroupRevision(sdk,draft(randomUUID(),[f]),()=>true),row=await settleSaleGroupRequest(sdk,request,()=>true,true),approval=await event(row,'APPROVE',approve);
  const responses=await Promise.all([actual(f.item.id),rpc(A.token,approval)]);assert.deepEqual(responses.map(r=>r.status).sort(),[200,400]);
  const outcomes=(await admin.query('select count(*)::int n from sale_outcomes where item_id=$1',[f.item.id])).rows[0].n;if(outcomes===1){assert.equal((await rpc(A.token,await event(row,'SOLD',{ownerConfirmed:true,currency:'GBP',grossTotal:100,sourceReference:'Synthetic impossible double sale'}))).status,400)}else{assert.equal((await actual(f.item.id)).status,400)}
 });
 await check('changed evidence makes a saved group ineligible for reservation; history remains intact',async()=>{
  const fresh=await seedReviewedAssessmentFixture(admin,A.id,{client:storageClient,title:'SYNTHETIC stale lot fixture'}),g=draft(randomUUID(),[fresh]);const held=await prepareSaleGroupRevision(sdk,g,()=>true),row=await settleSaleGroupRequest(sdk,held,()=>true,true);
  assert.equal((await rest(A.token,'items?id=eq.'+fresh.item.id,{method:'PATCH',body:JSON.stringify({condition_summary:'Synthetic newly discovered damage; earlier group is stale'})})).status,204);
  assert.equal((await rpc(A.token,await event(row,'APPROVE',approve))).status,400);assert.equal((await settleSaleGroupRequest(sdk,held,()=>true,false)).id,row.id);
 });
}
