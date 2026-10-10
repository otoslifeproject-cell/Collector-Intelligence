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
  const [checked,setChecked] = useState(false)

  const load = async () => {
    const [t,k,c,p,cs,cc] = await Promise.all([
      supabase.from('research_tasks').select('*,items(item_code,title,current_attribution)').order('information_value',{ascending:false}),
      supabase.from('knowledge_records').select('*').order('created_at',{ascending:false}).limit(50),
      supabase.from('canonical_documents').select('id,document_key,source_class,authority_rank,content_sha256,ingested_at').order('ingested_at',{ascending:false}).limit(100),
      supabase.from('intake_photo_sessions').select('session_key,photo_count,linked_analysis_run,link_method,first_uploaded_at').order('first_uploaded_at',{ascending:false}).limit(50),
      supabase.from('conversation_sources').select('id,source_title,source_format,source_sha256,extraction_status,captured_at').order('captured_at',{ascending:false}).limit(50),
      supabase.from('conversation_claims').select('id,source_id,source_locator,subject_key,claim_text,claim_type,certainty,created_at').order('created_at',{ascending:false}).limit(150)
    ])
    setTasks(t.data||[])
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
    const {error} = await supabase.from('knowledge_records').insert({
      owner_id:user.id, knowledge_type:selected.knowledge_type, entity_type:selected.entity_type,
      entity_key:selected.entity_key, claim:selected.claim, certainty_class:selected.certainty_class,
      confidence:selected.confidence, evidence_provenance:'OWNER_DOCUMENT_REVIEW',
      source_reference:selected.source_reference, source_url:selected.source_url,
      source_date:selected.source_date, last_verified:new Date().toISOString().slice(0,10),
      freshness_requirement:selected.freshness_requirement,
      verification_status:reviewClass, stance:selected.stance, tags:selected.tags||[],
      supersedes_id:selected.id, notes:'Previous record: '+selected.id+'; Documentary review: '+reviewNote.trim()
    })
    setSaving(false)
    if (error) return setMessage(error.message)
    setReviewId(null);setReviewNote('');setChecked(false)
    setMessage('Source review saved as a new revision. Original preserved.')
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
      <div className="tableWrap"><table><thead><tr><th>Entity</th><th>Claim</th><th>Verification</th><th>Source</th><th>Review</th></tr></thead><tbody>{current.map(k=><tr key={k.id}><td>{k.entity_key||'—'}</td><td>{k.claim}</td><td>{k.verification_status||'UNVERIFIED'}<div>Last verified: {k.last_verified||'Not yet'}</div></td><td>{k.source_url?<a href={k.source_url} target="_blank" rel="noreferrer">Open source</a>:'—'}</td><td><button className="secondaryButton" onClick={()=>{setReviewId(k.id);setChecked(false);setReviewNote('')}}>Review</button></td></tr>)}</tbody></table></div>}
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
