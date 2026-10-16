import { ChangeEvent, DragEvent, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Camera, Images, LoaderCircle, Sparkles, Trash2, UploadCloud } from 'lucide-react'
import { supabase } from '../lib/supabase'
import ObjectCollectionToolbar from '../components/ObjectCollectionToolbar'

type UploadPhoto = {
  index: number
  file: File
  preview: string
  storagePath?: string
  signedUrl?: string
}

type DraftObject = {
  image_indices: number[]
  working_title: string
  category: string
  object_type: string
  material: string
  colour: string
  maker: string | null
  current_attribution: string | null
  period_wording: string | null
  region_country: string | null
  identification_confidence: number
  dating_confidence: number
  valuation_confidence: number
  condition_summary: string
  marks_signatures_labels: string | null
  rarity_desirability: string | null
  sale_readiness: string
  status: string
  specialist_review: boolean
  evidence: Array<{claim:string,provenance:'PHOTO'|'INFERENCE',certainty_class:string,stance:string,notes:string|null}>
  next_evidence: Array<{title:string,why:string,information_value:number}>
  preliminary_value: {currency:string,quick_sale:number|null,balanced_low:number|null,balanced_high:number|null,floor:number|null,basis:string}
  catalogue_note: string
  include?: boolean
}

const emptyContext = {
  purchase_price: '',
  currency: 'GBP',
  weight_g: '',
  dimensions: '',
  storage_location: '',
  user_notes: ''
}

