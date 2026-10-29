import type {miniAppraisal} from '../lib/miniAppraisal'

type Appraisal=ReturnType<typeof miniAppraisal>
type Props={
  appraisal:Appraisal
  onCopy:()=>void
  copyStatus?:string
  onSave?:()=>void
  saveDisabled?:boolean
  onOpenDetails?:()=>void
  sold?:boolean
}
export default function MiniAppraisal({appraisal,onCopy,copyStatus,onSave,saveDisabled=false,onOpenDetails,sold=false}:Props){
 return <section className="ci-mini-appraisal" aria-label="Your answer">
  <div className="ci-mini-steps" aria-label="Three-step journey">
   <span>1 · Add photos</span><span>2 · Analyse</span><strong>3 · Answer</strong>
  </div>
  <h2>Your answer</h2>
  <div className="ci-mini-line">
   <strong>What it is</strong><p title={appraisal.identity}>{appraisal.identity}</p>
  </div>
  <div className="ci-mini-line">
   <strong>What it's worth</strong><p title={appraisal.worth}>{appraisal.worth}</p>
   <small title={appraisal.worthBasis}>{appraisal.worthBasis}</small>
  </div>
  <div className="ci-mini-line">
   <strong>Where to sell</strong><p title={appraisal.venue}>{appraisal.venue}</p>
  </div>
  <div className="ci-mini-line">
   <strong>What to do</strong><p><b>{appraisal.decision==='Check'?'Research needed before selling':appraisal.decision}</b></p>
  </div>
  <button type="button" className="primaryButton ci-mini-cta" onClick={onCopy}>
   {sold?'View recorded sale':'Copy listing draft'}
  </button>
  {copyStatus&&<p className="ci-mini-feedback" role="status">{copyStatus}</p>}
  {(onSave||onOpenDetails)&&<div className="ci-mini-secondary">
    {onSave&&<button type="button" disabled={saveDisabled} className="ci-mini-text-action" onClick={onSave}>Save item to catalogue</button>}
    {onOpenDetails&&<button type="button" className="ci-mini-text-action" onClick={onOpenDetails}>Open details and challenge findings</button>}
  </div>}
 </section>
}
