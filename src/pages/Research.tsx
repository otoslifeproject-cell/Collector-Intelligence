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
    const [t,k] = await Promise.all([
      supabase.from('research_tasks').select('*,items(item_code,title,current_attribution)').order('information_value',{ascending:false}),
      supabase.from('knowledge_records').select('*').order('created_at',{ascending:false}).limit(50)
    ])
    setTasks(t.data||[])
    setKnowledge((k.data||[]) as KnowledgeRow[])
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
      <div className="panelHeader"><h2>Latest Knowledge Brain records</h2><span>{knowledge.length} shown · owner-scoped</span></div>
      {knowledge.length===0?<div className="empty">No knowledge records yet. Save the first documented lead above.</div>:
      <div className="tableWrap"><table><thead><tr><th>Entity</th><th>Claim</th><th>Verification</th><th>Source</th></tr></thead><tbody>{knowledge.map(k=><tr key={k.id}><td>{k.entity_key||'—'}</td><td>{k.claim}</td><td>{k.verification_status||'UNVERIFIED'}<div>Last verified: {k.last_verified||'Not yet'}</div></td><td>{k.source_url?<a href={k.source_url} target="_blank" rel="noreferrer">Open source</a>:'—'}</td></tr>)}</tbody></table></div>}
    </div>
  </div>
}
