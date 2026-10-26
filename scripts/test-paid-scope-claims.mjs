// Regression cases specified by independent state QA role D; real disposable REST.
import assert from 'node:assert/strict';
export async function exercisePaidScopeClaims({admin,rest,check,A,B,anon}){
 const post=(token,path,body)=>rest(token,path,{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(body)});
 const insert=async(table,body,token=A.token)=>{const r=await post(token,table,body);assert.equal(r.status,201,await r.clone().text());return(await r.json())[0]};
 const item=()=>insert('items',{title:'Independent QA scope fixture'});
 const stage=context=>insert('ai_analysis_runs',{mode:'research',model:'NO_PROVIDER_FIXTURE',input_photo_count:0,user_context:context,result:{analysis_stage:'STAGED'}});
 const claim=(id,token=A.token)=>post(token,'rpc/ci_claim_scoped_paid_research_v1',{p_run_id:id});
 const race=async rows=>{const replies=await Promise.all(rows.map(r=>claim(r.id)));for(const r of replies)assert.ok([200,400].includes(r.status),await r.clone().text());return replies.filter(r=>r.status===200).length};
 const target=await item();let winner;
 await check('independent staged IDs for one physical item allow exactly one concurrent paid claim',async()=>{
  const attempts=await Promise.all(Array.from({length:8},()=>stage({item_id:target.id})));assert.equal(await race(attempts),1);
  const rows=(await admin.query('select * from public.ai_analysis_runs where id=any($1::uuid[])',[attempts.map(r=>r.id)])).rows;assert.equal(rows.filter(r=>r.result.analysis_stage==='PROCESSING').length,1);winner=rows.find(r=>r.result.analysis_stage==='PROCESSING');
 });
 await check('independent other physical item remains available while earlier item processes',async()=>{const other=await item(),run=await stage({item_id:other.id});assert.equal((await claim(run.id)).status,200)});
 await check('foreign and anonymous claims neither reveal nor consume owned staged work',async()=>{const other=await item(),run=await stage({item_id:other.id});for(const token of[B.token,anon])assert.ok([400,401,403].includes((await claim(run.id,token)).status));assert.equal((await admin.query('select result from public.ai_analysis_runs where id=$1',[run.id])).rows[0].result.analysis_stage,'STAGED')});
 const source=await insert('ai_analysis_runs',{mode:'batch',model:'NO_PROVIDER_FIXTURE',input_photo_count:2,result:{analysis_stage:'COMPLETE',objects:[{image_indices:[0]},{image_indices:[1]}]}});
 await check('separate original batch pieces have independent paid scopes',async()=>{const runs=await Promise.all([0,1].map(index=>stage({source_analysis_run_id:source.id,source_object_index:index,pair_source_indices:[]})));assert.equal(await race(runs),2)});
 await check('pair order and original/member aliases cannot cause duplicate charging',async()=>{
  const s=await insert('ai_analysis_runs',{mode:'single',model:'NO_PROVIDER_FIXTURE',input_photo_count:2,result:{analysis_stage:'COMPLETE',objects:[{},{}]}});
  const runs=[];for(const pair of[[0,1],[1,0],[0,1]])runs.push(await stage({source_analysis_run_id:s.id,source_object_index:0,pair_source_indices:pair}));assert.equal(await race(runs),1);
  const member=await stage({source_analysis_run_id:s.id,source_object_index:1,pair_source_indices:[]});assert.equal((await claim(member.id)).status,400);
 });
 await check('catalogue and original object aliases share a claim scope',async()=>{
  const linked=await insert('items',{source_analysis_run_id:source.id,source_object_index:0});const run=await stage({item_id:linked.id});assert.equal((await claim(run.id)).status,400);
 });
 await check('complete replay preserves original result while new source request is processing',async()=>{
  await admin.query("update public.ai_analysis_runs set result=jsonb_build_object('analysis_stage','COMPLETE','research_summary','Preserved fixture') where id=$1",[winner.id]);const next=await stage({item_id:target.id});assert.equal((await claim(next.id)).status,200);const r=await claim(winner.id);assert.equal(r.status,200);assert.equal(await r.json(),'COMPLETE');
 });
 for(const index of[-1,2])await check('invalid physical source index is refused: '+index,async()=>{const run=await stage({source_analysis_run_id:source.id,source_object_index:index,pair_source_indices:[]});assert.equal((await claim(run.id)).status,400)});
}
