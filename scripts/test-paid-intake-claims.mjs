// Real disposable Postgres/Auth/PostgREST receipt tests. Never uses paid provider.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
export async function exercisePaidIntakeClaims({admin,rest,check,A,B,anon}){
 const head={Prefer:'return=representation'};
 const sha='e'.repeat(64);
 const staged=async(hash=sha)=>{
  const id=randomUUID();
  const path=A.id+'/intake/'+id+'/00-original.png';
  const r=await rest(A.token,'ai_analysis_runs',{method:'POST',headers:head,body:JSON.stringify({
   id,mode:'single',model:'FIXTURE_NO_PROVIDER',status:'DRAFT',input_photo_count:1,
   user_context:{user_notes:'Immutable owner note'},
   result:{analysis_stage:'UPLOADED',image_manifest:[{index:0,file_name:'original.png',storage_path:path,sha256:hash,byte_count:100}]}
  })});
  assert.equal(r.status,201,await r.clone().text());return id;
 };
 const snapshot=async id=>{
  const found=(await admin.query('select mode,input_photo_count,user_context,result from public.ai_analysis_runs where id=$1',[id])).rows[0];
  assert.ok(found);
  return {p_expected_manifest:found.result.image_manifest,
    p_expected_context:found.user_context,p_expected_mode:found.mode,
    p_expected_photo_count:found.input_photo_count};
 };
 const claim=async(id,token=A.token,expected=null)=>rest(token,'rpc/ci_claim_intake_paid_v1',{
  method:'POST',body:JSON.stringify({p_run_id:id,...(expected??await snapshot(id))})
 });
 await check('protected intake claim permits ONE winner across eight concurrent sessions with same original digest',async()=>{
  const runs=await Promise.all(Array.from({length:8},()=>staged()));
  const results=await Promise.all(runs.map(id=>claim(id)));
  const success=results.filter(r=>r.status===200);assert.equal(success.length,1,JSON.stringify(await Promise.all(results.map(r=>r.clone().text()))));
  assert.equal(await success[0].json(),'CLAIMED');
  assert.ok(results.filter(r=>r.status!==200).every(r=>r.status===400));
  const rows=(await admin.query('select run_id,owner_id,photo_hashes,original_context from public.ci_paid_intake_claims_v1')).rows;
  assert.equal(rows.length,1);assert.equal(rows[0].owner_id,A.id);
  assert.deepEqual(rows[0].photo_hashes,[sha]);
  assert.equal(rows[0].original_context.user_notes,'Immutable owner note');
 });
 await check('owner cannot PATCH or DELETE immutable paid claim receipt',async()=>{
  const count=Number((await admin.query('select count(*) n from public.ci_paid_intake_claims_v1')).rows[0].n);
  const update=await rest(A.token,'ci_paid_intake_claims_v1?owner_id=eq.'+A.id,{method:'PATCH',body:JSON.stringify({photo_hashes:[]})});
  const removal=await rest(A.token,'ci_paid_intake_claims_v1?owner_id=eq.'+A.id,{method:'DELETE'});
  assert.ok([401,403,405].includes(update.status),await update.clone().text());
  assert.ok([401,403,405].includes(removal.status),await removal.clone().text());
  assert.equal(Number((await admin.query('select count(*) n from public.ci_paid_intake_claims_v1')).rows[0].n),count);
 });
 await check('client can mutate/deactivate original staging without deleting the protected billing receipt',async()=>{
  const one=(await admin.query('select run_id from public.ci_paid_intake_claims_v1 limit 1')).rows[0].run_id;
  const changed=await rest(A.token,'ai_analysis_runs?id=eq.'+one,{method:'PATCH',body:JSON.stringify({result:{analysis_stage:'UPLOADED',image_manifest:[]}})});
  assert.ok([200,204,400].includes(changed.status));
  assert.equal((await claim(one)).status,400);
  const ledger=(await admin.query('select count(*) n from public.ci_paid_intake_claims_v1 where run_id=$1',[one])).rows[0];
  assert.equal(Number(ledger.n),1);
 });
 await check('foreign owner and anonymous clients cannot read or claim owner receipts',async()=>{
  const one=(await admin.query('select run_id from public.ci_paid_intake_claims_v1 limit 1')).rows[0].run_id;
  const foreign=await rest(B.token,'ci_paid_intake_claims_v1?select=run_id',{method:'GET'});
  assert.equal(foreign.status,200);assert.deepEqual(await foreign.json(),[]);
  for(const token of[B.token,anon]){const attempted=await claim(one,token);assert.ok([400,401,403].includes(attempted.status))}
 });
 await check('different original photo hashes can each be claimed independently',async()=>{
  const other=await staged('f'.repeat(64)),r=await claim(other);
  assert.equal(r.status,200,await r.clone().text());
  assert.equal((await admin.query('select count(*) n from public.ci_paid_intake_claims_v1')).rows[0].n,'2');
 });
 await check('a changed saved photo scope cannot be billed with a stale server-verified snapshot',async()=>{
  const id=await staged('1'.repeat(64)),checked=await snapshot(id);
  const changed=(await admin.query('select result from public.ai_analysis_runs where id=$1',[id])).rows[0].result;
  changed.image_manifest[0].sha256='2'.repeat(64);
  await admin.query('update public.ai_analysis_runs set result=$2 where id=$1',[id,changed]);
  const before=await claim(id,A.token,checked);
  assert.equal(before.status,400,await before.clone().text());
  const record=await admin.query('select run_id from public.ci_paid_intake_claims_v1 where run_id=$1',[id]);
  assert.equal(record.rows.length,0);
  const fresh=await claim(id);
  assert.equal(fresh.status,200,await fresh.clone().text());
  const after=await admin.query('select original_manifest from public.ci_paid_intake_claims_v1 where run_id=$1',[id]);
  assert.equal(after.rows[0].original_manifest[0].sha256,'2'.repeat(64));
 });
 await check('changed owner notes and count fail closed before any claim',async()=>{
  const id=await staged('3'.repeat(64)),checked=await snapshot(id);
  await admin.query("update public.ai_analysis_runs set user_context=jsonb_set(user_context,'{user_notes}',to_jsonb($2::text)) where id=$1",[id,'Changed after validation']);
  const stale=await claim(id,A.token,checked);
  assert.equal(stale.status,400,await stale.clone().text());
  assert.equal((await admin.query('select count(*) n from public.ci_paid_intake_claims_v1 where run_id=$1',[id])).rows[0].n,'0');
  const current=await snapshot(id);
  const wrongCount=await claim(id,A.token,{...current,p_expected_photo_count:2});
  assert.equal(wrongCount.status,400,await wrongCount.clone().text());
  assert.equal((await admin.query('select count(*) n from public.ci_paid_intake_claims_v1 where run_id=$1',[id])).rows[0].n,'0');
 });

}
