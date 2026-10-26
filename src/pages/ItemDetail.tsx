import { ChangeEvent, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { Camera, Check, ExternalLink, LoaderCircle, Save, Search, ShieldAlert, Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Comparable, Item, ItemPhoto } from '../types'
import { date } from '../lib/format'
import {provisionalMoney} from '../lib/catalogueSaleState'
import {knownSaleCurrency} from '../lib/sellFastPlan'
import Confidence from '../components/Confidence'
import ResearchDecisionPanel from '../components/ResearchDecisionPanel'
import ResearchProgress from '../components/ResearchProgress'
import ComparableEvidence from '../components/ComparableEvidence'
import {itemResearchAudit,readItemResearch,readItemSaleRows} from '../lib/itemResearch'
import {readReviewedAssessment,readReviewedHistory,reviewedAudit,reviewedDecision,reviewedForItem} from '../lib/reviewedAssessment'
import type {ReviewedAssessment} from '../lib/reviewedAssessment'
import type {ItemResearchHistory} from '../lib/itemResearch'
import SellFastPlan from '../components/SellFastPlan'
import ItemAssessment from '../components/ItemAssessment'
import SaleEconomics from '../components/SaleEconomics'
import RecordSaleOutcome from '../components/RecordSaleOutcome'
import {applyConfirmedSaleStatus} from '../lib/actualSale'
import {PhotographError,preparePhotographAttempts,readItemPhotographs,settlePhotographAttempt} from '../lib/itemPhotographs'
import type {PhotographAttempt} from '../lib/itemPhotographs'
import VisualReferenceWorkbench from '../components/VisualReferenceWorkbench'
import WorkspaceActionPanel from '../components/WorkspaceActionPanel'
import ResearchArmyWorkspace from '../components/ResearchArmyWorkspace'

export default function ItemDetail() {
  const {id}=useParams()
  if(!id)return <div role="alert">This collection object could not be identified.</div>
  return <ItemDetailRecord key={id} id={id}/>
}
function ItemDetailRecord({id}:{id:string}) {
  const location = useLocation()
  const [item,setItem] = useState<Item|null>(null)
  const [photos,setPhotos] = useState<ItemPhoto[]>([])
  const [comps,setComps] = useState<Comparable[]>([])
  const [evidenceRecords,setEvidenceRecords] = useState<any[]>([])
  const [attributionVersions,setAttributionVersions] = useState<any[]>([])
  const [tab,setTab] = useState(()=>{
    const query=new URLSearchParams(location.search).get('tab')
    return ['overview','photos','identification','market','sales','catalogue'].includes(query||'')?query!:'overview'
  })
  useEffect(()=>{
    const requested=new URLSearchParams(location.search).get('tab')
    if(requested&&['overview','photos','identification','market','sales','catalogue'].includes(requested))setTab(requested)
  },[location.search,id])
  const [message,setMessage] = useState('')
  const [saving,setSaving]=useState(false)
  const [assessmentMutating,setAssessmentMutating]=useState(false)
  const [armyMutating,setArmyMutating]=useState(false)
  const saveLock=useRef(false),editRevision=useRef(0),savedRevision=useRef(0)
  const [uploading,setUploading] = useState(false)
  const [photoUrls,setPhotoUrls] = useState<Record<string,string>>({})
  const [photographsLoaded,setPhotographsLoaded]=useState(false)
  const [photographsLoading,setPhotographsLoading]=useState(true)
  const [photographError,setPhotographError]=useState('')
  const [photographMessage,setPhotographMessage]=useState('')
  const [pendingPhotographs,setPendingPhotographs]=useState<PhotographAttempt[]>([])
  const [loadError,setLoadError]=useState('')
  const alive=useRef(false),photoRead=useRef(0),itemRead=useRef(0),photoBusy=useRef(false)
  const photoInput=useRef<HTMLInputElement|null>(null),photoStatus=useRef<HTMLParagraphElement|null>(null)
  const current=()=>alive.current
  const loadPhotographs=async()=>{
    const serial=++photoRead.current
    setPhotographsLoading(true);setPhotographsLoaded(false);setPhotographError('');setPhotoUrls({})
    try{
      const {rows}=await readItemPhotographs(supabase,id,current)
      const urls=await Promise.all(rows.map(async photo=>{
        const signed=await supabase.storage.from('item-images').createSignedUrl(photo.storage_path,3600)
        return [photo.id,signed.error?'':signed.data?.signedUrl||''] as const
      }))
      if(!current()||serial!==photoRead.current)return
      setPhotos(rows);setPhotoUrls(Object.fromEntries(urls));setPhotographsLoaded(true)
      if(urls.some(([,url])=>!url))setPhotographError('Some original photographs need a new secure preview. Reload photographs to try again.')
    }catch(error){
      if(!current()||serial!==photoRead.current)return
      setPhotos([]);setPhotoUrls({});setPhotographError(error instanceof PhotographError?error.message:'Photographs could not be loaded. Reload before uploading.')
    }finally{if(current()&&serial===photoRead.current)setPhotographsLoading(false)}
  }
  const processPhotographs=async(attempts:PhotographAttempt[])=>{
    const pending:PhotographAttempt[]=[];let confirmed=0
    for(const attempt of attempts){
      if(!current())return
      try{await settlePhotographAttempt(supabase,attempt,current);confirmed++}
      catch{if(!current())return;pending.push(attempt)}
    }
    if(!current())return
    setPendingPhotographs(pending)
    await loadPhotographs()
    if(!current())return
    setPhotographMessage(pending.length?
      `${confirmed} original photographs confirmed; ${pending.length} still need confirmation. Files that reached private storage are retained. Keep this page open and retry the pending photographs.`:
      `${confirmed} original photographs saved and linked to this item.`)
  }
  useEffect(()=>{if(!uploading&&photographMessage)photoStatus.current?.focus()},[uploading,photographMessage])
  const retryPhotographs=async()=>{
    if(photoBusy.current||!pendingPhotographs.length)return
    invalidateReviewed();photoBusy.current=true;setUploading(true);setPhotographMessage('Checking the same pending photographs…')
    try{await processPhotographs(pendingPhotographs)}finally{photoBusy.current=false;if(current()){invalidateReviewed();setUploading(false)}}
  }
  const [originalReportPaired,setOriginalReportPaired] = useState(false)
  const [researching,setResearching] = useState(false)
  const [researchDraft,setResearchDraft] = useState<any|null>(null)
  const [researchRunId,setResearchRunId] = useState<string|null>(null)
  const [researchAudit,setResearchAudit] = useState<any>(null)
  const [savedResearchRuns,setSavedResearchRuns] = useState<any[]>([])
  const [pendingResearchRuns,setPendingResearchRuns] = useState<any[]>([])
  const [researchHistory,setResearchHistory]=useState<ItemResearchHistory|null>(null)
  const [historyLoading,setHistoryLoading]=useState(true)
  const [historyError,setHistoryError]=useState('')
  const [reviewedCandidate,setReviewed]=useState<ReviewedAssessment|null>(null)
  const [reviewedError,setReviewedError]=useState('')
  const [reviewedHistory,setReviewedHistory]=useState<ReviewedAssessment[]>([])
  const [trustedComps,setTrustedComps]=useState<Comparable[]>([])
  const [listings,setListings]=useState<any[]>([])
  const historyRead=useRef(0),reviewEpoch=useRef(0)
  function invalidateReviewed(){reviewEpoch.current++;setReviewed(null);setReviewedError('Final assessment must be rechecked after item facts or evidence change.')}
  const reloadResearch=async(record:Item)=>{
    const serial=++historyRead.current,epoch=reviewEpoch.current
    const selected=()=>current()&&serial===historyRead.current
    setHistoryLoading(true);setHistoryError('');setTrustedComps([]);setListings([]);setReviewed(null);setReviewedError('');setReviewedHistory([])
    try{
      const [history,comparables,trusted,storedListings]=await Promise.all([
        readItemResearch(supabase,record,selected),readItemSaleRows(supabase,'comparables',record,selected),
        readItemSaleRows(supabase,'trusted_comparables_v1',record,selected),readItemSaleRows(supabase,'listings',record,selected)
      ])
      if(!selected())return
      setResearchHistory(history);setComps(comparables);setTrustedComps(trusted);setListings(storedListings)
      try{const [verified,archive]=await Promise.all([readReviewedAssessment(supabase,record,selected),readReviewedHistory(supabase,record,selected)]);if(selected()){if(epoch===reviewEpoch.current)setReviewed(verified);setReviewedHistory(archive)}}catch(e){if(selected())setReviewedError(e instanceof Error?e.message:'Independent final review is unavailable.')}
      if(!selected())return
      setOriginalReportPaired(history.paired)
      setSavedResearchRuns(history.runs.filter(x=>x.status==='APPROVED'&&x.result?.research_summary))
      setPendingResearchRuns(history.runs.filter(x=>x.status==='DRAFT'&&x.result?.research_summary))
    }catch(error){if(selected()){setResearchHistory(null);setSavedResearchRuns([]);setPendingResearchRuns([]);setHistoryError(error instanceof Error?error.message:'Saved history is unavailable. No new research was started.')}}
    finally{if(selected())setHistoryLoading(false)}
  }

  const load = async () => {
    if (!id) return
    const serial=++itemRead.current
    setLoadError('')
    const auth=await supabase.auth.getUser()
    if(!current()||serial!==itemRead.current)return
    if(auth.error||!auth.data.user){setItem(null);setLoadError('Sign in again to open this collection object.');return}
    const ownerId=auth.data.user.id
    const {data:itemData,error:itemError}=await supabase.from('items').select('*').eq('id',id).eq('owner_id',ownerId).maybeSingle()
    if(!current()||serial!==itemRead.current)return
    if(itemError||!itemData||itemData.owner_id!==ownerId){setItem(null);setLoadError('This collection object is unavailable for the signed-in account.');return}
    setItem(itemData as Item)
    const [ev,ah] = await Promise.all([
      supabase.from('item_evidence').select('*').eq('item_id',id).order('created_at',{ascending:false}),
      supabase.from('attribution_history').select('*').eq('item_id',id).order('created_at',{ascending:false})
    ])
    if(!current()||serial!==itemRead.current)return
    setEvidenceRecords(ev.data||[])
    setAttributionVersions(ah.data||[])
    await reloadResearch(itemData as Item)
  }
  useEffect(()=>{
    alive.current=true;void load();void loadPhotographs()
    return ()=>{alive.current=false;photoRead.current++;itemRead.current++;historyRead.current++}
  },[id])
  useEffect(()=>{
    if(!item||(!researching&&!researchHistory?.runs.some(run=>run.result?.analysis_stage==='PROCESSING')))return
    const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void reloadResearch(item)},15000)
    return ()=>window.clearInterval(timer)
  },[item?.id,researchHistory,researching])

  const update = (k:keyof Item,v:any)=>{invalidateReviewed();editRevision.current++;if(item)setItem({...item,[k]:v})}
  const refreshStoredFacts=async()=>{
    invalidateReviewed()
    if(!item||editRevision.current!==savedRevision.current)throw Error('Save your current catalogue edits before replacing the stored facts for a new review.')
    const auth=await supabase.auth.getUser();if(auth.error||auth.data.user?.id!==item.owner_id)throw Error('Sign in as this object’s owner.')
    const read=await supabase.from('items').select('*').eq('id',item.id).eq('owner_id',item.owner_id).maybeSingle()
    if(!current()||read.error||!read.data)throw Error('Current stored catalogue facts could not be recovered.')
    setItem(read.data as Item)
  }
  const save = async () => {
    if(!item||saveLock.current)return
    invalidateReviewed();saveLock.current=true;setSaving(true);const selected=item,revision=editRevision.current
    const copy:any={...selected};delete copy.id;delete copy.item_code;delete copy.created_at;delete copy.updated_at
    try{
      const auth=await supabase.auth.getUser();if(!current())return
      if(auth.error||auth.data.user?.id!==selected.owner_id)throw Error('Sign in as this object’s owner before saving.')
      try{await supabase.from('items').update(copy).eq('id',selected.id).eq('owner_id',selected.owner_id)}catch{/* Independently read the outcome. */}
      const read=await supabase.from('items').select('*').eq('id',selected.id).eq('owner_id',selected.owner_id).maybeSingle()
      const confirmed=await supabase.auth.getUser();if(!current())return
      if(confirmed.error||confirmed.data.user?.id!==selected.owner_id||read.error||!read.data||Object.entries(copy).some(([k,v])=>JSON.stringify(v)!==JSON.stringify(read.data[k])))throw Error('Save outcome is unconfirmed. Your edits remain here; recover stored catalogue facts before another assessment.')
      savedRevision.current=revision
      setItem(previous=>previous&&previous.id===selected.id?(revision===editRevision.current?read.data as Item:{...previous,updated_at:read.data.updated_at}):previous)
      setMessage('Saved');setTimeout(()=>{if(current())setMessage('')},1600)
    }catch(e){if(current())setMessage(e instanceof Error?e.message:'Save unconfirmed; your edits remain here.')}
    finally{saveLock.current=false;if(current()){invalidateReviewed();setSaving(false)}}
  }

  const upload = async (event:ChangeEvent<HTMLInputElement>) => {
    const files=Array.from(event.target.files||[]);event.target.value=''
    if(!item||!files.length||photoBusy.current||!photographsLoaded||pendingPhotographs.length)return
    invalidateReviewed();photoBusy.current=true;setUploading(true);setPhotographMessage('Saving original photographs and checking their links…')
    try{
      const attempts=await preparePhotographAttempts(supabase,item.id,files,current)
      await processPhotographs(attempts)
    }catch(error){if(current())setPhotographMessage(error instanceof PhotographError?error.message:'The photographs could not be confirmed. Please retry.')}
    finally{photoBusy.current=false;if(current()){invalidateReviewed();setUploading(false)}}
  }

  const runResearch = async () => {
    if (!item) return
    invalidateReviewed();setResearching(true)
    setMessage('Researching live market evidence…')
    try {
      const {data:{session}} = await supabase.auth.getSession()
      if(!session)throw Error('Session expired. Sign in again.')
      // Re-read persisted attempts before staging another chargeable request.
      const history=await readItemResearch(supabase,item,current)
      if(history.runs.some(run=>run.result?.analysis_stage==='PROCESSING'))throw Error('An earlier research request has an unconfirmed outcome. Recover its stored history before any paid retry.')
      const images=Object.values(photoUrls).filter(Boolean).slice(0,12)
      const {data:staged,error:stageError}=await supabase.from('ai_analysis_runs').insert({
        mode:'research',model:'PENDING',status:'DRAFT',input_photo_count:images.length,
        user_context:{item_id:item.id,item_code:item.item_code},
        result:{analysis_stage:'STAGED',source_item_id:item.id}
      }).select('id').single()
      if(stageError||!staged?.id)throw Error('Cannot stage owner-scoped research. No paid model request made.')
      const response = await fetch('/api/research-item',{
        method:'POST',
        headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},
        body:JSON.stringify({item,images,research_run_id:staged.id})
      })
      const rawResponse=await response.text()
      let payload:any
      try {payload=JSON.parse(rawResponse)}
      catch {throw Error('Research service response was not readable. Check saved analysis before trying again.')}
      if(!response.ok){
        if(payload?.result?.research_summary){
          setResearchDraft(payload.result);setResearchAudit(payload.source_audit||null)
        }
        throw Error((payload.error||'Research service failed')+'. Staged run preserved; do not repeat paid research to recover it.')
      }
      if(payload.saved_run_id!==staged.id)throw Error('Research result ID did not match staged record.')
      const {data:verified,error:verifyError}=await supabase.from('ai_analysis_runs')
        .select('id,result,status').eq('id',staged.id).single()
      if(verifyError||!verified||verified.result?.analysis_stage!=='COMPLETE'||!verified.result?.research_summary)
        throw Error('Paid research readback incomplete. Do not make another paid request to recover it.')
      setResearchDraft(verified.result)
      setResearchAudit(verified.result.source_audit||null)
      setResearchRunId(staged.id)
      setMessage('Online research saved and read back. Review sources before promoting any claim or price.')
    } catch (err:any) {
      setMessage(err?.message || 'Research failed')
    } finally {
      if(current()){setResearching(false);await reloadResearch(item)}
    }
  }

  // Preserve provisional analysis atomically in its existing research-run record.
  // Do not mutate item, attribution history, valuation history or comparable trust status.
  const approveResearch = async () => {
    if (!item || !researchDraft || !researchRunId) {
      setMessage('Research draft could not be linked to a saved analysis run. Keep this draft open.')
      return
    }
    invalidateReviewed();setResearching(true)
    try {
      const {error}=await supabase.from('ai_analysis_runs')
        .update({status:'APPROVED',approved_at:new Date().toISOString()})
        .eq('id',researchRunId).eq('mode','research').eq('status','DRAFT').select('id').single()
      if(error) throw error
      await load()
      setResearchDraft(null)
      setMessage('Provisional research preserved in analysis history. Item attribution, values and comparables were NOT changed; original-source verification remains required.')
    } catch(err:any) {
      setMessage(err?.message || 'Research not saved; draft remains open.')
    } finally {if(current()){setResearching(false);await reloadResearch(item)}}
  }

  const reviewed=researching||uploading||saving||assessmentMutating||armyMutating?null:reviewedForItem(reviewedCandidate,item)
  if (!item) return <div className="empty" role={loadError?'alert':undefined}>{loadError||'Loading object record…'}</div>
  const heroPhoto=photos.find(photo=>photo.is_hero)||photos[0]
  const heroUrl=heroPhoto?photoUrls[heroPhoto.id]:''
  // One clear action. This is navigation only: it never promotes evidence,
  // starts paid AI, publishes a listing, or marks an object sold.
  const suggestedStage = item.status==='SOLD'?'sales':!photos.length?'photos':reviewed?'sales':'market'
  const suggestedLabel = item.status==='SOLD'?'View recorded sale':!photographsLoaded?'Check photographs':!photos.length?'Add photographs':reviewed?'Prepare sale':'Continue research'
  const wizardSteps = [
    {id:'photos',label:'Photos'},
    {id:'market',label:'Research & value'},
    {id:'overview',label:'Catalogue'},
    {id:'sales',label:'Sell'}
  ] as const
  const activeWizardStep = wizardSteps.findIndex(step=>step.id===tab)

  return (
    <div>
      <div className="itemHero">
        <div className="ci-item-hero-media">
          {heroUrl?
            <img src={heroUrl} alt={`Original photograph of ${item.item_code}`} onError={()=>{
              if(!current()||!heroPhoto)return
              setPhotoUrls(previous=>({...previous,[heroPhoto.id]:''}))
              setPhotographError('Secure photo preview unavailable. Reload photographs to refresh the link; the original is retained.')
            }}/>:
            <span role="status">{photographsLoading?'Checking original photograph…':photographError||!photographsLoaded?'Original photograph preview unavailable':heroPhoto?'Original photograph preview unavailable':'No photograph linked yet'}</span>}
        </div>
        <div className="ci-item-hero-details">
          <div className="eyebrow">{item.item_code}</div>
          <h1 style={{fontSize:'clamp(1.65rem,2.6vw,2.55rem)',lineHeight:1.12,maxWidth:'26ch'}}>{(item.current_attribution || item.title || item.object_type || 'Unidentified object').length>76 ? (item.object_type || item.title || 'Unidentified object').slice(0,76) : (item.current_attribution || item.title || item.object_type || 'Unidentified object')}</h1>
          <p>{[item.maker,item.period_wording,item.region_country].filter(Boolean).join(' · ') || 'Identification in progress'}</p>
          <div className="pillRow"><span className="pill accent">{item.status==='SOLD'?'SOLD':reviewed?reviewed.assessment.decision.replaceAll('_',' '):'FINAL RESEARCH DECISION REQUIRED'}</span></div>
        </div>
        <div className="heroActions">
          <button className="primaryButton inlineButton" onClick={()=>setTab(suggestedStage)}>{suggestedLabel}</button>
          <button className="secondaryButton" onClick={()=>setTab('market')}>Research & value</button>
          <button className="secondaryButton" onClick={()=>setTab('sales')}>Sell / route</button>
        </div>
      </div>
      <nav aria-label="Object workflow" className="panel" style={{padding:'0.75rem 1rem',marginBottom:'0.75rem'}}>
        <div className="eyebrow">ONE OBJECT · ONE NEXT STEP</div>
        <p className="ci-page-meta" role="status" aria-live="polite" style={{margin:'0.25rem 0'}}>
          {activeWizardStep>=0?`Step ${activeWizardStep+1} of ${wizardSteps.length}: ${wizardSteps[activeWizardStep].label}`:'Object details'} · Suggested: {suggestedLabel}
        </p>
        <div className="pillRow" style={{marginTop:'0.5rem'}}>
          {wizardSteps.map((step,index)=><button key={step.id} type="button" onClick={()=>setTab(step.id)}
            aria-current={tab===step.id?'step':undefined}
            className={tab===step.id?'primaryButton inlineButton':'secondaryButton'}
            style={{fontSize:'0.9rem'}}> {index+1}. {step.label}</button>)}
        </div>
        <small style={{display:'block',marginTop:'0.5rem'}}>Your evidence and earlier work stay saved. Steps do not approve research or publish listings automatically.</small>
      </nav>
      {message && <div className="saveToast">{message}</div>}

      <div className="tabBar">
        {['overview','photos','identification','market','sales','catalogue'].map(t=><button key={t} className={tab===t?'active':''} onClick={()=>setTab(t)}>{t}</button>)}
      </div>
      {tab==='overview' && <div>
        <div className="panel">
          <div className="panelHeader"><h2>At a glance</h2><span>{item.item_code}</span></div>
          <div className="valueSummary ci-item-value-summary">
            <div><small>Identity</small><strong>{item.maker || 'Maker unknown'}</strong></div>
            <div><small>Confidence</small><strong>{item.identification_confidence ?? '—'}% ID</strong></div>
            <div><small>Fast cash · provisional</small><strong>{provisionalMoney(item.quick_sale_value,item.currency)}</strong></div>
            <div><small>Next action</small><strong>{item.status==='SOLD'?'Review sale history':'Complete evidence review and final item assessment'}</strong></div>
          </div>
          <p>{item.condition_summary ? item.condition_summary.slice(0,180) : 'Condition not yet recorded.'}</p>
          <details><summary>Show identification and valuation confidence</summary>
            <Confidence label="Identification" value={item.identification_confidence}/>
            <Confidence label="Dating" value={item.dating_confidence}/>
            <Confidence label="Valuation" value={item.valuation_confidence}/>
          </details>
        </div>
        <details style={{marginTop:16}}>
          <summary style={{cursor:'pointer',fontWeight:700,padding:'12px 0'}}>Edit full item record, commercial details and values</summary>
          <div className="detailGrid">
        <div className="panel span2">
          <div className="panelHeader"><h2>Object record</h2><span>Permanent factual core</span></div>
          <div className="formGrid">
            <label>Working title<input value={item.title||''} onChange={e=>update('title',e.target.value)}/></label>
            <label>Object type<input value={item.object_type||''} onChange={e=>update('object_type',e.target.value)}/></label>
            <label>Maker<input value={item.maker||''} onChange={e=>update('maker',e.target.value)}/></label>
            <label>Attribution<input value={item.current_attribution||''} onChange={e=>update('current_attribution',e.target.value)}/></label>
            <label>Period<input value={item.period_wording||''} onChange={e=>update('period_wording',e.target.value)}/></label>
            <label>Region / country<input value={item.region_country||''} onChange={e=>update('region_country',e.target.value)}/></label>
            <label>Material<input value={item.material||''} onChange={e=>update('material',e.target.value)}/></label>
            <label>Colour<input value={item.colour||''} onChange={e=>update('colour',e.target.value)}/></label>
            <label>Weight (g)<input type="number" value={item.weight_g??''} onChange={e=>update('weight_g',e.target.value?Number(e.target.value):null)}/></label>
            <label>Storage location<input value={item.storage_location||''} onChange={e=>update('storage_location',e.target.value)}/></label>
          </div>
          <label>Condition<textarea rows={4} value={item.condition_summary||''} onChange={e=>update('condition_summary',e.target.value)}/></label>
          <label>Marks / signatures / labels<textarea rows={3} value={item.marks_signatures_labels||''} onChange={e=>update('marks_signatures_labels',e.target.value)}/></label>
          <label>Provenance<textarea rows={3} value={item.provenance||''} onChange={e=>update('provenance',e.target.value)}/></label>
          <label>External catalogue note<textarea rows={4} value={item.catalogue_note||''} onChange={e=>update('catalogue_note',e.target.value)} placeholder="Clean presentation wording suitable for a dealer, auctioneer or buyer."/></label>
          <label>Internal notes<textarea rows={5} value={item.notes||''} onChange={e=>update('notes',e.target.value)}/></label>
        </div>

        <div className="panel">
          <div className="panelHeader"><h2>Confidence</h2><span>Keep these independent</span></div>
          <Confidence label="Identification" value={item.identification_confidence}/>
          <Confidence label="Dating" value={item.dating_confidence}/>
          <Confidence label="Valuation" value={item.valuation_confidence}/>
        </div>

        <div className="panel">
          <div className="panelHeader"><h2>Commercial</h2><span>Current decision layer</span></div>
          <div className="formStack">
            <label>Status<select value={item.status} onChange={e=>update('status',e.target.value)}><option>CATALOGUED</option><option>RESEARCH</option><option>ONE_QUICK_CHECK</option><option>SPECIALIST_REVIEW</option><option>READY_TO_SELL</option><option>LISTED</option><option>CONSIGNED</option><option>SOLD</option><option>ARCHIVED</option></select></label>
            <label>Sale readiness<select value={item.sale_readiness||''} onChange={e=>update('sale_readiness',e.target.value||null)}><option value="">—</option><option>SELL_NOW</option><option>ONE_QUICK_CHECK_THEN_SELL</option><option>RESEARCH_FIRST</option><option>SPECIALIST_REVIEW</option></select></label>
            <label>Best venue<input value={item.best_venue||''} onChange={e=>update('best_venue',e.target.value)}/></label>
            <label>Backup venue<input value={(item as any).backup_venue||''} onChange={e=>update('backup_venue' as any,e.target.value)}/></label>
          </div>
          {item.status==='SPECIALIST_REVIEW' && <div className="warningCallout"><ShieldAlert size={19}/> Protected from fast-sale routing.</div>}
        </div>

        <div className="panel span2">
          <div className="panelHeader"><h2>Values</h2><span>{knownSaleCurrency(item.currency)?item.currency:'Currency unconfirmed'}</span></div>
          <div className="valueGrid">
            <label>Quick sale<input type="number" value={item.quick_sale_value??''} onChange={e=>update('quick_sale_value',e.target.value?Number(e.target.value):null)}/></label>
            <label>Balanced low<input type="number" value={item.balanced_value_low??''} onChange={e=>update('balanced_value_low',e.target.value?Number(e.target.value):null)}/></label>
            <label>Balanced high<input type="number" value={item.balanced_value_high??''} onChange={e=>update('balanced_value_high',e.target.value?Number(e.target.value):null)}/></label>
            <label>Floor<input type="number" value={item.floor_price??''} onChange={e=>update('floor_price',e.target.value?Number(e.target.value):null)}/></label>
            <label>Expected net<input type="number" value={item.expected_net??''} onChange={e=>update('expected_net',e.target.value?Number(e.target.value):null)}/></label>
          </div>
        </div>
          </div>
          <div style={{marginTop:12}}><button className="primaryButton inlineButton" onClick={save} disabled={saving}><Save size={17}/> {saving?'Checking saved facts…':'Save changes'}</button></div>
        </details>
      </div>}

      {tab==='photos' && <section className="panel" aria-label="Original photographs">
        <div className="panelHeader ci-photo-header"><div><h2>Photographs</h2><span>Original object evidence and listing imagery</span></div>
          <button type="button" className="primaryButton inlineButton" disabled={uploading||(!pendingPhotographs.length&&!photographsLoaded)} onClick={()=>pendingPhotographs.length?void retryPhotographs():photoInput.current?.click()}><Camera size={17}/>{uploading?'Checking photographs…':pendingPhotographs.length?'Retry pending photographs':'Upload photos'}</button>
          <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple hidden disabled={uploading||!photographsLoaded||!!pendingPhotographs.length} onChange={upload}/>
        </div>
        {photographsLoading&&<p>Loading private photographs…</p>}
        {photographError&&<p className="note" role="alert">{photographError}</p>}
        {photographError&&!uploading&&<button className="secondaryButton inlineButton" onClick={()=>void loadPhotographs()}>Reload photographs</button>}
        <div className="photoGrid">
          {photographsLoaded&&photos.length===0&&!photographError&&<div className="empty">No photographs linked to this item yet.</div>}
          {photos.map(photo=><div className="photoTile" key={photo.id}>{photoUrls[photo.id]?<img src={photoUrls[photo.id]} alt={photo.caption||photo.file_name||item.item_code} onError={()=>{
            if(!current())return
            setPhotoUrls(previous=>({...previous,[photo.id]:''}));setPhotographError('A secure preview could not be displayed. Reload photographs to try again; the original is retained.')
          }}/>:<div className="photoPending">{photographsLoading?'Loading secure preview…':'Preview unavailable'}</div>}<div><strong>{photo.photo_role||'Object photo'}</strong><span>{photo.file_name}</span></div></div>)}
        </div>
        {photographMessage&&<p className="note" role="status" tabIndex={-1} ref={photoStatus}>{photographMessage}</p>}
        <div className="note">Image previews use short-lived signed URLs from the private Supabase bucket.</div>
      </section>}

      {tab==='identification' && <div className="marketStack">
        <div className="panel">
          <div className="panelHeader"><h2>Attribution revision history</h2><span>{attributionVersions.length} recorded versions</span></div>
          {attributionVersions.length===0 ? <div className="empty">No attribution revisions recorded yet.</div> :
          <div className="tableWrap"><table><thead><tr><th>Status</th><th>Attribution</th><th>Confidence</th><th>Reason / evidence</th></tr></thead><tbody>
            {attributionVersions.map((v:any)=><tr key={v.id}><td>{v.attribution_status||'—'}</td><td>{v.attribution_text||v.maker||'Unattributed'}<div>{v.period_wording||''}</div></td><td>{v.confidence===null?'—':(v.confidence||0)+'%'}</td><td>{v.change_reason||v.evidence_summary||'—'}</td></tr>)}
          </tbody></table></div>}
        </div>
        <div className="panel">
          <div className="panelHeader"><h2>Object-level evidence</h2><span>{evidenceRecords.length} recorded claims</span></div>
          {evidenceRecords.length===0 ? <div className="empty">No evidence records yet.</div> :
          <div className="tableWrap"><table><thead><tr><th>Class</th><th>Observation / claim</th><th>Source</th><th>Verification</th></tr></thead><tbody>
            {evidenceRecords.map((e:any)=><tr key={e.id}><td>{e.certainty_class||'—'}<div>{e.stance||''}</div></td><td>{e.claim}<div>{e.notes||''}</div></td><td>{e.source_reference||e.provenance||'—'}</td><td>{e.verification_status||'UNVERIFIED'}</td></tr>)}
          </tbody></table></div>}
        </div>
      </div>}

      <div className="ci-research-workspace-shell" hidden={tab!=='market'}>
        <ResearchArmyWorkspace key={item.id} item={item} onMutating={active=>{invalidateReviewed();setArmyMutating(active)}} onChanged={()=>void reloadResearch(item)}/>
      </div>
      {tab==='market' && <div className="marketStack">
        <ComparableEvidence rows={comps} trustedIds={trustedComps.map(c=>c.id)} error={historyError}/>
        {photos.some(p=>!!photoUrls[p.id])&&
         <VisualReferenceWorkbench
          itemId={item.id}
          legacySourceRunId={(item as any).source_analysis_run_id||null}
          legacyObjectIndex={(item as any).source_object_index??null}
          legacyPaired={originalReportPaired}
          photos={Object.fromEntries(photos.map((p,i)=>[i,photoUrls[p.id]||'']))}
          photoIndices={photos.map((_,i)=>i)}
          itemPhotoIdsByIndex={Object.fromEntries(photos.map((p,i)=>[i,p.id]))}
          ownerMaterial={item.material||null}
          latestResearchAt={pendingResearchRuns[0]?.created_at||savedResearchRuns[0]?.created_at||null}
          workingTitle={item.title||item.object_type||'Collection object'}
         />}

        {pendingResearchRuns.length>0 && <div className="panel">
          <div className="panelHeader"><h2>Recovered research drafts</h2><span>{pendingResearchRuns.length} saved drafts</span></div>
          {pendingResearchRuns.map((run:any)=><div className="note" key={run.id}>
            <strong>{new Date(run.created_at).toLocaleString()} — saved provisional research{run.user_context?.source_analysis_run_id?' · from original photo draft':''}</strong>
            <p>{String(run.result?.research_summary||'Research result saved').slice(0,350)}</p>
            <button className="primaryButton inlineButton" disabled={researching} onClick={()=>{
              setResearchDraft(run.result);setResearchAudit(run.result?.source_audit||null);setResearchRunId(run.id);
              setMessage('Existing research draft restored. No new AI research has run.')
            }}>Restore existing draft</button>
          </div>)}
        </div>}
        {savedResearchRuns.length>0 && <div className="panel" style={{padding:16}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12}}>
            <div><strong>Saved research · {savedResearchRuns.length}</strong><div style={{fontSize:12,color:'var(--muted)',marginTop:4}}>Provisional — maker and sold prices not verified</div></div>
            <button className="secondaryButton" onClick={()=>{const run=savedResearchRuns[0];setResearchDraft(run.result);setResearchAudit(run.result?.source_audit||null);setResearchRunId(null)}}>View findings</button>
          </div>
          <details style={{marginTop:12}}><summary style={{cursor:'pointer',fontSize:12,color:'var(--muted)'}}>Earlier saved research</summary>
            {savedResearchRuns.slice(1).map((run:any)=><div className="note" key={run.id}>
              <span>{new Date(run.created_at).toLocaleDateString()} · Provisional</span>
              <button className="secondaryButton" onClick={()=>{setResearchDraft(run.result);setResearchAudit(run.result?.source_audit||null);setResearchRunId(null)}}>Open</button>
            </div>)}
          </details>
        </div>}
        <WorkspaceActionPanel eyebrow="RESEARCH OPTIONS" title="Research this object"
         description="Continue with the original item photographs. Saved research remains available above."
         primary={{
          label:researching?'Researching…':'Research online',
          onClick:runResearch,disabled:researching||historyLoading||!!historyError||!!researchHistory?.runs.some(run=>run.result?.analysis_stage==='PROCESSING'),loading:researching
         }}
         secondary={<a href="https://lens.google.com/" target="_blank" rel="noopener noreferrer"
          className="ci-action-text-link">Manual image search ↗</a>}
         note="Optional paid AI search. Your original evidence and earlier research remain unchanged."
        />

        {researchDraft && <>
         <ResearchDecisionPanel research={researchDraft} sourceAudit={researchAudit} title="Research decision" />
         <div className="panel researchApprove">
          <p className="ci-page-meta">Preserving this result keeps research provisional; it does not change maker, accepted value or trusted comparables.</p>
          <button className="secondaryButton" onClick={()=>setResearchDraft(null)} disabled={researching}>Close research view</button>
          {researchRunId&&<button className="primaryButton inlineButton" onClick={approveResearch} disabled={researching}><Check size={17}/> Preserve provisional research</button>}
         </div>
        </>}

      </div>}

      {tab==='sales' && <div className="marketStack">
       <div className="panel">
        <div className="panelHeader"><h2>Sales and listing record</h2><span>Original collection object</span></div>
        <div className="valueSummary">
         <div><small>Acquisition · cash paid</small><strong>{provisionalMoney(item.acquisition_price,item.acquisition_currency)}</strong></div>
         <div><small>Indicative fast cash · gross</small><strong>{provisionalMoney(item.quick_sale_value,item.currency)}</strong></div>
         <div><small>Previously recorded expected net</small><strong>{provisionalMoney(item.expected_net,item.currency)}</strong></div>
        </div>
        <p className="ci-page-meta">Previously recorded prices are not evidence of achieved sales. Do not automatically use dealer asking as a realised price.</p>
        <Link className="secondaryButton inlineButton" to={'/lots?item='+item.id}>Compare separate and grouped selling</Link>
        {savedResearchRuns.length>0&&<button className="secondaryButton inlineButton" onClick={()=>setTab('market')}>View preserved market research →</button>}
       </div>
       {historyError&&<p role="alert">{historyError} Sale recommendation and publication status cannot be confirmed.</p>}
       <SellFastPlan item={item} comparables={comps} trustedComparableIds={historyError?[]:trustedComps.map(c=>c.id)} listings={historyError?[]:listings} photoCount={photos.length} researchAudit={!historyError&&researchHistory?reviewedAudit(itemResearchAudit(researchHistory,trustedComps),reviewed):undefined} finalDecision={reviewed?reviewedDecision(reviewed):undefined}/>
       <SaleEconomics currency={item.currency||''} acquisitionPrice={item.acquisition_price} contextLabel={item.item_code}/>
       <RecordSaleOutcome client={supabase} itemId={item.id} onSold={(soldId,ownerId)=>setItem(current=>applyConfirmedSaleStatus(current,soldId,ownerId))}/>
      </div>}

      {tab==='catalogue' && <div className="cataloguePreview">
        <div className="catalogueTop"><span>{item.item_code}</span><span>Collector Intelligence Catalogue</span></div>
        <h1>{item.current_attribution || item.title || item.object_type}</h1>
        <div className="catalogueFacts">
          <div><small>Maker / attribution</small><strong>{item.maker || item.current_attribution || 'Unattributed'}</strong></div>
          <div><small>Period</small><strong>{item.period_wording || 'Undetermined'}</strong></div>
          <div><small>Origin</small><strong>{item.region_country || 'Undetermined'}</strong></div>
          <div><small>Material</small><strong>{item.material || '—'}</strong></div>
        </div>
        <h3>Condition</h3><p>{item.condition_summary || 'Condition report pending.'}</p>
        <h3>Catalogue note</h3><p>{item.catalogue_note || 'Catalogue description pending.'}</p>
        <div className="catalogueFooter">Internal research evidence is intentionally excluded from this external-facing view.</div>
      </div>}

      {/* Evidence and owner-assessment tools remain mounted for every tab,
          after the selected task. This keeps keyboard and screen-reader order
          aligned with the visible two-click workflow. */}
      <details className="panel" open={tab==='market'||tab==='identification'}>
        <summary style={{cursor:'pointer',fontWeight:700}}>Research evidence and expert controls</summary>
        <p className="ci-page-meta">Detailed evidence, assessments and verification are available here; the wizard remains your main path.</p>
      <ResearchProgress compact={tab!=='overview'} audit={researchHistory?reviewedAudit(itemResearchAudit(researchHistory,trustedComps),reviewed):undefined} finalDecision={reviewed?reviewedDecision(reviewed):undefined} history={researchHistory} error={historyError} loading={historyLoading} objectLabel={item.item_code} confidence={{identification:item.identification_confidence,dating:item.dating_confidence,valuation:item.valuation_confidence}} onReload={()=>void reloadResearch(item)} onInvestigate={()=>setTab('market')}/>
      <ItemAssessment client={supabase} item={item} qualifiedReviewId={reviewed?.id} onRefreshFacts={refreshStoredFacts} audit={!historyError&&researchHistory?reviewedAudit(itemResearchAudit(researchHistory,trustedComps),reviewed):undefined} onMutating={active=>{invalidateReviewed();setAssessmentMutating(active)}} onChanged={()=>{invalidateReviewed();void reloadResearch(item)}}/>
      {reviewedError&&<p className="ci-page-meta">{reviewedError}</p>}
      {reviewed&&<section className="panel" aria-label="Independently reviewed final assessment"><h2>Source-reviewed final assessment</h2><strong>{reviewed.assessment.decision.replaceAll('_',' ')}</strong><p>{reviewed.assessment.rationale}</p><p>Next action: {reviewed.assessment.nextAction}</p><p>Selling guidance: {reviewed.assessment.routeGuidance}</p><p>Unresolved: {reviewed.assessment.unresolvedIssues}</p><small>{reviewed.created_at} · {reviewed.assessment.reviewReference}</small><details><summary>Reviewed evidence and category decisions</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(reviewed.assessment,null,2)}</pre></details></section>}

      </details>
      {reviewedHistory.length>0&&<details className="panel"><summary>Independent final assessment history ({reviewedHistory.length})</summary><p>Historical decisions retain their original evidence. Only the current qualified assessment can establish readiness.</p>{reviewedHistory.map(row=><article key={row.id}><strong>{row.assessment.decision.replaceAll('_',' ')} · {row.id===reviewed?.id?'current independent source review':'historical decision — not current readiness'}</strong><p>{row.assessment.rationale}</p><small>{row.created_at} · {row.assessment.reviewReference}</small><details><summary>Original assessment and source references</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(row.assessment,null,2)}</pre></details></article>)}</details>}

    </div>
  )
}
