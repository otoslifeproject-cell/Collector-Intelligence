import {auditResearch,researchTypes} from '../lib/researchSaleDecision'
import type {ResearchReceipt,ResearchStatus} from '../lib/researchSaleDecision'
const titles:Record<string,string>={
 PHOTOGRAPH_EXAM:'Photograph examination',SIGNATURE_READING:'Signature and inscription',
 MAKER_ARCHIVE:'Maker / archival corroboration',AUCTION_REALISED:'Verified auction realisations',
 MARKETPLACE_SOLD:'Confirmed marketplace sold',CONDITION_REVIEW:'Condition verification',
 SALES_ECONOMICS:'Net proceeds and venue economics'
}
const statuses:Record<ResearchStatus,string>={
 NOT_RUN:'No execution receipt',RUNNING:'Running',DONE_EVIDENCED:'Evidence recorded',
 INCONCLUSIVE:'Inconclusive',FAILED:'Failed',BLOCKED:'Blocked'
}
export default function ResearchProgress({receipts=[]}:{receipts?:ResearchReceipt[]}){
 const audit=auditResearch(receipts)
 return <section className="panel" aria-label="Research completion audit">
  <div className="panelHeader"><h2>Research completion audit</h2><span>{audit.complete} / {audit.total} evidenced</span></div>
  <p className="ci-page-meta">This measures research supported by execution receipts and traceable sources — not the quality of a model's opinion. No receipt is treated as not verified, even if the research may have happened elsewhere.</p>
  <progress aria-label="Evidence-backed research progress" value={audit.complete} max={audit.total} style={{width:'100%'}}>{audit.percent}%</progress>
  <p aria-live="polite">{audit.percent}% evidenced · {audit.total-audit.complete} categories still requiring verification</p>
  <div className="tableWrap"><table><thead><tr><th>Research type</th><th>Evidence status</th><th>Trace</th></tr></thead><tbody>
   {researchTypes.map(type=>{
    const receipt=audit.receipts.find(x=>x.type===type)!
    return <tr key={type}>
     <td>{titles[type]}</td>
     <td>{statuses[receipt.status]}</td>
     <td>{receipt.status==='DONE_EVIDENCED'?<><small>Run {receipt.runId} · {receipt.checkedAt}</small><div>{(receipt.sourceRefs||[]).join(' · ')}</div></>:receipt.detail||'No independently verified execution/source receipt supplied'}</td>
    </tr>
   })}
  </tbody></table></div>
  {audit.complete!==audit.total&&<p className="ci-page-meta">Incomplete does not necessarily mean the check has never been attempted. Verify original tool receipts and sources before upgrading a stage.</p>}
 </section>
}
