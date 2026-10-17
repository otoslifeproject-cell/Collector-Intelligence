import {useState} from 'react'
import {money} from '../lib/format'

type Props={
 currency?:string
 acquisitionPrice?:number|string|null
 initialSalePrice?:number|null
 contextLabel?:string
}
const nonneg=(s:string)=>s.trim()===''?0:Math.max(0,Number.isFinite(Number(s))?Number(s):0)
export default function SaleEconomics({currency='GBP',acquisitionPrice,initialSalePrice,contextLabel='this object'}:Props){
 const [sale,setSale]=useState(initialSalePrice==null?'':String(initialSalePrice))
 const [feePercent,setFeePercent]=useState('')
 const [fixedFee,setFixedFee]=useState('0')
 const [shipping,setShipping]=useState('0')
 const [packing,setPacking]=useState('0')
 const [insurance,setInsurance]=useState('0')
 const [otherSelling,setOtherSelling]=useState('0')
 const [inboundTransport,setInboundTransport]=useState('0')
 const [restoration,setRestoration]=useState('0')
 const [purchase,setPurchase]=useState(acquisitionPrice==null?'':String(acquisitionPrice))
 const price=nonneg(sale)
 const variableFee=price*nonneg(feePercent)/100
 const sellingCosts=variableFee+nonneg(fixedFee)+nonneg(shipping)+nonneg(packing)+nonneg(insurance)+nonneg(otherSelling)
 const invested=purchase.trim()===''?null:nonneg(purchase)+nonneg(inboundTransport)+nonneg(restoration)
 const net=sale.trim()!==''&&feePercent.trim()!==''?price-sellingCosts:null
 const profit=net!=null&&invested!=null?net-invested:null
 const returnOnCash=profit!=null&&invested!=null&&invested>0?100*profit/invested:null
 return <section className="panel ci-sale-economics">
   <div className="panelHeader"><h2>Sale proceeds & profit scenarios</h2><span>User-entered assumptions · {contextLabel}</span></div>
   <p className="ci-page-meta">Enter an expected <strong>gross achieved sale price</strong> and your actual venue fee. Zero per cent is valid for a no-fee sale, but it must be entered deliberately. Figures do not alter the catalogue until you approve them elsewhere.</p>
   <div className="ci-review-fields ci-economics-fields">
    <label>Gross expected sale price ({currency})<input aria-label="Expected gross sale" type="number" min="0" step="0.01" value={sale} onChange={e=>setSale(e.target.value)} placeholder="Enter expected achieved sale"/></label>
    <label>Venue fee (%)<input aria-label="Venue fee percent" type="number" min="0" step="0.01" value={feePercent} onChange={e=>setFeePercent(e.target.value)} placeholder="Required: enter 0 if no fee"/></label>
    <label>Fixed fees / payment costs ({currency})<input type="number" min="0" step="0.01" value={fixedFee} onChange={e=>setFixedFee(e.target.value)}/></label>
    <label>Outbound shipping ({currency})<input type="number" min="0" step="0.01" value={shipping} onChange={e=>setShipping(e.target.value)}/></label>
    <label>Packaging ({currency})<input type="number" min="0" step="0.01" value={packing} onChange={e=>setPacking(e.target.value)}/></label>
    <label>Shipping insurance ({currency})<input type="number" min="0" step="0.01" value={insurance} onChange={e=>setInsurance(e.target.value)}/></label>
    <label>Other selling costs ({currency})<input type="number" min="0" step="0.01" value={otherSelling} onChange={e=>setOtherSelling(e.target.value)}/></label>
    <label>Purchase / acquisition cost ({currency})<input type="number" min="0" step="0.01" value={purchase} onChange={e=>setPurchase(e.target.value)} placeholder="Unknown until entered"/></label>
    <label>Inbound transport ({currency})<input type="number" min="0" step="0.01" value={inboundTransport} onChange={e=>setInboundTransport(e.target.value)}/></label>
    <label>Restoration / conservation ({currency})<input type="number" min="0" step="0.01" value={restoration} onChange={e=>setRestoration(e.target.value)}/></label>
   </div>
   <div className="valueSummary ci-economics-results" aria-live="polite">
    <div><small>Estimated selling costs</small><strong>{net==null?'—':money(sellingCosts,currency)}</strong></div>
    <div><small>Net proceeds · after selling costs</small><strong>{net==null?'—':money(net,currency)}</strong></div>
    <div><small>Profit · after acquisition</small><strong>{profit==null?'—':money(profit,currency)}</strong></div>
    <div><small>Return on acquisition cash</small><strong>{returnOnCash==null?'—':returnOnCash.toFixed(0)+'%'}</strong></div>
   </div>
   <p className="ci-page-meta">{net==null?'Enter gross sale and fee percentage to calculate indicative net proceeds.':invested==null?'Acquisition cost is missing: net proceeds shown, but profit cannot be calculated.':'Profit is gross sale less selling expenses and acquisition/inbound/restoration costs; return uses acquisition cash as its denominator.'} VAT, tax liability, buyer premium, refunds and exchange-rate differences are excluded unless you add them explicitly to cost fields.</p>
 </section>
}
