import {useEffect,useRef,useState} from 'react'
import type {Item} from '../types'
import {supabase} from '../lib/supabase'
import {armyRoles,armyRoleTitles,armySourceUrl,emptyArmyReport,prepareArmyEvent,prepareArmyPlan,readResearchArmy,settleArmyRequest} from '../lib/researchArmy'
import type {ArmyHistory,ArmyRequest,ArmyRole,ArmyRoleReport,ArmyStatus} from '../lib/researchArmy'
import {researchTypes} from '../lib/researchSaleDecision'

type Props={item:Item;onMutating?:(active:boolean)=>void;onChanged?:()=>void}
const statusNames:Record<ArmyStatus,string>={NOT_RUN:'Not run',RUNNING:'In progress',INCONCLUSIVE:'Inconclusive',EVIDENCED:'Source-reviewed',BLOCKED:'Blocked',FAILED:'Failed'}
const lines=(value:string)=>value.split('\n')
const cleanLines=(values:string[])=>values.map(s=>s.trim()).filter(Boolean)
const questions:Record<ArmyRole,string>={COORDINATOR:'Which saved evidence and unresolved checks should this object investigation address?',PHOTO_EXAMINER:'What do this object’s selected original photographs actually show, and what remains unobservable?',ATTRIBUTION_RESEARCHER:'Which documentary sources support or contradict the proposed maker, pattern and date?',RIVAL_CHALLENGER:'Which rival identification best explains the observations, and what evidence could disprove it?',SOURCE_VERIFIER:'What does each reopened original source establish, and which claims remain unverified?',COMPARABLE_SPECIALIST:'Which traceable achieved sales match this physical object, and what price and lot basis do they establish?',SELLING_REVIEWER:'Which individual or grouped sale route has the best evidenced net proceeds after all practical costs?'}
export default function ResearchArmyWorkspace({item,onMutating,onChanged}:Props){
 const[history,setHistory]=useState<ArmyHistory|null>(null),[loaded,setLoaded]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('')
 const[workflowId,setWorkflowId]=useState(''),[role,setRole]=useState<ArmyRole>('COORDINATOR'),[objective,setObjective]=useState('Identify this physical object, challenge rival attributions and establish evidenced selling options.')
 const[photoIds,setPhotoIds]=useState<string[]>([]),[drafts,setDrafts]=useState<Record<string,ArmyRoleReport>>({}),[pending,setPending]=useState<ArmyRequest|null>(null),[busy,setBusy]=useState(false),[canRetry,setCanRetry]=useState(false)
 const alive=useRef(false),serial=useRef(0),lock=useRef(false),held=useRef<ArmyRequest|null>(null)
 const current=()=>alive.current
 const load=async()=>{
  const n=++serial.current;setLoaded(false);setError('')
  try{const value=await readResearchArmy(supabase,item,()=>current()&&n===serial.current);if(!current()||n!==serial.current)return;setHistory(value);setWorkflowId(previous=>value.workflows.some(w=>w.plan.workflowId===previous)?previous:value.workflows[0]?.plan.workflowId||'');setLoaded(true)}
  catch(e){if(current()&&n===serial.current){setHistory(null);setError(e instanceof Error?e.message:'Saved role receipts could not be recovered.')}}
 }
 const facts=JSON.stringify(item)
 useEffect(()=>{alive.current=true;void load();return()=>{alive.current=false;serial.current++}},[item.id,item.owner_id,facts])
 const workflow=history?.workflows.find(w=>w.plan.workflowId===workflowId),roleState=workflow?.roles.find(r=>r.role===role)
 const draftKey=`${workflowId}:${role}`,report=drafts[draftKey]||roleState?.latest?.payload.report||{...emptyArmyReport(workflow?.plan.payload.photoIds),question:questions[role]}
 const change=(key:keyof ArmyRoleReport,value:any)=>setDrafts(previous=>({...previous,[draftKey]:{...report,[key]:value}}))
 const exportNotes=()=>{
  const data={format:'collector-native-research-workflow-v1',exportedAt:new Date().toISOString(),itemId:item.id,ownerId:item.owner_id,storageConfirmation:'CHECK_STORED_HISTORY',pending:held.current,objective,photoIds,role,report,history}
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=`${item.item_code.replace(/[^a-zA-Z0-9_-]/g,'_')}-research-workflow.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
 }
 const run=async(kind:'PLAN'|'START'|'RESULT'|'CHECK'|'RETRY')=>{
  if(lock.current)return;lock.current=true;setBusy(true);setError('');setMessage('');const mutating=kind!=='CHECK';if(mutating)onMutating?.(true)
  let confirmed=false
  try{
   let request=held.current
   if(kind==='PLAN'||kind==='START'||kind==='RESULT'){
    if(request)throw Error('Check the held research event before creating another.')
    if(!loaded)throw Error('Recover complete research workflow history first.')
    const submittedReport={...report,sourceUrls:cleanLines(report.sourceUrls),disagreements:cleanLines(report.disagreements),hypotheses:report.hypotheses.map(h=>({...h,sourceUrls:cleanLines(h.sourceUrls)}))}
    request=kind==='PLAN'?await prepareArmyPlan(supabase,item,photoIds,objective,current):workflow?await prepareArmyEvent(supabase,item,workflow,role,kind,submittedReport,current):null
    if(!request)throw Error('Choose a saved research plan first.');if(!current())return;held.current=request;setPending(request)
   }
   if(!request)throw Error('No held research event needs recovery.')
   if(kind==='RETRY'&&!canRetry)throw Error('Check the saved outcome before retrying the same event.')
   setCanRetry(false);const record=await settleArmyRequest(supabase,request,current,kind!=='CHECK');if(!current())return
   if(record){held.current=null;setPending(null);confirmed=true;setMessage('Research event confirmed from stored readback. Original history and independent evidence gates are retained.');await load()}
   else{setCanRetry(kind==='CHECK');setMessage(kind==='CHECK'?'No stored row was confirmed for this exact event. You may retry the same event or export its notes.':'Save outcome is unconfirmed. Keep this page open and Check saved research event before retrying.')}
  }catch(e){if(current())setError(e instanceof Error?e.message:'Research event could not be confirmed. Preserve the held notes and recover history.')}
  finally{lock.current=false;if(mutating)onMutating?.(false);if(current()){setBusy(false);if(confirmed)onChanged?.()}}
 }
 return <section className="panel ci-army-workspace" aria-label={`Research Army workspace — ${item.item_code}`}>
  <div className="panelHeader"><h2>Research Army</h2><span>Seven bounded review roles</span></div>
  <p>Build on saved research, record actual investigations and challenge the evidence before choosing a selling route. The role workspace preserves work; the object’s research audit and current independent final assessment determine listing readiness.</p>
  <p className="ci-page-meta">Creating a plan records seven tasks. Starting a role records manual work you are beginning; it does not launch a paid search. Owner notes remain unverified until a distinct reviewer checks existing qualified evidence. Provider calls: 0 · provider cost: 0.</p>
  {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
  <div className="ci-army-actions"><button className="secondaryButton inlineButton" disabled={busy} onClick={()=>void load()}>Reload research workflow</button><button className="secondaryButton inlineButton" onClick={exportNotes}>Export research notes</button></div>
  {!loaded&&!error&&<p role="status">Reading saved role executions…</p>}
  {history&&<>
   {!!history?.workflows.length&&<label className="ci-army-select">Saved investigation<select disabled={busy||!!pending} value={workflowId} onChange={e=>setWorkflowId(e.target.value)}>{history.workflows.map(w=><option key={w.plan.workflowId} value={w.plan.workflowId}>{w.plan.createdAt} · {w.currentFacts?'current facts':'earlier facts'} · {w.plan.payload.objective}</option>)}</select></label>}
   {workflow&&<>
    <p><strong>Next action:</strong> {workflow.nextAction}</p>
    <p className="ci-page-meta">{workflow.roles.filter(r=>r.status==='EVIDENCED').length} of 7 role receipts source-reviewed · {workflow.events.length} recorded events. {workflow.currentFacts?'Current catalogue facts.':'Historical plan: catalogue facts changed.'}</p>
    <div className="ci-army-role-grid" role="list" aria-label="Research workflow roles">{workflow.roles.map(r=><div className="ci-army-role" role="listitem" key={r.role}><strong>{armyRoleTitles[r.role]}</strong><span>{statusNames[r.status]}</span><small>{r.history.length} stored events</small></div>)}</div>
    <details className="ci-army-investigation"><summary>Record or resume a role investigation</summary>
     <fieldset disabled={busy||!!pending||!loaded||!workflow.currentFacts} className="ci-army-fieldset">
      <label>Review role<select value={role} onChange={e=>setRole(e.target.value as ArmyRole)}>{armyRoles.map(r=><option key={r} value={r}>{armyRoleTitles[r]}</option>)}</select></label>
      <div className="ci-review-fields">
       <label>Investigation question<textarea value={report.question} onChange={e=>change('question',e.target.value)}/></label>
       <label>Actual query or examination method<textarea value={report.query} onChange={e=>change('query',e.target.value)}/></label>
       <label>Tool used<input value={report.tool} onChange={e=>change('tool',e.target.value)}/></label>
       <label>Recorded outcome<select value={report.outcome} onChange={e=>change('outcome',e.target.value)}><option value="INCONCLUSIVE">Inconclusive — further verification required</option><option value="BLOCKED">Blocked — missing evidence or access</option><option value="FAILED">Failed — attempted check failed</option></select></label>
       <label>Observed results<textarea value={report.summary} onChange={e=>change('summary',e.target.value)}/></label>
       <label>Unresolved issues and next check<textarea value={report.unresolvedIssues} onChange={e=>change('unresolvedIssues',e.target.value)}/></label>
       <label>Original source URLs (one per line)<textarea value={report.sourceUrls.join('\n')} onChange={e=>change('sourceUrls',lines(e.target.value))}/></label>
       <label>Disagreements or contradictory evidence (one per line)<textarea value={report.disagreements.join('\n')} onChange={e=>change('disagreements',lines(e.target.value))}/></label>
      </div>
      <fieldset className="ci-army-photos"><legend>Photographs actually examined for this role</legend>{workflow.plan.payload.photoIds.map(id=>{const photo=history?.photos.find(p=>p.id===id);return <label key={id}><input type="checkbox" checked={report.photoIds.includes(id)} onChange={e=>change('photoIds',e.target.checked?[...report.photoIds,id]:report.photoIds.filter(p=>p!==id))}/>{photo?.file_name||id}</label>})}</fieldset>
      <fieldset className="ci-army-photos"><legend>Research checks actually attempted</legend><p>Select only the checks this execution addresses. This records scope, not verification.</p>{researchTypes.map(category=><label key={category}><input type="checkbox" checked={report.categoryIds.includes(category)} onChange={e=>change('categoryIds',e.target.checked?[...report.categoryIds,category]:report.categoryIds.filter(id=>id!==category))}/>{category.replaceAll('_',' ').toLowerCase()}</label>)}</fieldset>
      <div className="ci-army-hypotheses">{report.hypotheses.map((h,index)=><fieldset key={index}><legend>Attribution alternative {index+1}</legend><label>Candidate<input value={h.candidate} onChange={e=>change('hypotheses',report.hypotheses.map((v,i)=>i===index?{...v,candidate:e.target.value}:v))}/></label><label>Hypothesis state<select value={h.status} onChange={e=>change('hypotheses',report.hypotheses.map((v,i)=>i===index?{...v,status:e.target.value}:v))}><option value="UNRESOLVED">Unresolved</option><option value="SUPPORTED">Supported by reported observations — unverified</option><option value="REJECTED">Rejected with recorded reason</option></select></label><label>Reason and discriminating observation<textarea value={h.reason} onChange={e=>change('hypotheses',report.hypotheses.map((v,i)=>i===index?{...v,reason:e.target.value}:v))}/></label><label>Alternative source URLs<textarea value={h.sourceUrls.join('\n')} onChange={e=>change('hypotheses',report.hypotheses.map((v,i)=>i===index?{...v,sourceUrls:lines(e.target.value)}:v))}/></label></fieldset>)}<button className="secondaryButton inlineButton" disabled={report.hypotheses.length>=30} onClick={()=>change('hypotheses',[...report.hypotheses,{candidate:'',status:'UNRESOLVED',reason:'',sourceUrls:[]}])}>Add rival hypothesis</button></div>
      <div className="ci-army-actions"><button className="primaryButton inlineButton" disabled={roleState?.status==='RUNNING'} onClick={()=>void run('START')}>Record investigation start</button><button className="secondaryButton inlineButton" disabled={roleState?.latest?.kind!=='START'} onClick={()=>void run('RESULT')}>Save investigation result</button></div>
     </fieldset>
    </details>
    <details className="ci-army-investigation"><summary>Role execution history ({workflow.events.length})</summary>{workflow.events.map(event=><article className="note" key={event.eventId}><strong>{armyRoleTitles[event.role]} · {statusNames[event.status]}</strong><p>{event.payload.report.summary||'Investigation start recorded; no result yet.'}</p><p>Question: {event.payload.report.question}</p><p>Method/query: {event.payload.report.query} · {event.payload.report.tool}</p><p>Unresolved: {event.payload.report.unresolvedIssues||'Outcome not yet recorded.'}</p>{event.payload.report.disagreements.map((v,i)=><p key={i}>Contradiction: {v}</p>)}{event.payload.report.hypotheses.map((h,i)=><p key={i}>{h.candidate} · {h.status.toLowerCase()} · {h.reason}</p>)}{event.payload.report.sourceUrls.filter(armySourceUrl).map(url=><div key={url}><a href={url} target="_blank" rel="noopener noreferrer">{url}</a></div>)}<small>{event.createdAt} · {event.eventId} · {event.payload.report.photoIds.length} original photos · provider calls {event.providerCalls} · provider cost {event.providerAmount}</small></article>)}</details>
   </>}
   <details className="ci-army-investigation"><summary>{history?.workflows.length?'Create a new investigation plan':'Create this object’s investigation plan'}</summary><p>Earlier plans and their receipts remain in history. Saving new research work requires the separate final assessment to be checked again.</p><fieldset disabled={busy||!!pending} className="ci-army-fieldset"><label>Research objective<textarea value={objective} onChange={e=>setObjective(e.target.value)}/></label><fieldset className="ci-army-photos"><legend>Exact original photographs for this physical object</legend>{history?.photos.map(photo=><label key={photo.id}><input type="checkbox" checked={photoIds.includes(photo.id)} onChange={e=>setPhotoIds(previous=>e.target.checked?[...previous,photo.id]:previous.filter(id=>id!==photo.id))}/>{photo.file_name||photo.id}</label>)}{!history?.photos.length&&<p>No owned original photograph links were confirmed. Recover them before creating a plan.</p>}</fieldset><button className="primaryButton inlineButton" disabled={!photoIds.length} onClick={()=>void run('PLAN')}>Save investigation plan</button></fieldset></details>
  </>}
  {pending&&<div className="note"><p>One immutable event is held. Check reads its stored outcome; a deliberate retry uses the same identity and facts. Keep this page open until confirmed or exported.</p><div className="ci-army-actions"><button className="secondaryButton inlineButton" disabled={busy} onClick={()=>void run('CHECK')}>Check saved research event</button><button className="secondaryButton inlineButton" disabled={busy||!canRetry} onClick={()=>void run('RETRY')}>Retry same research event</button></div></div>}
 </section>
}
