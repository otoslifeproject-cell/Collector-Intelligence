// Runs only inside the guarded, initially empty loopback Auth/REST test stack.
// Actual original schema/RLS/RPCs; Storage rows are synthetic METADATA ONLY.
import assert from 'node:assert/strict';

export async function exerciseCatalogueApproval({admin,rest,check,A,B,anon,read}){
  const preservedComparables=(await admin.query('select to_jsonb(c) as row from public.comparables c order by id')).rows;
  const originalSQL=await read('supabase/migrations/20261017_reviewed_material_evidence_on_catalogue_v6.sql');
  const proposalSQL=await read('supabase/proposals/catalogue-approval-input-guards.sql');
  const post=(token,path,body)=>rest(token,path,{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(body)});
  const insert=async(token,path,body)=>{const r=await post(token,path,body);assert.equal(r.status,201,await r.clone().text());return (await r.json())[0];};
  const approve=(id,indices=[0],reviews={},token=A.token)=>post(token,'rpc/ci_approve_saved_intake_v1',{p_run_id:id,p_object_indices:indices,p_reviews:reviews});
  const source=async id=>(await admin.query('select * from public.ai_analysis_runs where id=$1',[id])).rows[0];
  const children=async id=>(await admin.query('select * from public.items where source_analysis_run_id=$1 order by source_object_index',[id])).rows;
  const related=async(table,id)=>(await admin.query(`select c.* from public.${table} c join public.items i on i.id=c.item_id where i.source_analysis_run_id=$1 order by c.id`,[id])).rows;
  const state=async id=>({source:await source(id),items:await children(id),photos:await related('item_photos',id),evidence:await related('item_evidence',id),attribution:await related('attribution_history',id),tasks:await related('research_tasks',id)});
  let serial=0;
  const object=(title,indices)=>({working_title:title,material:'Glass',object_type:'Vessel',maker:'Unverified model maker',current_attribution:'Unverified model attribution',period_wording:'Model period',region_country:'Model region',identification_confidence:82,dating_confidence:75,valuation_confidence:65,image_indices:indices,condition_summary:'AI fixture condition',evidence:[{claim:'Glass material claimed by AI',provenance:'INFERENCE',certainty_class:'FACT',stance:'SUPPORTS'}],next_evidence:[{title:'Inspect base',why:'Check construction',information_value:70}],preliminary_value:{currency:'GBP',quick_sale:70,balanced_low:90,balanced_high:120,floor:50,basis:'UNVERIFIED synthetic model estimate'}});
  async function stage({objects,photos=2,mode='single',stage='COMPLETE',owner=A,manifestChange,context={}}={}){
    const folder=`${owner.id}/intake/catalogue-fixture-${++serial}`;
    const manifest=Array.from({length:photos},(_,index)=>({index,storage_path:`${folder}/${index}.jpg`,file_name:`source-${index}.jpg`}));
    for(const image of manifest)await admin.query("insert into storage.objects(bucket_id,name) values('item-images',$1)",[image.storage_path]);
    const result={analysis_stage:stage,objects:objects??[object('Fixture vessel',[0,1])],image_manifest:manifestChange?manifestChange(structuredClone(manifest)):manifest,initial_ai_result:{batch_summary:'Original first-pass snapshot retained'}};
    const run=await insert(owner.token,'ai_analysis_runs',{mode,model:'fixture-intake',input_photo_count:photos,user_context:context,result});
    return {...run,original:structuredClone(result),storage:manifest};
  }
  const metadata=async()=>(await admin.query('select * from storage.objects order by id')).rows;
  const correction=(run,index=null,owner=A)=>insert(owner.token,'ai_verdict_feedback',{source_analysis_run_id:run.id,source_object_index:index,feedback_type:'MATERIAL_CORRECTION',corrected_material:'Metal',owner_statement:'Owner physical observation: this fixture represents metal, not glass.'});
  async function unchangedRejection(run,indices,reviews,status=400,token=A.token){
    const before=await state(run.id),files=await metadata();const r=await approve(run.id,indices,reviews,token);
    assert.equal(r.status,status,await r.clone().text());assert.deepEqual(await state(run.id),before);assert.deepEqual(await metadata(),files);return r;
  }
  async function verifyOriginal(run){
    const saved=await source(run.id);assert.deepEqual(saved.result.objects,run.original.objects);assert.deepEqual(saved.result.image_manifest,run.original.image_manifest);assert.deepEqual(saved.result.initial_ai_result,run.original.initial_ai_result);
    for(const image of run.storage)assert.equal((await admin.query("select count(*)::int n from storage.objects where bucket_id='item-images' and name=$1",[image.storage_path])).rows[0].n,1);
  }

  // Preserve a reproducible before/after receipt. These are original-code defect
  // reproductions in synthetic records, not acceptance of the unsafe behaviour.
  await check('BASELINE original v6 accepts duplicate corrected photo references (defect reproduced)',async()=>{
    const run=await stage();const r=await approve(run.id,[0],{'0':{confirmed_photo_indices:[0,0]}});assert.equal(r.status,200,await r.clone().text());
    const photos=await related('item_photos',run.id);assert.equal(photos.length,2);assert.equal(new Set(photos.map(x=>x.storage_path)).size,1);await verifyOriginal(run);
  });
  await check('BASELINE original v6 ignores malformed extra pair members (defect reproduced)',async()=>{
    const run=await stage({objects:[object('Left member',[0]),object('Right member',[1])]});
    const r=await approve(run.id,[0],{'0':{pair_source_indices:['0','1','ignored-invalid-member']}});assert.equal(r.status,200,await r.clone().text());assert.equal((await children(run.id)).length,1);await verifyOriginal(run);
  });
  await check('BASELINE material contradiction retains superseded model confidence (defect reproduced)',async()=>{
    const run=await stage();await correction(run);const r=await approve(run.id);assert.equal(r.status,200,await r.clone().text());
    const item=(await children(run.id))[0];assert.equal(item.material,'Metal');assert.equal(item.maker,null);assert.equal(item.quick_sale_value,null);assert.equal(item.identification_confidence,82);assert.equal(item.dating_confidence,75);assert.equal(item.valuation_confidence,65);await verifyOriginal(run);
  });
  await admin.query(proposalSQL); // DISPOSABLE only; no data/backfill operation.
  await check('catalogue proposal preserves invoker security grants and original history',async()=>{
    const info=(await admin.query(`select p.prosecdef,p.proconfig,has_function_privilege('authenticated',p.oid,'execute') as owner_execute,has_function_privilege('anon',p.oid,'execute') as anon_execute from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='ci_approve_saved_intake_v1'`)).rows;
    assert.equal(info.length,1);assert.equal(info[0].prosecdef,false);assert.deepEqual(info[0].proconfig,['search_path=pg_catalog, public']);assert.equal(info[0].owner_execute,true);assert.equal(info[0].anon_execute,false);
  });
  const single=await stage({context:{purchase_price:20,currency:'GBP',user_notes:'Owner fixture note'}});
  await check('catalogue approval denies anonymous and other-owner requests without writes',async()=>{
    await unchangedRejection(single,[0],{},401,anon);await unchangedRejection(single,[0],{},400,B.token);
  });
  let singleResult;
  await check('complete single approval preserves original manifest and links exact private source paths',async()=>{
    const files=await metadata();const r=await approve(single.id,[0],{'0':{working_title:'Owner-reviewed fixture',condition_summary:'Owner observed small chip'}});assert.equal(r.status,200,await r.clone().text());singleResult=await r.json();
    assert.equal(singleResult.length,1);const items=await children(single.id);assert.equal(items.length,1);assert.equal(items[0].title,'Owner-reviewed fixture');assert.equal(items[0].condition_summary,'Owner observed small chip');assert.equal(items[0].catalogue_review_status,'OWNER_REVIEWED');assert.equal(items[0].acquisition_price,'20.00');
    const photos=await related('item_photos',single.id);assert.deepEqual(photos.map(x=>x.storage_path).sort(),single.storage.map(x=>x.storage_path).sort());assert.equal(photos.filter(x=>x.is_hero).length,1);assert.equal(photos.find(x=>x.is_hero).position,0);
    const saved=await source(single.id);assert.equal(saved.status,'APPROVED');assert.ok(saved.approved_at);assert.equal(saved.result.owner_review.approved_snapshot['0'].working_title,'Owner-reviewed fixture');await verifyOriginal(single);assert.deepEqual(await metadata(),files);
  });
  await check('identical approval retries return the same IDs without duplicate children or photos',async()=>{
    const before=await state(single.id);const replies=await Promise.all(Array.from({length:4},()=>approve(single.id)));
    for(const r of replies){assert.equal(r.status,200);assert.deepEqual(await r.json(),singleResult);}assert.deepEqual(await state(single.id),before);
  });
  await check('approved selection cannot expand silently to different source objects',async()=>{
    const run=await stage({mode:'batch',objects:[object('Selected sibling',[0]),object('Unselected sibling',[1])]});
    assert.equal((await approve(run.id,[0])).status,200);await unchangedRejection(run,[0,1],{});
  });
  await check('unverified AI evidence is never promoted to verified comparables or Knowledge Brain',async()=>{
    const evidence=await related('item_evidence',single.id);assert.ok(evidence.length);assert.ok(evidence.every(x=>x.verification_status==='UNVERIFIED'));assert.ok(evidence.every(x=>x.provenance==='INFERENCE'));
    assert.deepEqual((await admin.query('select to_jsonb(c) as row from public.comparables c order by id')).rows,preservedComparables);assert.equal((await related('comparables',single.id)).length,0);assert.equal((await admin.query('select count(*)::int n from public.knowledge_records')).rows[0].n,0);
  });
  await check('other-owner catalogue and child queries remain empty under real RLS',async()=>{
    for(const table of ['items','item_photos','item_evidence','attribution_history','research_tasks']){
      const r=await rest(B.token,`${table}?owner_id=eq.${A.id}`);assert.equal(r.status,200);assert.deepEqual(await r.json(),[]);
    }
  });
  await check('eight simultaneous approvals create one catalogue child and reuse its identity',async()=>{
    const run=await stage();const files=await metadata();const replies=await Promise.all(Array.from({length:8},()=>approve(run.id)));
    const results=[];for(const r of replies){assert.equal(r.status,200,await r.clone().text());results.push(await r.json());}
    assert.ok(results.every(x=>JSON.stringify(x)===JSON.stringify(results[0])));assert.equal((await children(run.id)).length,1);assert.equal((await related('item_photos',run.id)).length,2);assert.deepEqual(await metadata(),files);await verifyOriginal(run);
  });
  await check('batch approval keeps non-contiguous photos attached to their original sibling',async()=>{
    const run=await stage({photos:3,mode:'batch',objects:[object('First sibling',[0,2]),object('Second sibling',[1])]});const r=await approve(run.id,[0,1]);assert.equal(r.status,200,await r.clone().text());
    const items=await children(run.id);assert.equal(items.length,2);const photos=await related('item_photos',run.id);
    for(const item of items){const expected=run.original.objects[item.source_object_index].image_indices;const own=photos.filter(p=>p.item_id===item.id);assert.deepEqual(own.map(p=>p.position).sort(),expected);assert.equal(own.filter(p=>p.is_hero).length,1);assert.equal(own.find(p=>p.is_hero).position,Math.min(...expected));}await verifyOriginal(run);
  });
  await check('explicit matched pair creates one lot with both member photo sets and audit snapshot',async()=>{
    const run=await stage({photos:3,objects:[object('Left member',[0,2]),object('Right member',[1,2])]});const r=await approve(run.id,[0],{'0':{pair_source_indices:[0,1],working_title:'Owner reviewed pair'}});assert.equal(r.status,200,await r.clone().text());
    const items=await children(run.id);assert.equal(items.length,1);assert.equal((await related('item_photos',run.id)).length,3);assert.match(items[0].notes,/two separately observed physical pieces/);
    const snapshot=(await source(run.id)).result.owner_review.approved_snapshot['0'];assert.deepEqual(snapshot.pair_source_indices,[0,1]);assert.deepEqual([...snapshot.approved_photo_indices].sort(),[0,1,2]);await verifyOriginal(run);
  });
  await check('invalid model photo index blocks approval until owner confirms an existing original subset',async()=>{
    const run=await stage({objects:[object('Bad model index',[0,1,6])]});await unchangedRejection(run,[0],{});
    const r=await approve(run.id,[0],{'0':{confirmed_photo_indices:[0,1]}});assert.equal(r.status,200,await r.clone().text());
    const snapshot=(await source(run.id)).result.owner_review.approved_snapshot['0'];assert.deepEqual(snapshot.original_model_photo_indices,[0,1,6]);assert.deepEqual(snapshot.approved_photo_indices,[0,1]);assert.equal(snapshot.photo_index_owner_confirmed,true);assert.equal((await related('item_photos',run.id)).length,2);await verifyOriginal(run);
  });
  for(const [name,review] of [
    ['duplicate confirmed photos',{confirmed_photo_indices:[0,0]}],['foreign confirmed photos',{confirmed_photo_indices:[2]}],
    ['fractional confirmed photo',{confirmed_photo_indices:[0.5]}],['string confirmed photo',{confirmed_photo_indices:['0']}],
    ['empty photo correction',{confirmed_photo_indices:[]}],['null photo correction',{confirmed_photo_indices:null}],
    ['extra pair member',{pair_source_indices:[0,1,2]}],['string pair members',{pair_source_indices:['0','1']}],
    ['mixed invalid pair members',{pair_source_indices:[0,1,'ignored']}],['duplicate pair members',{pair_source_indices:[0,0]}],
    ['null pair members',{pair_source_indices:null}]
  ])await check('catalogue proposal rejects '+name+' atomically',async()=>{
    const run=await stage({objects:[object('Left',[0]),object('Right',[1])]});await unchangedRejection(run,[0],{'0':review});
  });
  for(const [name,indices,reviews] of [['empty selected objects',[],{}],['duplicate selected objects',[0,0],{}],['negative selected object',[-1],{}],['out-of-range selected object',[9],{}],['null review',[0],null]])await check('catalogue rejects '+name+' without child records',async()=>{
    const run=await stage();await unchangedRejection(run,indices,reviews);
  });
  await check('duplicate raw model photo indices are rejected without silently dropping history',async()=>{
    const run=await stage({objects:[object('Duplicated model reference',[0,0])]});await unchangedRejection(run,[0],{});
  });
  for(const [name,change] of [
    ['missing source objects',r=>{delete r.objects;}],['non-array source objects',r=>{r.objects={};}],
    ['null source object',r=>{r.objects=[null];}],['missing photo indices',r=>{delete r.objects[0].image_indices;}],
    ['non-array photo indices',r=>{r.objects[0].image_indices='0';}]
  ])await check('catalogue rejects '+name+' while retaining malformed original for inspection',async()=>{
    const run=await stage(),result=structuredClone(run.original);change(result);
    await admin.query('update public.ai_analysis_runs set result=$1 where id=$2',[result,run.id]);await unchangedRejection(run,[0],{});
  });
  await check('duplicate selected manifest index cannot resolve to an ambiguous source photograph',async()=>{
    const run=await stage({manifestChange:m=>m.map(x=>({...x,index:0}))});await unchangedRejection(run,[0],{});
  });
  await check('missing Storage metadata refuses approval and retains the saved original report',async()=>{
    const run=await stage();await admin.query('delete from storage.objects where name=$1',[run.storage[1].storage_path]);await unchangedRejection(run,[0],{});assert.equal((await source(run.id)).status,'DRAFT');
  });
  await check('other-owner Storage path cannot be attached by forging source manifest',async()=>{
    const foreign=await stage({owner:B});const run=await stage({manifestChange:m=>m.map((x,i)=>({...x,storage_path:foreign.storage[i].storage_path}))});await unchangedRejection(run,[0],{});
  });
  for(const stageName of ['STAGED','FIRST_PASS_SAVED','PROCESSING'])await check('partial '+stageName+' analysis rolls back catalogue creation at final status gate',async()=>{
    const run=await stage({stage:stageName});await unchangedRejection(run,[0],{});
    const direct=await rest(A.token,'ai_analysis_runs?id=eq.'+run.id,{method:'PATCH',body:JSON.stringify({status:'APPROVED'})});assert.equal(direct.status,400);assert.equal((await source(run.id)).status,'DRAFT');
  });
  for(const table of ['item_photos','item_evidence','attribution_history','research_tasks'])await check('failed '+table+' insertion rolls back all approval records and preserves source metadata',async()=>{
    const run=await stage();const before=await state(run.id),files=await metadata();await admin.query(`REVOKE INSERT ON public.${table} FROM authenticated`);
    try{const r=await approve(run.id);assert.equal(r.status,403,await r.clone().text());}finally{await admin.query(`GRANT INSERT ON public.${table} TO authenticated`);}
    assert.deepEqual(await state(run.id),before);assert.deepEqual(await metadata(),files);
  });
  await check('later sibling failure rolls back an earlier valid child in the same batch approval',async()=>{
    const run=await stage({mode:'batch',objects:[object('Valid first child',[0]),object('Invalid second child',[7])]});await unchangedRejection(run,[0,1],{});
  });
  await check('material contradiction clears model attribution prices and all three copied confidence scores',async()=>{
    const run=await stage();await correction(run);const files=await metadata();const r=await approve(run.id);assert.equal(r.status,200,await r.clone().text());const item=(await children(run.id))[0];
    assert.equal(item.material,'Metal');assert.equal(item.maker,null);assert.equal(item.period_wording,null);assert.equal(item.region_country,null);assert.equal(item.quick_sale_value,null);assert.equal(item.balanced_value_low,null);assert.equal(item.balanced_value_high,null);assert.equal(item.floor_price,null);
    for(const field of ['identification_confidence','dating_confidence','valuation_confidence'])assert.equal(item[field],null);
    assert.equal(item.status,'RESEARCH');assert.equal(item.sale_readiness,'RESEARCH_FIRST');const evidence=await related('item_evidence',run.id);
    const model=evidence.find(x=>x.provenance==='INFERENCE'),owner=evidence.find(x=>x.provenance==='USER_SUPPLIED_FACT');assert.equal(model.certainty_class,'UNKNOWN');assert.equal(model.stance,'WEAKENS');assert.equal(owner.verification_status,'UNVERIFIED');assert.match(owner.notes,/not independently instrument-tested/);
    assert.ok((await related('attribution_history',run.id)).every(x=>x.confidence===null));assert.equal((await source(run.id)).result.owner_review.approved_snapshot['0'].invalidated_model_attribution_and_prices,true);assert.deepEqual(await metadata(),files);await verifyOriginal(run);
  });
  await check('sibling-specific material correction does not erase another object confidence',async()=>{
    const run=await stage({mode:'batch',objects:[object('First sibling',[0]),object('Second sibling',[1])]});await correction(run,1);const r=await approve(run.id,[0,1]);assert.equal(r.status,200,await r.clone().text());const items=await children(run.id);
    assert.equal(items[0].material,'Glass');assert.equal(items[0].identification_confidence,82);assert.equal(items[1].material,'Metal');assert.equal(items[1].identification_confidence,null);await verifyOriginal(run);
  });
  await check('owner review revision survives catalogue snapshot merge without rewriting edited history',async()=>{
    const run=await stage();const edited=await post(A.token,'rpc/ci_save_owner_review_v1',{p_run_id:run.id,p_expected_revision:0,p_object_changes:{'0':{working_title:'Revision-backed owner title'}}});assert.equal(edited.status,200);
    const r=await approve(run.id);assert.equal(r.status,200,await r.clone().text());const saved=await source(run.id);assert.equal(saved.owner_review_revision,1);assert.equal(saved.result.owner_review.objects['0'].working_title,'Revision-backed owner title');assert.equal((await children(run.id))[0].title,'Revision-backed owner title');await verifyOriginal(run);
  });
  await check('proposal reinstall and reversal preserve approved rows and original Storage metadata',async()=>{
    const before=await state(single.id),files=await metadata();await admin.query(proposalSQL);assert.deepEqual(await state(single.id),before);await admin.query(originalSQL);assert.deepEqual(await state(single.id),before);assert.deepEqual(await metadata(),files);
    await admin.query(proposalSQL);const r=await approve(single.id);assert.equal(r.status,200);assert.deepEqual(await r.json(),singleResult);assert.deepEqual(await state(single.id),before);assert.deepEqual(await metadata(),files);
  });
}
