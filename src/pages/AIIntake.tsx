import { ChangeEvent, DragEvent, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, Check, Images, LoaderCircle, Sparkles, Trash2, UploadCloud } from 'lucide-react'
import { supabase } from '../lib/supabase'

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
  const [mode,setMode] = useState<'single'|'batch'>('single')
  const [photos,setPhotos] = useState<UploadPhoto[]>([])
  const [context,setContext] = useState(emptyContext)
  const [drafts,setDrafts] = useState<DraftObject[]>([])
  const [batchSummary,setBatchSummary] = useState('')
  const [inscriptionReview,setInscriptionReview] = useState<any>(null)
  const [inscriptionReviewStatus,setInscriptionReviewStatus] = useState('NOT_TRIGGERED')
  const [knowledgeLookup,setKnowledgeLookup] = useState<any>({status:'NOT_ATTEMPTED',matches:[]})
  const [analysisRunId,setAnalysisRunId] = useState<string|null>(null)
  const [stage,setStage] = useState<'upload'|'analysing'|'review'|'saving'>('upload')
  const [message,setMessage] = useState('')
  const [dragActive,setDragActive] = useState(false)

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
      setMessage('Collector Intelligence is separating and examining the object evidence…')

      const response = await fetch('/api/analyse-intake',{
        method:'POST',
        headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},
        body:JSON.stringify({
          mode,
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
      setMessage('Review the draft. Nothing has been written to the permanent catalogue yet.')

      const {data:run} = await supabase.from('ai_analysis_runs').insert({
        mode,
        model: payload.model || 'unknown',
        status:'DRAFT',
        input_photo_count: uploaded.length,
        user_context: context,
        result: { ...payload.result, inscription_review: payload.inscription_review || null, inscription_review_status:payload.inscription_review_status || null, knowledge_lookup:payload.knowledge_lookup || null, canonical_policy_hashes:payload.canonical_policy_hashes || null }
      }).select('id').single()
      if (run?.id) setAnalysisRunId(run.id)
      setStage('review')
    } catch (err:any) {
      setStage('upload')
      setMessage(err?.message || 'Analysis failed')
    }
  }

  const patchDraft = (idx:number,key:keyof DraftObject,value:any) => {
    setDrafts(v=>v.map((d,i)=>i===idx?{...d,[key]:value}:d))
  }

  const approve = async () => {
    const selected = drafts.filter(d=>d.include!==false)
    if (!selected.length) return setMessage('Select at least one object.')
    setStage('saving'); setMessage('Creating permanent Collector Intelligence records…')
    const {data:{user}} = await supabase.auth.getUser()
    if (!user) { setStage('review'); return setMessage('Session expired.') }

    try {
      const created:any[] = []
      for (let draftIndex=0; draftIndex<selected.length; draftIndex++) {
        const d = selected[draftIndex]
        const values = d.preliminary_value || {currency:'GBP',quick_sale:null,balanced_low:null,balanced_high:null,floor:null,basis:''}
        const {data:item,error:itemError} = await supabase.from('items').insert({
          title:d.working_title || null,
          category:d.category || null,
          object_type:d.object_type || null,
          maker:d.maker || null,
          current_attribution:d.current_attribution || null,
          period_wording:d.period_wording || null,
          region_country:d.region_country || null,
          material:d.material || null,
          colour:d.colour || null,
          identification_confidence:d.identification_confidence,
          dating_confidence:d.dating_confidence,
          valuation_confidence:d.valuation_confidence,
          rarity_desirability:d.rarity_desirability || null,
          condition_summary:d.condition_summary || null,
          marks_signatures_labels:d.marks_signatures_labels || null,
          acquisition_price: context.purchase_price && selected.length===1 ? Number(context.purchase_price) : null,
          acquisition_currency: context.currency || 'GBP',
          storage_location: context.storage_location || null,
          status:d.specialist_review ? 'SPECIALIST_REVIEW' : d.status,
          sale_readiness:d.specialist_review ? 'SPECIALIST_REVIEW' : d.sale_readiness,
          currency:values.currency || 'GBP',
          quick_sale_value:values.quick_sale,
          balanced_value_low:values.balanced_low,
          balanced_value_high:values.balanced_high,
          floor_price:values.floor,
          catalogue_note:d.catalogue_note || null,
          notes:[
            context.user_notes ? `User intake notes: ${context.user_notes}` : '',
            values.basis ? `AI intake valuation basis: ${values.basis}` : ''
          ].filter(Boolean).join('\n') || null,
          source_analysis_run_id: analysisRunId,
          catalogue_review_status:'OWNER_REVIEWED'
        }).select().single()
        if (itemError) throw itemError

        const assigned = photos.filter(p=>d.image_indices.includes(p.index) && p.storagePath)
        for (const p of assigned) {
          const ext = p.file.name.includes('.') ? p.file.name.split('.').pop() : 'jpg'
          const dest = `${user.id}/${item.item_code}/intake-${String(p.index).padStart(2,'0')}.${ext}`
          const {error:copyError} = await supabase.storage.from('item-images').copy(p.storagePath!,dest)
          if (copyError) throw copyError
          const {error:photoError} = await supabase.from('item_photos').insert({
            item_id:item.id,
            storage_path:dest,
            file_name:p.file.name,
            caption:`AI intake image ${p.index+1}`,
            photo_role:'AI intake photo',
            position:p.index,
            is_hero:false
          })
          if (photoError) throw photoError
        }

        if (d.evidence?.length) {
          const evidenceRows = d.evidence.map(ev=>({
            item_id:item.id,
            claim:ev.claim,
            provenance:ev.provenance,
            certainty_class:ev.certainty_class,
            stance:ev.stance,
            source_reference:'AI visual intake',
            verification_status:ev.provenance==='PHOTO' && ev.certainty_class==='FACT' ? 'VERIFIED_DIRECT' : 'UNVERIFIED',
            notes:ev.notes
          }))
          const {error} = await supabase.from('item_evidence').insert(evidenceRows)
          if (error) throw error
        }

        if (d.current_attribution || d.maker) {
          const {error} = await supabase.from('attribution_history').insert({
            item_id:item.id,
            attribution_text:d.current_attribution || d.maker || d.working_title,
            maker:d.maker,
            region_country:d.region_country,
            period_wording:d.period_wording,
            confidence:d.identification_confidence,
            attribution_status:'CURRENT',
            evidence_summary:'Initial AI-assisted visual intake; preserve uncertainty and verify before strong market claims.'
          })
          if (error) throw error
        }

        if (d.next_evidence?.length) {
          const tasks = d.next_evidence.map(n=>({
            item_id:item.id,
            task_type:'EVIDENCE',
            title:n.title,
            information_value:n.information_value,
            notes:n.why
          }))
          const {error} = await supabase.from('research_tasks').insert(tasks)
          if (error) throw error
        }

        created.push(item)
      }

      // Preserve the original intake photo files for forensic / source-evidence audit.
      // Approved item photos are separate copies; deletion here would break historical manifests.
      if (analysisRunId) await supabase.from('ai_analysis_runs').update({status:'APPROVED',approved_at:new Date().toISOString()}).eq('id',analysisRunId)

      setMessage(`Created ${created.length} permanent object record${created.length===1?'':'s'}.`)
      if (created.length===1) nav(`/item/${created[0].id}`)
      else nav('/inventory')
    } catch (err:any) {
      setStage('review')
      setMessage(err?.message || 'Could not create records')
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
        <div className="reviewTop panel">
          <div><div className="eyebrow">DRAFT — NOT YET PERMANENT</div><h2>{drafts.length} object{drafts.length===1?'':'s'} detected</h2><p>{batchSummary}</p></div>
          <div className="reviewCount">{selectedCount} selected</div>
        </div>

        <div className="note">Inscription second-pass status: <strong>{inscriptionReviewStatus}</strong>. This status indicates whether a second image examination ran; it does not prove a signature reading or maker attribution.</div>
        <div className="panel">
          <strong>Knowledge Brain — existing source lookup</strong>
          <p>Retrieval status: {knowledgeLookup.status}. Matches are evidence leads, not confirmed identification. Existing records must retain source and freshness checks.</p>
          {(knowledgeLookup.matches||[]).map((k:any)=><div key={k.id} className="note">
            <strong>{k.entity_key || k.entity_type || k.knowledge_type}</strong> — {k.claim}
            <div>{k.certainty_class || 'UNCLASSIFIED'} · {k.verification_status || 'UNVERIFIED'} · {k.freshness_flag}</div>
            {k.source_url && <a href={k.source_url} target="_blank" rel="noreferrer">Source</a>}
          </div>)}
        </div>
        <div className="draftGrid">
          {drafts.map((d,idx)=><div className={d.include===false?'draftCard excluded':'draftCard'} key={idx}>
            <div className="draftHead">
              <label className="draftInclude"><input type="checkbox" checked={d.include!==false} onChange={e=>patchDraft(idx,'include',e.target.checked)}/><span>Include</span></label>
              <span className="draftNumber">OBJECT {String.fromCharCode(65+idx)}</span>
            </div>
            <div className="draftImages">{photos.filter(p=>d.image_indices.includes(p.index)).map(p=><a href={p.preview} target="_blank" rel="noreferrer" key={p.index} title={`Open original photograph ${p.index+1}`}><img src={p.preview} alt={`Original photograph ${p.index+1}`}/><small>Photo {p.index+1}</small></a>)}</div>
            <label>Working title<input value={d.working_title} onChange={e=>patchDraft(idx,'working_title',e.target.value)}/></label>
            <div className="formGrid">
              <label>Object type<input value={d.object_type} onChange={e=>patchDraft(idx,'object_type',e.target.value)}/></label>
              <label>Maker<input value={d.maker||''} onChange={e=>patchDraft(idx,'maker',e.target.value||null)}/></label>
              <label>Attribution<input value={d.current_attribution||''} onChange={e=>patchDraft(idx,'current_attribution',e.target.value||null)}/></label>
              <label>Period<input value={d.period_wording||''} onChange={e=>patchDraft(idx,'period_wording',e.target.value||null)}/></label>
            </div>
            <div className="confidenceMiniRow">
              <span>ID <strong>{d.identification_confidence}%</strong></span>
              <span>Date <strong>{d.dating_confidence}%</strong></span>
              <span>Value <strong>{d.valuation_confidence}%</strong></span>
            </div>
            <div className="draftStatusRow">
              <span className="pill">{d.sale_readiness.replaceAll('_',' ')}</span>
              {d.specialist_review && <span className="pill riskPill">PROTECT / SPECIALIST</span>}
            </div>
            {d.marks_signatures_labels && <div className="panel" style={{padding:12,marginTop:12}}>
              <strong>Marks and inscriptions — check original photo</strong>
              <p>{d.marks_signatures_labels}</p>
              {inscriptionReview?.mark_visible && d.image_indices.some((i:number)=>(inscriptionReview.evidence_image_indices||[]).includes(i)) && <div>
                <p><strong>Candidate transcription:</strong> {inscriptionReview.candidate_transcription || 'Not reliably readable'}</p>
                <p>Transcription confidence: {inscriptionReview.transcription_confidence}% · Unverified — visual examination only</p>
                <p>Original photograph numbers: {(inscriptionReview.evidence_image_indices||[]).map((i:number)=>i+1).join(', ') || 'Not identified'}</p>
                <p>{inscriptionReview.rationale}</p>
                {inscriptionReview.contradictions?.length>0 && <div><strong>Conflicting interpretations</strong>{inscriptionReview.contradictions.map((c:string,i:number)=><p key={i}>{c}</p>)}</div>}
                <p>Maker candidate: {inscriptionReview.candidate_maker || "None"} · Design candidate: {inscriptionReview.candidate_design || "None"} · Attribution confidence: {inscriptionReview.attribution_confidence}% (not signature confidence)</p>
              </div>}
            </div>}
            <label>Condition<textarea rows={3} value={d.condition_summary} onChange={e=>patchDraft(idx,'condition_summary',e.target.value)}/></label>
            <div className="draftEvidence">
              <strong>Evidence captured</strong>
              {d.evidence.map((ev,i)=><div key={i}><span>{ev.certainty_class.replaceAll('_',' ')}</span>{ev.claim}{ev.notes && <small> — {ev.notes}</small>}</div>)}
            </div>
            {d.next_evidence.length>0 && <div className="nextEvidence"><strong>Best next evidence</strong>{d.next_evidence.slice(0,3).map((n,i)=><div key={i}>{n.title} <small>{n.information_value}/100</small></div>)}</div>}
            <div className="provisionalValue">
              <span>Visual-only provisional</span>
              <strong>{d.preliminary_value.quick_sale!==null ? `${d.preliminary_value.currency} ${d.preliminary_value.quick_sale} quick-sale` : 'No defensible value yet'}</strong>
              <small>{d.preliminary_value.basis}</small>
            </div>
          </div>)}
        </div>

        {message && <div className="note">{message}</div>}
        <div className="intakeActions stickyActions">
          <button className="secondaryButton" disabled={stage==='saving'} onClick={()=>setStage('upload')}>Back to photographs</button>
          <button className="primaryButton intakeBigButton" disabled={stage==='saving' || !selectedCount} onClick={approve}>
            {stage==='saving'?<><LoaderCircle className="spin" size={17}/> Creating records…</>:<><Check size={18}/> Approve & create {selectedCount} permanent record{selectedCount===1?'':'s'}</>}
          </button>
        </div>
      </>}
    </div>
  )
}
