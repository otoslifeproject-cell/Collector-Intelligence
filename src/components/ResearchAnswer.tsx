import {ItemProgress} from './IntakeProgress'
import {useEffect,useState} from 'react'
import type {ResearchAnswer as Answer} from '../lib/researchAnswer'
import {RESEARCH_STEPS,researchStep} from '../lib/researchAnswer'

type Props={
 answer:Answer
 onCopy:()=>void
 copyStatus?:string
 onSave?:()=>void
 saveDisabled?:boolean
 onOpenResearch:()=>void
 onFullResearch?:()=>void
 fullResearchDisabled?:boolean
}
export default function ResearchAnswer({answer,onCopy,copyStatus,onSave,saveDisabled=false,onOpenResearch,onFullResearch,fullResearchDisabled=false}:Props){
 const worthIt=answer.quick&&answer.triage!=='LOW_VALUE'
 return <section className="ci-mini-appraisal ci-research-answer" aria-label="Your answer">
  <h2>{answer.quick?'Quick check':'Your answer'}</h2>
  {answer.quick&&answer.triageText&&<p className="ci-triage" data-triage={answer.triage||'UNCLEAR'}><b>{answer.triageText}</b></p>}
  <div className="ci-mini-line">
   <strong>What it probably is</strong><p title={answer.identity}>{answer.identity}</p>
   <small>{answer.identityBasis}</small>
   <small title={answer.google}>{answer.google}</small>
  </div>
  <div className="ci-mini-line">
   <strong>What it's worth</strong><p title={answer.sold}>{answer.sold}</p>
   <small>{answer.soldBasis}</small>
   {answer.asking&&<small title={answer.asking}>{answer.asking}</small>}
   {answer.range&&<small>{answer.range}</small>}
  </div>
  <div className="ci-mini-line">
   <strong>Where to sell</strong><p title={answer.venue}>{answer.venue}</p>
  </div>
  <div className="ci-mini-line">
   <strong>What to do</strong><p><b>{answer.decision}</b></p>
   {answer.checks.map((check,i)=><small key={i} title={check}>• {check}</small>)}
  </div>
  {worthIt&&onFullResearch&&<button type="button" className="primaryButton ci-mini-cta" disabled={fullResearchDisabled} onClick={onFullResearch}>Do full research · paid</button>}
  <button type="button" className={worthIt&&onFullResearch?'secondaryButton ci-mini-cta':'primaryButton ci-mini-cta'} onClick={onCopy}>Copy listing draft</button>
  {copyStatus&&<p className="ci-mini-feedback" role="status">{copyStatus}</p>}
  <div className="ci-mini-secondary">
   {onSave&&<button type="button" disabled={saveDisabled} className="ci-mini-text-action" onClick={onSave}>Save item to catalogue</button>}
   <button type="button" className="ci-mini-text-action" onClick={onOpenResearch}>See sources and Google matches</button>
  </div>
 </section>
}

// Research continues the same one-run tracker: steps 1-3 are already done by
// the photo analysis. Quick check = step 4, full research = step 5.
// Research continues the same one-run tracker: steps 1-3 are already done by
// the photo analysis. Quick check (writing the questions) = step 4, deep research = step 5.
export function ResearchRunning({quick=false}:{startedAt?:number|null;message?:string;quick?:boolean;deep?:boolean;lowValue?:boolean}){
 return <ItemProgress step={quick?3:4} message={quick?'Checking what to ask you. Usually under a minute.':'Deep research usually takes 3 to 6 minutes. You can leave this page; the answer is saved and collected by itself.'}/>
}
