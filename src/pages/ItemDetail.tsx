import { ChangeEvent, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Camera, ExternalLink, Save, ShieldAlert } from 'lucide-react'
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

      {tab==='market' && <div className="panel">
        <div className="panelHeader"><h2>Comparable evidence</h2><span>{comps.length} records</span></div>
        {comps.length===0 ? <div className="empty">No comparable sales recorded yet.</div> :
        <div className="tableWrap"><table><thead><tr><th>Venue</th><th>Date</th><th>Evidence class</th><th>Description</th><th>Price</th><th>Verification</th></tr></thead><tbody>{comps.map(c=><tr key={c.id}><td>{c.venue}</td><td>{date(c.sale_date)}</td><td>{c.price_type.replaceAll('_',' ')}</td><td>{c.description}</td><td>{money(c.price,c.currency||'GBP')}</td><td>{c.verification_status.replaceAll('_',' ')} {c.source_url && <a href={c.source_url} target="_blank"><ExternalLink size={13}/></a>}</td></tr>)}</tbody></table></div>}
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
