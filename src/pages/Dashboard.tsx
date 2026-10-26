import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Boxes, CircleDollarSign, ListChecks, ShieldAlert } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Item } from '../types'
import ItemCard from '../components/ItemCard'
import StatCard from '../components/StatCard'
import {provisionalCurrencyTotals} from '../lib/catalogueSaleState'

export default function Dashboard() {
  const [items,setItems] = useState<Item[]>([])
  const [loading,setLoading] = useState(true)
  const [error,setError]=useState(''),[reload,setReload]=useState(0)
  const [coverUrls,setCoverUrls] = useState<Record<string,string>>({})

  useEffect(() => {
    let active=true;setLoading(true);setError('')
    supabase.from('items').select('*').order('updated_at',{ascending:false}).limit(50)
      .then(async ({data,error}) => {
        if(!active)return
        if(error||!data){setItems([]);setLoading(false);setError('Collection unavailable. Reload the collection to recover saved objects.');return}
        const rows=(data||[]) as Item[]
        setItems(rows); setLoading(false)
        const ids=rows.slice(0,6).map(x=>x.id)
        if(!ids.length)return
        const {data:photos}=await supabase.from('item_photos').select('item_id,storage_path,is_hero,position').in('item_id',ids).order('position',{ascending:true})
        const selected=new Map<string,string>()
        for(const p of (photos||[]).sort((a:any,b:any)=>Number(b.is_hero)-Number(a.is_hero)))if(!selected.has(p.item_id))selected.set(p.item_id,p.storage_path)
        const signed=await Promise.all(Array.from(selected.entries()).map(async ([itemId,path])=>{
          const {data:url}=await supabase.storage.from('item-images').createSignedUrl(path,3600)
          return [itemId,url?.signedUrl||''] as const
        }))
        if(active)setCoverUrls(Object.fromEntries(signed))
      })
    return()=>{active=false}
  },[reload])

  const decisions = items.filter(i=>!['SOLD','ARCHIVED'].includes(i.status)).length
  const review = items.filter(i=>i.status === 'SPECIALIST_REVIEW').length
  const quick = useMemo(()=>provisionalCurrencyTotals(items),[items])

  return (
    <div>
      <div className="pageHeader">
        <div><div className="eyebrow">OVERVIEW</div><h1 style={{fontSize:"clamp(28px,3vw,40px)"}}>Your collection</h1></div><div className="heroActions"><Link className="primaryButton ci-action-primary" to="/intake">+ Analyse photos</Link><Link className="secondaryButton" to="/inventory">All objects</Link></div>
      </div>
      {!loading && !error && items.length > 0 && <section className="panel" aria-label="Next action" style={{marginTop:12}}>
        <div className="eyebrow">YOUR NEXT STEP</div>
        <h2 style={{margin:'0.35rem 0'}}>Continue your last object</h2>
        <p>{items[0].item_code} · {items[0].title || items[0].object_type || 'Unidentified object'}</p>
        <Link className="primaryButton inlineButton" to={`/item/${items[0].id}`}>Continue object</Link>
        <p className="ci-page-meta">Pick up where you left off. Research and sale approval still require evidence.</p>
      </section>}
      <details style={{marginTop:12}}><summary style={{cursor:"pointer",color:"var(--muted)",fontWeight:700}}>Collection totals · {items.length} objects</summary><div className="statsGrid" style={{marginTop:12}}>
        <StatCard label="Objects catalogued" value={items.length} sub="Permanent CI records" icon={<Boxes/>}/>
        <StatCard label="Final decisions required" value={decisions} sub="Research and evidenced assessment before listing" icon={<ListChecks/>}/>
        <StatCard label="Provisional quick-sale indications" value={quick.text} sub={`Loaded records, up to50; no currency conversion. ${quick.unknown} values unknown.`} icon={<CircleDollarSign/>}/>
        <StatCard label="Specialist review" value={review} sub="Protected from underselling" icon={<ShieldAlert/>}/>
      </div></details>

      <section className="section" style={{marginTop:20}}>
        <div className="sectionHeader"><div><h2>Continue with an object</h2></div><Link to="/uploads">Resume saved photo sessions</Link></div>
        {error?<div role="alert">{error}<button className="secondaryButton inlineButton" onClick={()=>setReload(n=>n+1)}>Reload collection</button></div>:loading ? <div className="empty">Loading…</div> :
          items.length === 0 ? <div className="empty"><h3>No items yet</h3><p>Your first five glass pieces can become CI-000001 onward.</p></div> :
          <div className="cardGrid">{items.slice(0,6).map(i=><ItemCard item={i} imageUrl={coverUrls[i.id]} key={i.id}/>)}</div>}
      </section>
    </div>
  )
}
