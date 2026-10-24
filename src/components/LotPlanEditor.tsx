import type {LotCosts,LotPlan,LotPlanAssessment} from '../lib/lotOptimizer'
import {lotStrategyTitles} from '../lib/lotOptimizer'
import type {Item} from '../types'
const costFields:[keyof LotCosts,string][]=[['sellerCommissionPercent','Seller commission (%)'],['commissionVatPercent','VAT on commission (%)'],['minimumCommission','Minimum commission before VAT'],['listingFee','Listing / entry fee'],['unsoldFee','Unsold fee'],['paymentPercent','Payment fee (%)'],['paymentFixed','Fixed payment fee'],['packing','Packing materials / labour'],['delivery','Delivery'],['insurance','Insurance'],['breakageReturnAllowance','Breakage / returns allowance'],['unsoldPreparation','Preparation lost if unsold']]
const amount=(n:number|null,currency:string)=>n===null?'Unknown':`${currency} ${n.toFixed(2)}`
type Props={plan:LotPlan;assessment:LotPlanAssessment;items:Item[];disabled:boolean;onChange:(plan:LotPlan)=>void}
export default function LotPlanEditor({plan,assessment,items,disabled,onChange}:Props){
 const change=(index:number,key:string,value:unknown)=>onChange({...plan,lines:plan.lines.map((line,i)=>i===index?{...line,[key]:value}:line)})
 const number=(value:string)=>value===''?null:Number(value)
 return <section className="ci-lot-editor" aria-label={`${lotStrategyTitles[plan.strategy]} ${plan.objective.replaceAll('_',' ')} assumptions`}>
  <h3>{lotStrategyTitles[plan.strategy]} · {plan.objective.replaceAll('_',' ')}</h3>
  <p>Enter realistic assumptions for this strategy only. Blank means unknown. No bundle premium or achieved price is inferred from the number of pieces.</p>
  <div className="ci-lot-metrics" aria-label="Hypothetical strategy arithmetic"><div><small>Gross if sold</small><strong>{plan.lines.every(l=>l.grossLow!==null)?amount(plan.lines.reduce((s,l)=>s+l.grossLow!,0),plan.currency):'Unknown'}</strong></div><div><small>Net if sold</small><strong>{amount(assessment.conditionalNetLow,plan.currency)} – {amount(assessment.conditionalNetHigh,plan.currency)}</strong></div><div><small>Probability-adjusted expected net</small><strong>{amount(assessment.expectedNetLow,plan.currency)} – {amount(assessment.expectedNetHigh,plan.currency)}</strong></div><div><small>Profit after acquisition costs</small><strong>{amount(assessment.profitLow,plan.currency)}</strong></div></div>
  <p className="note">Hypothetical arithmetic only. Source-reviewed whole-lot composition is not connected yet, so this plan cannot establish a selling recommendation, reserve objects or publish a listing. Acquisition costs are not assumed complete; unknown profit stays unknown.</p>
  <fieldset disabled={disabled}>
   <legend>Strategy assumptions · {plan.currency||'confirm currency'}</legend>
   {plan.lines.map((line,index)=><details key={line.id} open={plan.lines.length===1} className="ci-lot-line"><summary>Lot {index+1} · {line.itemIds.length} object{line.itemIds.length===1?'':'s'} · {line.itemIds.map(id=>items.find(item=>item.id===id)?.item_code||'Missing object').join(', ')}</summary>
    <div className="ci-lot-grid"><label>Selling venue<input value={line.venue} onChange={e=>change(index,'venue',e.target.value)}/></label><label>Price basis<select value={line.grossBasis} onChange={e=>change(index,'grossBasis',e.target.value)}><option value="UNKNOWN">Unknown</option><option value="SELLER_GROSS">Seller gross before seller costs</option><option value="BUYER_TOTAL">Buyer total including premium — not seller gross</option></select></label>
     {(['grossLow','grossHigh'] as const).map(key=><label key={key}>{key==='grossLow'?'Conservative gross if sold':'Upper gross if sold'} ({plan.currency||'currency'})<input type="number" min="0" step="0.01" value={line[key]??''} onChange={e=>change(index,key,number(e.target.value))}/></label>)}
     {costFields.map(([key,label])=><label key={key}>{label}{key.endsWith('Percent')?'':` (${plan.currency||'currency'})`}<input type="number" min="0" max={key.endsWith('Percent')?100:undefined} step="0.01" value={line.costs[key]??''} onChange={e=>change(index,'costs',{...line.costs,[key]:number(e.target.value)})}/></label>)}
     <label>Sale probability within stated window (%)<input type="number" min="0" max="100" step="1" value={line.saleProbability===null?'':Math.round(line.saleProbability*10000)/100} onChange={e=>change(index,'saleProbability',e.target.value===''?null:Number(e.target.value)/100)}/></label>
     {(['daysLow','daysHigh','workHours'] as const).map(key=><label key={key}>{key==='daysLow'?'Earliest sale (days)':key==='daysHigh'?'Latest assumed sale (days)':'Practical work (hours)'}<input type="number" min="0" step={key==='workHours'?'0.25':'1'} value={line[key]??''} onChange={e=>change(index,key,number(e.target.value))}/></label>)}
     <label>Published fee source URL<input type="url" value={line.feeSource} onChange={e=>change(index,'feeSource',e.target.value)}/></label><label>Platform / venue eligibility URL<input type="url" value={line.eligibilitySource} onChange={e=>change(index,'eligibilitySource',e.target.value)}/></label><label>Fee and eligibility check date<input type="date" value={line.checkedAt} onChange={e=>change(index,'checkedAt',e.target.value)}/></label>
    </div><label>Price adjustment, comparable differences and probability rationale<textarea value={line.priceAdjustment} onChange={e=>change(index,'priceAdjustment',e.target.value)}/></label><label>Packing, delivery / collection, insurance and practical workload<textarea value={line.shippingInstructions} onChange={e=>change(index,'shippingInstructions',e.target.value)}/></label>
   </details>)}
  </fieldset>
  <details><summary>Evidence and economics checks ({assessment.blockers.length})</summary><ul>{assessment.blockers.map(message=><li key={message}>{message}</li>)}</ul></details>
 </section>
}
