import {useEffect,useRef,useState} from 'react'
import {ArrowLeft,Bell} from 'lucide-react'
import {Link,useNavigate,useParams} from 'react-router-dom'
import ObjectCollectionToolbar from '../components/ObjectCollectionToolbar'
import {supabase} from '../lib/supabase'
import {suggestSingleIntakePair} from '../lib/pairGrouping'
import {money} from '../lib/format'
import ResearchDecisionPanel from '../components/ResearchDecisionPanel'
import SaleEconomics from '../components/SaleEconomics'
import VisualReferenceWorkbench from '../components/VisualReferenceWorkbench'
import WorkspaceActionPanel from '../components/WorkspaceActionPanel'
import InfoDisclosure from '../components/InfoDisclosure'
import {feedbackForObject,currentOwnerMaterial,researchPredatesCorrection,materialContradictsVisualGuess} from '../lib/ownerCorrections'

type SavedRun={id:string;status:string;mode:string;created_at:string;result:any;input_photo_count:number;owner_review_revision:number;user_context?:any}
export default function SavedDraft(){
 const {id}=useParams()
 const reportMenuRef=useRef<HTMLDetailsElement>(null)
 const navigate=useNavigate()
 const [run,setRun]=useState<SavedRun|null>(null)
 const [images,setImages]=useState<Record<number,string>>({})
 const [error,setError]=useState('')
 const [busy,setBusy]=useState(true)
 const [edits,setEdits]=useState<Record<number,{working_title:string;condition_summary:string}>>({})
 const [saving,setSaving]=useState(false)
 const [approving,setApproving]=useState(false)
 const [selected,setSelected]=useState<Record<number,boolean>>({})
 const [groupPair,setGroupPair]=useState(true)
 const [confirmedPhotoCorrection,setConfirmedPhotoCorrection]=useState(false)
 const [catalogued,setCatalogued]=useState<Array<{item_id:string;item_code:string;title:string;object_index:number}>>([])
 const [saveStatus,setSaveStatus]=useState('')
 const [activeTab,setActiveTab]=useState(()=>{
   try{return new URLSearchParams(window.location.hash.split('?')[1]||'').get('tab')||'overview'}catch{return 'overview'}
 })
 const [researching,setResearching]=useState(false)
 const [researchIndex,setResearchIndex]=useState(0)
 const [researchResult,setResearchResult]=useState<any|null>(null)
 const [researchAudit,setResearchAudit]=useState<any|null>(null)
 const [researchHistory,setResearchHistory]=useState<any[]>([])
 const [unfinishedResearch,setUnfinishedResearch]=useState<any[]>([])
 const [lastResearchScope,setLastResearchScope]=useState('')
 const [verdictFeedback,setVerdictFeedback]=useState<any[]>([])
 const [disagreeOpen,setDisagreeOpen]=useState(false)
 useEffect(()=>{
  const closeOutside=(event:PointerEvent)=>{
   if(reportMenuRef.current?.open&&!reportMenuRef.current.contains(event.target as Node)){
    reportMenuRef.current.open=false
    setDisagreeOpen(false)
   }
  }
  document.addEventListener('pointerdown',closeOutside)
  return ()=>document.removeEventListener('pointerdown',closeOutside)
 },[])
 const [disagreementMaterial,setDisagreementMaterial]=useState('Metal')
 const [disagreementType,setDisagreementType]=useState('MATERIAL_CORRECTION')
 const [disagreementNote,setDisagreementNote]=useState('')
 const [savingDisagreement,setSavingDisagreement]=useState(false)
 const [query,setQuery]=useState('')
 const [filter,setFilter]=useState('ALL')
 const [view,setView]=useState<'tiles'|'list'|'compact'>(()=>{try{const v=window.localStorage.getItem('ci-inventory-view');return v==='list'||v==='compact'?v:'tiles'}catch{return 'tiles'}})
 const changeView=(v:'tiles'|'list'|'compact')=>{setView(v);try{window.localStorage.setItem('ci-inventory-view',v)}catch{}}
 useEffect(()=>{
  let alive=true
  async function load(){
   setBusy(true);setError('');setRun(null);setImages({})
   const {data,error:e}=await supabase.from('ai_analysis_runs').select('id,status,mode,created_at,result,input_photo_count,owner_review_revision,user_context').eq('id',id||'').single()
   if(!alive)return
   if(e||!data){setError('Saved report unavailable or access denied.');setBusy(false);return}
   const report=data as SavedRun
   setRun(report)
   setGroupPair(!!suggestSingleIntakePair(report.result?.objects||[],report.mode))
   setConfirmedPhotoCorrection(false)
   setSelected(Object.fromEntries((report.result?.objects||[]).map((_:any,i:number)=>[i,true])))
   const {data:prior}=await supabase.from('ai_analysis_runs')
    .select('id,result,created_at,user_context').eq('mode','research').order('created_at',{ascending:false}).limit(100)
   if(alive){
     const related=(prior||[]).filter((x:any)=>x.user_context?.source_analysis_run_id===report.id)
     const past=related.filter((x:any)=>x.result?.research_summary)
     setUnfinishedResearch(related.filter((x:any)=>!x.result?.research_summary))
     setResearchHistory(past)
     if(past.length){setResearchResult(past[0].result);setResearchAudit(past[0].result?.source_audit||null)}
   }
   const {data:feedbackRows,error:feedbackError}=await supabase.from('ai_verdict_feedback')
    .select('id,source_object_index,feedback_type,corrected_material,owner_statement,created_at')
    .eq('source_analysis_run_id',report.id).order('created_at',{ascending:false}).limit(100)
   if(!alive)return
   if(feedbackError){setError('Owner corrections unavailable; no paid research can safely use this report.');setBusy(false);return}
   setVerdictFeedback(feedbackRows||[])
   const overrides=report.result?.owner_review?.objects || {}
   setEdits(Object.fromEntries((report.result?.objects||[]).map((o:any,i:number)=>[i,{working_title:overrides[i]?.working_title??o.working_title??'',condition_summary:overrides[i]?.condition_summary??o.condition_summary??''}])))
   const manifest=Array.isArray(report.result?.image_manifest)?report.result.image_manifest:[]
   const requests=manifest.filter((p:any)=>Number.isInteger(p.index)&&typeof p.storage_path==='string')
   const signed=await Promise.all(requests.map(async(p:any)=>{
    const {data:u}=await supabase.storage.from('item-images').createSignedUrl(p.storage_path,1800)
    return [p.index,u?.signedUrl||''] as const
   }))
   if(alive){setImages(Object.fromEntries(signed));setBusy(false)}
  }
  load()
  return ()=>{alive=false}
 },[id])
 const save=async()=>{
  if(!run||run.status!=='DRAFT')return
  setSaving(true);setSaveStatus('')
  try{
   const {data,error:writeError}=await supabase.rpc('ci_save_owner_review_v1',{
    p_run_id:run.id,p_expected_revision:run.owner_review_revision??0,
    p_object_changes:edits
   })
   if(writeError)throw Error(writeError.message)
   if(!Array.isArray(data)||data.length!==1||typeof data[0]?.revision!=='number')
    throw Error('Owner review could not be confirmed. Check original report before retrying.')
   setRun(r=>r?{...r,owner_review_revision:data[0].revision,
    result:{...r.result,owner_review:data[0].owner_review}}:r)
   setSaveStatus('Owner review revision '+data[0].revision+' saved with previous edits preserved. No AI rerun.')
  }catch(e:any){
   const detail=e?.message||'Save failed'
   setSaveStatus(detail.includes('REVIEW_REVISION_CONFLICT')
    ? 'Another tab saved a newer review. Your current text remains here. Copy your edits before reloading this page. No later edits were overwritten.'
    :detail)
  }
  finally{setSaving(false)}
 }
 const openSavedObject=(i:number)=>{
  changeView('tiles')
  requestAnimationFrame(()=>{
   const card=document.getElementById('ci-object-'+i)
   card?.scrollIntoView({block:'center',behavior:'auto'})
   const review=card?.querySelector('details.ci-object-review') as HTMLDetailsElement|null
   if(review)review.open=true
  })
 }
 const pairProposal=run?suggestSingleIntakePair(run.result?.objects||[],run.mode):null
 const paired=!!pairProposal&&groupPair
 const selectedIndices=paired?(selected[0]===false?[]:[0]):(run?.result?.objects||[]).flatMap((_:any,i:number)=>selected[i]===false?[]:[i]) as number[]
 const manifestIndices=new Set<number>(Array.isArray(run?.result?.image_manifest)
    ? run!.result.image_manifest.map((x:any)=>x.index).filter((x:any)=>Number.isInteger(x)):[])
 const indicesForReview=(i:number):number[]=>{
   const objects=run?.result?.objects||[]
   const source=paired&&i===0
    ? [...(objects[0]?.image_indices||[]),...(objects[1]?.image_indices||[])]
    : objects[i]?.image_indices||[]
   return [...new Set<number>(source.filter((x:any)=>Number.isInteger(x)))]
 }
 const missingSourceIndices=selectedIndices.flatMap(i=>indicesForReview(i).filter(n=>!manifestIndices.has(n)))
 const needsPhotoCorrection=missingSourceIndices.length>0
 const noticeCount=run&&(needsPhotoCorrection||!Array.isArray(run.result?.image_manifest)||run.result?.analysis_stage!=='COMPLETE')?1:0
 const hasReviewObjects=!!run && Array.isArray(run.result?.objects) && run.result.objects.length>0
 const isPhotoManifestReady=!!run && Array.isArray(run.result?.image_manifest) &&
    run.result.image_manifest.length===run.input_photo_count && run.input_photo_count>0 &&
    run.result?.analysis_stage==='COMPLETE'
 const scopeIndex=paired?0:researchIndex
 const scopeKey=String(scopeIndex)+':'+(paired?'pair':'single')
 const scopeFeedback=feedbackForObject(verdictFeedback,scopeIndex,paired)
 const correctedMaterial=currentOwnerMaterial(scopeFeedback)
 const matchedResearchRun=researchHistory.find((x:any)=>
   x.user_context?.source_object_index===scopeIndex &&
   (Array.isArray(x.user_context?.pair_source_indices)&&x.user_context.pair_source_indices.length===2)===paired)
 const visibleResearch=matchedResearchRun?.result || (lastResearchScope===scopeKey?researchResult:null)
 const visibleAudit=matchedResearchRun?.result?.source_audit || (lastResearchScope===scopeKey?researchAudit:null)
 const correctionAfterResearch=!!matchedResearchRun&&
  researchPredatesCorrection(matchedResearchRun.created_at,scopeFeedback)
 const originalMaterial=String(run?.result?.objects?.[scopeIndex]?.material||'').toLowerCase()
 const correctedPairTitle=pairProposal?.title&&correctedMaterial
  ? pairProposal.title.replace(/\bglass\b/gi,correctedMaterial.toLowerCase())
  :pairProposal?.title
 const materialContradictsModel=materialContradictsVisualGuess(correctedMaterial,originalMaterial)
 // Only research completed BEFORE the owner's correction is superseded.
 // New metal-informed deep dives must remain visible even while raw visual AI says glass.
 const existingResearchObsolete=correctionAfterResearch
 const saveDisagreement=async()=>{
   if(!run||savingDisagreement)return
   const note=disagreementNote.trim()||'Owner rejects the model material. Reinvestigate using corrected material and original photographs.'
   setSavingDisagreement(true);setSaveStatus('Preserving correction separately from original AI…')
   try{
     const {data,error:e}=await supabase.from('ai_verdict_feedback').insert({
       source_analysis_run_id:run.id,source_object_index:paired?null:scopeIndex,
       feedback_type:disagreementType,corrected_material:disagreementType==='MATERIAL_CORRECTION'?disagreementMaterial:null,owner_statement:note
     }).select('id,source_object_index,feedback_type,corrected_material,owner_statement,created_at').single()
     if(e||!data)throw Error(e?.message||'Owner correction was not saved')
     setVerdictFeedback(v=>[data,...v]);setDisagreeOpen(false);setDisagreementNote('')
     setSaveStatus('Correction saved. Original AI error preserved; conflicting prior prices flagged.')
   }catch(e:any){setSaveStatus(e?.message||'Feedback not saved')}
   finally{setSavingDisagreement(false)}
 }
 const runDraftResearch=async(depth:'standard'|'deep_dive'='standard')=>{
   if(!run||!isPhotoManifestReady||researching)return
   setResearching(true);setSaveStatus(depth==='deep_dive'?'Deep visual and source research applying owner corrections…':'Researching attribution, genuine sale evidence and selling routes online…')
   try{
     const {data:{session}}=await supabase.auth.getSession()
     if(!session)throw Error('Sign in again to use web research.')
     const i=paired?0:researchIndex
     const memberKeys=paired?[...new Set([...(run.result?.objects?.[0]?.image_indices||[]),...(run.result?.objects?.[1]?.image_indices||[])])]:run.result?.objects?.[i]?.image_indices||[]
     const urls=memberKeys.map((n:number)=>images[n]).filter(Boolean).slice(0,12)
     // Pre-stage an owner-scoped source link BEFORE the paid model request.
     const {data:staged,error:stageError}=await supabase.from('ai_analysis_runs').insert({
       mode:'research',model:'PENDING',status:'DRAFT',input_photo_count:urls.length,
       user_context:{source_analysis_run_id:run.id,source_object_index:i,pair_source_indices:paired?[0,1]:[],research_depth:depth},
       result:{analysis_stage:'STAGED',source_analysis_run_id:run.id,source_object_index:i}
     }).select('id,created_at,user_context').single()
     if(stageError||!staged?.id)throw Error('Could not preserve the research session; no paid AI was requested.')
     const response=await fetch('/api/research-item',{
      method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},
      body:JSON.stringify({draft_run_id:run.id,draft_index:i,pair_source_indices:paired?[0,1]:[],
       research_run_id:staged.id,depth,images:urls})
     })
     const payload=await response.json()
     if(!response.ok){
       if(payload?.result?.research_summary){
         setLastResearchScope(scopeKey)
         setResearchResult(payload.result);setResearchAudit(payload.source_audit||null)
       }
       throw Error((payload.error||'Live research did not complete.')+
        ' The staged research run remains saved; do not repeat the paid request to recover it.')
     }
     if(payload.saved_run_id!==staged.id)throw Error('Research identity mismatch; no result is being presented as saved.')
     const {data:verified,error:verifyError}=await supabase.from('ai_analysis_runs')
       .select('id,result,created_at,user_context').eq('id',staged.id).single()
     if(verifyError||!verified||verified.result?.analysis_stage!=='COMPLETE'||!verified.result?.research_summary)
       throw Error('Research completed but database readback failed. Do not pay for another search to recover this result.')
     setLastResearchScope(scopeKey)
     setResearchResult(verified.result);setResearchAudit(verified.result.source_audit||null)
     setResearchHistory(v=>[verified,...v])
     setSaveStatus((depth==='deep_dive'?'Deep-dive':'Research')+' findings saved. Original evidence and corrections preserved.')
   }catch(err:any){setSaveStatus(err?.message||'Research failed')}
   finally{setResearching(false)}
 }
 const approveSaved=async()=>{
  if(!run || run.status!=='DRAFT'||!isPhotoManifestReady||approving||saving)return
  if(!selectedIndices.length){setSaveStatus('Select at least one object to catalogue.');return}
  if(needsPhotoCorrection&&!confirmedPhotoCorrection){setSaveStatus('Confirm the valid source photo mapping before approval.');return}
  setApproving(true);setSaveStatus('Saving catalogue and linking original photographs…')
  try{
   const reviews:Record<string,object>={}
   for(const i of selectedIndices){
    const raw=indicesForReview(i)
    const valid=raw.filter(n=>manifestIndices.has(n))
    const correction=raw.length!==valid.length?{confirmed_photo_indices:valid}:{}
    reviews[String(i)]=paired&&i===0
      ? {...edits[i],working_title:correctedPairTitle,pair_source_indices:[0,1],...correction}
      : {...edits[i],...correction}
   }
   const {data,error:e}=await supabase.rpc('ci_approve_saved_intake_v1',{
    p_run_id:run.id,p_object_indices:selectedIndices,p_reviews:reviews
   })
   if(e)throw Error(e.message)
   if(!Array.isArray(data)||data.length!==selectedIndices.length)
    throw Error('Approval response incomplete. Check Inventory before retrying.')
   setCatalogued(data)
   setRun(r=>r?{...r,status:'APPROVED'}:r)
   setSaveStatus(data.length+' catalogue records safely saved with original photo links. No AI rerun.')
   if(data.length===1)navigate('/item/'+data[0].item_id+'?tab=market')
  }catch(e:any){
   setSaveStatus('Approval not confirmed: '+(e?.message||'Unknown failure')+'. The saved report remains available.')
  }finally{setApproving(false)}
 }
 return <div className="ci-page ci-saved-draft">
  <header className="ci-page-header ci-report-heading">
    <div className="ci-report-heading-copy">
     
     <h1 title={paired?(correctedPairTitle||'Matched pair'):run?.result?.objects?.[scopeIndex]?.working_title||'Your object'}>
      {paired?(correctedPairTitle||'Matched pair'):run?.result?.objects?.[scopeIndex]?.working_title||'Your object'}
     </h1>
    </div>
    <div className="ci-report-heading-tools">
     <Link to="/inventory" className="ci-report-icon-control" aria-label="Back to Inventory" title="Back to Inventory">
      <ArrowLeft size={19} aria-hidden="true"/>
     </Link>
     {run&&<details ref={reportMenuRef} className="ci-report-menu" onKeyDown={e=>{if(e.key==='Escape'){e.currentTarget.open=false;setDisagreeOpen(false)}}}>
      <summary aria-label="Report notifications and actions" title="Report notifications and actions">
       <Bell size={19} aria-hidden="true"/>
       {noticeCount>0&&<span className="ci-report-notice-count" aria-label={noticeCount+' source issue requiring review'}>{noticeCount}</span>}
      </summary>
      <div className="ci-report-menu-content">
       <strong className="ci-report-menu-title">Report activity</strong>
       <button type="button" className="ci-report-menu-action" onClick={()=>setDisagreeOpen(v=>!v)}>
        {disagreeOpen?'Close correction form':'Disagree with verdict'}
       </button>
       {disagreeOpen&&<section className="ci-report-correction-form" aria-label="Correct AI verdict">
        <label>What is wrong?
         <select value={disagreementType} onChange={e=>setDisagreementType(e.target.value)}>
          <option value="MATERIAL_CORRECTION">Material</option>
          <option value="ATTRIBUTION_REJECTION">Maker or attribution</option>
          <option value="IDENTIFICATION_CORRECTION">Object type or period</option>
          <option value="OTHER">Value, pair or another conclusion</option>
         </select></label>
        {disagreementType==='MATERIAL_CORRECTION'&&<label>Actual material
         <select value={disagreementMaterial} onChange={e=>setDisagreementMaterial(e.target.value)}>
          {['Metal','Glass','Ceramic','Wood','Stone','Textile','Mixed materials','Unknown'].map(x=><option key={x} value={x}>{x}</option>)}
         </select></label>}
        <label>Correction details
         <textarea rows={3} maxLength={2000} value={disagreementNote}
          onChange={e=>setDisagreementNote(e.target.value)} placeholder="Describe what needs correcting"/></label>
        <div className="ci-page-actions">
         <button className="primaryButton" disabled={savingDisagreement} onClick={saveDisagreement}>
          {savingDisagreement?'Saving…':'Save correction'}
         </button>
         <button className="secondaryButton" onClick={()=>setDisagreeOpen(false)}>Cancel</button>
        </div>
       </section>}
       {scopeFeedback.length>0&&<div className="ci-report-menu-entry">
        <strong>Owner correction{correctedMaterial?': '+correctedMaterial:''}</strong>
        <p>{scopeFeedback[0].owner_statement}</p>
       </div>}
       {needsPhotoCorrection&&<div className="ci-report-menu-entry ci-report-menu-warning">
        <strong>Source photo index needs review</strong>
        <p>The AI references photo(s) {[...new Set(missingSourceIndices)].map(n=>n+1).join(', ')};
         the upload contains only {run.input_photo_count}. Original photos and AI text remain unchanged.</p>
       </div>}
       {!Array.isArray(run.result?.image_manifest)&&<div className="ci-report-menu-entry ci-report-menu-warning">
        <strong>Unverified photo source</strong>
        <p>The historical report lacks a confirmed manifest. Catalogue photo linking remains restricted.</p>
       </div>}
       {Array.isArray(run.result?.image_manifest)&&run.result?.analysis_stage!=='COMPLETE'&&run.status==='DRAFT'&&
        <div className="ci-report-menu-entry ci-report-menu-warning">
         <strong>Incomplete analysis</strong><p>Second-stage checks have not been saved.</p>
        </div>}
       <div className="ci-report-menu-entry">
        <strong>Report details</strong>
        <p>{run.input_photo_count} photos · {run.status==='DRAFT'?'Not catalogued':run.status}
         · saved {new Date(run.created_at).toLocaleString()}</p>
        <p>Original evidence and earlier AI interpretations remain preserved.</p>
       </div>
      </div>
     </details>}
    </div>
   </header>
   {busy&&<p role="status">Opening your saved report…</p>}
  {error&&<p role="alert">{error}</p>}
  {run&&<>
   <div className="tabBar" role="tablist" aria-label="Object workspace">
    {['overview','photos','identification','market','sales','catalogue'].map(t=>
      <button key={t} role="tab" aria-selected={activeTab===t} className={activeTab===t?'active':''} onClick={()=>setActiveTab(t)}>{t}</button>)}
   </div>
   {(activeTab==='overview'||activeTab==='catalogue')&&pairProposal&&run.status==='DRAFT'&&<div className="panel ci-pair-choice">
      <strong>Matched pair recognised — two physical pieces</strong>
      <p>Keep both objects and all their original photo evidence, but catalogue and sell them as one pair unless you deliberately separate them.</p>
      <label className="ci-record-selection"><input type="checkbox" checked={groupPair} onChange={e=>{setGroupPair(e.target.checked);setConfirmedPhotoCorrection(false)}}/> One catalogue record for the pair (recommended)</label>
    </div>}
   {activeTab==='catalogue'&&needsPhotoCorrection&&<label className="ci-catalogue-photo-confirm">
    <input type="checkbox" checked={confirmedPhotoCorrection} onChange={e=>setConfirmedPhotoCorrection(e.target.checked)}/>
    Confirm existing uploaded photos only
   </label>}
   {activeTab==='catalogue'&&run.status==='DRAFT'&&hasReviewObjects&&<div className="ci-page-actions">
    <button className="secondaryButton" disabled={saving||approving} onClick={save}>{saving?'Saving…':'Save review changes'}</button>
    <button className="primaryButton" disabled={approving||saving||!isPhotoManifestReady||!selectedIndices.length||(needsPhotoCorrection&&!confirmedPhotoCorrection)} onClick={approveSaved}>
     {approving?'Saving safely…':'Catalogue '+selectedIndices.length+' selected'}
    </button>
   </div>}
   {activeTab==='catalogue'&&run.status==='DRAFT'&&isPhotoManifestReady&&<p className="ci-action-hint">Select the objects to catalogue.</p>}
   {catalogued.length>0&&<div className="panel ci-catalogued-result" role="status">
    <h2>Objects safely catalogued</h2>
    <div className="ci-catalogued-links">{catalogued.map(item=><Link key={item.item_id} to={'/item/'+item.item_id} className="secondaryButton inlineButton">{item.item_code} · {item.title||'Object'}</Link>)}</div>
   </div>}
   {saveStatus&&<p role="status" className="note">{saveStatus}</p>}
   {activeTab==='market'&&<div className="marketStack">
    {isPhotoManifestReady&&Object.values(images).some(Boolean)&&
     <VisualReferenceWorkbench
      analysisRunId={run.id} objectIndex={scopeIndex} paired={paired}
      photos={images} photoIndices={indicesForReview(scopeIndex)}
      ownerMaterial={correctedMaterial}
      latestResearchAt={matchedResearchRun?.created_at||null}
      workingTitle={paired?(correctedPairTitle||'Matching pair'):run.result.objects?.[scopeIndex]?.working_title||'Collection object'}
     />}

    <WorkspaceActionPanel
     eyebrow="RESEARCH OPTIONS"
     title={paired?'Research this pair':'Research this object'}
     description=""
     primary={{
      label:researching?'Researching…':'Dive deeper',
      onClick:()=>runDraftResearch('deep_dive'),
      disabled:researching||!isPhotoManifestReady||run.status!=='DRAFT',loading:researching
     }}
     selector={!paired&&(run.result?.objects||[]).length>1?
      <label>Choose object to research
       <select value={researchIndex} onChange={e=>setResearchIndex(Number(e.target.value))}>
        {(run.result.objects||[]).map((o:any,i:number)=><option value={i} key={i}>{o.working_title||'Object '+(i+1)}</option>)}
       </select>
      </label>:null}
     secondary={<a className="ci-action-text-link" href="https://lens.google.com/" target="_blank" rel="noopener noreferrer">
      Manual image search ↗</a>}
     note="Dive deeper uses paid AI research. Museum image comparisons above are free; reverse-image search remains manual."
    >
     {existingResearchObsolete&&<InfoDisclosure label="Earlier research superseded" warning><p>Owner correction invalidates the prior glass conclusions. Historical findings remain preserved.</p></InfoDisclosure>}
     {visibleResearch?
      <details className="ci-archive-section">
       <summary>Another standard online search · paid</summary>
       <p className="ci-page-meta">Existing saved findings remain available without a repeat charge.</p>
       <button className="secondaryButton" disabled={researching||!isPhotoManifestReady||run.status!=='DRAFT'}
        onClick={()=>runDraftResearch('standard')}>Run standard research</button>
      </details>:
      <button className="secondaryButton ci-action-minor-button"
       disabled={researching||!isPhotoManifestReady||run.status!=='DRAFT'}
       onClick={()=>runDraftResearch('standard')}>Standard research instead</button>}
     {researchHistory.length>0&&<span className="ci-subtle-count">{researchHistory.length} saved results</span>}
     {unfinishedResearch.length>0&&<details className="ci-archive-section">
      <summary>{unfinishedResearch.length} interrupted or staged investigation(s)</summary>
      <p className="ci-page-meta">Inspect previous attempts before rerunning; a paid request may have been interrupted.</p>
      {unfinishedResearch.map((x:any)=><p key={x.id} className="ci-page-meta">
       {new Date(x.created_at).toLocaleString()} · {x.result?.analysis_stage||'Unknown state'}</p>)}
     </details>}
    </WorkspaceActionPanel>
    {!materialContradictsModel&&<div className="panel">
     <div className="panelHeader"><h2>Preliminary AI estimate</h2><span>Visual only, not verified sales evidence</span></div>
     <div className="valueSummary">
      <div><small>Fast cash indication</small><strong>{money(run.result.objects?.[paired?0:researchIndex]?.preliminary_value?.quick_sale??null,run.result.objects?.[paired?0:researchIndex]?.preliminary_value?.currency||'GBP')}</strong></div>
      <div><small>Balanced range · provisional</small><strong>{money(run.result.objects?.[paired?0:researchIndex]?.preliminary_value?.balanced_low??null,run.result.objects?.[paired?0:researchIndex]?.preliminary_value?.currency||'GBP')} – {money(run.result.objects?.[paired?0:researchIndex]?.preliminary_value?.balanced_high??null,run.result.objects?.[paired?0:researchIndex]?.preliminary_value?.currency||'GBP')}</strong></div>
     </div>
     {paired&&<p className="ci-page-meta">These are first-piece visual estimates, NOT a pair valuation. Run online research for the pair as one lot before using a sale figure.</p>}
    </div>}
    {materialContradictsModel&&<InfoDisclosure label="Earlier image-only estimate withheld" warning><p>The model assumed {originalMaterial||'another material'}; owner-recorded material is {correctedMaterial}. The original guess remains available in the saved AI evidence.</p></InfoDisclosure>}
    {visibleResearch&&(existingResearchObsolete
     ? <details className="ci-archive-section"><summary>View superseded research · not valid for pricing</summary>
        <ResearchDecisionPanel research={visibleResearch} sourceAudit={visibleAudit} paired={paired} title="Superseded model research"/>
       </details>
     : <ResearchDecisionPanel research={visibleResearch} sourceAudit={visibleAudit} paired={paired} title="Market research and valuation"/>)}
      </div>}
   {activeTab==='photos'&&<div className="panel"><div className="panelHeader"><h2>Original photographs</h2><span>{Object.values(images).filter(Boolean).length} accessible</span></div>
     <div className="photoGrid">{Object.entries(images).map(([index,url])=>url?<div className="photoTile" key={index}><img src={url} alt={'Original photograph '+(Number(index)+1)}/><span>Photo {Number(index)+1}</span></div>:null)}</div>
   </div>}
   {activeTab==='identification'&&<div className="panel"><div className="panelHeader"><h2>Identification & original evidence</h2><span>Provisional, not authenticated</span></div>
     {(run.result.objects||[]).map((o:any,i:number)=><details key={i} className="ci-review-section ci-review-source"><summary>{o.working_title||'Object '+(i+1)} · {o.identification_confidence??'—'}% ID</summary>
      <p>{o.current_attribution||'Unconfirmed'}</p><p>{o.condition_summary}</p>
      {(o.evidence||[]).map((e:any,j:number)=><p key={j}><strong>{e.certainty_class||'UNKNOWN'}: </strong>{e.claim}</p>)}
     </details>)}
   </div>}
   {activeTab==='sales'&&<div className="marketStack">
    <div className="panel">
     <div className="panelHeader"><h2>Sales planning</h2><span>No listing or publication without approval</span></div>
     <p>{!existingResearchObsolete&&visibleResearch?.routing?.best_venue?'Research suggests '+visibleResearch.routing.best_venue+' as the likely route.':'Current source-backed selling route not established. Rerun material-corrected research first.'}</p>
     <p>{!existingResearchObsolete?visibleResearch?.routing?.sale_readiness?.replaceAll('_',' ')||'Sale readiness needs source and condition review.':'Prior sale-readiness judgement superseded by owner correction.'}</p>
     <button className="secondaryButton inlineButton" onClick={()=>setActiveTab('market')}>Review source evidence and valuation →</button>
    </div>
    <SaleEconomics currency={run.result?.objects?.[paired?0:researchIndex]?.preliminary_value?.currency||'GBP'}
     acquisitionPrice={run.user_context?.purchase_price??null}
     contextLabel={paired?'two-piece matched lot':'saved draft object'}/>
   </div>}
   {(activeTab==='overview'||activeTab==='catalogue')&&<>
   <ObjectCollectionToolbar
     query={query} onQueryChange={setQuery} view={view} onViewChange={changeView}
     searchLabel="Search report objects" filterLabel="Filter reviewed objects"
     filter={filter} onFilterChange={setFilter}
     filters={[{value:'ALL',label:'All objects'},{value:'NEEDS_PHOTO',label:'Photos missing'},{value:'HAS_PHOTO',label:'With photos'}]}
   />
   <div className="inventorySummary">{paired?'1 matched-pair catalogue lot · 2 physical pieces':(run.result?.objects||[]).length+' separate objects'} · Select to review</div>
   <div className={`cardGrid ci-object-grid ci-view-${view}`}>
   {(run.result?.objects||[]).map((o:any,i:number)=>{
    if(paired&&i===1)return null
    const keys=paired?[...new Set([...((o.image_indices||[]) as number[]),...((run.result.objects[1]?.image_indices||[]) as number[])])]:Array.isArray(o.image_indices)?o.image_indices:[]
    const photos=keys.filter((n:number)=>!!images[n])
    const title=paired&&pairProposal?pairProposal.title:edits[i]?.working_title||o.working_title||o.object_type||'Unidentified object'
    if(![title,o.object_type,o.current_attribution].filter(Boolean).join(' ').toLowerCase().includes(query.toLowerCase()))return null
    if(filter==='HAS_PHOTO'&&!photos.length)return null
    if(filter==='NEEDS_PHOTO'&&photos.length)return null
    return <article className="itemCard ci-record-card" key={i} tabIndex={view==='compact'?0:undefined} role={view==='compact'?'link':undefined} aria-label={view==='compact'?'Open '+title:undefined} onClick={view==='compact'?()=>openSavedObject(i):undefined} onKeyDown={view==='compact'?e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openSavedObject(i)}}:undefined} id={'ci-object-'+i}>
     <div className="itemCardImage placeholderGlass">{photos.length?<img src={images[photos[0]]} alt={title}/>:<span className="ci-missing-photo">Photo not linked</span>}</div>
     <div className="itemCardBody">
      <div className="itemMeta"><span>{paired?'Pair · 2 pieces':'Object '+(i+1)}</span><span>{run.status==='DRAFT'?'Unfinished':run.status}</span></div>
      {run.status==='DRAFT'&&isPhotoManifestReady&&<label className="ci-record-selection" onClick={e=>e.stopPropagation()}>
       <input type="checkbox" checked={selected[i]!==false} onChange={e=>{setSelected(v=>({...v,[i]:e.target.checked}));setConfirmedPhotoCorrection(false)}}/>
       <span>Include in catalogue</span>
      </label>}
      <h3 className="ci-record-title">{title}</h3>
      <p className="ci-record-stage">{o.maker||'Maker not confirmed'} · Provisional identification</p>
      <details className="ci-object-review">
       <summary>Review object & evidence</summary>
       <div className="ci-object-review-content">
        <div className="ci-review-section ci-review-section-primary">
         <div className="ci-review-section-heading"><span className="ci-review-section-number">01</span><h4>Your review</h4><span className="ci-review-section-hint">Editable information</span></div>
         {run.status==='DRAFT'?<div className="ci-review-fields">
          <label>{paired?'Original first-piece title':'Object title'}<input value={edits[i]?.working_title||''} onChange={e=>setEdits(v=>({...v,[i]:{...v[i],working_title:e.target.value}}))}/></label>
          {paired&&<p className="ci-page-meta">Second original member: {run.result.objects[1]?.working_title||'Unidentified'} · {run.result.objects[1]?.condition_summary||'Condition not recorded'}. Both observations will be retained.</p>}
          <label>Your condition notes<textarea rows={3} value={edits[i]?.condition_summary||''} onChange={e=>setEdits(v=>({...v,[i]:{...v[i],condition_summary:e.target.value}}))}/></label>
         </div>:<p>Previously saved review</p>}
        </div>
        <details className="ci-review-section ci-review-source">
         <summary><span className="ci-review-section-number">02</span><span>AI identification & observations</span><span className="ci-review-section-hint">Unverified source notes</span></summary>
         <div className="ci-review-source-content">
          <div><small>Suggested attribution</small><p>{o.current_attribution||'Unconfirmed'}</p></div>
          <div><small>Original condition observation</small><p>{o.condition_summary||'Not recorded'}</p></div>
          {run.result?.initial_ai_result?.objects?.[i]&&<div>
            <small>Archived initial model interpretation (before extra checks)</small>
            <p>{run.result.initial_ai_result.objects[i].current_attribution||run.result.initial_ai_result.objects[i].working_title||'Not identified'}</p>
          </div>}
         </div>
        </details>
        {photos.length>1&&<details className="ci-review-section ci-review-source"><summary><span className="ci-review-section-number">03</span><span>Original photographs</span><span className="ci-review-section-hint">{photos.length} linked</span></summary><div className="intakeThumbGrid">{photos.map((n:number)=><img key={n} src={images[n]} alt={'Photo '+(n+1)} style={{width:115,height:115,objectFit:'contain'}}/>)}</div></details>}
        <details className="ci-review-section ci-review-source">
         <summary><span className="ci-review-section-number">{photos.length>1?'04':'03'}</span><span>Evidence & next checks</span><span className="ci-review-section-hint">Advanced</span></summary>
         <div className="ci-review-source-content">
          {(o.evidence||[]).map((e:any,j:number)=><div key={j}><small>{e.certainty_class||'Unverified'}</small><p>{e.claim}</p></div>)}
          {(o.next_evidence||[]).map((t:any,j:number)=><div key={'t'+j}><small>Next check</small><p>{t.title}</p></div>)}
         </div>
        </details>
       </div>
      </details>
     </div>
    </article>
   })}</div>
   </>}
  </>}
 </div>
}
