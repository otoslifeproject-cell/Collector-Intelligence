import {useEffect,useRef,useState} from 'react'
import {ArrowLeft,Bell} from 'lucide-react'
import {Link,useLocation,useNavigate,useParams} from 'react-router-dom'
import ObjectCollectionToolbar from '../components/ObjectCollectionToolbar'
import {supabase} from '../lib/supabase'
import {suggestSingleIntakePair} from '../lib/pairGrouping'
import {money} from '../lib/format'
import ResearchDecisionPanel from '../components/ResearchDecisionPanel'
import ResearchProgress from '../components/ResearchProgress'
import {provisionalMoney} from '../lib/catalogueSaleState'
import {draftResearchDashboard} from '../lib/draftResearchAudit'
import SaleEconomics from '../components/SaleEconomics'
import VisualReferenceWorkbench from '../components/VisualReferenceWorkbench'
import WorkspaceActionPanel from '../components/WorkspaceActionPanel'
import InfoDisclosure from '../components/InfoDisclosure'
import {feedbackForObject,currentOwnerMaterial,researchPredatesCorrection,materialContradictsVisualGuess} from '../lib/ownerCorrections'
import {CatalogueError,prepareCatalogueRequest,readApprovedCatalogue,readCatalogueContext,settleCatalogueApproval} from '../lib/catalogueApproval'
import type {CatalogueRequest,CatalogueSource} from '../lib/catalogueApproval'

import {OwnerReviewError,prepareOwnerReview,settleOwnerReview} from '../lib/ownerReview'
import type {OwnerReviewRequest} from '../lib/ownerReview'
import {CorrectionError,prepareCorrection,readOwnerCorrections,settleCorrection} from '../lib/verdictCorrection'
import type {CorrectionRequest} from '../lib/verdictCorrection'
import {DraftResearchError,hasSavedResearchResult,readDraftResearch,researchForScope} from '../lib/draftResearch'

