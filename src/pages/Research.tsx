import { useEffect, useState } from 'react'
import { Link,useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {suggestSingleIntakePair} from '../lib/pairGrouping'
import InfoDisclosure from '../components/InfoDisclosure'

type KnowledgeRow = {
  id: string
  entity_key: string | null
  claim: string
  source_url: string | null
  verification_status: string | null
  last_verified: string | null
  created_at: string
  owner_id: string
  knowledge_type: string
  entity_type: string | null
  certainty_class: string | null
  confidence: number | null
  evidence_provenance: string | null
  source_reference: string | null
  source_date: string | null
  freshness_requirement: string
  stance: string | null
  tags: string[]
  supersedes_id: string | null
  notes: string | null
}

export default function Research() {
  const location=useLocation()
  const [museumItems,setMuseumItems] = useState<any[]>([])
  const [researchDrafts,setResearchDrafts] = useState<any[]>([])
  const [draftCovers,setDraftCovers] = useState<Record<string,string>>({})
  const [draftFeedback,setDraftFeedback] = useState<any[]>([])
  const [museumTarget,setMuseumTarget] = useState(()=>new URLSearchParams(location.search).get('item')||'')
  const [museumSaving,setMuseumSaving] = useState<string|null>(null)
  const [museumSource,setMuseumSource] = useState<'met'|'vam'|'europeana'>('met')
  const [museumQuery,setMuseumQuery] = useState('')
  const [museumResults,setMuseumResults] = useState<any[]>([])
  const [museumMessage,setMuseumMessage] = useState('')
  const [museumLoading,setMuseumLoading] = useState(false)
  const [tasks,setTasks] = useState<any[]>([])
  const [knowledge,setKnowledge] = useState<KnowledgeRow[]>([])
  const [canonicalDocs,setCanonicalDocs] = useState<any[]>([])
  const [photoSessions,setPhotoSessions] = useState<any[]>([])
  const [conversationSources,setConversationSources] = useState<any[]>([])
  const [conversationClaims,setConversationClaims] = useState<any[]>([])
  const [openDoc,setOpenDoc] = useState<any>(null)
  const [loadingDoc,setLoadingDoc] = useState(false)
  const [entityKey,setEntityKey] = useState('')
  const [claim,setClaim] = useState('')
  const [sourceUrl,setSourceUrl] = useState('')
  const [message,setMessage] = useState('')
  const [saving,setSaving] = useState(false)
  const [reviewId,setReviewId] = useState<string|null>(null)
  const [reviewNote,setReviewNote] = useState('')
  const [reviewClass,setReviewClass] = useState('SECONDARY_REPORT')
  const [reviewKind,setReviewKind] = useState('PRIMARY_DOCUMENT')
  const [trustedIds,setTrustedIds] = useState<string[]>([])
  const [checked,setChecked] = useState(false)
  const [comps,setComps] = useState<any[]>([])
  const [trustedCompIds,setTrustedCompIds] = useState<string[]>([])
  const [compReviewId,setCompReviewId] = useState<string|null>(null)
  const [compDecision,setCompDecision] = useState('NEEDS_WORK')
  const [compObserved,setCompObserved] = useState('UNKNOWN')
  const [compNote,setCompNote] = useState('')
  const [compLocator,setCompLocator] = useState('')
  const [compChecked,setCompChecked] = useState(false)
  const [sourceChecks,setSourceChecks] = useState<any[]>([])
  const [sourceCheckId,setSourceCheckId] = useState<string|null>(null)
  const [sourceCheckOutcome,setSourceCheckOutcome] = useState('UNKNOWN')
  const [sourceCheckNote,setSourceCheckNote] = useState('')
  const [snapshotText,setSnapshotText] = useState('')
  const [snapshotMedia,setSnapshotMedia] = useState('text/plain')
  const [integrityBusy,setIntegrityBusy] = useState<string|null>(null)
  const [integrityResults,setIntegrityResults] = useState<Record<string,string>>({})

  useEffect(()=>{
    const linkedObject=new URLSearchParams(location.search).get('item')
    if(linkedObject)setMuseumTarget(linkedObject)
  },[location.search])

  useEffect(()=>{
    let mounted=true
    supabase.from('items').select('id,item_code,title').order('updated_at',{ascending:false}).limit(100)
      .then(({data,error})=>{if(mounted&&!error)setMuseumItems(data||[])})
    void (async()=>{
      const [draftRows,feedbackRows]=await Promise.all([
        supabase.from('ai_analysis_runs').select('id,mode,created_at,input_photo_count,result')
          .eq('status','DRAFT').in('mode',['single','batch']).order('created_at',{ascending:false}).limit(12),
        supabase.from('ai_verdict_feedback').select('source_analysis_run_id,source_object_index,corrected_material,feedback_type,created_at')
          .eq('feedback_type','MATERIAL_CORRECTION').order('created_at',{ascending:false}).limit(100)
      ])
      if(!mounted)return
      const drafts=(draftRows.data||[]).filter((r:any)=>Array.isArray(r.result?.objects)&&r.result.objects.length)
      setResearchDrafts(drafts)
      setDraftFeedback(feedbackRows.data||[])
      const covers=await Promise.all(drafts.map(async(r:any)=>{
        const first=(r.result.image_manifest||[]).find((m:any)=>
          typeof m.storage_path==='string'&&Number.isInteger(m.index))
        if(!first)return [r.id,''] as const
        const signed=await supabase.storage.from('item-images').createSignedUrl(first.storage_path,900)
        return [r.id,signed.data?.signedUrl||''] as const
      }))
      if(mounted)setDraftCovers(Object.fromEntries(covers))
    })()
    return ()=>{mounted=false}
  },[])

  const saveMuseumLead=async (m:any) => {
    if(!museumTarget){setMuseumMessage('Select the CI object before saving.');return}
    if(!m.sourceUrl || !/^https:\/\/(collections\.vam\.ac\.uk|www\.europeana\.eu|www\.metmuseum\.org)\//.test(m.sourceUrl)){
      setMuseumMessage('Unrecognised source URL; no record saved.');return
    }
    setMuseumSaving(m.id);setMuseumMessage('')
    try{
      const {data:userResult,error:userError}=await supabase.auth.getUser()
      if(userError||!userResult.user)throw new Error('Sign in again.')
      const owner=userResult.user.id
      // Recheck object ownership; item_evidence has owner RLS as an independent backstop.
      const {data:found,error:checkError}=await supabase.from('items').select('id').eq('id',museumTarget).single()
      if(checkError||!found)throw new Error('Selected item not accessible.')
      const claim='REFERENCE ONLY: '+(m.provider||'Museum')+' catalogue entry "'+String(m.title||'Untitled').slice(0,160)+'"'+(m.maker?' (catalogued maker: '+String(m.maker).slice(0,120)+')':'')+(m.date?' (catalogued date: '+String(m.date).slice(0,80)+')':'')+'. No attribution of this CI object is asserted.'
      const record={owner_id:owner,item_id:museumTarget,claim,provenance:'RESEARCH_SOURCE',certainty_class:'POSSIBLE_ATTRIBUTION',stance:'NEUTRAL',source_reference:String(m.provider)+': '+String(m.id),source_url:m.sourceUrl,verification_status:'UNVERIFIED',notes:'Saved manually from museum search. Museum catalogue record is not authentication of the collection object. No sold-price evidence. Original source must be checked.'}
      const {error}=await supabase.from('item_evidence').insert(record)
      if(error)throw error
      setMuseumMessage('Provisional museum lead saved against the selected CI item. No maker, value or verified comparable changed.')
    }catch(err:any){setMuseumMessage(err?.message||'Museum lead was not saved.')}
    finally{setMuseumSaving(null)}
  }

  const searchMuseum = async () => {
    const q=museumQuery.trim()
    if(q.length<3) {setMuseumMessage('Enter at least three characters.');return}
    setMuseumLoading(true);setMuseumResults([]);setMuseumMessage('')
    try {
      const {data}=await supabase.auth.getSession()
      const token=data.session?.access_token
      if(!token)throw new Error('Please sign in again.')
      const endpoint=museumSource==='met'
        ?'/api/open-access-search?q='+encodeURIComponent(q)
        :'/api/museum-search?source='+museumSource+'&q='+encodeURIComponent(q)
      const response=await fetch(endpoint,{headers:{Authorization:'Bearer '+token}})
      const raw=await response.text()
      let payload:any={}
      try{payload=JSON.parse(raw)}catch{throw new Error('Museum service response unavailable. No evidence was saved; retry later or open the museum site manually.')}
      if(!response.ok)throw new Error(payload.error||'Museum lookup failed')
      setMuseumResults(payload.records||[])
      setMuseumMessage((payload.records||[]).length?'Museum references only — these do not authenticate your item or establish a sold price.':'No catalogue records returned. Try a maker, technique or object type.')
    } catch(err:any){setMuseumMessage(err?.message||'Museum service unavailable')}
    finally{setMuseumLoading(false)}
  }

  const load = async () => {
    const [t,k,c,p,cs,cc,trusted,allComps,approvedComps,sourceResult] = await Promise.all([
      supabase.from('research_tasks').select('*,items(item_code,title,current_attribution)').order('information_value',{ascending:false}),
      supabase.from('knowledge_records').select('*').order('created_at',{ascending:false}).limit(50),
      supabase.from('canonical_documents').select('id,document_key,source_class,authority_rank,content_sha256,ingested_at').order('ingested_at',{ascending:false}).limit(100),
      supabase.from('intake_photo_sessions').select('session_key,photo_count,linked_analysis_run,link_method,first_uploaded_at').order('first_uploaded_at',{ascending:false}).limit(50),
      supabase.from('conversation_sources').select('id,source_title,source_format,source_sha256,extraction_status,captured_at').order('captured_at',{ascending:false}).limit(50),
      supabase.from('conversation_claims').select('id,source_id,source_locator,subject_key,claim_text,claim_type,certainty,created_at').order('created_at',{ascending:false}).limit(150),
      supabase.from('trusted_knowledge_v1').select('id').limit(500),
      supabase.from('comparables').select('id,owner_id,item_id,venue,source_reference,source_url,lot_item_id,sale_date,price_type,price,currency,description,verification_status').order('created_at',{ascending:false}).limit(100),
      supabase.from('trusted_comparables_v1').select('id').limit(500),
      supabase.from('comparable_source_checks').select('id,comparable_id,source_url,checked_at,fetch_status,observed_result,verification_decision,archive_reference,notes').order('checked_at',{ascending:false}).limit(100)
    ])
    setSourceChecks(sourceResult.data||[])
    if(sourceResult.error) setMessage('Source-check ledger unavailable: '+sourceResult.error.message)
    setComps(allComps.data||[])
    setTrustedCompIds((approvedComps.data||[]).map((x:any)=>x.id))
    if (allComps.error || approvedComps.error) setMessage('Comparable review records unavailable: '+(allComps.error?.message||approvedComps.error?.message))
    setTasks(t.data||[])
    setTrustedIds((trusted.data||[]).map((x:any)=>x.id))
    if (trusted.error) setMessage('Trusted-only knowledge view unavailable: '+trusted.error.message)
    setKnowledge((k.data||[]) as KnowledgeRow[])
    setCanonicalDocs(c.data||[])
    setPhotoSessions(p.data||[])
    setConversationSources(cs.data||[])
    setConversationClaims(cc.data||[])
    if (cs.error || cc.error) setMessage('Historical learning ledger could not be read: '+(cs.error?.message||cc.error?.message))
    if (c.error) setMessage('Canonical source archive unavailable: '+c.error.message)
    if (k.error) setMessage('Knowledge Brain could not be read: '+k.error.message)
  }
  useEffect(()=>{void load()},[])

  const addLead = async () => {
    const key = entityKey.trim()
    const statement = claim.trim()
    if (!key || !statement || !sourceUrl.trim()) return setMessage('Enter a named maker/design, exact evidence claim and source URL.')
    let parsed: URL
    try { parsed = new URL(sourceUrl.trim()) } catch { return setMessage('Enter a valid source URL.') }
    if (!['https:','http:'].includes(parsed.protocol)) return setMessage('Use an HTTP(S) source URL.')
    const {data:{user}} = await supabase.auth.getUser()
    if (!user) return setMessage('Sign in again before saving.')
    setSaving(true)
    setMessage('')
    const {error} = await supabase.from('knowledge_records').insert({
      owner_id:user.id,
      knowledge_type:'REFERENCE_LEAD',
      entity_type:'maker_or_design',
      entity_key:key,
      claim:statement,
      certainty_class:'POSSIBLE_ATTRIBUTION',
      confidence:null,
      evidence_provenance:'USER_SOURCE_LEAD',
      source_reference:parsed.hostname,
      source_url:parsed.toString(),
      source_date:null,
      last_verified:null,
      freshness_requirement:'SLOW_CHANGING',
      verification_status:'UNVERIFIED',
      stance:'NEUTRAL',
      tags:[key.toLowerCase()],
      notes:'User-entered documentary lead. Preserve exact claim; validate source independently before promoting to verified knowledge.'
    })
    setSaving(false)
    if (error) return setMessage('Could not save: '+error.message)
    setEntityKey('');setClaim('');setSourceUrl('')
    setMessage('Source lead saved as UNVERIFIED. This does not confirm an attribution.')
    await load()
  }

  const viewCanonical = async (id:string) => {
    setLoadingDoc(true)
    const {data,error} = await supabase.from('canonical_documents').select('document_key,content,content_sha256,source_path,ingested_at').eq('id',id).single()
    setLoadingDoc(false)
    if (error) { setMessage('Cannot read canonical document: '+error.message);return }
    setOpenDoc(data)
  }
  const latestCanonical = canonicalDocs.filter((d:any,i:number,a:any[]) => a.findIndex(x=>x.document_key===d.document_key)===i)

  const current = knowledge.filter(k=>!knowledge.some(newer=>newer.supersedes_id===k.id))
  const selected = knowledge.find(k=>k.id===reviewId)
  const saveReview = async () => {
    if (!selected || saving) return
    if (!checked || reviewNote.trim().length<30) return setMessage('Inspect the source and enter at least 30 characters describing the evidence.')
    const {data:{user}} = await supabase.auth.getUser()
    if (!user || user.id!==selected.owner_id) return setMessage('Owner verification failed.')
    if (knowledge.some(k=>k.supersedes_id===selected.id)) return setMessage('That version was already superseded.')
    setSaving(true)
    const direct = reviewClass === 'VERIFIED_DIRECT'
    if (direct && !selected.source_url && !selected.source_reference) {
      setSaving(false)
      return setMessage('Direct verification requires an original source URL or specific document/lot reference.')
    }
    // First preserve a non-trusted historical revision; promotion is a separate gated step.
    const {data:revision,error} = await supabase.from('knowledge_records').insert({
      owner_id:user.id, knowledge_type:selected.knowledge_type, entity_type:selected.entity_type,
      entity_key:selected.entity_key, claim:selected.claim, certainty_class:selected.certainty_class,
      confidence:selected.confidence, evidence_provenance:'OWNER_DOCUMENT_REVIEW',
      source_reference:selected.source_reference, source_url:selected.source_url,
      source_date:selected.source_date, last_verified:direct ? null : new Date().toISOString().slice(0,10),
      freshness_requirement:selected.freshness_requirement,
      verification_status:direct ? 'UNVERIFIED' : reviewClass, stance:selected.stance, tags:selected.tags||[],
      supersedes_id:selected.id, notes:'Previous record: '+selected.id+'; Documentary review: '+reviewNote.trim()
    }).select('id').single()
    if (error || !revision) {setSaving(false);return setMessage('Could not preserve revision: '+(error?.message||'No revision ID returned'))}
    if (direct) {
      const {error:reviewError} = await supabase.from('evidence_reviews').insert({
        owner_id:user.id, reviewer_id:user.id, knowledge_record_id:revision.id,
        decision:'APPROVED', evidence_kind:reviewKind,
        original_source_url:selected.source_url, original_source_reference:selected.source_reference,
        verification_method:reviewNote.trim(),
        notes:'Owner attestation; external source must be independently checked before relying on the maker or sale claim.'
      })
      if (reviewError) {setSaving(false);return setMessage('Revision preserved as UNVERIFIED; approval failed: '+reviewError.message)}
      const {error:promotionError} = await supabase.from('knowledge_records')
        .update({verification_status:'VERIFIED_DIRECT',last_verified:new Date().toISOString().slice(0,10)})
        .eq('id',revision.id).eq('owner_id',user.id)
      if (promotionError) {setSaving(false);return setMessage('Revision retained as UNVERIFIED; promotion blocked: '+promotionError.message)}
    }
    setSaving(false)
    setReviewId(null);setReviewNote('');setChecked(false)
    setMessage(direct ? 'Reviewed new revision and passed the database evidence gate. This is owner-attested source review, not independent authentication of the physical object.' : 'Source review saved as a new revision. Original preserved.')
    await load()
  }

  const inspectSnapshotIntegrity = async (sourceCheckId:string) => {
    setIntegrityBusy(sourceCheckId)
    try {
      const {data:{session}}=await supabase.auth.getSession()
      if(!session?.access_token) throw new Error('Sign in required')
      const response=await fetch('/api/check-snapshot-integrity',{
        method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},
        body:JSON.stringify({source_check_id:sourceCheckId})
      })
      const body=await response.json()
      const label=response.ok?(body.integrity_verified?'ARCHIVE HASH MATCH':'ARCHIVE HASH MISMATCH'):(body.error||body.status||'Integrity check failed')
      setIntegrityResults(prev=>({...prev,[sourceCheckId]:label}))
    } catch (error) {
      setIntegrityResults(prev=>({...prev,[sourceCheckId]:error instanceof Error?error.message:'Integrity check failed'}))
    } finally {setIntegrityBusy(null)}
  }

  const stageSnapshotFromText = async () => {
    const comparable=comps.find(c=>c.id===sourceCheckId)
    if(!comparable||saving)return
    const bytes=new TextEncoder().encode(snapshotText)
    if(bytes.length<20||bytes.length>262144){setMessage('Paste 20 bytes to 256 KiB of original-page text or HTML.');return}
    const {data:{session}}=await supabase.auth.getSession()
    if(!session?.access_token){setMessage('Sign in to store evidence.');return}
    let binary=''
    for(const byte of bytes)binary+=String.fromCharCode(byte)
    setSaving(true)
    try{
      const response=await fetch('/api/stage-source-snapshot',{method:'POST',
        headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},
        body:JSON.stringify({comparable_id:comparable.id,snapshot_base64:btoa(binary),media_type:snapshotMedia})})
      const payload=await response.json()
      if(!response.ok)throw new Error(payload.error||'Snapshot staging failed')
      setSnapshotText('')
      await load()
      setMessage('Provisional snapshot staged and ledger linked. Hash read-back succeeded; original source NOT independently authenticated.')
    }catch(error){setMessage(error instanceof Error?error.message:'Source staging failed')}
    finally{setSaving(false)}
  }

  const stageManualSourceCheck = async () => {
    const c=comps.find(x=>x.id===sourceCheckId)
    if(!c||saving) return
    if(!c.source_url || !/^https:\/\//i.test(c.source_url)) return setMessage('A recorded HTTPS original-source URL is required before staging a source check.')
    if(sourceCheckNote.trim().length<20) return setMessage('Provide at least 20 characters describing what is or is not visible on the source.')
    const {data:{user}}=await supabase.auth.getUser()
    if(!user || user.id!==c.owner_id) return setMessage('Only this comparable’s owner may stage a source check.')
    setSaving(true)
    const {error}=await supabase.from('comparable_source_checks').insert({
      owner_id:user.id,comparable_id:c.id,source_url:c.source_url,
      original_lot_reference:c.source_reference||null,
      fetch_status:'MANUAL_ONLY',verification_method:'OWNER_MANUAL',
      verification_decision:'REVIEW_REQUIRED',observed_result:sourceCheckOutcome,
      notes:sourceCheckNote.trim()
    })
    setSaving(false)
    if(error) return setMessage('Source check was not saved: '+error.message)
    setSourceCheckId(null);setSourceCheckNote('');setSourceCheckOutcome('UNKNOWN')
    await load()
    setMessage('Manual source observation staged as REVIEW_REQUIRED — NOT independently verified or valuation trusted.')
  }

  const selectedComp = comps.find(c=>c.id===compReviewId)
  const saveComparableReview = async () => {
    if (!selectedComp || saving) return
    if (!compChecked || compNote.trim().length < 30 || !compLocator.trim())
      return setMessage('Inspect the original result and provide a lot URL/reference and at least 30 characters of verification detail.')
    const {data:{user}}=await supabase.auth.getUser()
    if (!user || user.id!==selectedComp.owner_id) return setMessage('Only the owner may review this comparable.')
    const approved=compDecision==='APPROVED'
    const enteredLocator=compLocator.trim()
    const sameOriginalReference=Boolean(selectedComp.source_reference && enteredLocator===selectedComp.source_reference.trim())
    const sameOriginalUrl=Boolean(selectedComp.source_url && enteredLocator===selectedComp.source_url.trim())
    if (approved && !sameOriginalReference && !sameOriginalUrl)
      return setMessage('The approved lot URL/reference must exactly match the comparable source record. Correct the source record before reviewing a different lot.')
    if (approved && !['HAMMER','INCLUSIVE_REALIZED','CONFIRMED_MARKETPLACE_SOLD'].includes(compObserved))
      return setMessage('UNSOLD, ASKING, ESTIMATE or UNKNOWN cannot be approved as a realised sale.')
    if (approved && (selectedComp.price==null || Number(selectedComp.price)<0 || !selectedComp.currency || !selectedComp.source_reference)) return setMessage('The sale needs a valid recorded amount, currency and original lot reference before approval.')
    const expected:any={HAMMER_REALIZED:'HAMMER',REALIZED_INCL_BP:'INCLUSIVE_REALIZED',MARKETPLACE_SOLD:'CONFIRMED_MARKETPLACE_SOLD',DEALER_SOLD_CONFIRMED:'CONFIRMED_MARKETPLACE_SOLD'}
    if (approved && expected[selectedComp.price_type]!==compObserved)
      return setMessage('The observed result type must match the recorded price basis before approval.')
    setSaving(true)
    const {error}=await supabase.from('comparable_evidence_reviews').insert({
      owner_id:user.id,comparable_id:selectedComp.id,reviewer_id:user.id,
      decision:compDecision,result_observed:compObserved,
      original_lot_url:/^https?:\/\//i.test(compLocator.trim())?compLocator.trim():null,
      original_lot_reference:/^https?:\/\//i.test(compLocator.trim())?null:compLocator.trim(),
      sale_date_checked:new Date().toISOString().slice(0,10),
      evidence_explanation:compNote.trim(),
      reviewed_price:approved?selectedComp.price:null,
      reviewed_currency:approved?selectedComp.currency:null,
      reviewed_price_type:approved?selectedComp.price_type:null
    })
    if (error) {setSaving(false);return setMessage('Comparable review failed: '+error.message)}
    // Owner-attested approval uses the database trigger for final evidence gating.
    // A rejected/uncertain review is preserved without changing the original comparable.
    if (approved) {
      const {error:promotionError}=await supabase.from('comparables')
        .update({verification_status:'VERIFIED_DIRECT'})
        .eq('id',selectedComp.id).eq('owner_id',user.id)
      if (promotionError) {
        setSaving(false)
        setMessage('Review saved, but trusted promotion was BLOCKED: '+promotionError.message)
        await load()
        return
      }
    }
    setSaving(false);setCompReviewId(null);setCompChecked(false);setCompNote('');setCompLocator('')
    setMessage(approved?'Owner review saved and database promotion accepted. This does NOT independently authenticate the auction result.':'Review preserved without promoting the comparable to verified.')
    await load()
  }

  return <div>
    <div className="pageHeader"><div><div className="eyebrow">RESEARCH</div><h1 style={{fontSize:'clamp(26px,3vw,38px)'}}>Research your objects</h1><InfoDisclosure label="About research"><p>Saved reports and individual objects retain their own source evidence, corrections and provisional valuations.</p></InfoDisclosure></div></div>
    {researchDrafts.length>0&&<section className="ci-research-recent">
      <div className="panelHeader"><h2>Continue researching saved uploads</h2><span>{researchDrafts.length} recent unapproved reports</span></div>
      
      <div className="cardGrid ci-object-grid ci-view-tiles">
       {researchDrafts.slice(0,6).map((draft:any)=>{
        const objects=draft.result?.objects||[]
        const pair=suggestSingleIntakePair(objects,draft.mode)
        const correction=draftFeedback.find((x:any)=>x.source_analysis_run_id===draft.id&&x.source_object_index==null)
        const material=correction?.corrected_material||null
        const rawTitle=pair?.title||objects[0]?.working_title||'Unidentified object'
        const title=material?rawTitle.replace(/\bglass\b/gi,String(material).toLowerCase()):rawTitle
        return <Link key={draft.id} to={'/draft/'+draft.id+'?tab=market'} className="itemCard ci-record-card">
         <div className="itemCardImage placeholderGlass">
          {draftCovers[draft.id]?<img src={draftCovers[draft.id]} alt={title}/>:<span className="ci-missing-photo">Saved source photos</span>}
         </div>
         <div className="itemCardBody">
          <div className="itemMeta"><span>{pair?'Matched pair · 2 pieces':'Draft report'}</span><span>Not catalogued</span></div>
          <h3 className="ci-record-title">{title}</h3>
          <p className="ci-record-stage">{material?'Owner corrected: '+material:'Attribution provisional'} · {draft.input_photo_count} source photographs</p>
          <span className="primaryButton ci-card-action">Open Market / Deep Dive →</span>
         </div>
        </Link>
       })}
      </div>
    </section>}
    <div className="panel" style={{padding:16}}>
      <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
        <select aria-label="Choose an object" value={museumTarget} onChange={e=>setMuseumTarget(e.target.value)} style={{flex:'1 1 240px',minWidth:0}}>
          <option value="">Select a CI object</option>
          {museumItems.map((i:any)=><option key={i.id} value={i.id}>{i.item_code} — {i.title||'Untitled'}</option>)}
        </select>
        {museumTarget?<Link to={'/item/'+museumTarget} className="primaryButton">Open object →</Link>:<span style={{fontSize:12,color:'var(--muted)'}}>Select an object to see its findings</span>}
      </div>
    </div>
    <details className="panel">
      <summary style={{cursor:'pointer',fontWeight:700,padding:'8px 0'}}>Museum references — open-access or external</summary>
      <p>Search The Met's public-domain CC0 illustrations. V&A commercial API access is paused pending licensing; use its public collection site manually. Museum objects are reference leads, not authentication or achieved prices.</p>
      <p className="ci-page-meta"><a href="https://collections.vam.ac.uk/" target="_blank" rel="noopener noreferrer">Open V&A catalogue manually ↗</a> (licence permission required for in-app API/image use).</p>
      <div className="toolbar">
        <select aria-label="Museum source" value={museumSource} onChange={e=>{setMuseumSource(e.target.value as 'met'|'vam'|'europeana');setMuseumResults([]);setMuseumMessage('')}}><option value="met">The Met — Open Access CC0</option><option value="vam">V&A — licence required</option><option value="europeana">Europeana — API key required</option></select>
        <input aria-label="Search museum objects" value={museumQuery} onChange={e=>setMuseumQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')searchMuseum()}} placeholder="Maker, material, object type…" style={{flex:1,minWidth:100}} />
        <button className="secondaryButton" disabled={museumLoading} onClick={searchMuseum}>{museumLoading?'Searching…':'Search museum'}</button>
      </div>
      {museumResults.length>0 && <label style={{display:'block',marginBottom:12}}>Save references against item <select value={museumTarget} onChange={e=>setMuseumTarget(e.target.value)}><option value="">Choose an item — required</option>{museumItems.map((i:any)=><option key={i.id} value={i.id}>{i.item_code} — {i.title||'Untitled'}</option>)}</select></label>}
      {museumMessage && <p className="note">{museumMessage}</p>}
      {museumResults.length>0 && <div className="tableWrap"><table><thead><tr><th>Museum object</th><th>Type / maker</th><th>Date</th><th>Original record</th><th>Save lead</th></tr></thead><tbody>
      {museumResults.map((m:any)=><tr key={m.id}>
        <td>{m.title}</td><td>{m.objectType}{m.maker?' · '+m.maker:''}</td><td>{m.date||'Unknown'}</td>
        <td><a href={m.sourceUrl} target="_blank" rel="noopener noreferrer">{m.provider==='Europeana'?'Europeana record ↗':'V&A catalogue ↗'}</a></td>
        <td><button className="secondaryButton" disabled={!museumTarget||!!museumSaving} onClick={()=>void saveMuseumLead(m)}>
          {museumSaving===m.id?'Saving…':'Save provisional lead'}</button></td>
       </tr>)}
      </tbody></table></div>}
    </details>
    <details className="panel"><summary style={{cursor:"pointer",fontWeight:700}}>Research tasks ({tasks.length})</summary><div style={{marginTop:14}} className="panelHeader"><h2>Research tasks</h2><span>Highest-information evidence first</span></div>
      {tasks.length===0?<div className="empty">No open research tasks recorded.</div>:
      <div className="tableWrap"><table><thead><tr><th>Item</th><th>Task</th><th>Type</th><th>Information value</th><th>Status</th></tr></thead><tbody>{tasks.map(t=><tr key={t.id}><td>{t.items?.item_code}</td><td>{t.title}</td><td>{t.task_type||'—'}</td><td>{t.information_value??'—'}</td><td>{t.status}</td></tr>)}</tbody></table></div>}
    </details>
    <details className="panel"><summary style={{cursor:"pointer",fontWeight:700}}>Manual source entry — advanced</summary><div className="panelHeader" style={{marginTop:14}}><h2>Add a source-backed research lead</h2><span>Always saved as UNVERIFIED initially</span></div>
      <div className="formGrid">
        <label>Named maker, pattern or design<input value={entityKey} onChange={e=>setEntityKey(e.target.value)} placeholder="e.g. Fionia"/></label>
        <label>Original source URL<input value={sourceUrl} onChange={e=>setSourceUrl(e.target.value)} placeholder="https://..."/></label>
      </div>
      <label>Exact claim from source (not a guess)<textarea rows={3} value={claim} onChange={e=>setClaim(e.target.value)}/></label>
      <div className="intakeActions"><button className="primaryButton inlineButton" disabled={saving} onClick={addLead}>{saving?'Saving…':'Save provisional reference'}</button></div>
      {message && <div className="note">{message}</div>}
    </details>
    <details className="panel">
      <summary style={{cursor:'pointer',fontWeight:700,padding:'8px 0'}}>Knowledge Brain records — details</summary>
      <div>
      <div className="panelHeader"><h2>Latest Knowledge Brain records</h2><span>{current.length} current · {knowledge.length} versions</span></div>
      {knowledge.length===0?<div className="empty">No knowledge records yet. Save the first documented lead above.</div>:
      <div className="tableWrap"><table><thead><tr><th>Entity</th><th>Claim</th><th>Verification</th><th>Source</th><th>Review</th></tr></thead><tbody>{current.map(k=><tr key={k.id}><td>{k.entity_key||'—'}</td><td><div style={{maxWidth:370,maxHeight:90,overflow:"auto"}}>{k.claim}</div></td><td>{trustedIds.includes(k.id)?'TRUST-GATED · '+k.verification_status:'NOT TRUST-GATED · '+(k.verification_status||'UNVERIFIED')}<div>Last verified: {k.last_verified||'Not yet'}</div></td><td>{k.source_url?<a href={k.source_url} target="_blank" rel="noreferrer">Open source</a>:'—'}</td><td><button className="secondaryButton" onClick={()=>{setReviewId(k.id);setChecked(false);setReviewNote('')}}>Review</button></td></tr>)}</tbody></table></div>}
    </div>
    </details>

    <details className="panel"><summary style={{cursor:"pointer",fontWeight:700}}>Advanced · Source verification ({sourceChecks.length})</summary>
      <div className="panelHeader" style={{marginTop:16}}><h2>Original-source check ledger</h2><span>{sourceChecks.length} latest checks</span></div>
      <p>Manual observations are always REVIEW_REQUIRED and cannot independently certify a sale. Independent fetch, archived snapshot and verifier review are still unavailable.</p>
      {sourceChecks.length===0?<div className="empty">No source-check records. Nothing has been independently confirmed.</div>:
      <div className="tableWrap"><table><thead><tr><th>Checked</th><th>Source</th><th>Outcome</th><th>Verification</th><th>Archive integrity</th></tr></thead><tbody>
      {sourceChecks.map(sc=><tr key={sc.id}><td>{sc.checked_at?.slice(0,10)}</td><td><a href={sc.source_url} target="_blank" rel="noreferrer">Original page</a></td><td>{sc.observed_result}</td><td>{sc.verification_decision}</td><td>{sc.archive_reference?<><button className="secondaryButton" disabled={integrityBusy===sc.id} onClick={()=>void inspectSnapshotIntegrity(sc.id)}>Check saved bytes</button><div>{integrityResults[sc.id]||'Not checked'}</div></>:'No saved snapshot'}</td></tr>)}
      </tbody></table></div>}
      <label>Stage manual observation for a comparable
        <select value={sourceCheckId||''} onChange={e=>{setSourceCheckId(e.target.value||null);setSourceCheckNote('');setSourceCheckOutcome('UNKNOWN')}}><option value="">Select comparable with original URL</option>{comps.filter(c=>c.source_url).map(c=><option key={c.id} value={c.id}>{c.venue||'Unknown venue'} — {c.source_reference}</option>)}</select>
      </label>
      {sourceCheckId&&<div className="note">
        <label>Visible result classification<select value={sourceCheckOutcome} onChange={e=>setSourceCheckOutcome(e.target.value)}>
        {['UNKNOWN','HAMMER','INCLUSIVE_REALIZED','MARKETPLACE_SOLD','UNSOLD','ASKING','ESTIMATE','AMBIGUOUS'].map(x=><option key={x} value={x}>{x}</option>)}
        </select></label>
        <label>Observation and limitations<textarea rows={3} value={sourceCheckNote} onChange={e=>setSourceCheckNote(e.target.value)} placeholder="Only record what the original page directly shows; do not claim an independent fetch."/></label>
        <button className="primaryButton inlineButton" disabled={saving||sourceCheckNote.trim().length<20} onClick={stageManualSourceCheck}>Stage unverified source observation</button>
        <p>Optional: preserve pasted original-page text/HTML as a <strong>user-supplied, unverified</strong> snapshot. Pasting content does not independently prove auction provenance.</p>
        <label>Snapshot format<select value={snapshotMedia} onChange={e=>setSnapshotMedia(e.target.value)}><option value="text/plain">Plain text</option><option value="text/html">HTML source</option></select></label>
        <label>Source contents<textarea rows={5} value={snapshotText} onChange={e=>setSnapshotText(e.target.value)} placeholder="Paste actual page text or HTML. Maximum 256 KiB UTF-8."/></label>
        <button className="secondaryButton" disabled={saving||snapshotText.length<20} onClick={()=>void stageSnapshotFromText()}>Archive provisional snapshot</button>
      </div>}
    </details>
    <details className="panel"><summary style={{cursor:"pointer",fontWeight:700}}>Advanced · Comparable reviews ({comps.length})</summary>
      <div className="panelHeader" style={{marginTop:16}}><h2>Comparable sale evidence reviews</h2><span>{trustedCompIds.length} trusted in current view · {comps.length} recent records</span></div>
      <p>Review the original auction result, not an AI summary. A review does not independently authenticate the result or promote the original comparable status.</p>
      {comps.length===0?<div className="empty">No comparable records yet. AI-reported sales remain provisional until an original result is recorded.</div>:
      <div className="tableWrap"><table><thead><tr><th>Source</th><th>Price basis</th><th>Amount</th><th>Trust gate</th><th>Review</th></tr></thead><tbody>
        {comps.map(c=><tr key={c.id}>
          <td>{c.source_url?<a href={c.source_url} target="_blank" rel="noreferrer">{c.venue||'Original listing'}</a>:(c.venue||'—')}<div>{c.source_reference||c.lot_item_id||'No reference'}</div></td>
          <td>{c.price_type||'UNKNOWN'}</td><td>{c.currency||''} {c.price??'—'}</td>
          <td>{trustedCompIds.includes(c.id)?'REVIEWED AND TRUSTED':'NOT TRUSTED'}</td>
          <td><button className="secondaryButton" onClick={()=>{setCompReviewId(c.id);setCompDecision('NEEDS_WORK');setCompObserved('UNKNOWN');setCompLocator(c.source_url||c.source_reference||'');setCompNote('');setCompChecked(false)}}>Examine result</button></td>
        </tr>)}
      </tbody></table></div>}
      {selectedComp && <div className="note">
        <strong>Original sale verification: {selectedComp.venue||'Unnamed source'}</strong>
        <p>{selectedComp.description} · {selectedComp.price_type} · {selectedComp.currency} {selectedComp.price}</p>
        {selectedComp.source_url && <p><a href={selectedComp.source_url} target="_blank" rel="noreferrer">Open claimed original result</a></p>}
        <label>Result actually shown by original source<select value={compObserved} onChange={e=>setCompObserved(e.target.value)}>
          <option value="UNKNOWN">UNKNOWN — not established</option><option value="HAMMER">HAMMER — sold at hammer</option>
          <option value="INCLUSIVE_REALIZED">INCLUSIVE_REALIZED — including buyer premium</option>
          <option value="CONFIRMED_MARKETPLACE_SOLD">CONFIRMED_MARKETPLACE_SOLD</option>
          <option value="UNSOLD">UNSOLD</option><option value="ESTIMATE">ESTIMATE</option><option value="ASKING">ASKING</option>
        </select></label>
        <label>Review outcome<select value={compDecision} onChange={e=>setCompDecision(e.target.value)}>
          <option value="NEEDS_WORK">NEEDS_WORK</option><option value="REJECTED">REJECTED</option><option value="APPROVED">APPROVED — evidenced realised transaction only</option>
        </select></label>
        <label>Original URL or exact auction/lot reference<input value={compLocator} onChange={e=>setCompLocator(e.target.value)}/></label>
        <label>Observed price, date, currency, source wording, premium basis and limitations<textarea rows={4} value={compNote} onChange={e=>setCompNote(e.target.value)}/></label>
        <label><input type="checkbox" checked={compChecked} onChange={e=>setCompChecked(e.target.checked)}/> I personally inspected the original result; this is not based solely on AI or search snippets.</label>
        <div className="intakeActions"><button className="secondaryButton" onClick={()=>setCompReviewId(null)}>Cancel</button>
          <button className="primaryButton inlineButton" disabled={saving||!compChecked||compNote.trim().length<30||!compLocator.trim()} onClick={saveComparableReview}>Record evidence review</button></div>
      </div>}
    </details>
    <details className="panel">
      <summary style={{cursor:'pointer',fontWeight:700,padding:'8px 0'}}>Project governance & source archive — details</summary>
      <div>
      <div className="panelHeader"><h2>Canonical project archive</h2><span>{latestCanonical.length} documents · exact stored versions</span></div>
      <p>These are the controlling instructions, research rules, skills and project logs stored in the Collector Intelligence Supabase database. They are read-only and content-hashed.</p>
      {canonicalDocs.length===0 ? <div className="empty">Canonical documents not available — do not rely on AI results until this is resolved.</div> :
        <div className="tableWrap"><table><thead><tr><th>Document</th><th>Authority class</th><th>Stored SHA-256</th><th>Read</th></tr></thead><tbody>
        {latestCanonical.map((d:any)=><tr key={d.id}><td>{d.document_key}</td><td>{d.source_class}</td><td><code>{String(d.content_sha256).slice(0,16)}…</code></td><td><button className="secondaryButton" disabled={loadingDoc} onClick={()=>viewCanonical(d.id)}>Read</button></td></tr>)}
        </tbody></table></div>}
      {openDoc && <div className="note">
        <div><strong>{openDoc.document_key}</strong> · SHA-256 {openDoc.content_sha256}</div>
        <button className="secondaryButton" onClick={()=>setOpenDoc(null)}>Close document</button>
        <pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',maxHeight:440,overflow:'auto'}}>{openDoc.content}</pre>
      </div>}
    </div>
    </details>

    <details className="panel">
      <summary style={{cursor:'pointer',fontWeight:700,padding:'8px 0'}}>Historical research archive — details</summary>
      <div>
      <div className="panelHeader"><h2>Historical research learning ledger</h2><span>{conversationSources.length} archived conversations · {conversationClaims.length} extracted records</span></div>
      <p>Archived research remains traceable to its original page or conversation. Historical AI attributions and price estimates are not automatically independently verified.</p>
      {conversationSources.length===0 ? <div className="empty">No historical conversation source registered yet.</div> :
        <div className="tableWrap"><table><thead><tr><th>Archived source</th><th>Ingestion</th><th>SHA-256</th></tr></thead><tbody>
        {conversationSources.map((x:any)=><tr key={x.id}><td>{x.source_title}</td><td>{x.extraction_status}</td><td><code>{x.source_sha256.slice(0,16)}…</code></td></tr>)}
        </tbody></table></div>}
      {conversationClaims.length>0 && <div className="tableWrap"><table><thead><tr><th>Object/topic</th><th>Historical claim</th><th>Evidence status</th><th>Source location</th></tr></thead><tbody>
      {conversationClaims.map((x:any)=><tr key={x.id}><td>{x.subject_key}</td><td><div style={{maxWidth:380,maxHeight:85,overflow:"auto"}}>{x.claim_text}</div></td><td>{x.claim_type} · {x.certainty}</td><td>{x.source_locator}</td></tr>)}
      </tbody></table></div>}
    </div>
    </details>

    <details className="panel">
      <summary style={{cursor:'pointer',fontWeight:700,padding:'8px 0'}}>Earlier photo uploads — details</summary>
      <div>
      <div className="panelHeader"><h2>Preserved photo intake history</h2><span>{photoSessions.length} upload sessions</span></div>
      <p>Historic photos remain in private storage. A linked analysis is based on matching the upload time and photo count; an unmatched session is not assigned to a guessed draft.</p>
      {photoSessions.length>0 && <div className="tableWrap"><table><thead><tr><th>Uploaded</th><th>Photos</th><th>Evidence link</th></tr></thead><tbody>
      {photoSessions.map((p:any)=><tr key={p.session_key}><td>{new Date(p.first_uploaded_at).toLocaleString()}</td><td>{p.photo_count}</td><td>{p.linked_analysis_run ? 'Analysis linked by '+p.link_method : 'UNMATCHED — preserved'}</td></tr>)}
      </tbody></table></div>}
    </div>
    </details>

    {selected && <div className="panel">
      <div className="panelHeader"><h2>Check original source</h2><span>Creates a new version without modifying history</span></div>
      <p><strong>{selected.entity_key}</strong>: {selected.claim}</p>
      <p>{selected.source_url && <a href={selected.source_url} target="_blank" rel="noreferrer">Open original source</a>}</p>
      <label>Evidence class<select value={reviewClass} onChange={e=>setReviewClass(e.target.value)}>
        <option value="SECONDARY_REPORT">SECONDARY_REPORT — indirectly supported</option>
        <option value="VERIFIED_DIRECT">VERIFIED_DIRECT — directly checked</option>
        <option value="UNVERIFIED">UNVERIFIED — unresolved</option>
      </select></label>
      {reviewClass==='VERIFIED_DIRECT' && <label>Original evidence type<select value={reviewKind} onChange={e=>setReviewKind(e.target.value)}><option value="PRIMARY_DOCUMENT">Primary factory/catalogue document</option><option value="ORIGINAL_SALE_RESULT">Original sale result</option><option value="PHYSICAL_OBJECT">Physical object evidence</option><option value="RECOGNISED_SPECIALIST">Recognised specialist</option><option value="OTHER">Other independently traceable source</option></select></label>}
      <label>Documentary basis, exact detail and limitations<textarea rows={4} value={reviewNote} onChange={e=>setReviewNote(e.target.value)} /></label>
      <label><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)}/> I checked the cited source personally and recorded the limitations.</label>
      <div className="intakeActions">
        <button className="secondaryButton" onClick={()=>setReviewId(null)}>Cancel</button>
        <button className="primaryButton inlineButton" disabled={saving || !checked || reviewNote.trim().length<30} onClick={saveReview}>Save new revision</button>
      </div>
      {message && <div className="note">{message}</div>}
    </div>}
  </div>
}
