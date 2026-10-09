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
  const [tab,setTab] = useState('overview')
  const [message,setMessage] = useState('')
  const [uploading,setUploading] = useState(false)
  const [photoUrls,setPhotoUrls] = useState<Record<string,string>>({})
  const [researching,setResearching] = useState(false)
  const [researchDraft,setResearchDraft] = useState<any|null>(null)
  const [researchRunId,setResearchRunId] = useState<string|null>(null)

  const load = async () => {
    if (!id) return
    const [{data:itemData},{data:photoData},{data:compData}] = await Promise.all([
      supabase.from('items').select('*').eq('id',id).single(),
      supabase.from('item_photos').select('*').eq('item_id',id).order('position'),
      supabase.from('comparables').select('*').eq('item_id',id).order('sale_date',{ascending:false})
    ])
    setItem(itemData as Item); setPhotos((photoData||[]) as ItemPhoto[]); setComps((compData||[]) as Comparable[])
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
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Research failed')
      setResearchDraft(payload.result)
      const {data:run} = await supabase.from('ai_analysis_runs').insert({
        mode:'research',
        model:payload.model || 'unknown',
        status:'DRAFT',
        input_photo_count:Object.values(photoUrls).filter(Boolean).length,
        user_context:{item_id:item.id,item_code:item.item_code},
        result:payload.result
      }).select('id').single()
      if (run?.id) setResearchRunId(run.id)
      setMessage('Research draft ready. Review before writing it back.')
    } catch (err:any) {
      setMessage(err?.message || 'Research failed')
    } finally {
      setResearching(false)
    }
  }

  const approveResearch = async () => {
    if (!item || !researchDraft) return
    setResearching(true)
    setMessage('Writing verified research back to the permanent record…')
    try {
      const idu = researchDraft.identification_update || {}
      const v = researchDraft.valuation || {}
      const r = researchDraft.routing || {}
      const sources = Array.isArray(researchDraft.comparables) ? researchDraft.comparables : []
      const hasDirectVerifiedSource = sources.some((c:any) =>
        c.verification_status === 'VERIFIED_DIRECT' &&
        Boolean(c.source_url) &&
        ['HAMMER_REALIZED','REALIZED_INCL_BP','MARKETPLACE_SOLD','DEALER_SOLD_CONFIRMED'].includes(c.price_type)
      )
      // Owner approval is not equivalent to independent source verification.
      const reviewStatus = hasDirectVerifiedSource ? 'RESEARCH_VERIFIED' : 'OWNER_REVIEWED'

      const updatePayload:any = {
        maker: idu.maker ?? item.maker,
        current_attribution: idu.attribution ?? item.current_attribution,
        period_wording: idu.period_wording ?? item.period_wording,
        region_country: idu.region_country ?? item.region_country,
        identification_confidence: idu.identification_confidence ?? item.identification_confidence,
        dating_confidence: idu.dating_confidence ?? item.dating_confidence,
        valuation_confidence: v.valuation_confidence ?? item.valuation_confidence,
        currency: v.currency || item.currency || 'GBP',
        quick_sale_value: v.quick_sale_value,
        balanced_value_low: v.balanced_low,
        balanced_value_high: v.balanced_high,
        auction_value_low: v.auction_low,
        auction_value_high: v.auction_high,
        private_sale_low: v.private_low,
        private_sale_high: v.private_high,
        dealer_asking_low: v.dealer_asking_low,
        dealer_asking_high: v.dealer_asking_high,
        sale_readiness: r.sale_readiness || item.sale_readiness,
        strategy: r.strategy || null,
        best_venue: r.best_venue,
        backup_venue: r.backup_venue,
        status: r.specialist_review ? 'SPECIALIST_REVIEW' : (r.sale_readiness === 'SELL_NOW' ? 'READY_TO_SELL' : 'RESEARCH'),
        catalogue_review_status:reviewStatus,
        notes:[item.notes || '', researchDraft.research_summary ? `Research summary: ${researchDraft.research_summary}` : '', v.notes ? `Valuation notes: ${v.notes}` : ''].filter(Boolean).join('\n\n')
      }
      const {error:updateError} = await supabase.from('items').update(updatePayload).eq('id',item.id)
      if (updateError) throw updateError

      await supabase.from('attribution_history').update({
        attribution_status:'PREVIOUS',
        valid_to:new Date().toISOString()
      }).eq('item_id',item.id).eq('attribution_status','CURRENT')

      if (idu.attribution || idu.maker) {
        const {error} = await supabase.from('attribution_history').insert({
          item_id:item.id,
          attribution_text:idu.attribution || idu.maker || item.title || item.object_type || 'Unattributed object',
          maker:idu.maker,
          region_country:idu.region_country,
          period_wording:idu.period_wording,
          confidence:idu.identification_confidence,
          attribution_status:'CURRENT',
          evidence_summary:idu.rationale,
          change_reason:'Live web research review'
        })
        if (error) throw error
      }

      if (Array.isArray(researchDraft.comparables) && researchDraft.comparables.length) {
        const rows = researchDraft.comparables.map((c:any)=>({
          item_id:item.id,
          venue:c.venue,
          source_reference:c.source_reference || c.source_url || 'Research source',
          source_url:c.source_url,
          date_checked:new Date().toISOString().slice(0,10),
          sale_date:c.sale_date || null,
          price_type:c.price_type,
          price:c.price,
          currency:c.currency,
          description:c.description,
          maker_attribution:c.maker_attribution,
          dimensions:c.dimensions,
          condition_summary:c.condition_summary,
          comparability_grade:c.comparability_grade,
          verification_status:c.verification_status,
          notes:c.notes
        }))
        const {error} = await supabase.from('comparables').insert(rows)
        if (error) throw error
      }

      const {error:valError} = await supabase.from('valuation_history').insert({
        item_id:item.id,
        identification_confidence:idu.identification_confidence,
        dating_confidence:idu.dating_confidence,
        valuation_confidence:v.valuation_confidence,
        quick_sale_value:v.quick_sale_value,
        balanced_low:v.balanced_low,
        balanced_high:v.balanced_high,
        auction_low:v.auction_low,
        auction_high:v.auction_high,
        private_sale_low:v.private_low,
        private_sale_high:v.private_high,
        dealer_asking_low:v.dealer_asking_low,
        dealer_asking_high:v.dealer_asking_high,
        currency:v.currency || 'GBP',
        methodology_notes:v.notes
      })
      if (valError) throw valError

      if (Array.isArray(researchDraft.next_evidence) && researchDraft.next_evidence.length) {
        await supabase.from('research_tasks').insert(researchDraft.next_evidence.map((n:any)=>({
          item_id:item.id,
          task_type:'EVIDENCE',
          title:n.title,
          information_value:n.information_value,
          notes:n.why
        })))
      }

      if (researchRunId) await supabase.from('ai_analysis_runs').update({status:'APPROVED',approved_at:new Date().toISOString()}).eq('id',researchRunId)
      setResearchDraft(null)
      setMessage(hasDirectVerifiedSource ? 'Research written back with directly verified comparable evidence.' : 'Research written back as PROVISIONAL: no directly verified sold comparable was supplied.')
      await load()
    } catch (err:any) {
      setMessage(err?.message || 'Could not save research')
    } finally {
      setResearching(false)
    }
  }


  if (!item) return <div className="empty">Loading object record…</div>

  return (
    <div>
      <div className="itemHero">
        <div>
          <div className="eyebrow">{item.item_code}</div>
          <h1>{item.current_attribution || item.title || item.object_type || 'Unidentified object'}</h1>
          <p>{[item.maker,item.period_wording,item.region_country].filter(Boolean).join(' · ') || 'Identification in progress'}</p>
          <div className="pillRow"><span className="pill">{item.status.replaceAll('_',' ')}</span>{item.sale_readiness && <span className="pill accent">{item.sale_readiness.replaceAll('_',' ')}</span>}</div>
        </div>
        <div className="heroActions"><button className="primaryButton inlineButton" onClick={save}><Save size={17}/> Save</button></div>
      </div>
      {message && <div className="saveToast">{message}</div>}

      <div className="tabBar">
        {['overview','photos','identification','market','sales','catalogue'].map(t=><button key={t} className={tab===t?'active':''} onClick={()=>setTab(t)}>{t}</button>)}
      </div>

      {tab==='overview' && <div className="detailGrid">
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
      </div>}

      {tab==='photos' && <div className="panel">
        <div className="panelHeader"><div><h2>Photographs</h2><span>Original object evidence and listing imagery</span></div><label className="primaryButton inlineButton uploadButton"><Camera size={17}/>{uploading?'Uploading…':'Upload photos'}<input type="file" accept="image/*" multiple hidden onChange={upload}/></label></div>
        <div className="photoGrid">
          {photos.length===0 && <div className="empty">No photographs uploaded yet.</div>}
          {photos.map(p=><div className="photoTile" key={p.id}>{photoUrls[p.id] ? <img src={photoUrls[p.id]} alt={p.caption||p.file_name||item.item_code}/> : <div className="photoPending">Generating secure preview…</div>}<div><strong>{p.photo_role||'Object photo'}</strong><span>{p.file_name}</span></div></div>)}
        </div>
        <div className="note">Image previews use short-lived signed URLs from the private Supabase bucket.</div>
      </div>}

      {tab==='identification' && <div className="panel"><div className="panelHeader"><h2>Identification & evidence</h2><span>FACT / attribution / unknown should be preserved separately</span></div><div className="empty"><p>The schema is ready for object-level evidence and attribution history. AI write-back will populate this layer after the first five-item run.</p></div></div>}

      {tab==='market' && <div className="marketStack">
        <div className="panel researchLauncher">
          <div>
            <div className="eyebrow">LIVE MARKET RESEARCH</div>
            <h2>Verify attribution, sold evidence and sale route</h2>
            <p>Uses live web search. Sold/realized evidence is kept separate from estimates and asking prices.</p>
          </div>
          <button className="primaryButton inlineButton" onClick={runResearch} disabled={researching}>
            {researching ? <><LoaderCircle className="spin" size={17}/> Researching…</> : <><Search size={17}/> Run verified research</>}
          </button>
        </div>

        {researchDraft && <div className="panel researchDraftPanel">
          <div className="panelHeader"><div><h2>Research draft</h2><span>Review before permanent write-back</span></div><span className="pill accent">DRAFT</span></div>
          <div className="researchSummary">{researchDraft.research_summary}</div>
          <div className="note">Approval records this analysis and its sources; it does not independently validate them. Directly verified sold evidence requires a source URL, appropriate sold-price classification and VERIFIED_DIRECT evidence status.</div>
          <div className="researchMetricGrid">
            <div><small>Attribution</small><strong>{researchDraft.identification_update?.attribution || researchDraft.identification_update?.maker || 'Unresolved'}</strong><span>{researchDraft.identification_update?.identification_confidence}% ID confidence</span></div>
            <div><small>Balanced value</small><strong>{money(researchDraft.valuation?.balanced_low,researchDraft.valuation?.currency||'GBP')}–{money(researchDraft.valuation?.balanced_high,researchDraft.valuation?.currency||'GBP')}</strong><span>{researchDraft.valuation?.valuation_confidence}% value confidence</span></div>
            <div><small>Route</small><strong>{researchDraft.routing?.best_venue || 'Research first'}</strong><span>{researchDraft.routing?.sale_readiness?.replaceAll('_',' ')}</span></div>
          </div>
          {researchDraft.identification_update?.contradictions?.length>0 && <div className="warningCallout"><ShieldAlert size={18}/><div><strong>Contradictions / cautions</strong>{researchDraft.identification_update.contradictions.map((x:string,i:number)=><div key={i}>{x}</div>)}</div></div>}
          <div className="tableWrap researchPreviewTable"><table><thead><tr><th>Venue</th><th>Class</th><th>Price</th><th>Verification</th><th>Comparable</th></tr></thead><tbody>
            {(researchDraft.comparables||[]).map((c:any,i:number)=><tr key={i}><td>{c.venue}{c.source_url && <> <a href={c.source_url} target="_blank"><ExternalLink size={12}/></a></>}</td><td>{c.price_type.replaceAll('_',' ')}</td><td>{money(c.price,c.currency||'GBP')}</td><td>{c.verification_status.replaceAll('_',' ')}</td><td>{c.comparability_grade}</td></tr>)}
          </tbody></table></div>
          <div className="researchApprove"><button className="secondaryButton" onClick={()=>setResearchDraft(null)} disabled={researching}>Discard draft</button><button className="primaryButton inlineButton" onClick={approveResearch} disabled={researching}><Check size={17}/> Approve research & write back</button></div>
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
