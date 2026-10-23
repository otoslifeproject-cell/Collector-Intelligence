import {useState} from 'react'
import {auditResearch,researchTypes} from '../lib/researchSaleDecision'
import type {ResearchAudit,ResearchReceipt,ResearchStatus} from '../lib/researchSaleDecision'
import type {ItemResearchHistory} from '../lib/itemResearch'
import {CheckCircle2,Clock3,AlertCircle,Circle,HelpCircle} from 'lucide-react'
const titles:Record<string,string>={
 PHOTOGRAPH_EXAM:'Photograph examination',SIGNATURE_READING:'Signature and inscription',
 MAKER_ARCHIVE:'Maker / archival corroboration',AUCTION_REALISED:'Verified auction realisations',
 MARKETPLACE_SOLD:'Confirmed marketplace sold',CONDITION_REVIEW:'Condition verification',
 SALES_ECONOMICS:'Net proceeds and venue economics'
}
const statuses:Record<ResearchStatus,string>={
 NOT_RUN:'Not run',RUNNING:'In progress — outcome unconfirmed',DONE_EVIDENCED:'Complete — source review recorded',
 INCONCLUSIVE:'Inconclusive',FAILED:'Blocked — failed execution',BLOCKED:'Blocked',RECEIPT_MISSING:'Inconclusive — historical receipt missing'
}
const purposes:Record<string,string>={PHOTOGRAPH_EXAM:'Original images, base, rim and measurements',SIGNATURE_READING:'Each physical mark, candidate readings and competing makers',MAKER_ARCHIVE:'Museum, factory, catalogue and specialist records',AUCTION_REALISED:'Sold lots, condition and exact price basis',MARKETPLACE_SOLD:'Traceable confirmed sales, separate from asking prices',CONDITION_REVIEW:'Chips, cracks, repairs, wear and manufacturing features',SALES_ECONOMICS:'Fees, packing, delivery, insurance and expected net'}
type Props={receipts?:ResearchReceipt[];audit?:ResearchAudit;history?:ItemResearchHistory|null;error?:string;loading?:boolean;onReload?:()=>void;objectLabel?:string;compact?:boolean;historyHref?:string;confidence?:{identification?:number|null;dating?:number|null;valuation?:number|null};onInvestigate?:()=>void}
export default function ResearchProgress({receipts=[],audit:savedAudit,history,error,loading,onReload,objectLabel,compact=false,historyHref,confidence,onInvestigate}:Props){
 const [detailsOpen,setDetailsOpen]=useState(false)
 const condensed=compact&&!detailsOpen
 const shortStatus:Record<ResearchStatus,string>={NOT_RUN:"Not run",RUNNING:"In progress",DONE_EVIDENCED:"Complete",INCONCLUSIVE:"Inconclusive",FAILED:"Failed",BLOCKED:"Blocked",RECEIPT_MISSING:"Receipt missing"}
 const audit=savedAudit||auditResearch(receipts)
 const unresolved=audit.receipts.find(r=>r.status==='BLOCKED'||r.status==='RUNNING')||audit.receipts.find(r=>r.status!=='DONE_EVIDENCED')
 const next=error?'Recover saved history before running more research.':unresolved?`${titles[unresolved.type]}: ${unresolved.detail||statuses[unresolved.status]}`:'Prepare the final evidence-led item assessment before deciding whether to list.'
 const score=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=100?`${n}%`:'Not established'
 return <section className={`panel ci-research-progress${condensed?' ci-research-progress-compact':''}`} aria-label={objectLabel?`Research dashboard — ${objectLabel}`:'Research completion audit'}>
  <div className="panelHeader"><h2>Research audit</h2><span>{loading?'Reading saved history…':error?'History unavailable':'Stored executions and evidence'}</span></div>
  {loading?<p role="status">Reading stored executions and sources…</p>:error?<p role={compact?undefined:'alert'}>{error} Missing history is not evidence that research was never run.</p>:<>
  <div className="ci-audit-total"><strong>{audit.complete} of {audit.total}</strong><span>{audit.complete} / {audit.total} categories complete</span></div>
  <progress aria-label="Evidence-backed research progress" value={audit.complete} max={audit.total} style={{width:'100%'}}>{audit.percent}%</progress>
  <p aria-live="polite">{history?.runs.length??0} saved research executions · {audit.total-audit.complete} categories still requiring verification</p>
  <p className="ci-research-next"><strong>Next action:</strong> {next}</p>
  <div className="ci-audit-categories" role="list" aria-label="Research categories">
   {researchTypes.map(type=>{
    const receipt=audit.receipts.find(x=>x.type===type)!
    const Icon=receipt.status==='DONE_EVIDENCED'?CheckCircle2:receipt.status==='RUNNING'?Clock3:['BLOCKED','FAILED'].includes(receipt.status)?AlertCircle:receipt.status==='NOT_RUN'?Circle:HelpCircle
    return <div role="listitem" className="ci-audit-row" key={type} data-research-type={type} data-status={receipt.status}>
     <Icon className="ci-audit-icon" size={21} aria-hidden="true"/>
     <div className="ci-audit-category"><strong>{titles[type]}</strong>{!condensed&&<p>{purposes[type]}</p>}
      {!condensed&&<details><summary>Results, sources and unresolved issues</summary><p>{receipt.detail||'No independently verified category outcome is stored.'}</p>
       <p>{type==='SIGNATURE_READING'?'Signature-reading confidence':'Recorded category confidence'}: {score(receipt.confidence)}{type==='SIGNATURE_READING'?' · not maker authentication':''}</p>
       <small>{receipt.runId?`Record ${receipt.runId}`:'No category execution receipt'}{receipt.checkedAt?` · ${receipt.checkedAt}`:''}</small>
       {receipt.sourceRefs?.map((ref,i)=><div key={i}>{/^https:\/\//.test(ref)?<a href={ref} target="_blank" rel="noopener noreferrer">{ref}</a>:ref}</div>)}
      </details>}
     </div>
     <span className="ci-audit-state">{condensed?shortStatus[receipt.status]:statuses[receipt.status]}</span>
    </div>
   })}
  </div>
  
  {compact&&<button className="secondaryButton inlineButton" onClick={()=>setDetailsOpen(v=>!v)}>{detailsOpen?"Show concise research status":"Show evidence details"}</button>}
  {!condensed&&confidence&&<p className="ci-page-meta">Stored model confidence · ID {score(confidence.identification)} · date {score(confidence.dating)} · value {score(confidence.valuation)}. These are unverified opinions, independent of source completion.</p>}
  <p className="ci-page-meta"><strong>Do not list yet:</strong> final research decision required. Signature reading and maker authentication remain separate.</p>
  {!condensed&&<p className="ci-page-meta">Statuses come from stored work. Inconclusive investigations and missing historical receipts are distinct from never attempted.</p>}
  {!!history?.runs.length&&<details id={objectLabel?undefined:'item-research-history'}><summary>Stored execution history ({history.runs.length})</summary>{history.runs.map(run=>{
   const execution=run.result?.research_execution_v1
   return <div className="note" key={run.id}><strong>{run.created_at} · {run.result?.analysis_stage||'Historical result'}</strong><div>Run {run.id} · {run.model||'Model not recorded'}</div>
    <p>Recorded result: {typeof run.result?.research_summary==='string'?run.result.research_summary:'No confirmed research result. Recover this request before another paid run.'}</p>
    {execution?.version===1&&execution.run_id===run.id?<p>Provider receipt {execution.provider_response_id||'ID unavailable'} · {Array.isArray(execution.web_search_calls)?execution.web_search_calls.length:0} recorded web tool calls. Sources still require independent review.</p>:<p>Historical category/tool receipt missing. Original result retained.</p>}
   </div>
  })}</details>}
  </>}
  {historyHref&&<a className="ci-action-text-link" href={historyHref}>Open investigation history →</a>}
  {onInvestigate&&<button type="button" className="secondaryButton inlineButton" onClick={onInvestigate}>Continue this investigation</button>}
  {onReload&&<button type="button" className="secondaryButton inlineButton" disabled={loading} onClick={onReload}>Reload saved research history</button>}
 </section>
}
