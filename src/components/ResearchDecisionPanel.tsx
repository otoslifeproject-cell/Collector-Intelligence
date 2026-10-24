import {ExternalLink} from 'lucide-react'
import InfoDisclosure from './InfoDisclosure'
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
 const attribution=String(id.attribution||id.maker||'Unresolved')
 const routeTitle=String(route.best_venue||'Research first')
 const short=(t:string,n:number)=>t.length>n?t.slice(0,n).trimEnd()+'…':t
 const summary=String(research.research_summary||'')
 const comparables=Array.isArray(research.comparables)?research.comparables:[]
 const checks=Array.isArray(research.next_evidence)?research.next_evidence:[]
 const contradictions=Array.isArray(id.contradictions)?id.contradictions:[]
 return <section className="panel researchDraftPanel ci-research-decision" aria-label="Provisional market research">
  <div className="panelHeader"><h2>{title}</h2><span className="ci-compact-status">Provisional</span></div>
  {paired&&quotedPerPiece&&<span className="ci-compact-status ci-status-warning">Estimate is for one vase, not the pair</span>}
  <div className="researchMetricGrid">
   <div><small>Attribution</small><strong title={attribution}>{short(attribution,128)}</strong>
    <span>{id.identification_confidence??'—'}% identification confidence — not authentication</span></div>
   <div><small>{quotedPerPiece?'Individual vessel balanced estimate':paired?'Pair lot balanced estimate':'Balanced estimate'} · provisional</small>
    <strong>{money(val.balanced_low,currency)} – {money(val.balanced_high,currency)}</strong>
    <span>{val.valuation_confidence??'—'}% valuation confidence</span></div>
   <div><small>Suggested selling route</small><strong title={routeTitle}>{short(routeTitle,92)}</strong>
    <span>Model suggestion: {text(route.sale_readiness)||'Unknown readiness'}. Final research decision required before listing.</span></div>
  </div>
  {summary&&<div className="ci-research-brief-wrap">
    <p className="ci-research-brief">{short(summary,180)}</p>
    {summary.length>180&&<InfoDisclosure label="Full research summary"><p className="ci-research-full-summary">{summary}</p></InfoDisclosure>}
   </div>}
  <InfoDisclosure label="Evidence quality">
    <p>Model-supplied leads are not independently verified sold comparables or authenticated maker records.</p>
    {sourceAudit?.warning&&<p>{sourceAudit.warning}</p>}
    {paired&&!quotedPerPiece&&<p>Price scope is the proposed matched pair; verify both physical pieces are included in each reference.</p>}
   </InfoDisclosure>
  <details className="ci-review-section ci-review-source">
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
     <td>{typeof comp.source_url==='string'&&/^https:\/\/[^\s]+$/i.test(comp.source_url)?<a href={comp.source_url} target="_blank" rel="noopener noreferrer">{comp.venue||'Source'} <ExternalLink size={12}/></a>:comp.venue||'Unspecified'}
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
