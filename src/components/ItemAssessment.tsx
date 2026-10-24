import {useEffect,useRef,useState} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import type {Item} from '../types'
import type {ResearchAudit} from '../lib/researchSaleDecision'
import {assessmentIsCurrent,prepareItemAssessment,readAssessmentHistory,settleItemAssessment,ItemAssessmentStaleMissingError} from '../lib/itemAssessment'
import type {AssessmentRequest,HoldAdvice,StoredItemAssessment} from '../lib/itemAssessment'

type Props={client:SupabaseClient;item:Item;audit?:ResearchAudit;onRefreshFacts?:()=>Promise<void>;onChanged?:()=>void;onMutating?:(active:boolean)=>void;qualifiedReviewId?:string}
const initial:HoldAdvice={decision:'DO_NOT_LIST_YET',rationale:'',unresolvedIssues:'',nextAction:'',routeGuidance:'',confidence:{identification:null,dating:null,valuation:null},sourceRefs:[]}
export default function ItemAssessment(props:Props){
 return <AssessmentRecord key={`${props.item.owner_id}:${props.item.id}`} {...props}/>
}
function AssessmentRecord({client,item,audit,onRefreshFacts,onChanged,onMutating,qualifiedReviewId}:Props){
 const [advice,setAdvice]=useState<HoldAdvice>(initial),[sourceText,setSourceText]=useState('')
 const [rows,setRows]=useState<StoredItemAssessment[]>([]),[currentId,setCurrentId]=useState<string|null>(null)
 const [pending,setPending]=useState<AssessmentRequest|null>(null),[message,setMessage]=useState(''),[error,setError]=useState('')
 const [busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false)
 const [canRetry,setCanRetry]=useState(false)
 const [staleMissing,setStaleMissing]=useState(false)
 const alive=useRef(false),lock=useRef(false),serial=useRef(0),held=useRef<AssessmentRequest|null>(null)
 const current=()=>alive.current
 const load=async()=>{
  const n=++serial.current;setLoaded(false);setError('')
  try{const history=await readAssessmentHistory(client,item,()=>current()&&n===serial.current)
   if(!current()||n!==serial.current)return
   setRows(history.rows);setCurrentId(history.rows.find(r=>assessmentIsCurrent(r,history.context))?.id||null);setLoaded(true)
  }catch(e){if(current()&&n===serial.current){setRows([]);setCurrentId(null);setError(e instanceof Error?e.message:'Final assessment history is unavailable.')}}
 }
 const facts=JSON.stringify(item)
 useEffect(()=>{alive.current=true;void load();return()=>{alive.current=false;serial.current++}},[item.id,item.owner_id,facts])
 const run=async(mode:'SAVE'|'CHECK'|'RETRY')=>{
  if(lock.current)return;lock.current=true;setBusy(true);setError('');setMessage('')
  try{
   if(mode!=='CHECK')onMutating?.(true)
   let request=held.current
   if(mode==='SAVE'){
    if(request)throw Error('Check the held decision before recording another assessment.')
    if(!audit||!loaded)throw Error('Load the current research and final decision history first.')
    request=await prepareItemAssessment(client,item,{...advice,sourceRefs:sourceText.split('\n').map(s=>s.trim()).filter(Boolean)},audit,current)
    if(!current())return;held.current=request;setPending(request)
   }
   if(!request)throw Error('There is no held decision to check.')
   if(mode==='RETRY'&&!canRetry)throw Error('Use Check saved decision before retrying the same held event.')
   setCanRetry(false)
   const saved=await settleItemAssessment(client,request,current,mode!=='CHECK')
   if(!current())return
   if(saved){onChanged?.();held.current=null;setPending(null);setMessage(saved.current?'Final hold decision confirmed by stored readback. This does not certify research completion.':'Earlier hold decision recovered. Item facts changed; a new assessment is required.');await load()}
   else{setCanRetry(mode==='CHECK');setMessage(mode==='CHECK'?'No stored row confirmed for this exact held decision. Retry the same decision only after this check, or export it.':'Save outcome is not confirmed. Keep this page open and use Check saved decision before retrying. No sale-ready status was created.')}
  }catch(e){if(current()){setStaleMissing(mode==='CHECK'&&e instanceof ItemAssessmentStaleMissingError);setError(e instanceof Error?e.message:'The decision could not be confirmed. Keep the held advice and check again.')}}
  finally{lock.current=false;if(current()){if(mode!=='CHECK')onMutating?.(false);setBusy(false)}}
 }
 const exportAdvice=()=>{
  const data=pending||{itemId:item.id,ownerId:item.owner_id,advice:{...advice,sourceRefs:sourceText.split('\n').map(s=>s.trim()).filter(Boolean)},researchAudit:audit}
  const url=URL.createObjectURL(new Blob([JSON.stringify({format:'collector-item-hold-review-v1',exportedAt:new Date().toISOString(),storageConfirmation:'NOT_CONFIRMED_FOR_THIS_EXPORT',currentStoredDecisionId:currentId,review:data},null,2)],{type:'application/json'}))
  const a=document.createElement('a');a.href=url;a.download=`${item.item_code.replace(/[^a-zA-Z0-9_-]/g,'_')}-hold-review.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
 }
 const latest=qualifiedReviewId?undefined:rows.find(r=>r.id===currentId)
 return <section className="panel ci-item-assessment" aria-label={`Owner hold decision — ${item.item_code}`}>
  <div className="panelHeader"><h2>Owner hold decision and guidance</h2><span>{latest?latest.decision.replaceAll('_',' '):loaded?'NO CURRENT OWNER HOLD':error?'OWNER HOLD HISTORY UNAVAILABLE':'READING OWNER HOLD HISTORY'}</span></div>
  <p className="ci-page-meta">Research and a final evidenced assessment are required before listing. An owner hold records advice and unresolved work; it cannot verify sources, complete a research stage or approve a sale.</p>
  {latest&&<div><strong>{latest.decision.replaceAll('_',' ')}</strong><p>{latest.assessment.rationale}</p><p>Unresolved: {latest.assessment.unresolvedIssues}</p><p>Next action: {latest.assessment.nextAction}</p><p>Selling guidance: {latest.assessment.routeGuidance}</p><small>Owner-reported, unverified · {latest.created_at} · {latest.id}</small></div>}
  {!latest&&loaded&&<p>{qualifiedReviewId?'The source-reviewed final assessment below governs current readiness. Earlier owner holds remain in history.':'No current owner hold is recorded for these catalogue facts. Research completion and a final source-reviewed decision are assessed separately.'}</p>}
  {error&&<p role="status">{error}</p>}{message&&<p role="status">{message}</p>}
  <button className="secondaryButton inlineButton" disabled={busy} onClick={()=>void load()}>Reload final decision history</button>
  <details style={{marginTop:12}}><summary>Record a hold decision and guidance</summary>
   <p className="ci-page-meta">This records an owner review. Leave confidence unknown unless you can justify it. Source references are retained as reported, without treating them as independently verified. Unsaved text remains on this page only.</p>
   <fieldset disabled={busy||!!pending} style={{border:0,padding:0,minWidth:0}}><div className="ci-review-fields">
    <label>Decision<select aria-label="Decision" value={advice.decision} onChange={e=>setAdvice(v=>({...v,decision:e.target.value as HoldAdvice['decision']}))}><option value="DO_NOT_LIST_YET">DO NOT LIST YET</option><option value="SPECIALIST_REVIEW">SPECIALIST REVIEW</option></select></label>
    {([['rationale','Decision rationale (at least 40 characters)'],['unresolvedIssues','Unresolved identification / value issues'],['nextAction','Next recommended action'],['routeGuidance','Selling route guidance while research is incomplete']] as const).map(([key,label])=><label key={key}>{label}<textarea maxLength={6000} value={advice[key]} onChange={e=>setAdvice(v=>({...v,[key]:e.target.value}))}/></label>)}
    {(['identification','dating','valuation'] as const).map(key=><label key={key}>Owner-reported {key} confidence (%)<input type="number" min="0" max="100" step="1" placeholder="Unknown" value={advice.confidence[key]??''} onChange={e=>{const n=e.target.value===''?null:Number(e.target.value);setAdvice(v=>({...v,confidence:{...v.confidence,[key]:n}}))}}/></label>)}
    <label>Reported source references (one per line)<textarea value={sourceText} onChange={e=>setSourceText(e.target.value)}/></label>
   </div></fieldset>
   <div style={{display:'flex',flexWrap:'wrap',gap:8,marginTop:12}}>
    <button className="primaryButton inlineButton" disabled={busy||!loaded||!audit||!!pending} onClick={()=>void run('SAVE')}>Save hold decision</button>
    {pending&&<><button className="secondaryButton inlineButton" disabled={busy} onClick={()=>void run('CHECK')}>Check saved decision</button><button className="secondaryButton inlineButton" disabled={busy||!canRetry} onClick={()=>void run('RETRY')}>Retry same held decision</button></>}
    <button className="secondaryButton inlineButton" onClick={exportAdvice}>Export hold review</button>
    {pending&&staleMissing&&<button className="secondaryButton inlineButton" disabled={busy} onClick={async()=>{try{exportAdvice();await onRefreshFacts?.();if(!current())return;held.current=null;setPending(null);setCanRetry(false);setStaleMissing(false);setMessage('Earlier held advice exported. Review current stored facts before a new save.');await load()}catch(e){setError(e instanceof Error?e.message:'Current review could not be opened. Held advice remains here.')}}}>Export held advice and start current review</button>}
   </div>
   {pending&&<p>One immutable save is held for this object. Check reads the stored outcome only. A retry uses the same event and facts; do not refresh until confirmed or exported.</p>}
  </details>
  <details style={{marginTop:12}}><summary>Final decision history ({rows.length})</summary>{rows.map(row=><article key={row.id} style={{marginTop:12,overflowWrap:'anywhere'}}><strong>{row.decision.replaceAll('_',' ')} · {row.id===currentId&&!qualifiedReviewId?'current catalogue facts':'historical owner hold'}</strong><p>{row.assessment.rationale}</p><p>Unresolved: {row.assessment.unresolvedIssues}</p><p>Next: {row.assessment.nextAction}</p><p>{row.assessment.routeGuidance}</p><small>{row.created_at} · {row.id} · owner-reported, unverified</small><details><summary>Full recorded advice, confidence and research snapshot</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(row.assessment,null,2)}</pre></details></article>)}</details>
 </section>
}
