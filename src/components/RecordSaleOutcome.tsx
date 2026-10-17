import {useEffect,useRef,useState} from 'react'
import {supabase} from '../lib/supabase'
import {money} from '../lib/format'

type Outcome={
 id:string
 venue:string|null
 sale_date:string|null
 gross_sale:number|null
 net_sale_proceeds:number|null
 net_profit:number|null
 return_on_cash:number|null
 provenance_basis:string|null
 source_reference:string|null
}
export default function RecordSaleOutcome({itemId,currency='GBP',itemStatus}:{
 itemId:string;currency?:string;itemStatus?:string
}){
 const [prior,setPrior]=useState<Outcome[]>([])
 const [loaded,setLoaded]=useState(false)
 const [soldAt,setSoldAt]=useState('')
 const [venue,setVenue]=useState('')
 const [gross,setGross]=useState('')
 const [platformFees,setPlatformFees]=useState('')
 const [paymentFees,setPaymentFees]=useState('')
 const [shipping,setShipping]=useState('')
 const [packing,setPacking]=useState('')
 const [insurance,setInsurance]=useState('')
 const [source,setSource]=useState('')
 const [notes,setNotes]=useState('')
 const [confirmed,setConfirmed]=useState(false)
 const [saving,setSaving]=useState(false)
 const [message,setMessage]=useState('')
 const eventKey=useRef<string|null>(null)
 const moneyInput=(value:string)=>value.trim()===''?0:Number(value)
 const refresh=async()=>{
  const {data,error}=await supabase.from('sale_outcomes')
    .select('id,venue,sale_date,gross_sale,net_sale_proceeds,net_profit,return_on_cash,provenance_basis,source_reference')
    .eq('item_id',itemId).order('created_at',{ascending:false})
  if(!error){setPrior(data||[]);setLoaded(true)}else{
   setLoaded(false);setMessage('Sale outcome history cannot be loaded. Saving is blocked until it is accessible.')
  }
 }
 useEffect(()=>{setLoaded(false);void refresh()},[itemId])
 const alreadySold=prior.some(x=>x.gross_sale!==null)||itemStatus==='SOLD'
 const invalidInputs=!soldAt||!venue.trim()||gross.trim()===''||!confirmed||
  [gross,platformFees,paymentFees,shipping,packing,insurance].some(x=>x!==''&&(!Number.isFinite(Number(x))||Number(x)<0))
 const record=async()=>{
  if(!loaded||alreadySold||saving||invalidInputs)return
  setSaving(true);setMessage('Saving your owner-reported actual sale as one private transaction…')
  try{
   if(!eventKey.current)eventKey.current=crypto.randomUUID()
   const {data,error}=await supabase.rpc('ci_record_actual_sale_v1',{
    p_item_id:itemId,p_client_event_id:eventKey.current,
    p_sale:{
     owner_confirmed:true,sale_date:soldAt,venue:venue.trim(),currency,
     gross_sale:moneyInput(gross),
     platform_fees:moneyInput(platformFees),payment_fees:moneyInput(paymentFees),
     shipping_cost:moneyInput(shipping),packing_cost:moneyInput(packing),
     insurance_cost:moneyInput(insurance),
     source_reference:source.trim(),notes:notes.trim()
    }
   })
   if(error)throw Error(error.message)
   if(!Array.isArray(data)||data.length!==1||!data[0]?.sale_id)
    throw Error('Sale save was not confirmed. Read back sale history before retrying.')
   await refresh()
   setMessage('Actual sale recorded and linked to this collection object. Source is owner-reported, not an independently verified auction comparable.')
  }catch(e:any){
   setMessage((e?.message||'Sale outcome not confirmed')+'. If unsure, check the saved sale history before retrying.')
  }finally{setSaving(false)}
 }
 return <section className="panel ci-sale-outcome" aria-label="Actual recorded sale outcomes">
  <div className="panelHeader"><h2>Actual sale outcomes</h2><span>Owner-reported only, not an externally verified comparable</span></div>
  {prior.length>0&&<div className="ci-outcome-history">
   {prior.map(out=><div key={out.id} className="ci-outcome-row">
    <strong>{out.venue||'Unknown venue'} · {out.sale_date||'No date'}</strong>
    <span>Gross {money(out.gross_sale,currency)} · Net {money(out.net_sale_proceeds,currency)}
      · Profit {money(out.net_profit,currency)}</span>
    <small>{out.provenance_basis||'Source not independently verified'}{out.source_reference?' · '+out.source_reference:''}</small>
   </div>)}
  </div>}
  {!alreadySold&&loaded&&<details className="ci-archive-section">
   <summary>Record an actual completed sale · requires confirmation</summary>
   <p className="ci-page-meta">Use this only after the object has genuinely sold. AI estimates, auction asking prices or unverified lot results do not count. This action marks the item SOLD and archives achieved gross price, fees and profit.</p>
   <div className="ci-review-fields ci-economics-fields">
    <label>Actual sale date<input type="date" value={soldAt} onChange={e=>setSoldAt(e.target.value)}/></label>
    <label>Actual selling venue<input value={venue} maxLength={160} placeholder="eBay, auction house, collector sale…" onChange={e=>setVenue(e.target.value)}/></label>
    <label>Gross amount received ({currency})<input type="number" min="0" step="0.01" value={gross} onChange={e=>setGross(e.target.value)}/></label>
    <label>Platform or auction seller fees ({currency})<input type="number" min="0" step="0.01" value={platformFees} onChange={e=>setPlatformFees(e.target.value)} placeholder="0 if none"/></label>
    <label>Payment fees ({currency})<input type="number" min="0" step="0.01" value={paymentFees} onChange={e=>setPaymentFees(e.target.value)} placeholder="0 if none"/></label>
    <label>Out-of-pocket shipping ({currency})<input type="number" min="0" step="0.01" value={shipping} onChange={e=>setShipping(e.target.value)} placeholder="0 if none"/></label>
    <label>Packaging ({currency})<input type="number" min="0" step="0.01" value={packing} onChange={e=>setPacking(e.target.value)} placeholder="0 if none"/></label>
    <label>Insurance ({currency})<input type="number" min="0" step="0.01" value={insurance} onChange={e=>setInsurance(e.target.value)} placeholder="0 if none"/></label>
    <label>Receipt or listing reference<input value={source} maxLength={1000} onChange={e=>setSource(e.target.value)} placeholder="Original sale receipt or order reference"/></label>
    <label>Owner notes<textarea rows={2} maxLength={2000} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Buyer geography, delays, condition/packaging issues…"/></label>
   </div>
   <label className="ci-record-selection"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>
    <span>I confirm this item actually sold and the amounts entered are real transaction details.</span></label>
   <button className="primaryButton inlineButton" disabled={saving||invalidInputs} onClick={record}>
    {saving?'Recording confirmed sale…':'Record actual sale and mark SOLD'}
   </button>
  </details>}
  {alreadySold&&<p className="ci-page-meta">This item is already recorded as sold. Existing outcomes are preserved; do not create another sold transaction without reviewing the original record.</p>}
  {!loaded&&<p className="ci-page-meta">Loading private sale records…</p>}
  {message&&<p className="note" role="status">{message}</p>}
 </section>
}
