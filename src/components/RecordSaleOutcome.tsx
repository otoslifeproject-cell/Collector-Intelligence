import {useEffect,useRef,useState} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {readSaleContext,saleAmount,saleMoney} from '../lib/actualSale'
import type {SaleContext,SalePayload} from '../lib/actualSale'

type Attempt={id:string;ownerId:string;payload:SalePayload}
const empty={date:'',venue:'',gross:'',platform:'',payment:'',shipping:'',packing:'',insurance:'',acquisition:'',source:'',notes:''}
type Fields=typeof empty
type Props={client:SupabaseClient;itemId:string;onSold?:(itemId:string,ownerId:string)=>void}
export default function RecordSaleOutcome(props:Props){
 return <SaleForm key={props.itemId} {...props}/>
}
function SaleForm({client,itemId,onSold}:Props){
 const [context,setContext]=useState<SaleContext|null>(null)
 const [fields,setFields]=useState<Fields>(empty)
 const [confirmed,setConfirmed]=useState(false)
 const [saving,setSaving]=useState(false)
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 const [message,setMessage]=useState('')
 const [attempt,setAttempt]=useState<Attempt|null>(null)
 const attemptRef=useRef<Attempt|null>(null),statusRef=useRef<HTMLParagraphElement|null>(null)
 const scope=useRef(0),readNumber=useRef(0),owner=useRef<string|null|undefined>(undefined)
 const controller=useRef<AbortController|null>(null),active=useRef(false)
 const notified=useRef<string|null>(null)
 const setPending=(value:Attempt|null)=>{attemptRef.current=value;setAttempt(value)}
 const matched=(data:SaleContext,pending:Attempt)=>data.ownerId===pending.ownerId&&data.outcomes.some(row=>
  row.client_event_id===pending.id&&row.currency===pending.payload.currency&&row.gross_sale===pending.payload.gross_sale&&
  row.sale_date===pending.payload.sale_date&&row.venue===pending.payload.venue&&data.item.status==='SOLD'&&
  row.platform_fees===pending.payload.platform_fees&&row.payment_fees===pending.payload.payment_fees&&
  row.shipping_subsidy===pending.payload.shipping_cost&&row.packing_cost===pending.payload.packing_cost&&row.insurance_cost===pending.payload.insurance_cost&&
  (pending.payload.acquisition_cost===undefined||row.acquisition_cost===pending.payload.acquisition_cost)&&
  (row.source_reference||'')===pending.payload.source_reference&&(row.owner_notes||'')===pending.payload.notes&&row.provenance_basis==='OWNER_REPORTED_UNVERIFIED')
 const saved='Actual sale recorded and read back from your private history. The source remains owner-reported.'
 const load=async()=>{
  if(!active.current)return null
  const epoch=scope.current,serial=++readNumber.current
  controller.current?.abort();const abort=new AbortController();controller.current=abort
  const timeout=setTimeout(()=>abort.abort(),20000)
  setLoading(true);setError('');setContext(null)
  try{
   const next=await readSaleContext(client,itemId,abort.signal)
   if(epoch!==scope.current||serial!==readNumber.current)return null
   if(owner.current!==undefined&&owner.current!==next.ownerId)return null
   owner.current=next.ownerId;setContext(next)
   if(attemptRef.current&&matched(next,attemptRef.current)){setPending(null);setMessage(saved)}
   return next
  }catch(e){
   if(epoch===scope.current&&serial===readNumber.current)setError(e instanceof Error?e.message:'Private sale records could not be loaded.')
   return null
  }finally{clearTimeout(timeout);if(epoch===scope.current&&serial===readNumber.current)setLoading(false)}
 }
 useEffect(()=>{
  active.current=true
  const subscription=client.auth.onAuthStateChange((_event,session)=>{
   const next=session?.user.id??null
   if(owner.current===undefined){owner.current=next;return}
   if(next===owner.current)return
   owner.current=next;scope.current++;controller.current?.abort()
   setContext(null);setFields(empty);setConfirmed(false);setPending(null);setSaving(false);setMessage('');setError('');setLoading(true)
   // Auth callbacks must return before another SDK Auth request starts.
   queueMicrotask(()=>{void load()})
  })
  void load()
  return ()=>{active.current=false;scope.current++;controller.current?.abort();subscription.data.subscription.unsubscribe()}
 },[client,itemId])
 useEffect(()=>{if(!saving&&message)statusRef.current?.focus()},[message,saving])
 useEffect(()=>{
  if(!context||context.item.status!=='SOLD'||owner.current!==context.ownerId||!active.current||!onSold)return
  const identity=context.ownerId+':'+itemId
  if(notified.current===identity)return
  notified.current=identity;onSold(itemId,context.ownerId)
 },[context,itemId,onSold])
 const currency=context?.item.currency||'GBP'
 const knownCost=context?.item.all_in_cost??context?.item.acquisition_price??null
 const crossCurrency=knownCost!==null&&context?.item.acquisition_currency!==currency
 const sold=context?.item.status==='SOLD'||context?.outcomes.some(row=>row.gross_sale!==null)
 const costs=['platform','payment','shipping','packing','insurance'] as const
 const today=new Date().toLocaleDateString('en-CA',{timeZone:'Europe/London'})
 const invalid=!fields.date||fields.date<'1950-01-01'||fields.date>today||!fields.venue.trim()||!confirmed||
  saleAmount(fields.gross)===null||costs.some(key=>saleAmount(fields[key],0)===null)||
  (fields.acquisition.trim()!==''&&saleAmount(fields.acquisition)===null)||(crossCurrency&&saleAmount(fields.acquisition)===null)
 const update=(key:keyof Fields,value:string)=>setFields(previous=>({...previous,[key]:value}))
 const record=async()=>{
  if(!context||sold||saving||loading||(!attemptRef.current&&invalid))return
  const epoch=scope.current
  const pending=attemptRef.current??{id:crypto.randomUUID(),ownerId:context.ownerId,payload:{
   owner_confirmed:true as const,sale_date:fields.date,venue:fields.venue.trim(),currency,gross_sale:saleAmount(fields.gross)!,
   platform_fees:saleAmount(fields.platform,0)!,payment_fees:saleAmount(fields.payment,0)!,shipping_cost:saleAmount(fields.shipping,0)!,
   packing_cost:saleAmount(fields.packing,0)!,insurance_cost:saleAmount(fields.insurance,0)!,
   ...(fields.acquisition.trim()?{acquisition_cost:saleAmount(fields.acquisition)!}:{}),source_reference:fields.source.trim(),notes:fields.notes.trim(),
  }}
  setPending(pending);setSaving(true);setMessage('Recording your sale and checking the saved result…');setError('')
  try{
   const identity=await client.auth.getUser()
   if(epoch!==scope.current)return
   if(identity.error||identity.data.user?.id!==pending.ownerId)throw Error('Your account changed. Reload your sale history before continuing.')
   const result=await client.rpc('ci_record_actual_sale_v1',{p_item_id:itemId,p_client_event_id:pending.id,p_sale:pending.payload})
   if(epoch!==scope.current)return
   // A successful acknowledgement alone cannot establish a saved sale. An
   // interrupted acknowledgement may still have committed: always read back.
   const next=await load()
   if(epoch!==scope.current)return
   if(next&&matched(next,pending)){setPending(null);setMessage(saved)}
   else if(next&&result.error&&['P0001','22023','22P02','23514','42501'].includes(result.error.code)){
    setPending(null);setMessage('The sale was refused and no matching saved result was found. Check the details before trying again.')
   }else setMessage('The saved result is not yet confirmed. Your original details are held unchanged. Reload sale history before retrying the same request.')
  }catch{
   if(epoch!==scope.current)return
   const next=await load()
   if(epoch!==scope.current)return
   if(next&&matched(next,pending)){setPending(null);setMessage(saved)}
   else setMessage('The saved result is not yet confirmed. Your original details are held unchanged. Reload sale history before retrying the same request.')
  }finally{if(epoch===scope.current)setSaving(false)}
 }
 const amountInput=(key:keyof Fields,label:string,placeholder?:string)=><label>{label} ({currency})<input inputMode="decimal" value={fields[key]} onChange={event=>update(key,event.target.value)} placeholder={placeholder}/></label>
 return <section className="panel ci-sale-outcome" aria-label="Actual recorded sale outcomes" aria-busy={loading||saving}>
  <div className="panelHeader"><h2>Actual sale outcomes</h2><span>Owner-reported · not independently verified</span></div>
  {context&&context.outcomes.length>0&&<div className="ci-outcome-history" aria-label="Saved sale history">
   {context.outcomes.map(out=><div key={out.id} className="ci-outcome-row">
    <strong>{out.venue||'Unknown venue'} · {out.sale_date||'No date'}</strong>
    <span>Gross {saleMoney(out.gross_sale,out.currency)} · Net {saleMoney(out.net_sale_proceeds,out.currency)} · Profit {saleMoney(out.net_profit,out.currency)}</span>
    <small>Owner-reported · not independently verified{out.source_reference?' · '+out.source_reference:''}</small>
   </div>)}
  </div>}
  {!sold&&context&&<details className="ci-archive-section">
   <summary>Record an actual completed sale</summary>
   <p className="ci-page-meta">Use this after the object has sold. Recording a sale marks the item SOLD. Enter receipt amounts, rather than estimates or asking prices. Blank fees are recorded as zero.</p>
   <fieldset className="ci-sale-fields" disabled={saving||!!attempt}>
    <legend className="sr-only">Completed sale details</legend>
    <div className="ci-review-fields ci-economics-fields">
     <label>Actual sale date<input type="date" min="1950-01-01" max={today} value={fields.date} onChange={e=>update('date',e.target.value)}/></label>
     <label>Actual selling venue<input value={fields.venue} maxLength={160} onChange={e=>update('venue',e.target.value)}/></label>
     {amountInput('gross','Gross amount received')}
     {amountInput('platform','Platform or auction seller fees','0 if none')}
     {amountInput('payment','Payment fees','0 if none')}
     {amountInput('shipping','Out-of-pocket shipping','0 if none')}
     {amountInput('packing','Packaging','0 if none')}
     {amountInput('insurance','Insurance','0 if none')}
     {amountInput('acquisition','Acquisition cost in sale currency',crossCurrency?'Required: enter the converted cost':'Optional override')}
     <p className="ci-page-meta">{knownCost===null?'Saved acquisition cost is unknown. Leave blank to keep profit unknown.':`Saved acquisition cost: ${saleMoney(knownCost,context.item.acquisition_currency||currency)}. ${crossCurrency?'Enter the acquisition cost in the sale currency; no automatic currency conversion is made.':'Leave blank to use this cost.'}`} Use up to two decimal places for all amounts.</p>
     <label>Receipt or listing reference<input value={fields.source} maxLength={1000} onChange={e=>update('source',e.target.value)}/></label>
     <label>Owner notes<textarea rows={2} maxLength={2000} value={fields.notes} onChange={e=>update('notes',e.target.value)} placeholder="Include any conversion reference here"/></label>
    </div>
    <label className="ci-record-selection"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/><span>I confirm this item sold and these amounts are real transaction details.</span></label>
   </fieldset>
   <button className="primaryButton inlineButton" disabled={saving||loading||(!attempt&&invalid)} onClick={()=>void record()}>
    {saving?'Checking saved sale…':attempt?'Retry the same sale request':'Record actual sale and mark SOLD'}
   </button>
  </details>}
  {sold&&<p className="ci-page-meta">This item is already recorded as sold. Its existing outcomes are preserved.</p>}
  {loading&&<p className="ci-page-meta">Loading private sale records…</p>}
  {error&&<p role="alert" className="note">{error}</p>}
  {message&&<p className="note" role="status" tabIndex={-1} ref={statusRef}>{message}</p>}
  {(!loading&&!saving&&(error||attempt))&&<button className="secondaryButton inlineButton" onClick={()=>void load()}>Reload sale history</button>}
 </section>
}
