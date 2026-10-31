// ONE RUN (Dean, 29 Oct): the whole chain from upload to result is one tracker
// with one list of steps in the order they really happen. The photo analysis
// page and the item page both show it; neither restarts the list.
export const ONE_RUN_STEPS=['Photos saved','Google Lens','Reading your photos','Questions for you','Deep research','Your result'] as const
export const ONE_RUN_TITLE='Working on your item'

type ItemProps={step:number;stopped?:boolean;skipped?:number[];message?:string;onRetry?:()=>void;retryLabel?:string;disabled?:boolean}
export function ItemProgress({step,stopped=false,skipped=[],message,onRetry,retryLabel='Try again',disabled=false}:ItemProps){
 return <section className="ci-analysis-tracker" role="status" aria-live="polite" aria-label="Progress">
  <h2>{ONE_RUN_TITLE}</h2>
  <ol className="ci-analysis-tracker-list">
   {ONE_RUN_STEPS.map((label,index)=>{
    const state=skipped.includes(index)?'complete':index<step?'complete':index===step&&!stopped?'active':'waiting'
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

type Phase='idle'|'saved'|'checking'|'looking'|'nearly'|'ready'|'stopped'
type Props={phase:Phase;message?:string;onRetry?:()=>void;retryLabel?:string;disabled?:boolean}
// Photo analysis covers the first three steps: saved, Google Lens (runs first,
// inside the analysis), then reading the photos. "Ready" hands on to step 4.
const phaseStep:Record<Phase,number>={idle:0,saved:0,checking:1,looking:2,nearly:2,ready:3,stopped:1}
export default function IntakeProgress({phase,message,onRetry,retryLabel='Try again',disabled=false}:Props){
 return <ItemProgress step={phaseStep[phase]} stopped={phase==='stopped'} message={message} onRetry={onRetry} retryLabel={retryLabel} disabled={disabled}/>
}
export type {Phase as IntakeProgressPhase}
