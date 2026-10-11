import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

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
      supabase.from('comparable_source_checks').select('id,comparable_id,source_url,checked_at,fetch_status,observed_result,verification_decision,notes').order('checked_at',{ascending:false}).limit(100)
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
    <div className="pageHeader"><div className="eyebrow">RESEARCH QUEUE & KNOWLEDGE BRAIN</div><h1>Evidence before attribution</h1><p>Preserve source-backed discoveries without treating an unverified lead as fact.</p></div>
    <div className="panel">
      <div className="panelHeader"><h2>Research tasks</h2><span>Highest-information evidence first</span></div>
      {tasks.length===0?<div className="empty">No open research tasks recorded.</div>:
      <div className="tableWrap"><table><thead><tr><th>Item</th><th>Task</th><th>Type</th><th>Information value</th><th>Status</th></tr></thead><tbody>{tasks.map(t=><tr key={t.id}><td>{t.items?.item_code}</td><td>{t.title}</td><td>{t.task_type||'—'}</td><td>{t.information_value??'—'}</td><td>{t.status}</td></tr>)}</tbody></table></div>}
    </div>
    <div className="panel">
      <div className="panelHeader"><h2>Add a source-backed research lead</h2><span>Always saved as UNVERIFIED initially</span></div>
      <div className="formGrid">
        <label>Named maker, pattern or design<input value={entityKey} onChange={e=>setEntityKey(e.target.value)} placeholder="e.g. Fionia"/></label>
        <label>Original source URL<input value={sourceUrl} onChange={e=>setSourceUrl(e.target.value)} placeholder="https://..."/></label>
      </div>
      <label>Exact claim from source (not a guess)<textarea rows={3} value={claim} onChange={e=>setClaim(e.target.value)}/></label>
      <div className="intakeActions"><button className="primaryButton inlineButton" disabled={saving} onClick={addLead}>{saving?'Saving…':'Save provisional reference'}</button></div>
      {message && <div className="note">{message}</div>}
    </div>
    <div className="panel">
      <div className="panelHeader"><h2>Latest Knowledge Brain records</h2><span>{current.length} current · {knowledge.length} versions</span></div>
      {knowledge.length===0?<div className="empty">No knowledge records yet. Save the first documented lead above.</div>:
      <div className="tableWrap"><table><thead><tr><th>Entity</th><th>Claim</th><th>Verification</th><th>Source</th><th>Review</th></tr></thead><tbody>{current.map(k=><tr key={k.id}><td>{k.entity_key||'—'}</td><td>{k.claim}</td><td>{trustedIds.includes(k.id)?'TRUST-GATED · '+k.verification_status:'NOT TRUST-GATED · '+(k.verification_status||'UNVERIFIED')}<div>Last verified: {k.last_verified||'Not yet'}</div></td><td>{k.source_url?<a href={k.source_url} target="_blank" rel="noreferrer">Open source</a>:'—'}</td><td><button className="secondaryButton" onClick={()=>{setReviewId(k.id);setChecked(false);setReviewNote('')}}>Review</button></td></tr>)}</tbody></table></div>}
    </div>
    <div className="panel">
      <div className="panelHeader"><h2>Original-source check ledger</h2><span>{sourceChecks.length} latest checks</span></div>
      <p>Manual observations are always REVIEW_REQUIRED and cannot independently certify a sale. Independent fetch, archived snapshot and verifier review are still unavailable.</p>
      {sourceChecks.length===0?<div className="empty">No source-check records. Nothing has been independently confirmed.</div>:
      <div className="tableWrap"><table><thead><tr><th>Checked</th><th>Source</th><th>Outcome</th><th>Verification</th></tr></thead><tbody>
      {sourceChecks.map(sc=><tr key={sc.id}><td>{sc.checked_at?.slice(0,10)}</td><td><a href={sc.source_url} target="_blank" rel="noreferrer">Original page</a></td><td>{sc.observed_result}</td><td>{sc.verification_decision}</td></tr>)}
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
      </div>}
    </div>
    <div className="panel">
      <div className="panelHeader"><h2>Comparable sale evidence reviews</h2><span>{trustedCompIds.length} trusted in current view · {comps.length} recent records</span></div>
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
    </div>
    <div className="panel">
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
    <div className="panel">
      <div className="panelHeader"><h2>Historical research learning ledger</h2><span>{conversationSources.length} archived conversations · {conversationClaims.length} extracted records</span></div>
      <p>Archived research remains traceable to its original page or conversation. Historical AI attributions and price estimates are not automatically independently verified.</p>
      {conversationSources.length===0 ? <div className="empty">No historical conversation source registered yet.</div> :
        <div className="tableWrap"><table><thead><tr><th>Archived source</th><th>Ingestion</th><th>SHA-256</th></tr></thead><tbody>
        {conversationSources.map((x:any)=><tr key={x.id}><td>{x.source_title}</td><td>{x.extraction_status}</td><td><code>{x.source_sha256.slice(0,16)}…</code></td></tr>)}
        </tbody></table></div>}
      {conversationClaims.length>0 && <div className="tableWrap"><table><thead><tr><th>Object/topic</th><th>Historical claim</th><th>Evidence status</th><th>Source location</th></tr></thead><tbody>
      {conversationClaims.map((x:any)=><tr key={x.id}><td>{x.subject_key}</td><td>{x.claim_text}</td><td>{x.claim_type} · {x.certainty}</td><td>{x.source_locator}</td></tr>)}
      </tbody></table></div>}
    </div>
    <div className="panel">
      <div className="panelHeader"><h2>Preserved photo intake history</h2><span>{photoSessions.length} upload sessions</span></div>
      <p>Historic photos remain in private storage. A linked analysis is based on matching the upload time and photo count; an unmatched session is not assigned to a guessed draft.</p>
      {photoSessions.length>0 && <div className="tableWrap"><table><thead><tr><th>Uploaded</th><th>Photos</th><th>Evidence link</th></tr></thead><tbody>
      {photoSessions.map((p:any)=><tr key={p.session_key}><td>{new Date(p.first_uploaded_at).toLocaleString()}</td><td>{p.photo_count}</td><td>{p.linked_analysis_run ? 'Analysis linked by '+p.link_method : 'UNMATCHED — preserved'}</td></tr>)}
      </tbody></table></div>}
    </div>
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