export default function AIIntake() {
  const nav = useNavigate()
  const approvalLock = useRef(false)
  const [mode,setMode] = useState<'single'|'batch'>('single')
  const [photos,setPhotos] = useState<UploadPhoto[]>([])
  const [context,setContext] = useState(emptyContext)
  const [drafts,setDrafts] = useState<DraftObject[]>([])
  const [batchSummary,setBatchSummary] = useState('')
  const [savedItems,setSavedItems] = useState<any[]>([])
  const [inscriptionReview,setInscriptionReview] = useState<any>(null)
  const [inscriptionReviewStatus,setInscriptionReviewStatus] = useState('NOT_TRIGGERED')
  const [knowledgeLookup,setKnowledgeLookup] = useState<any>({status:'NOT_ATTEMPTED',matches:[]})
  const [analysisRunId,setAnalysisRunId] = useState<string|null>(null)
  const [stage,setStage] = useState<'upload'|'analysing'|'review'|'saving'|'complete'>('upload')
  const [message,setMessage] = useState('')
  const [dragActive,setDragActive] = useState(false)
  const [query,setQuery] = useState('')
  const [filter,setFilter] = useState('ALL')
  const [view,setView] = useState<'tiles'|'list'|'compact'>(() => {
    try {
      const saved=window.localStorage.getItem('ci-inventory-view')
      return saved==='list'||saved==='compact'?saved:'tiles'
    }catch{return 'tiles'}
  })
  const changeView=(v:'tiles'|'list'|'compact')=>{
    setView(v)
    try{window.localStorage.setItem('ci-inventory-view',v)}catch{ /* optional preference */ }
  }


  const openDraftObject=(i:number)=>{
    changeView('tiles')
    requestAnimationFrame(()=>{
      const card=document.getElementById('ci-intake-object-'+i)
      card?.scrollIntoView({block:'center',behavior:'auto'})
      const panel=card?.querySelector('details.ci-object-review') as HTMLDetailsElement|null
      if(panel)panel.open=true
    })
  }

  const selectedCount = useMemo(()=>drafts.filter(d=>d.include!==false).length,[drafts])

  const addIncomingFiles = (files: File[]) => {
    const supported = files.filter(file =>
      ['image/jpeg','image/png','image/webp'].includes(file.type) ||
      /\.(jpe?g|png|webp)$/i.test(file.name)
    )
    const rejected = files.length - supported.length
    const max = mode === 'single' ? 20 : 40

    setPhotos(current => {
      const room = Math.max(0,max-current.length)
      const accepted = supported.slice(0,room).map((file,i)=>({
        index: current.length+i,
        file,
        preview: URL.createObjectURL(file)
      }))
      if (rejected) setMessage(`${rejected} unsupported file${rejected===1?' was':'s were'} ignored. Use JPEG, PNG or WebP.`)
      else if (supported.length > room) setMessage(`Photo limit reached: ${max} for this intake mode.`)
      else if (accepted.length) setMessage(`${accepted.length} photograph${accepted.length===1?'':'s'} added.`)
      return [...current,...accepted]
    })
  }

  const addFiles = (e:ChangeEvent<HTMLInputElement>) => {
    addIncomingFiles(Array.from(e.target.files || []))
    e.target.value=''
  }

  const handleDragOver = (e:DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'copy'
    setDragActive(true)
  }

  const handleDragLeave = (e:DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
    setDragActive(false)
  }

  const handleDrop = (e:DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    const dropped = Array.from(e.dataTransfer.files || [])
    if (!dropped.length) {
      setMessage('No image files were detected in that drop.')
      return
    }
    addIncomingFiles(dropped)
  }

  const removePhoto = (index:number) => {
    setPhotos(v=>v.filter(p=>p.index!==index).map((p,i)=>({...p,index:i})))
  }

  const updateContext = (key:string,value:string)=>setContext(v=>({...v,[key]:value}))

  const uploadAndAnalyse = async () => {
    if (!photos.length) return setMessage('Add photographs first.')
    setStage('analysing'); setMessage('Uploading photographs securely…')
    const {data:{session}} = await supabase.auth.getSession()
    const {data:{user}} = await supabase.auth.getUser()
    if (!session || !user) { setStage('upload'); return setMessage('Your session has expired. Sign in again.') }

    const sessionId = crypto.randomUUID()
    let stagedRunId:string|null=null
    const uploaded: UploadPhoto[] = []

    try {
      for (const p of photos) {
        const safe = p.file.name.replace(/[^a-zA-Z0-9._-]/g,'_')
        const path = `${user.id}/intake/${sessionId}/${String(p.index).padStart(2,'0')}-${safe}`
        const {error} = await supabase.storage.from('item-images').upload(path,p.file,{upsert:false})
        if (error) throw error
        const {data:signed,error:signedError} = await supabase.storage.from('item-images').createSignedUrl(path,1800)
        if (signedError || !signed?.signedUrl) throw signedError || new Error('Could not create secure image link')
        uploaded.push({...p,storagePath:path,signedUrl:signed.signedUrl})
      }
      setPhotos(uploaded)
      // Preserve the complete source manifest in the owner's private database BEFORE paid AI.
      const sourceManifest=uploaded.map(p=>({index:p.index,storage_path:p.storagePath,file_name:p.file.name}))
      const {data:staged,error:stageError}=await supabase.from('ai_analysis_runs').insert({
        mode,model:'PENDING',status:'DRAFT',input_photo_count:uploaded.length,
        user_context:context,
        result:{image_manifest_version:1,image_manifest:sourceManifest,analysis_stage:'UPLOADED'}
      }).select('id').single()
      if(stageError||!staged?.id)throw Error('Your photographs uploaded, but the saved report could not be created. No AI was charged; please check your session before retrying.')
      stagedRunId=staged.id
      setAnalysisRunId(staged.id)
      setMessage('Photographs saved. Collector Intelligence is now examining the evidence…')

      const response = await fetch('/api/analyse-intake',{
        method:'POST',
        headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},
        body:JSON.stringify({
          mode,
          run_id:staged.id,
          images:uploaded.map(p=>({index:p.index,fileName:p.file.name,url:p.signedUrl})),
          context:{
            ...context,
            purchase_price: context.purchase_price ? Number(context.purchase_price) : null,
            weight_g: context.weight_g ? Number(context.weight_g) : null
          }
        })
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'AI analysis failed')

      const objects = (payload.result?.objects || []).map((o:DraftObject)=>({...o,include:true}))
      setDrafts(objects)
      setBatchSummary(payload.result?.batch_summary || '')
      setInscriptionReview(payload.inscription_review || null)
      setInscriptionReviewStatus(payload.inscription_review_status || 'UNKNOWN_VERSION')
      setKnowledgeLookup(payload.knowledge_lookup || {status:'UNAVAILABLE',matches:[]})
      setMessage('Checking that the full paid analysis was safely saved…')
      if(payload.saved_run_id!==staged.id)throw Error('Analysis run mismatch. The saved report must be checked before approval.')
      const {data:verified,error:verifyError}=await supabase.from('ai_analysis_runs')
        .select('id,result,status').eq('id',staged.id).single()
      if(verifyError||!verified||verified.status!=='DRAFT'||
         !Array.isArray(verified.result?.objects)||verified.result.objects.length!==objects.length)
        throw Error('The AI response is not yet confirmed in private storage. Do not repeat the paid run; open the saved report.')
      setMessage('AI report saved with original photo references. Review and catalogue when ready.')
      setStage('review')
    } catch (err:any) {
      // A later enrichment failure must NOT trigger another paid AI call if the first-pass result survived.
      if(stagedRunId){
        const {data:retained}=await supabase.from('ai_analysis_runs').select('result')
          .eq('id',stagedRunId).single()
        if(Array.isArray(retained?.result?.objects)&&retained.result.objects.length){
          nav('/draft/'+stagedRunId)
          return
        }
      }
      setStage('upload')
      setMessage((err?.message||'Analysis failed')+
        (stagedRunId?' Your private photo session was preserved; do not pay for another analysis until the saved run is checked.':''))
    }
  }

  const patchDraft = (idx:number,key:keyof DraftObject,value:any) => {
    setDrafts(v=>v.map((d,i)=>i===idx?{...d,[key]:value}:d))
  }

  const approve = async () => {
    if (approvalLock.current) return
    if (!analysisRunId) {
      setMessage('Save the AI report before catalogue approval. No objects have been created.')
      return
    }
    const selectedIndices = drafts.flatMap((d,i) => d.include===false ? [] : [i])
    if (!selectedIndices.length) return setMessage('Select at least one object.')
    approvalLock.current = true
    setStage('saving')
    setMessage('Saving selected objects and their original photo links as one safe transaction…')
    try {
      const {data:{user}} = await supabase.auth.getUser()
      if (!user) throw new Error('Your session has expired; sign in again.')
      const reviews:Record<string,object> = {}
      for (const i of selectedIndices) {
        const d = drafts[i]
        reviews[String(i)] = {
          working_title:d.working_title,
          object_type:d.object_type,
          maker:d.maker,
          current_attribution:d.current_attribution,
          period_wording:d.period_wording,
          region_country:d.region_country,
          condition_summary:d.condition_summary
        }
      }
      const {data,error} = await supabase.rpc('ci_approve_saved_intake_v1',{
        p_run_id:analysisRunId,
        p_object_indices:selectedIndices,
        p_reviews:reviews
      })
      if (error) throw new Error(error.message)
      if (!Array.isArray(data) || data.length!==selectedIndices.length)
        throw new Error('Approval response is incomplete. Check Inventory before trying again.')
      const records = data.map((x:any)=>({id:x.item_id,item_code:x.item_code,title:x.title,source_object_index:x.object_index}))
      setSavedItems(records)
      setStage('complete')
      setMessage(records.length+' objects safely catalogued. Source photos and original AI report remain preserved.')
    } catch (err:any) {
      setStage('review')
      setMessage('Catalogue approval not confirmed: '+(err?.message||'unknown error')+'. Original saved report and photos remain available.')
    } finally {
      approvalLock.current=false
    }
  }

  return (
    <div>
      <div className="pageHeader">
        <div>
          <div className="eyebrow">AI CATALOGUE INTAKE</div>
          <h1>Photographs in. Catalogue out.</h1>
          <p>Upload the object evidence. Collector Intelligence separates, describes and drafts the permanent records for your approval.</p>
        </div>
      </div>

      {stage==='upload' && <>
        <div className="intakeModeGrid">
          <button className={mode==='single'?'intakeMode active':'intakeMode'} onClick={()=>setMode('single')}>
            <Camera/><strong>One object</strong><span>Up to 20 photographs of one physical object.</span>
          </button>
          <button className={mode==='batch'?'intakeMode active':'intakeMode'} onClick={()=>setMode('batch')}>
            <Images/><strong>Mixed batch — up to 5</strong><span>Upload mixed photographs. AI performs object separation first.</span>
          </button>
        </div>

        <div className="panel intakeDropPanel">
          <label
            className={dragActive ? "intakeDrop dragActive" : "intakeDrop"}
            onDragEnter={handleDragOver}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <UploadCloud size={34}/>
            <strong>Drop or choose photographs</strong>
            <span>{mode==='single'?'Overall, base, rim, mark, condition and detail shots are ideal.':'All photographs for up to five objects. Order does not need to be perfect.'}</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={addFiles}/>
          </label>
          {photos.length>0 && <div className="intakeThumbGrid">
            {photos.map(p=><div className="intakeThumb" key={p.index}>
              <img src={p.preview} alt={p.file.name}/>
              <span>#{p.index+1}</span>
              <button onClick={()=>removePhoto(p.index)}><Trash2 size={14}/></button>
            </div>)}
          </div>}
        </div>

        <div className="panel">
          <div className="panelHeader"><div><h2>Only what you know</h2><span>All fields optional. User facts are kept separate from AI inference.</span></div></div>
          <div className="formGrid">
            <label>Purchase price<input type="number" step="0.01" value={context.purchase_price} onChange={e=>updateContext('purchase_price',e.target.value)} placeholder="Optional"/></label>
            <label>Currency<select value={context.currency} onChange={e=>updateContext('currency',e.target.value)}><option>GBP</option><option>EUR</option><option>USD</option></select></label>
            <label>Weight (g)<input type="number" value={context.weight_g} onChange={e=>updateContext('weight_g',e.target.value)} placeholder="Optional"/></label>
            <label>Dimensions<input value={context.dimensions} onChange={e=>updateContext('dimensions',e.target.value)} placeholder="e.g. H 24 cm, W 15 cm"/></label>
            <label>Storage location<input value={context.storage_location} onChange={e=>updateContext('storage_location',e.target.value)} placeholder="Shelf / box / room"/></label>
            <label>Your notes / hypothesis<input value={context.user_notes} onChange={e=>updateContext('user_notes',e.target.value)} placeholder="Optional — treated as a hypothesis, not a fact"/></label>
          </div>
        </div>

        {message && <div className="note">{message}</div>}
        <div className="intakeActions">
          <button className="primaryButton intakeBigButton" disabled={!photos.length} onClick={uploadAndAnalyse}><Sparkles size={18}/> Analyse & draft catalogue</button>
          <span>Nothing is written to the permanent catalogue until you approve the draft.</span>
        </div>
      </>}

      {stage==='analysing' && <div className="analysisStage">
        <LoaderCircle className="spin" size={44}/>
        <h2>Collector Intelligence is examining the photographs</h2>
        <p>{message}</p>
        <div className="analysisChecklist"><span>Object separation</span><span>Construction evidence</span><span>Condition</span><span>Attribution confidence</span><span>Sale-readiness</span></div>
      </div>}

      {(stage==='review' || stage==='saving') && <>
        <div className="ci-intake-review-heading">
          <div><div className="eyebrow">REVIEW YOUR OBJECTS</div>
           <h2>{drafts.length} draft objects</h2>
           <p className="ci-page-meta">Select the objects you want to catalogue. Original source images and AI findings remain unchanged.</p>
          </div>
          <details className="ci-archive-section">
           <summary>Batch analysis and model status</summary>
           <p>{batchSummary}</p>
           <p>Mark recheck: {inscriptionReviewStatus}. Existing knowledge: {knowledgeLookup.status}. Neither confirms a maker.</p>
          </details>
        </div>
        <ObjectCollectionToolbar query={query} onQueryChange={setQuery}
         view={view} onViewChange={changeView} filter={filter} onFilterChange={setFilter}
         searchLabel="Search intake objects" filterLabel="Filter intake objects"
         filters={[{value:'ALL',label:'All objects'},{value:'SELECTED',label:'Selected to save'},{value:'EXCLUDED',label:'Excluded'}]}
        />
        <div className={`cardGrid ci-object-grid ci-view-${view}`}>
          {drafts.map((d,idx)=>{
            if(![d.working_title,d.object_type,d.maker,d.current_attribution].filter(Boolean).join(' ').toLowerCase().includes(query.toLowerCase()))return null
            if(filter==='SELECTED'&&d.include===false)return null
            if(filter==='EXCLUDED'&&d.include!==false)return null
            const hero=photos.find(p=>d.image_indices.includes(p.index))
            return <article className={`itemCard ci-record-card ci-intake-record ${d.include===false?'excluded':''}`}
              key={idx} id={'ci-intake-object-'+idx} tabIndex={view==='compact'?0:undefined}
              role={view==='compact'?'link':undefined} aria-label={view==='compact'?'Review '+d.working_title:undefined}
              onClick={view==='compact'?()=>openDraftObject(idx):undefined}
              onKeyDown={view==='compact'?e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openDraftObject(idx)}}:undefined}>
              <div className="itemCardImage placeholderGlass">
                {hero?<img src={hero.preview} alt={d.working_title||'Provisional object'}/>:<span className="ci-missing-photo">Photo needs linking</span>}
              </div>
              <div className="itemCardBody">
                <div className="itemMeta"><span>Object {idx+1}</span><span>Provisional</span></div>
                <h3 className="ci-record-title">{d.working_title||'Unidentified object'}</h3>
                <p className="ci-record-stage">{d.maker||'Maker not confirmed'} · {d.preliminary_value?.quick_sale==null?'Value needs research':d.preliminary_value.currency+' '+d.preliminary_value.quick_sale+' estimated fast cash'}</p>
                <label className="ci-record-selection" onClick={e=>e.stopPropagation()}>
                  <input type="checkbox" checked={d.include!==false} onChange={e=>patchDraft(idx,'include',e.target.checked)}/>
                  <span>Include in catalogue</span>
                </label>
                <details className="ci-object-review">
                  <summary>Review details and evidence</summary>
                  <div className="ci-object-review-content">
                    <section className="ci-review-section ci-review-section-primary">
                     <div className="ci-review-section-heading"><span className="ci-review-section-number">01</span><h4>Your review</h4><span className="ci-review-section-hint">Editable</span></div>
                     <div className="ci-review-fields">
                      <label>Working title<input value={d.working_title} onChange={e=>patchDraft(idx,'working_title',e.target.value)}/></label>
                      <label>Object type<input value={d.object_type} onChange={e=>patchDraft(idx,'object_type',e.target.value)}/></label>
                      <label>Maker — unverified until researched<input value={d.maker||''} onChange={e=>patchDraft(idx,'maker',e.target.value||null)}/></label>
                      <label>Attribution<input value={d.current_attribution||''} onChange={e=>patchDraft(idx,'current_attribution',e.target.value||null)}/></label>
                      <label>Period<input value={d.period_wording||''} onChange={e=>patchDraft(idx,'period_wording',e.target.value||null)}/></label>
                      <label>Condition notes<textarea rows={3} value={d.condition_summary} onChange={e=>patchDraft(idx,'condition_summary',e.target.value)}/></label>
                     </div>
                    </section>
                    <details className="ci-review-section ci-review-source">
                      <summary><span className="ci-review-section-number">02</span><span>Original photographs</span><span className="ci-review-section-hint">{d.image_indices.length} linked</span></summary>
                      <div className="draftImages ci-intake-photo-details">
                       {photos.filter(p=>d.image_indices.includes(p.index)).map(p=><a href={p.preview} target="_blank" rel="noreferrer" key={p.index}>
                         <img src={p.preview} alt={'Photograph '+(p.index+1)}/><small>Photo {p.index+1}</small>
                       </a>)}
                      </div>
                    </details>
                    <details className="ci-review-section ci-review-source">
                      <summary><span className="ci-review-section-number">03</span><span>AI observations and evidence</span><span className="ci-review-section-hint">Provisional</span></summary>
                      <div className="ci-review-source-content">
                       <div><small>Identification confidence</small><p>{d.identification_confidence}% · Dating {d.dating_confidence}% · Valuation {d.valuation_confidence}%</p></div>
                       {d.marks_signatures_labels&&<div><small>Possible mark</small><p>{d.marks_signatures_labels}</p></div>}
                       {inscriptionReview?.mark_visible&&d.image_indices.some(i=>(inscriptionReview.evidence_image_indices||[]).includes(i))&&
                        <div><small>Unverified inscription reading</small><p>{inscriptionReview.candidate_transcription||'Unclear'}</p></div>}
                       {d.evidence.map((ev,i)=><div key={i}><small>{ev.certainty_class}</small><p>{ev.claim}</p></div>)}
                       <div><small>Estimated valuation basis (not verified sold data)</small><p>{d.preliminary_value?.basis||'Not supplied'}</p></div>
                      </div>
                    </details>
                    <details className="ci-review-section ci-review-source">
                      <summary><span className="ci-review-section-number">04</span><span>Suggested next checks</span><span className="ci-review-section-hint">{d.next_evidence.length}</span></summary>
                      <div className="ci-review-source-content">
                       {d.next_evidence.map((n,i)=><div key={i}><small>Evidence request</small><p>{n.title}</p></div>)}
                      </div>
                    </details>
                  </div>
                </details>
              </div>
            </article>
          })}
        </div>
        {message && <div role="status" className="note">{message}</div>}
        <div className="intakeActions">
          <button className="secondaryButton" disabled={stage==='saving'} onClick={()=>setStage('upload')}>Back to photographs</button>
          <button className="primaryButton intakeBigButton" disabled={stage==='saving'||!selectedCount} onClick={approve}>
           {stage==='saving'?'Saving catalogue…':'Catalogue '+selectedCount+' selected'}
          </button>
        </div>
      </>}
      {stage==='complete' && <div>
        <div className="panel ci-catalogued-result">
          <h2>{savedItems.length} catalogue objects saved</h2>
          <p className="ci-page-meta">Your original report and images are retained. Open an object to continue researching or selling.</p>
        </div>
        <ObjectCollectionToolbar query={query} onQueryChange={setQuery} view={view} onViewChange={changeView}
         searchLabel="Search newly catalogued objects"/>
        <div className={`cardGrid ci-object-grid ci-view-${view}`}>
          {savedItems.filter((item:any)=>[item.title,item.item_code].filter(Boolean).join(' ').toLowerCase().includes(query.toLowerCase()))
           .map((item:any)=>{
            const d=drafts[item.source_object_index]
            const hero=photos.find(p=>d?.image_indices.includes(p.index))
            return <Link to={'/item/'+item.id+'?tab=market'} className="itemCard ci-record-card" key={item.id}>
             <div className="itemCardImage placeholderGlass">{hero?<img src={hero.preview} alt={item.title||'Collection object'}/>:<span className="ci-missing-photo">Photo not linked</span>}</div>
             <div className="itemCardBody">
              <div className="itemMeta"><span>{item.item_code}</span><span>Catalogued</span></div>
              <h3 className="ci-record-title">{item.title||'Unidentified object'}</h3>
              <p className="ci-record-stage">Continue identification, research and sales planning</p>
              <span className="primaryButton ci-card-action">Open object →</span>
             </div>
            </Link>
          })}
        </div>
        <div className="intakeActions"><button className="secondaryButton" onClick={()=>nav('/inventory')}>All objects</button></div>
      </div>}
    </div>
  )
}
