import {ExternalLink, ShieldAlert} from 'lucide-react'
import {money} from '../lib/format'

type Props={
 research:any
 sourceAudit?:any
 paired?:boolean
 title?:string
}
const text=(value:any)=>String(value||'').replaceAll('_',' ')
export default function ResearchDecisionPanel({research,sourceAudit,paired=false,title='Research decision'}:Props){
 if(!research)return null
 const val=research.valuation||{}
 const route=research.routing||{}
 const id=research.identification_update||{}
 const notes=String(val.notes||'')
 const quotedPerPiece=paired&&/\bper\s+(?:individual|piece|vase|vessel|single\s+vase)\b/i.test(notes)
 const currency=val.currency||'GBP'
 const comparables=Array.isArray(research.comparables)?research.comparables:[]
 const checks=Array.isArray(research.next_evidence)?research.next_evidence:[]
 const contradictions=Array.isArray(id.contradictions)?id.contradictions:[]
 return <section className="panel researchDraftPanel ci-research-decision" aria-label="Provisional market research">
  <div className="panelHeader"><h2>{title}</h2><span>Provisional · independently verify originals</span></div>
  {paired&&<p className="ci-page-meta">
   <strong>Valuation scope: </strong>{quotedPerPiece?'Individual vessel, NOT the whole pair': 'Proposed matched pair lot; verify that the valuation notes actually describe both pieces'}
  </p>}
  <div className="researchMetricGrid">
   <div><small>Attribution</small><strong>{id.attribution||id.maker||'Unresolved'}</strong>
    <span>{id.identification_confidence??'—'}% identification confidence — not authentication</span></div>
   <div><small>{quotedPerPiece?'Individual vessel balanced estimate':paired?'Pair lot balanced estimate':'Balanced estimate'} · provisional</small>
    <strong>{money(val.balanced_low,currency)} – {money(val.balanced_high,currency)}</strong>
    <span>{val.valuation_confidence??'—'}% valuation confidence</span></div>
   <div><small>Suggested selling route</small><strong>{route.best_venue||'Research first'}</strong>
    <span>{text(route.sale_readiness)||'Unknown readiness'}</span></div>
  </div>
  {research.research_summary&&<p className="ci-research-brief">{research.research_summary}</p>}
  <p className="ci-research-evidence-warning"><ShieldAlert size={17}/> Model-supplied source claims are research leads, not verified sold comparables or approved catalogue values.</p>
  {sourceAudit?.warning&&<p className="ci-page-meta"><strong>Source audit:</strong> {sourceAudit.warning}</p>}
  <details className="ci-review-section ci-review-source" open>
   <summary>Market value and selling economics</summary>
   <div className="ci-research-value-wrap">
    <div className="valueSummary">
     <div><small>Fast cash · gross</small><strong>{money(val.quick_sale_value,currency)}</strong></div>
     <div><small>Regional auction range</small><strong>{money(val.auction_low,currency)} – {money(val.auction_high,currency)}</strong></div>
     <div><small>Private sale range</small><strong>{money(val.private_low,currency)} – {money(val.private_high,currency)}</strong></div>
     <div><small>Dealer asking · not achieved</small><strong>{money(val.dealer_asking_low,currency)} – {money(val.dealer_asking_high,currency)}</strong></div>
    </div>
    {paired&&quotedPerPiece&&<p className="ci-page-meta">The structured amounts above are for ONE member. Do not double them automatically or use as the whole-pair sale value. Read the contextual pair price discussion below.</p>}
    <p><strong>Valuation basis:</strong> {notes||'Not supplied'}</p>
    <p><strong>Route:</strong> {route.best_venue||'Unresolved'} · alternative {route.backup_venue||'not established'}. {text(route.strategy)}</p>
    {(route.reasons||[]).map((r:string,i:number)=><p key={i} className="ci-page-meta">• {r}</p>)}
    <p className="ci-page-meta">These are gross price indications. Selling fees, shipping, restoration, insurance and actual net profit are not calculated without confirmed inputs.</p>
   </div>
  </details>
  <details className="ci-review-section ci-review-source">
   <summary>Comparable and source leads · {comparables.length}</summary>
   <div className="tableWrap"><table>
    <thead><tr><th>Source</th><th>Basis</th><th>Price</th><th>Verification</th><th>Relevance</th></tr></thead>
    <tbody>{comparables.map((comp:any,i:number)=><tr key={i}>
     <td>{comp.source_url?<a href={comp.source_url} target="_blank" rel="noreferrer">{comp.venue||'Source'} <ExternalLink size={12}/></a>:comp.venue||'Unspecified'}
      <div className="ci-page-meta">{comp.description}</div></td>
     <td>{text(comp.price_type)||'Unknown'}</td>
     <td>{money(comp.price,comp.currency||currency)}</td>
     <td>{text(comp.verification_status)||'UNVERIFIED'}</td>
     <td>{text(comp.comparability_grade)||'Unrated'}</td>
    </tr>)}</tbody>
   </table></div>
   {!comparables.length&&<p>No traceable comparable leads in this saved research. Do not infer a market price from asking listings.</p>}
  </details>
  <details className="ci-review-section ci-review-source">
   <summary>Attribution basis, contradictions and next checks</summary>
   <div className="ci-review-source-content">
    <p>{id.rationale||'Maker and period have not been verified.'}</p>
    <p><strong>Period:</strong> {id.period_wording||'Unresolved'} · <strong>Region:</strong> {id.region_country||'Unresolved'}</p>
    {contradictions.map((x:string,i:number)=><p key={'c'+i}><strong>Caution:</strong> {x}</p>)}
    {checks.map((x:any,i:number)=><p key={'e'+i}><strong>Useful next check:</strong> {x.title} — {x.why}</p>)}
   </div>
  </details>
 </section>
}
