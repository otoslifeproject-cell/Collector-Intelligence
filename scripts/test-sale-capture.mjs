// Disposable real Auth/REST acceptance only. Synthetic owner-reported sales;
// never a genuine receipt, independently verified comparable or production write.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

export async function exerciseSaleCapture({admin,rest,check,A,B,anon,read}){
 const originalSQL=await read('supabase/migrations/20261017_allow_loss_making_sales_v3.sql');
 const proposalSQL=await read('supabase/proposals/actual-sale-input-guards.sql');
 const post=(token,path,body)=>rest(token,path,{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(body)});
 const insert=async(token,path,body)=>{const r=await post(token,path,body);assert.equal(r.status,201,await r.clone().text());return (await r.json())[0];};
 const item=(values={},owner=A)=>insert(owner.token,'items',{title:'SYNTHETIC SALE ACCEPTANCE ONLY',currency:'GBP',acquisition_currency:'GBP',acquisition_price:20,...values});
 const facts=(values={})=>({owner_confirmed:true,sale_date:'2026-01-15',venue:'SYNTHETIC OWNER SALE',currency:'GBP',gross_sale:100,platform_fees:12,payment_fees:3,shipping_cost:5,packing_cost:2,insurance_cost:0,source_reference:'SYNTHETIC RECEIPT REFERENCE — no actual sale',notes:'Disposable acceptance fixture',...values});
 const record=(id,event,sale,token=A.token)=>post(token,'rpc/ci_record_actual_sale_v1',{p_item_id:id,p_client_event_id:event,p_sale:sale});
 const state=async id=>({item:(await admin.query('select * from public.items where id=$1',[id])).rows[0],sales:(await admin.query('select * from public.sale_outcomes where item_id=$1 order by id',[id])).rows});
 const rejected=async(i,sale,{event=randomUUID(),token=A.token,status=400}={})=>{const before=await state(i.id);const r=await record(i.id,event,sale,token);assert.equal(r.status,status,await r.clone().text());assert.deepEqual(await state(i.id),before);return r;};
 async function race(i,event,sale,count=3){
  await admin.query('BEGIN');await admin.query('select id from public.items where id=$1 for update',[i.id]);
  const calls=Array.from({length:count},()=>record(i.id,event,sale));
  try{
   let blocked=false;
   for(let n=0;n<100;n++){
    await admin.query('select pg_stat_clear_snapshot()');
    const waiters=(await admin.query("select count(*)::int n from pg_stat_activity where pid<>pg_backend_pid() and state='active' and query like '%ci_record_actual_sale_v1%' and cardinality(pg_blocking_pids(pid))>0")).rows[0].n;
    if(waiters>=count){blocked=true;break;}await new Promise(resolve=>setTimeout(resolve,50));
   }
   assert.equal(blocked,true,'Real RPC requests did not reach the held item lock');
  }finally{await admin.query('COMMIT');}
  return Promise.all(calls);
 }
 await check('BASELINE sale v3 accepts NaN fees and stores non-finite net/profit (defect reproduced)',async()=>{
  const i=await item();const r=await record(i.id,randomUUID(),facts({platform_fees:'NaN'}));assert.equal(r.status,200,await r.clone().text());
  const saved=await state(i.id);assert.equal(saved.item.status,'SOLD');assert.equal(saved.sales[0].net_sale_proceeds,'NaN');assert.equal(saved.sales[0].net_profit,'NaN');
 });
 await check('BASELINE sale v3 silently mixes acquisition and sale currencies (defect reproduced)',async()=>{
  const i=await item({currency:'USD',acquisition_currency:'GBP'});const r=await record(i.id,randomUUID(),facts({currency:'USD'}));assert.equal(r.status,200,await r.clone().text());
  const saved=await state(i.id);assert.equal(saved.sales[0].currency,'USD');assert.equal(saved.sales[0].acquisition_cost,'20.00');assert.equal(saved.sales[0].net_profit,'58.00');
 });
 await check('BASELINE sale v3 rounds stored fees separately from its calculated net (defect reproduced)',async()=>{
  const i=await item();const r=await record(i.id,randomUUID(),facts({platform_fees:0.004,payment_fees:0.004,shipping_cost:0.004,packing_cost:0}));assert.equal(r.status,200,await r.clone().text());
  const sale=(await state(i.id)).sales[0];assert.equal(sale.platform_fees,'0.00');assert.equal(sale.payment_fees,'0.00');assert.equal(sale.shipping_subsidy,'0.00');assert.equal(sale.net_sale_proceeds,'99.99');
 });
 await check('BASELINE simultaneous identical sale retries include rejected responses (defect reproduced)',async()=>{
  const i=await item();const replies=await race(i,randomUUID(),facts());assert.equal(replies.filter(r=>r.status===200).length,1);assert.equal(replies.filter(r=>r.status===400).length,2);assert.equal((await state(i.id)).sales.length,1);
 });
 await admin.query(proposalSQL);
 await check('sale candidate retains authenticated invoker function and fixed search path',async()=>{
  const p=(await admin.query("select prosecdef,proconfig,has_function_privilege('anon',oid,'execute') as anon_execute from pg_proc where oid='public.ci_record_actual_sale_v1(uuid,uuid,jsonb)'::regprocedure")).rows[0];assert.equal(p.prosecdef,false);assert.deepEqual(p.proconfig,['search_path=pg_catalog, public']);assert.equal(p.anon_execute,false);
 });
 const owned=await item(),event=randomUUID(),sale=facts();let result;
 await check('sale RPC denies anonymous and other-owner events with no status/outcome changes',async()=>{
  await rejected(owned,sale,{token:anon,status:401});await rejected(owned,sale,{token:B.token});
 });
 await check('actual sale stores gross costs net profit ROI and owner-only source separately',async()=>{
  const r=await record(owned.id,event,sale);assert.equal(r.status,200,await r.clone().text());result=await r.json();assert.equal(result.length,1);
  const saved=await state(owned.id),s=saved.sales[0];assert.equal(saved.item.status,'SOLD');assert.equal(s.gross_sale,'100.00');assert.equal(s.net_sale_proceeds,'78.00');assert.equal(s.net_profit,'58.00');assert.equal(s.return_on_cash,'290.0000');assert.equal(s.provenance_basis,'OWNER_REPORTED_UNVERIFIED');assert.equal(s.source_reference,sale.source_reference);assert.equal(s.owner_notes,sale.notes);assert.match(s.request_fingerprint,/^[a-f0-9]{32}$/);assert.equal(s.valuation_accuracy_notes,null);
 });
 await check('saved sale retry reuses the exact event without changing source or amounts',async()=>{
  const before=await state(owned.id);const r=await record(owned.id,event,sale);assert.equal(r.status,200);assert.deepEqual(await r.json(),result);assert.deepEqual(await state(owned.id),before);
 });
 await check('changed facts with reused sale event cannot overwrite the stored original',async()=>{await rejected(owned,facts({gross_sale:101}),{event});});
 await check('different sale event cannot create another sold outcome for the same item',async()=>{await rejected(owned,sale);});
 await check('same event cannot attach saved facts to a different owned item',async()=>{const i=await item();await rejected(i,sale,{event});});
 await check('simultaneous identical sale requests all return the same one stored identity',async()=>{
  const i=await item();const replies=await race(i,randomUUID(),facts(),4);const bodies=[];for(const r of replies){assert.equal(r.status,200,await r.clone().text());bodies.push(await r.json());}assert.ok(bodies.every(x=>JSON.stringify(x)===JSON.stringify(bodies[0])));assert.equal((await state(i.id)).sales.length,1);
 });
 await check('legitimate loss-making sale preserves negative net profit and ROI',async()=>{
  const i=await item();const r=await record(i.id,randomUUID(),facts({gross_sale:10,platform_fees:12,payment_fees:0,shipping_cost:4,packing_cost:0}));assert.equal(r.status,200);const s=(await state(i.id)).sales[0];assert.equal(s.net_sale_proceeds,'-6.00');assert.equal(s.net_profit,'-26.00');assert.equal(s.return_on_cash,'-130.0000');
 });
 await check('unknown acquisition cost leaves profit and return unknown without inventing zero cost',async()=>{
  const i=await item({acquisition_price:null,all_in_cost:null});const r=await record(i.id,randomUUID(),sale);assert.equal(r.status,200);const s=(await state(i.id)).sales[0];assert.equal(s.net_sale_proceeds,'78.00');assert.equal(s.acquisition_cost,null);assert.equal(s.net_profit,null);assert.equal(s.return_on_cash,null);
 });
 await check('zero known acquisition cost permits profit but leaves division-by-zero ROI unknown',async()=>{
  const i=await item({acquisition_price:0});const r=await record(i.id,randomUUID(),sale);assert.equal(r.status,200);const s=(await state(i.id)).sales[0];assert.equal(s.net_profit,'78.00');assert.equal(s.return_on_cash,null);
 });
 await check('same-currency all-in cost takes precedence over purchase-only cost',async()=>{
  const i=await item({all_in_cost:30});const r=await record(i.id,randomUUID(),sale);assert.equal(r.status,200);assert.equal((await state(i.id)).sales[0].net_profit,'48.00');
 });
 await check('cross-currency fallback is refused until acquisition cost is explicitly supplied in sale currency',async()=>{
  const i=await item({currency:'USD',acquisition_currency:'GBP'});await rejected(i,facts({currency:'USD'}));
  const r=await record(i.id,randomUUID(),facts({currency:'USD',acquisition_cost:25,notes:'Owner-supplied USD acquisition amount; no automatic FX conversion'}));assert.equal(r.status,200);const s=(await state(i.id)).sales[0];assert.equal(s.currency,'USD');assert.equal(s.acquisition_cost,'25.00');assert.equal(s.net_profit,'53.00');
 });
 for(const [name,changes] of [
  ['NaN fee',{platform_fees:'NaN'}],['infinite fee',{payment_fees:'Infinity'}],['negative infinite acquisition',{acquisition_cost:'-Infinity'}],
  ['sub-penny gross',{gross_sale:100.001}],['sub-penny fee',{platform_fees:0.004}],['sub-penny acquisition',{acquisition_cost:20.001}],
  ['negative gross',{gross_sale:-1}],['negative fee',{shipping_cost:-1}],['negative acquisition',{acquisition_cost:-1}],
  ['future sale date',{sale_date:'2999-01-01'}],['missing sale date',{sale_date:''}],['invalid sale date',{sale_date:'invalid'}],
  ['invalid currency',{currency:'gbp'}],['blank venue',{venue:' '}],['oversized venue',{venue:'x'.repeat(161)}],
  ['unconfirmed sale',{owner_confirmed:false}],['string confirmation',{owner_confirmed:'true'}],['unsupported request field',{verified:true}],
  ['oversized source reference',{source_reference:'x'.repeat(1001)}],['oversized notes',{notes:'x'.repeat(2001)}]
 ])await check('sale candidate rejects '+name+' atomically',async()=>{const i=await item();await rejected(i,facts(changes));});
 await check('other-owner sale history stays private under real REST RLS',async()=>{
  const own=await rest(A.token,'sale_outcomes?item_id=eq.'+owned.id);assert.equal(own.status,200);assert.equal((await own.json()).length,1);
  const foreign=await rest(B.token,'sale_outcomes?item_id=eq.'+owned.id);assert.equal(foreign.status,200);assert.deepEqual(await foreign.json(),[]);
 });
 await check('direct client cannot link a listing or sale to another owner item',async()=>{
  const foreign=await item({},B);
  assert.equal((await post(A.token,'listings',{item_id:foreign.id,platform:'Synthetic fixture'})).status,403);
  assert.equal((await post(A.token,'sale_outcomes',{item_id:foreign.id,gross_sale:100})).status,403);
 });
 await check('sale cannot link an owned listing from a different item',async()=>{
  const i=await item(),other=await item();const listing=await insert(A.token,'listings',{item_id:other.id,platform:'Synthetic fixture'});
  assert.equal((await post(A.token,'sale_outcomes',{item_id:i.id,listing_id:listing.id,gross_sale:100})).status,403);assert.equal((await state(i.id)).sales.length,0);
 });
 await check('failed sale insert rolls back item status without recording an outcome',async()=>{
  const i=await item();await admin.query('REVOKE INSERT ON public.sale_outcomes FROM authenticated');
  try{await rejected(i,sale,{status:403});}finally{await admin.query('GRANT INSERT ON public.sale_outcomes TO authenticated');}
 });
 await check('failed item status update rolls back an already attempted outcome insertion',async()=>{
  const i=await item();
  // Revoking UPDATE would fail at SELECT FOR UPDATE before the insert. A real
  // late trigger exception proves that the preceding sale row rolls back too.
  await admin.query(`CREATE FUNCTION public.ci_fixture_reject_sold() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.status='SOLD' THEN RAISE EXCEPTION 'DISPOSABLE late status failure'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER ci_fixture_reject_sold BEFORE UPDATE OF status ON public.items
      FOR EACH ROW EXECUTE FUNCTION public.ci_fixture_reject_sold()`);
  try{await rejected(i,sale);}finally{await admin.query('DROP TRIGGER ci_fixture_reject_sold ON public.items; DROP FUNCTION public.ci_fixture_reject_sold()');}
 });
 await check('owner sale does not become a trusted comparable or Knowledge Brain claim',async()=>{
  assert.equal((await admin.query('select count(*)::int n from public.comparables')).rows[0].n,0);assert.equal((await admin.query('select count(*)::int n from public.knowledge_records')).rows[0].n,0);
 });
 await check('sale candidate reinstall reversal and reapply preserve saved outcomes and fingerprints',async()=>{
  const before=await state(owned.id);await admin.query(proposalSQL);assert.deepEqual(await state(owned.id),before);await admin.query(originalSQL);assert.deepEqual(await state(owned.id),before);await admin.query(proposalSQL);const r=await record(owned.id,event,sale);assert.equal(r.status,200);assert.deepEqual(await r.json(),result);assert.deepEqual(await state(owned.id),before);
 });
}
