import { ChangeEvent, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Camera, Check, ExternalLink, LoaderCircle, Save, Search, ShieldAlert, Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Comparable, Item, ItemPhoto } from '../types'
import { date, money } from '../lib/format'
import Confidence from '../components/Confidence'

export default function ItemDetail() {
  const {id} = useParams()
  const [item,setItem] = useState<Item|null>(null)
  const [photos,setPhotos] = useState<ItemPhoto[]>([])
  const [comps,setComps] = useState<Comparable[]>([])
  const [evidenceRecords,setEvidenceRecords] = useState<any[]>([])
  const [attributionVersions,setAttributionVersions] = useState<any[]>([])
  const [tab,setTab] = useState('overview')
  const [message,setMessage] = useState('')
  const [uploading,setUploading] = useState(false)
  const [photoUrls,setPhotoUrls] = useState<Record<string,string>>({})
  const [researching,setResearching] = useState(false)
  const [researchDraft,setResearchDraft] = useState<any|null>(null)
  const [researchRunId,setResearchRunId] = useState<string|null>(null)
  const [researchAudit,setResearchAudit] = useState<any>(null)
  const [savedResearchRuns,setSavedResearchRuns] = useState<any[]>([])
  const [pendingResearchRuns,setPendingResearchRuns] = useState<any[]>([])

  const load = async () => {
    if (!id) return
    const [{data:itemData},{data:photoData},{data:compData}] = await Promise.all([
      supabase.from('items').select('*').eq('id',id).single(),
      supabase.from('item_photos').select('*').eq('item_id',id).order('position'),
      supabase.from('comparables').select('*').eq('item_id',id).order('sale_date',{ascending:false})
    ])
    setItem(itemData as Item); setPhotos((photoData||[]) as ItemPhoto[]); setComps((compData||[]) as Comparable[])
    const [ev,ah] = await Promise.all([
      supabase.from('item_evidence').select('*').eq('item_id',id).order('created_at',{ascending:false}),
      supabase.from('attribution_history').select('*').eq('item_id',id).order('created_at',{ascending:false})
    ])
    setEvidenceRecords(ev.data||[])
    setAttributionVersions(ah.data||[])
    const {data:runs}=await supabase.from('ai_analysis_runs').select('id,result,created_at,status,user_context').eq('mode','research').in('status',['APPROVED','DRAFT']).order('created_at',{ascending:false}).limit(100)
    const itemRuns=(runs||[]).filter((x:any)=>x.user_context?.item_id===id)
    setSavedResearchRuns(itemRuns.filter((x:any)=>x.status==='APPROVED'))
    setPendingResearchRuns(itemRuns.filter((x:any)=>x.status==='DRAFT'))
    const rows = (photoData || []) as ItemPhoto[]
    if (rows.length) {
      const signed = await Promise.all(rows.map(async p => {
        const {data} = await supabase.storage.from('item-images').createSignedUrl(p.storage_path, 3600)
        return [p.id, data?.signedUrl || ''] as const
      }))
      setPhotoUrls(Object.fromEntries(signed))
    } else {
      setPhotoUrls({})
    }
  }
  useEffect(()=>{load()},[id])

  const update = (k:keyof Item,v:any)=> item && setItem({...item,[k]:v})
  const save = async () => {
    if (!item) return
    const copy:any = {...item}; delete copy.id; delete copy.item_code; delete copy.created_at; delete copy.updated_at
    const {error} = await supabase.from('items').update(copy).eq('id',item.id)
    setMessage(error ? error.message : 'Saved')
    if (!error) setTimeout(()=>setMessage(''),1600)
  }

  const upload = async (e:ChangeEvent<HTMLInputElement>) => {
    if (!item || !e.target.files?.length) return
    setUploading(true)
    const {data:{user}} = await supabase.auth.getUser()
    if (!user) return
    for (const file of Array.from(e.target.files)) {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g,'_')
      const path = `${user.id}/${item.item_code}/${Date.now()}-${safe}`
      const {error} = await supabase.storage.from('item-images').upload(path,file)
      if (!error) await supabase.from('item_photos').insert({item_id:item.id,storage_path:path,file_name:file.name,position:photos.length})
    }
    setUploading(false); await load()
  }


  const runResearch = async () => {
    if (!item) return
    setResearching(true)
    setMessage('Researching live market evidence…')
    const {data:{session}} = await supabase.auth.getSession()
    if (!session) { setResearching(false); return setMessage('Session expired. Sign in again.') }
    try {
      const response = await fetch('/api/research-item',{
        method:'POST',
        headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},
        body:JSON.stringify({item,images:Object.values(photoUrls).filter(Boolean).slice(0,12)})
      })
      const rawResponse = await response.text()
      let payload:any
      try { payload=JSON.parse(rawResponse) }
      catch { throw new Error('Research service returned an unexpected response (HTTP '+response.status+'). Please retry after deployment; no research was saved.') }
      if (!response.ok) throw new Error(payload.error || ('Research request failed (HTTP '+response.status+')'))
      setResearchDraft(payload.result)
      setResearchAudit(payload.source_audit || null)
      const {data:run} = await supabase.from('ai_analysis_runs').insert({
        mode:'research',
        model:payload.model || 'unknown',
        status:'DRAFT',
        input_photo_count:Object.values(photoUrls).filter(Boolean).length,
        user_context:{item_id:item.id,item_code:item.item_code},
        result:{...payload.result, source_audit:payload.source_audit||null,canonical_policy_hashes:payload.canonical_policy_hashes||null}
      }).select('id').single()
      if (run?.id) setResearchRunId(run.id)
      setMessage('Research draft ready. Review before writing it back.')
    } catch (err:any) {
      setMessage(err?.message || 'Research failed')
    } finally {
      setResearching(false)
    }
  }

  // Preserve provisional analysis atomically in its existing research-run record.
  // Do not mutate item, attribution history, valuation history or comparable trust status.
  const approveResearch = async () => {
    if (!item || !researchDraft || !researchRunId) {
      setMessage('Research draft could not be linked to a saved analysis run. Keep this draft open.')
      return
    }
    setResearching(true)
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
    } finally {setResearching(false)}
  }

  if (!item) return <div className="empty">Loading object record…</div>

  return (
    <div>
      <div className="itemHero">
        <div>
          <div className="eyebrow">{item.item_code}</div>
          <h1 style={{fontSize:'clamp(1.65rem,2.6vw,2.55rem)',lineHeight:1.12,maxWidth:'26ch'}}>{(item.current_attribution || item.title || item.object_type || 'Unidentified object').length>76 ? (item.object_type || item.title || 'Unidentified object').slice(0,76) : (item.current_attribution || item.title || item.object_type || 'Unidentified object')}</h1>
          <p>{[item.maker,item.period_wording,item.region_country].filter(Boolean).join(' · ') || 'Identification in progress'}</p>
          <div className="pillRow"><span className="pill accent">{(item.sale_readiness || item.status).replaceAll('_',' ')}</span></div>
        </div>
        <div className="heroActions">
          <button className="primaryButton inlineButton" onClick={()=>setTab('market')}><Search size={17}/> Research & value</button>
          <button className="secondaryButton" onClick={()=>setTab('sales')}>Sell / route</button>
        </div>
      </div>
      {message && <div className="saveToast">{message}</div>}

      <div className="tabBar">
        {['overview','photos','identification','market','sales','catalogue'].map(t=><button key={t} className={tab===t?'active':''} onClick={()=>setTab(t)}>{t}</button>)}
      </div>

      {tab==='overview' && <div>
        <div className="panel">
          <div className="panelHeader"><h2>At a glance</h2><span>{item.item_code}</span></div>
          <div className="valueSummary">
            <div><small>Identity</small><strong>{item.maker || 'Maker unknown'}</strong></div>
            <div><small>Confidence</small><strong>{item.identification_confidence ?? '—'}% ID</strong></div>
            <div><small>Fast cash · provisional</small><strong>{money(item.quick_sale_value,item.currency||'GBP')}</strong></div>
            <div><small>Next action</small><strong>{(item.sale_readiness||'RESEARCH_FIRST').replaceAll('_',' ')}</strong></div>
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
          <div className="panelHeader"><h2>Values</h2><span>{item.currency || 'GBP'}</span></div>
          <div className="valueGrid">
            <label>Quick sale<input type="number" value={item.quick_sale_value??''} onChange={e=>update('quick_sale_value',e.target.value?Number(e.target.value):null)}/></label>
            <label>Balanced low<input type="number" value={item.balanced_value_low??''} onChange={e=>update('balanced_value_low',e.target.value?Number(e.target.value):null)}/></label>
            <label>Balanced high<input type="number" value={item.balanced_value_high??''} onChange={e=>update('balanced_value_high',e.target.value?Number(e.target.value):null)}/></label>
            <label>Floor<input type="number" value={item.floor_price??''} onChange={e=>update('floor_price',e.target.value?Number(e.target.value):null)}/></label>
            <label>Expected net<input type="number" value={item.expected_net??''} onChange={e=>update('expected_net',e.target.value?Number(e.target.value):null)}/></label>
          </div>
        </div>
          </div>
          <div style={{marginTop:12}}><button className="primaryButton inlineButton" onClick={save}><Save size={17}/> Save changes</button></div>
        </details>
      </div>}

      {tab==='photos' && <div className="panel">
        <div className="panelHeader"><div><h2>Photographs</h2><span>Original object evidence and listing imagery</span></div><label className="primaryButton inlineButton uploadButton"><Camera size={17}/>{uploading?'Uploading…':'Upload photos'}<input type="file" accept="image/*" multiple hidden onChange={upload}/></label></div>
        <div className="photoGrid">
          {photos.length===0 && <div className="empty">No photographs uploaded yet.</div>}
          {photos.map(p=><div className="photoTile" key={p.id}>{photoUrls[p.id] ? <img src={photoUrls[p.id]} alt={p.caption||p.file_name||item.item_code}/> : <div className="photoPending">Generating secure preview…</div>}<div><strong>{p.photo_role||'Object photo'}</strong><span>{p.file_name}</span></div></div>)}
        </div>
        <div className="note">Image previews use short-lived signed URLs from the private Supabase bucket.</div>
      </div>}

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

      {tab==='market' && <div className="marketStack">
        {pendingResearchRuns.length>0 && <div className="panel">
          <div className="panelHeader"><h2>Recovered research drafts</h2><span>{pendingResearchRuns.length} saved drafts</span></div>
          {pendingResearchRuns.map((run:any)=><div className="note" key={run.id}>
            <strong>{new Date(run.created_at).toLocaleString()} — provisional, not yet preserved</strong>
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
                <div className="panel researchLauncher">
          <div>
            <div className="eyebrow">LIVE MARKET RESEARCH</div>
            <h2>Need more research?</h2>
            <p>Optional paid AI search. Existing findings are saved above.</p>
          </div>
          <button className="primaryButton inlineButton" onClick={runResearch} disabled={researching}>
            {researching ? <><LoaderCircle className="spin" size={17}/> Researching…</> : <><Search size={17}/> Run new research</>}
          </button>
        </div>

        {researchDraft && <div className="panel researchDraftPanel">
          <div className="panelHeader"><div><h2>Research decision</h2><span>Provisional · source verification pending</span></div><span className="pill accent">DRAFT</span></div>


          <div className="note">Preserving this draft retains its provisional research record only. It will NOT change the item's maker, valuation or comparables. Independent original-source checks are required before promotion.</div>
          <div className="researchMetricGrid">
            <div><small>Attribution</small><strong>{researchDraft.identification_update?.attribution || researchDraft.identification_update?.maker || 'Unresolved'}</strong><span>{researchDraft.identification_update?.identification_confidence}% ID confidence</span></div>
            <div><small>Balanced value</small><strong>{money(researchDraft.valuation?.balanced_low,researchDraft.valuation?.currency||'GBP')}–{money(researchDraft.valuation?.balanced_high,researchDraft.valuation?.currency||'GBP')}</strong><span>{researchDraft.valuation?.valuation_confidence}% value confidence</span></div>
            <div><small>Route</small><strong>{researchDraft.routing?.best_venue || 'Research first'}</strong><span>{researchDraft.routing?.sale_readiness?.replaceAll('_',' ')}</span></div>
          </div>
          <details className="note"><summary style={{cursor:"pointer",fontWeight:700}}>Supporting evidence, cautions and comparable leads</summary>
          <p>{researchDraft.research_summary}</p>
          {researchAudit && <p><strong>Evidence status:</strong> {researchAudit.warning}</p>}
          {researchDraft.identification_update?.contradictions?.length>0 && <div className="warningCallout"><ShieldAlert size={18}/><div><strong>Contradictions / cautions</strong>{researchDraft.identification_update.contradictions.map((x:string,i:number)=><div key={i}>{x}</div>)}</div></div>}
          <div className="tableWrap researchPreviewTable"><table><thead><tr><th>Venue</th><th>Class</th><th>Price</th><th>Verification</th><th>Comparable</th></tr></thead><tbody>
            {(researchDraft.comparables||[]).map((c:any,i:number)=><tr key={i}><td>{c.venue}{c.source_url && <> <a href={c.source_url} target="_blank"><ExternalLink size={12}/></a></>}</td><td>{c.price_type.replaceAll('_',' ')}</td><td>{money(c.price,c.currency||'GBP')}</td><td>{c.verification_status.replaceAll('_',' ')}</td><td>{c.comparability_grade}</td></tr>)}
          </tbody></table></div>
          </details>
          <div className="researchApprove"><button className="secondaryButton" onClick={()=>setResearchDraft(null)} disabled={researching}>Discard draft</button><button className="primaryButton inlineButton" onClick={approveResearch} disabled={researching}><Check size={17}/> Preserve provisional research</button></div>
        </div>}

        <div className="panel">
          <div className="panelHeader"><h2>Comparable evidence</h2><span>{comps.length} permanent records</span></div>
          {comps.length===0 ? <div className="empty">No permanent comparable sales recorded yet.</div> :
          <div className="tableWrap"><table><thead><tr><th>Venue</th><th>Date</th><th>Evidence class</th><th>Description</th><th>Price</th><th>Verification</th></tr></thead><tbody>{comps.map(c=><tr key={c.id}><td>{c.venue}</td><td>{date(c.sale_date)}</td><td>{c.price_type.replaceAll('_',' ')}</td><td>{c.description}</td><td>{money(c.price,c.currency||'GBP')}</td><td>{c.verification_status.replaceAll('_',' ')} {c.source_url && <a href={c.source_url} target="_blank"><ExternalLink size={13}/></a>}</td></tr>)}</tbody></table></div>}
        </div>
      </div>}

      {tab==='sales' && <div className="panel"><div className="panelHeader"><h2>Sales record</h2><span>Listings and actual outcomes</span></div><div className="valueSummary"><div><small>Acquisition</small><strong>{money(item.acquisition_price,item.acquisition_currency||'GBP')}</strong></div><div><small>Fast cash</small><strong>{money(item.quick_sale_value,item.currency||'GBP')}</strong></div><div><small>Expected net</small><strong>{money(item.expected_net,item.currency||'GBP')}</strong></div></div><div className="empty"><p>Platform listings and final sale outcomes are stored separately so asking price is never confused with achieved value.</p></div></div>}

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
    </div>
  )
}