type SavedRun=CatalogueSource
export default function SavedDraft(){
 const {id}=useParams()
 if(!id)return <div role="alert">This saved report could not be identified.</div>
 return <SavedDraftRecord key={id} id={id}/>
}
function SavedDraftRecord({id}:{id:string}){
 const reportMenuRef=useRef<HTMLDetailsElement>(null)
 const alive=useRef(false),approvalBusy=useRef(false),reviewBusy=useRef(false),correctionBusy=useRef(false),researchBusy=useRef(false),approvalStatus=useRef<HTMLParagraphElement|null>(null)
 const current=()=>alive.current
 const navigate=useNavigate()
 const location=useLocation()
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
 const [pendingCorrection,setPendingCorrection]=useState<CorrectionRequest|null>(null)
 const [pendingReview,setPendingReview]=useState<OwnerReviewRequest|null>(null)
 const [pendingApproval,setPendingApproval]=useState<CatalogueRequest|null>(null)
 const [activeTab,setActiveTab]=useState(()=>{
   try{return new URLSearchParams(window.location.hash.split('?')[1]||'').get('tab')||'overview'}catch{return 'overview'}
 })
 const [researching,setResearching]=useState(false)
 const [checkingResearch,setCheckingResearch]=useState(false)
 const [researchError,setResearchError]=useState('')
 const [unconfirmedResearch,setUnconfirmedResearch]=useState<{runId:string;payload:any}|null>(null)
 const [researchIndex,setResearchIndex]=useState(0)
 // Object indices refer only to the saved run's objects; never map by photo order.
 // Invalid, hostile or stale links safely show object 0 without altering evidence.
 useEffect(()=>{
  const raw=new URLSearchParams(location.search).get('object')
  const parsed=raw!==null&&/^(0|[1-9][0-9]*)$/.test(raw)?Number(raw):0
  const count=Array.isArray(run?.result?.objects)?run.result.objects.length:0
  setResearchIndex(Number.isSafeInteger(parsed)&&parsed>=0&&parsed<count?parsed:0)
 },[location.search,run?.id])
 const [researchHistory,setResearchHistory]=useState<any[]>([])
 const [unfinishedResearch,setUnfinishedResearch]=useState<any[]>([])
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
  alive.current=true
  let active=true
  const current=()=>active&&alive.current
  async function load(){
   try{
   setBusy(true);setError('');setRun(null);setImages({})
   const context=await readCatalogueContext(supabase,id,current)
   if(!current())return
   const report=context.source
   setRun(report)
   setGroupPair(!!suggestSingleIntakePair(report.result?.objects||[],report.mode))
   setConfirmedPhotoCorrection(false)
   setSelected(Object.fromEntries((report.result?.objects||[]).map((_:any,i:number)=>[i,true])))
   try{
    const prior=await readDraftResearch(supabase,report,current)
    if(!current())return
    setResearchHistory(prior.filter(hasSavedResearchResult));setUnfinishedResearch(prior.filter(row=>!hasSavedResearchResult(row)));setResearchError('')
   }catch(error){if(current())setResearchError(error instanceof DraftResearchError?error.message:'Saved research history unavailable. Check it before starting another paid search.')}
   const feedbackRows=await readOwnerCorrections(supabase,report,current)
   if(!current())return
   setVerdictFeedback(feedbackRows)
   const overrides=report.result?.owner_review?.objects || {}
   setEdits(Object.fromEntries((report.result?.objects||[]).map((o:any,i:number)=>[i,{working_title:overrides[i]?.working_title??o.working_title??'',condition_summary:overrides[i]?.condition_summary??o.condition_summary??''}])))
   const manifest=Array.isArray(report.result?.image_manifest)?report.result.image_manifest:[]
   const requests=manifest.filter((p:any)=>Number.isInteger(p.index)&&typeof p.storage_path==='string'&&p.storage_path.startsWith(report.owner_id+'/intake/'))
   const signed=await Promise.all(requests.map(async(p:any)=>{
    const {data:u}=await supabase.storage.from('item-images').createSignedUrl(p.storage_path,1800)
    return [p.index,u?.signedUrl||''] as const
   }))
   if(!current())return
   setImages(Object.fromEntries(signed))
   if(signed.some(([,url])=>!url))setError('Some original photographs could not be previewed. Reload this report before approving.')
   if(report.status==='APPROVED'){
    const verified=await readApprovedCatalogue(supabase,id,current)
    if(current())setCatalogued(verified.records)
   }
   }catch(error){if(current()){setError(error instanceof CatalogueError||error instanceof CorrectionError?error.message:'The saved report could not be read. Reload before further actions.');setRun(null)}}
   finally{if(current())setBusy(false)}
  }
  void load()
  return ()=>{active=false;alive.current=false}
 },[id])
 useEffect(()=>{if(!approving&&!saving&&!savingDisagreement&&saveStatus)approvalStatus.current?.focus()},[approving,saving,savingDisagreement,saveStatus])
 const finishReview=async(request:OwnerReviewRequest,submit:boolean)=>{
  const result=await settleOwnerReview(supabase,request,current,submit)
  if(!current())return
  if(!result){setSaveStatus('No review revision is confirmed yet. Your review text is held unchanged. Check the save or retry the same changes; keep this page open.');return}
  setRun(result);setPendingReview(null)
  setSaveStatus('Owner review revision '+result.owner_review_revision+' saved and independently read back with its revision evidence. Previous edits preserved. No AI rerun.')
 }
 const recoverReview=async(submit:boolean)=>{
  if(!pendingReview||pendingCorrection||correctionBusy.current||reviewBusy.current||approvalBusy.current||busy||error)return
  reviewBusy.current=true;setSaving(true);setSaveStatus('Checking the held owner review…')
  try{await finishReview(pendingReview,submit)}
  catch(error){if(current())setSaveStatus(error instanceof OwnerReviewError||error instanceof CatalogueError||error instanceof CorrectionError?error.message:'The review result could not be confirmed. Keep this page open and check the same save.')}
  finally{reviewBusy.current=false;if(current())setSaving(false)}
 }
 const save=async()=>{
  if(!run||run.status!=='DRAFT'||pendingApproval||pendingReview||reviewBusy.current||approvalBusy.current||pendingCorrection||correctionBusy.current||researchBusy.current||researching||savingDisagreement||busy||error)return
  reviewBusy.current=true;setSaving(true);setSaveStatus('Saving your reviewed text…')
  try{
   const request=await prepareOwnerReview(supabase,run,edits,current)
   if(!current())return
   setPendingReview(request)
   await finishReview(request,true)
  }catch(error){if(current())setSaveStatus(error instanceof OwnerReviewError||error instanceof CatalogueError||error instanceof CorrectionError?error.message:'The review result could not be confirmed. Keep this page open and check the same save.')}
  finally{reviewBusy.current=false;if(current())setSaving(false)}
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
 const storedResearch=[...researchHistory,...unfinishedResearch]
 const dashboardFor=(index:number,pair=false)=>run?draftResearchDashboard(run,storedResearch.filter(row=>researchForScope(row,index,pair)),index,pair,researchError):null
 const scopeDashboard=dashboardFor(scopeIndex,paired)
 const scopeFeedback=feedbackForObject(verdictFeedback,scopeIndex,paired)
 const correctedMaterial=currentOwnerMaterial(scopeFeedback)
 const matchedResearchRun=researchHistory.find((x:any)=>
   x.user_context?.source_object_index===scopeIndex &&
   (Array.isArray(x.user_context?.pair_source_indices)&&x.user_context.pair_source_indices.length===2)===paired)
 const scopePending=unfinishedResearch.filter(row=>researchForScope(row,scopeIndex,paired))
 const researchBlocked=!!researchError||scopePending.length>0
 const visibleResearch=researchError?null:matchedResearchRun?.result || null
 const visibleAudit=matchedResearchRun?.result?.source_audit || null
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
 const finishCorrection=async(request:CorrectionRequest,submit:boolean)=>{
  const result=await settleCorrection(supabase,request,current,submit)
  if(!current())return
  if(!result){setSaveStatus('No correction is confirmed yet. Your observation is held unchanged. Check the save or retry the same correction; keep this page open.');return}
  setVerdictFeedback(result.rows);setPendingCorrection(null);setDisagreeOpen(false);setDisagreementNote('')
  if(reportMenuRef.current)reportMenuRef.current.open=false
  setSaveStatus('Correction saved and independently read back. Original AI and earlier observations preserved. Current owner history refreshed.')
 }
 const recoverCorrection=async(submit:boolean)=>{
  if(!pendingCorrection||correctionBusy.current||reviewBusy.current||approvalBusy.current||busy||error)return
  correctionBusy.current=true;setSavingDisagreement(true);setSaveStatus('Checking the held correction…')
  try{await finishCorrection(pendingCorrection,submit)}
  catch(error){if(current())setSaveStatus(error instanceof CorrectionError||error instanceof CatalogueError?error.message:'The correction could not be confirmed. Keep this page open and check the same save.')}
  finally{correctionBusy.current=false;if(current())setSavingDisagreement(false)}
 }
 const saveDisagreement=async()=>{
  if(!run||pendingCorrection||correctionBusy.current||researchBusy.current||researching||savingDisagreement||pendingApproval||pendingReview||reviewBusy.current||approvalBusy.current||busy||error)return
  correctionBusy.current=true;setSavingDisagreement(true);setSaveStatus('Preserving your correction separately from original AI…')
  try{
   const note=disagreementNote.trim()||'Owner requests review of this AI conclusion; no additional observation supplied.'
   const request=await prepareCorrection(supabase,run,{source_object_index:paired?null:scopeIndex,feedback_type:disagreementType,corrected_material:disagreementType==='MATERIAL_CORRECTION'?disagreementMaterial:null,owner_statement:note},current)
   if(!current())return
   setPendingCorrection(request)
   await finishCorrection(request,true)
  }catch(error){if(current())setSaveStatus(error instanceof CorrectionError||error instanceof CatalogueError?error.message:'The correction could not be confirmed. Keep this page open and check the same save.')}
  finally{correctionBusy.current=false;if(current())setSavingDisagreement(false)}
 }
 const updateResearchHistory=async()=>{
  if(!run)return
  const rows=await readDraftResearch(supabase,run,current)
  if(!current())return
  const complete=rows.filter(hasSavedResearchResult)
  setResearchHistory(complete);setUnfinishedResearch(rows.filter(row=>!hasSavedResearchResult(row)));setResearchError('')
  setUnconfirmedResearch(previous=>previous&&complete.some(row=>row.id===previous.runId)?null:previous)
  return rows
 }
 const checkSavedResearch=async()=>{
  if(!run||checkingResearch||researchBusy.current||reviewBusy.current||approvalBusy.current||correctionBusy.current||pendingReview||pendingApproval||pendingCorrection||busy||error)return
  setCheckingResearch(true);setSaveStatus('Checking saved research without another AI request…')
  try{const rows=await updateResearchHistory();if(current()&&rows)setSaveStatus('Saved research checked: '+rows.filter(hasSavedResearchResult).length+' complete responses and '+rows.filter(row=>!hasSavedResearchResult(row)).length+' unresolved attempts. No AI requested.')}
  catch(error){if(current()){const message=error instanceof DraftResearchError||error instanceof CatalogueError?error.message:'Saved research history unavailable. Check again before starting another paid search.';setResearchError(message);setSaveStatus(message)}}
  finally{if(current())setCheckingResearch(false)}
 }
 const runDraftResearch=async(depth:'standard'|'deep_dive'='standard')=>{
  if(!run||researchBlocked||checkingResearch||researchBusy.current||!isPhotoManifestReady||pendingApproval||pendingReview||reviewBusy.current||approvalBusy.current||pendingCorrection||correctionBusy.current||busy||error)return
  researchBusy.current=true;setResearching(true);setSaveStatus('Preserving the research session before requesting '+(depth==='deep_dive'?'deep':'standard')+' research…')
  let stagedId:string|null=null
  try{
   // Recheck complete history immediately before any new staged/paid request.
   const rows=await readDraftResearch(supabase,run,current)
   if(rows.some(row=>researchForScope(row,scopeIndex,paired)&&!hasSavedResearchResult(row)))throw new DraftResearchError('An unresolved research attempt already exists for this object. Check saved research; do not repeat the paid request.')
   const {data:{session}}=await supabase.auth.getSession()
   if(!current())return
   if(!session||session.user.id!==run.owner_id)throw Error('Sign in again to use your private research.')
   const i=scopeIndex,pair=paired?[0,1]:[]
   const memberKeys=paired?[...new Set([...(run.result?.objects?.[0]?.image_indices||[]),...(run.result?.objects?.[1]?.image_indices||[])])]:run.result?.objects?.[i]?.image_indices||[]
   const urls=memberKeys.map((n:number)=>images[n]).filter(Boolean).slice(0,12)
   const {data:staged,error:stageError}=await supabase.from('ai_analysis_runs').insert({mode:'research',model:'PENDING',status:'DRAFT',input_photo_count:urls.length,
    user_context:{source_analysis_run_id:run.id,source_object_index:i,pair_source_indices:pair,research_depth:depth},
    result:{analysis_stage:'STAGED',source_analysis_run_id:run.id,source_object_index:i}
   }).select('id,owner_id,mode,model,result,created_at,user_context').single()
   if(!current())return
   if(stageError||!staged?.id)throw Error('The research session could not be confirmed. Check saved research before another attempt; no AI request was sent.')
   stagedId=staged.id;setUnfinishedResearch(previous=>[staged,...previous])
   const response=await fetch('/api/research-item',{method:'POST',signal:AbortSignal.timeout(120000),headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify({draft_run_id:run.id,draft_index:i,pair_source_indices:pair,research_run_id:staged.id,depth,images:urls})})
   const payload=await response.json()
   if(!current())return
   if(payload?.result)setUnconfirmedResearch({runId:staged.id,payload})
   if(!response.ok)throw Error((payload.error||'Research outcome unavailable.')+' Check saved research; do not repeat the paid request.')
   if(payload.saved_run_id!==staged.id)throw Error('Research identity mismatch. Check saved research before another attempt.')
   const saved=await updateResearchHistory()
   if(!current())return
   if(!saved?.some(row=>row.id===staged.id&&hasSavedResearchResult(row)))throw Error('Research response received, but its saved result could not be confirmed. Check saved research; do not repeat the paid request.')
   setSaveStatus('Research findings independently read back from the saved session. Original evidence and corrections preserved.')
  }catch(error){
   if(!current())return
   try{await updateResearchHistory()}catch{if(current())setResearchError('Saved research history is unconfirmed. Check saved research before another paid request.')}
   if(current()){
    // A lost staging acknowledgement can leave a real session. Until history is
    // checked, a fresh paid request must not be used as recovery.
    if(!stagedId)setResearchError('The research attempt needs a saved-history check before another paid request.')
    setSaveStatus(error instanceof Error?error.message:'Research outcome unavailable. Check the saved session before another attempt.')
   }
  }finally{researchBusy.current=false;if(current())setResearching(false)}
 }
 const finishApproval=async(request:CatalogueRequest,submit:boolean)=>{
  const result=await settleCatalogueApproval(supabase,request,current,submit)
  if(!current())return
  if(!result){setSaveStatus('No catalogue result is confirmed yet. Your original approval is held unchanged. Check the result or retry the same approval; keep this page open.');return}
  setCatalogued(result.records);setRun(result.source);setPendingApproval(null)
  setSaveStatus(result.records.length+' catalogue records saved and read back with their original photo links. No AI rerun.')
  if(result.records.length===1)navigate('/item/'+result.records[0].item_id+'?tab=market')
 }
 const recoverApproval=async(submit:boolean)=>{
  if(!pendingApproval||pendingReview||reviewBusy.current||approvalBusy.current||pendingCorrection||correctionBusy.current||busy||error)return
  approvalBusy.current=true;setApproving(true);setSaveStatus('Checking the held catalogue approval…')
  try{await finishApproval(pendingApproval,submit)}
  catch(error){if(current())setSaveStatus(error instanceof CatalogueError||error instanceof CorrectionError?error.message:'The catalogue result could not be confirmed. Keep this page open and check the same approval.')}
  finally{approvalBusy.current=false;if(current())setApproving(false)}
 }
 const approveSaved=async()=>{
  if(!run || run.status!=='DRAFT'||!isPhotoManifestReady||approvalBusy.current||reviewBusy.current||pendingReview||pendingCorrection||correctionBusy.current||researchBusy.current||saving||researching||savingDisagreement||pendingApproval||busy||error)return
  if(!selectedIndices.length){setSaveStatus('Select at least one object to catalogue.');return}
  if(needsPhotoCorrection&&!confirmedPhotoCorrection){setSaveStatus('Confirm the valid source photo mapping before approval.');return}
  approvalBusy.current=true;setApproving(true);setSaveStatus('Saving catalogue and linking original photographs…')
  try{
   const reviews:Record<string,any>={}
   for(const i of selectedIndices){
    const raw=indicesForReview(i)
    const valid=raw.filter(n=>manifestIndices.has(n))
    const correction=raw.length!==valid.length?{confirmed_photo_indices:valid}:{}
    reviews[String(i)]=paired&&i===0
      ? {...edits[i],working_title:correctedPairTitle,pair_source_indices:[0,1],...correction}
      : {...edits[i],...correction}
   }
   const request=await prepareCatalogueRequest(supabase,run,selectedIndices,reviews,current)
   if(!current())return
   setPendingApproval(request)
   await finishApproval(request,true)
  }catch(error){if(current())setSaveStatus(error instanceof CatalogueError||error instanceof CorrectionError?error.message:'The catalogue result could not be confirmed. Keep this page open and check the same approval.')}
  finally{approvalBusy.current=false;if(current())setApproving(false)}
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
         <select disabled={savingDisagreement||!!pendingCorrection} value={disagreementType} onChange={e=>setDisagreementType(e.target.value)}>
          <option value="MATERIAL_CORRECTION">Material</option>
          <option value="ATTRIBUTION_REJECTION">Maker or attribution</option>
          <option value="IDENTIFICATION_CORRECTION">Object type or period</option>
          <option value="OTHER">Value, pair or another conclusion</option>
         </select></label>
        {disagreementType==='MATERIAL_CORRECTION'&&<label>Actual material
         <select disabled={savingDisagreement||!!pendingCorrection} value={disagreementMaterial} onChange={e=>setDisagreementMaterial(e.target.value)}>
          {['Metal','Glass','Ceramic','Wood','Stone','Textile','Mixed materials','Unknown'].map(x=><option key={x} value={x}>{x}</option>)}
         </select></label>}
        <label>Correction details
         <textarea readOnly={savingDisagreement||!!pendingCorrection} rows={3} maxLength={2000} value={disagreementNote}
          onChange={e=>setDisagreementNote(e.target.value)} placeholder="Describe what needs correcting"/></label>
        <div className="ci-page-actions">
         <button className="primaryButton" disabled={savingDisagreement||researching||checkingResearch||busy||!!error||approving||saving||!!pendingReview||!!pendingApproval||!!pendingCorrection} onClick={saveDisagreement}>
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
   {!paired&&(run.result?.objects||[]).length>1&&<label className="ci-research-scope-selector">Choose object to research
    <select disabled={savingDisagreement||!!pendingCorrection||saving||!!pendingReview||approving||!!pendingApproval||researching||checkingResearch} value={researchIndex} onChange={e=>{const next=Number(e.target.value);setResearchIndex(next);const params=new URLSearchParams(location.search);params.set('object',String(next));navigate({pathname:location.pathname,search:'?'+params.toString()},{replace:true})}}>
     {(run.result.objects||[]).map((o:any,i:number)=><option value={i} key={i}>{o.working_title||'Object '+(i+1)}</option>)}
    </select>
   </label>}
   <div className="tabBar" role="tablist" aria-label="Object workspace">
    {['overview','photos','identification','market','sales','catalogue'].map(t=>
      <button key={t} role="tab" aria-selected={activeTab===t} className={activeTab===t?'active':''} onClick={()=>setActiveTab(t)}>{t}</button>)}
   </div>
   {scopeDashboard&&<ResearchProgress compact audit={scopeDashboard.audit} history={scopeDashboard.history}
    objectLabel={paired?(correctedPairTitle||'Matched pair — whole lot'):run.result.objects?.[scopeIndex]?.working_title||'Object '+(scopeIndex+1)}
    confidence={scopeDashboard.confidence} loading={busy||checkingResearch} error={researchError}
    onReload={()=>void checkSavedResearch()} onInvestigate={()=>setActiveTab('market')}/>}

   {(activeTab==='overview'||activeTab==='catalogue')&&pairProposal&&run.status==='DRAFT'&&<div className="panel ci-pair-choice">
      <strong>Matched pair recognised — two physical pieces</strong>
      <p>Keep both objects and all their original photo evidence, but catalogue and sell them as one pair unless you deliberately separate them.</p>
      <label className="ci-record-selection"><input type="checkbox" disabled={busy||approving||saving||!!pendingReview||!!pendingApproval||savingDisagreement||!!pendingCorrection} checked={groupPair} onChange={e=>{setGroupPair(e.target.checked);setConfirmedPhotoCorrection(false)}}/> One catalogue record for the pair (recommended)</label>
    </div>}
   {activeTab==='catalogue'&&needsPhotoCorrection&&<label className="ci-catalogue-photo-confirm">
    <input type="checkbox" disabled={busy||approving||saving||!!pendingReview||!!pendingApproval||savingDisagreement||!!pendingCorrection} checked={confirmedPhotoCorrection} onChange={e=>setConfirmedPhotoCorrection(e.target.checked)}/>
    Confirm existing uploaded photos only
   </label>}
   {activeTab==='catalogue'&&run.status==='DRAFT'&&hasReviewObjects&&!pendingApproval&&!pendingReview&&!pendingCorrection&&<div className="ci-page-actions">
    <button className="secondaryButton" disabled={busy||!!error||saving||approving||researching||savingDisagreement} onClick={save}>{saving?'Saving…':'Save review changes'}</button>
    <button className="primaryButton" disabled={busy||!!error||approving||saving||researching||savingDisagreement||!isPhotoManifestReady||!selectedIndices.length||(needsPhotoCorrection&&!confirmedPhotoCorrection)} onClick={approveSaved}>
     {approving?'Saving safely…':'Catalogue '+selectedIndices.length+' selected'}
    </button>
   </div>}
   {pendingCorrection&&<div className="ci-page-actions" aria-label="Recover owner correction">
    <button className="primaryButton" disabled={savingDisagreement} onClick={()=>void recoverCorrection(false)}>Check correction save</button>
    <button className="secondaryButton" disabled={savingDisagreement} onClick={()=>void recoverCorrection(true)}>Retry same correction</button>
   </div>}
   {pendingReview&&<div className="ci-page-actions" aria-label="Recover owner review">
    <button className="primaryButton" disabled={saving} onClick={()=>void recoverReview(false)}>Check review save</button>
    <button className="secondaryButton" disabled={saving} onClick={()=>void recoverReview(true)}>Retry same review save</button>
   </div>}
   {pendingApproval&&<div className="ci-page-actions" aria-label="Recover catalogue approval">
    <button className="primaryButton" disabled={approving} onClick={()=>void recoverApproval(false)}>Check catalogue result</button>
    <button className="secondaryButton" disabled={approving} onClick={()=>void recoverApproval(true)}>Retry same catalogue approval</button>
   </div>}
   {activeTab==='catalogue'&&run.status==='DRAFT'&&isPhotoManifestReady&&!pendingApproval&&!pendingReview&&!pendingCorrection&&<p className="ci-action-hint">Select the objects to catalogue.</p>}
   {catalogued.length>0&&<div className="panel ci-catalogued-result" role="region" aria-label="Saved catalogue records">
    <h2>Objects safely catalogued</h2>
    <div className="ci-catalogued-links">{catalogued.map(item=><Link key={item.item_id} to={'/item/'+item.item_id} className="secondaryButton inlineButton">{item.item_code} · {item.title||'Object'}</Link>)}</div>
   </div>}
   {saveStatus&&<p role="status" tabIndex={-1} ref={approvalStatus} className="note ci-catalogue-status">{saveStatus}</p>}
   {activeTab==='market'&&<div className="marketStack">
    <section className="panel ci-fast-research-result" aria-label="Research result">
      <div className="eyebrow">YOUR OBJECT · RESEARCH</div>
      <h2>{paired?(correctedPairTitle||'Matched pair'):run.result.objects?.[scopeIndex]?.working_title||'Object identification pending'}</h2>
      <p role="status" aria-live="polite">{researching?'Research running · examining matches and checking evidence…':checkingResearch?'Checking saved research…':visibleResearch&&!existingResearchObsolete?'Research returned · review the result below':'Ready to research · visual matches are leads, not verified facts'}</p>
      {!visibleResearch&&<p className="ci-page-meta">Start research below. Results will appear on this page; original photographs and your research history remain saved.</p>}
      {visibleResearch&&!existingResearchObsolete&&<ResearchDecisionPanel research={visibleResearch} sourceAudit={visibleAudit} paired={paired} title="Identification, value and selling recommendation"/>}
      {catalogued.length>0&&<Link className="primaryButton inlineButton" to={'/item/'+catalogued[0].item_id+'?tab=sales'}>Sell item · prepare listing</Link>}
    </section>
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
      label:researching?'Research running…':'Start research',
      onClick:()=>runDraftResearch('deep_dive'),
      disabled:researching||checkingResearch||researchBlocked||busy||!!error||approving||saving||!!pendingReview||!!pendingApproval||savingDisagreement||!!pendingCorrection||!isPhotoManifestReady||run.status!=='DRAFT',loading:researching
     }}
     secondary={<a className="ci-action-text-link" href="https://lens.google.com/" target="_blank" rel="noopener noreferrer">
      Manual image search ↗</a>}
     note="Dive deeper uses paid AI research. Museum image comparisons above are free; reverse-image search remains manual."
    >
     {existingResearchObsolete&&<InfoDisclosure label="Earlier research superseded" warning><p>Owner correction invalidates the prior glass conclusions. Historical findings remain preserved.</p></InfoDisclosure>}
     {visibleResearch?
      <details className="ci-archive-section">
       <summary>Another standard online search · paid</summary>
       <p className="ci-page-meta">Existing saved findings remain available without a repeat charge.</p>
       <button className="secondaryButton" disabled={researching||checkingResearch||researchBlocked||busy||!!error||approving||saving||!!pendingReview||!!pendingApproval||savingDisagreement||!!pendingCorrection||!isPhotoManifestReady||run.status!=='DRAFT'}
        onClick={()=>runDraftResearch('standard')}>Run standard research</button>
      </details>:
      <button className="secondaryButton ci-action-minor-button"
       disabled={researching||checkingResearch||researchBlocked||busy||!!error||approving||saving||!!pendingReview||!!pendingApproval||savingDisagreement||!!pendingCorrection||!isPhotoManifestReady||run.status!=='DRAFT'}
       onClick={()=>runDraftResearch('standard')}>Standard research instead</button>}
     <button className="secondaryButton" disabled={checkingResearch||researching||busy||!!error||saving||approving||savingDisagreement||!!pendingReview||!!pendingApproval||!!pendingCorrection} onClick={()=>void checkSavedResearch()}>{checkingResearch?'Checking saved research…':'Check saved research'}</button>
     {researchHistory.length>0&&<span className="ci-subtle-count">{researchHistory.length} saved complete responses · provisional</span>}
     {scopePending.length>0&&<p className="ci-page-meta">An unresolved attempt exists for this object. Check saved research before another paid request.</p>}
     {unfinishedResearch.length>0&&<details className="ci-archive-section">
      <summary>{unfinishedResearch.length} interrupted or staged investigation(s)</summary>
      <p className="ci-page-meta">Checking reads saved records only. It never starts another search. Unknown or malformed responses remain preserved below.</p>
      {unfinishedResearch.map((x:any)=><details key={x.id} className="ci-review-section ci-review-source"><summary>{x.id} · {x.result?.analysis_stage||'Unknown state'}</summary><pre className="ci-research-response">{JSON.stringify({model:x.model,created_at:x.created_at,user_context:x.user_context,result:x.result},null,2)}</pre></details>)}
     </details>}
     {unconfirmedResearch&&<details className="ci-archive-section"><summary>Returned response · save unconfirmed</summary><p>This response is retained in this page only. Check its saved session before using it or starting another paid request.</p><pre className="ci-research-response">{JSON.stringify(unconfirmedResearch,null,2)}</pre></details>}
    </WorkspaceActionPanel>
    {!materialContradictsModel&&<div className="panel">
     <div className="panelHeader"><h2>Preliminary AI estimate</h2><span>Visual only, not verified sales evidence</span></div>
     <div className="valueSummary">
      <div><small>Fast cash indication</small><strong>{provisionalMoney(run.result.objects?.[paired?0:researchIndex]?.preliminary_value?.quick_sale??null,run.result.objects?.[paired?0:researchIndex]?.preliminary_value?.currency)}</strong></div>
      <div><small>Balanced range · provisional</small><strong>{provisionalMoney(run.result.objects?.[paired?0:researchIndex]?.preliminary_value?.balanced_low??null,run.result.objects?.[paired?0:researchIndex]?.preliminary_value?.currency)} – {provisionalMoney(run.result.objects?.[paired?0:researchIndex]?.preliminary_value?.balanced_high??null,run.result.objects?.[paired?0:researchIndex]?.preliminary_value?.currency)}</strong></div>
     </div>
     {paired&&<p className="ci-page-meta">These are first-piece visual estimates, NOT a pair valuation. Run online research for the pair as one lot before using a sale figure.</p>}
    </div>}
    {materialContradictsModel&&<InfoDisclosure label="Earlier image-only estimate withheld" warning><p>The model assumed {originalMaterial||'another material'}; owner-recorded material is {correctedMaterial}. The original guess remains available in the saved AI evidence.</p></InfoDisclosure>}
    {visibleResearch&&(existingResearchObsolete
     ? <details className="ci-archive-section"><summary>View superseded research · not valid for pricing</summary>
        <ResearchDecisionPanel research={visibleResearch} sourceAudit={visibleAudit} paired={paired} title="Superseded model research"/>
       </details>
     : null)}
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
     <p><strong>DO NOT LIST YET — final evidenced item decision required.</strong> {!existingResearchObsolete?`Earlier model suggestion: ${visibleResearch?.routing?.sale_readiness?.replaceAll('_',' ')||'not recorded'}. This does not establish readiness.`:'Prior judgement superseded by owner correction.'}</p>
     <button className="secondaryButton inlineButton" onClick={()=>setActiveTab('market')}>Review source evidence and valuation →</button>
    </div>
    <SaleEconomics key={`${run.id}:${paired?'pair':researchIndex}`} currency={run.result?.objects?.[paired?0:researchIndex]?.preliminary_value?.currency||''}
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
       <input type="checkbox" disabled={busy||approving||saving||!!pendingReview||!!pendingApproval||savingDisagreement||!!pendingCorrection} checked={selected[i]!==false} onChange={e=>{setSelected(v=>({...v,[i]:e.target.checked}));setConfirmedPhotoCorrection(false)}}/>
       <span>Include in catalogue</span>
      </label>}
      <h3 className="ci-record-title">{title}</h3>
      <p className="ci-record-stage">{o.maker||'Maker not confirmed'} · Provisional identification</p>
      <div className="ci-object-research-summary" onClick={e=>e.stopPropagation()} onKeyDown={e=>e.stopPropagation()}>
       {paired?<>
        <p className="ci-page-meta">Two physical pieces retain separate mark readings. Whole-lot market research above does not authenticate either piece.</p>
        {(run.result.objects||[]).map((member:any,memberIndex:number)=>{
         const dashboard=dashboardFor(memberIndex)
         return dashboard&&<section key={memberIndex} className="ci-pair-piece-research" aria-label={'Physical piece '+(memberIndex+1)+' research'}>
          <h4>Physical piece {memberIndex+1} · {member.working_title||'Original object'}</h4>
          <ResearchProgress announceError={false} audit={dashboard.audit} history={dashboard.history} compact
           objectLabel={'Physical piece '+(memberIndex+1)+' · '+(member.working_title||'Original object')}
           confidence={dashboard.confidence} loading={busy||checkingResearch} error={researchError}/>
         </section>
        })}
        <button type="button" className="secondaryButton inlineButton" onClick={()=>setActiveTab('identification')}>Review both original pieces</button>
       </>:(()=>{
        const dashboard=dashboardFor(i)
        return dashboard&&<ResearchProgress announceError={false} audit={dashboard.audit} history={dashboard.history} compact
         objectLabel={'Object '+(i+1)+' · '+title} confidence={dashboard.confidence}
         loading={busy||checkingResearch} error={researchError}
         onInvestigate={()=>{setResearchIndex(i);setActiveTab('market')}}/>
       })()}
      </div>
      <details className="ci-object-review">
       <summary>Review object & evidence</summary>
       <div className="ci-object-review-content">
        <div className="ci-review-section ci-review-section-primary">
         <div className="ci-review-section-heading"><span className="ci-review-section-number">01</span><h4>Your review</h4><span className="ci-review-section-hint">Editable information</span></div>
         {run.status==='DRAFT'?<div className="ci-review-fields">
          <label>{paired?'Original first-piece title':'Object title'}<input readOnly={saving||!!pendingReview||savingDisagreement||!!pendingCorrection} disabled={busy||approving||!!pendingApproval} value={edits[i]?.working_title||''} onChange={e=>setEdits(v=>({...v,[i]:{...v[i],working_title:e.target.value}}))}/></label>
          {paired&&<p className="ci-page-meta">Second original member: {run.result.objects[1]?.working_title||'Unidentified'} · {run.result.objects[1]?.condition_summary||'Condition not recorded'}. Both observations will be retained.</p>}
          <label>Your condition notes<textarea rows={3} readOnly={saving||!!pendingReview||savingDisagreement||!!pendingCorrection} disabled={busy||approving||!!pendingApproval} value={edits[i]?.condition_summary||''} onChange={e=>setEdits(v=>({...v,[i]:{...v[i],condition_summary:e.target.value}}))}/></label>
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
