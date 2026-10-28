type Phase='idle'|'saved'|'checking'|'looking'|'nearly'|'ready'|'stopped'
type Props={phase:Phase;message?:string;onRetry?:()=>void;retryLabel?:string;disabled?:boolean}
const labels=['Photos saved','Checking sources','Looking at your photos','Nearly there','Ready'] as const
const phaseIndex:Record<Phase,number>={idle:-1,saved:0,checking:1,looking:2,nearly:3,ready:4,stopped:0}
export default function IntakeProgress({phase,message,onRetry,retryLabel='Try again',disabled=false}:Props){
 const active=phaseIndex[phase]
 return <section className="ci-analysis-tracker" role="status" aria-live="polite" aria-label="Photo analysis progress">
  <h2>Photo analysis</h2>
  <ol className="ci-analysis-tracker-list">
   {labels.map((label,index)=> {
    const state=phase==='stopped'?index===0?'complete':'waiting':
      index<active?'complete':index===active?'active':'waiting'
    return <li className="ci-analysis-step" data-state={state} key={label}>
     <span className="ci-analysis-dot" aria-hidden="true">{state==='complete'?'✓':index+1}</span>
     <strong>{label}</strong>
     {state==='active'&&<span className="ci-analysis-current">In progress</span>}
    </li>
   })}
  </ol>
  {message&&<p className="ci-analysis-tracker-message">{message}</p>}
  {onRetry&&<button type="button" className="primaryButton intakeBigButton" disabled={disabled} onClick={onRetry}>{retryLabel}</button>}
 </section>
}
export type {Phase as IntakeProgressPhase}
