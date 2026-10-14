import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Boxes, CircleDollarSign, ListChecks, ShieldAlert } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Item } from '../types'
import ItemCard from '../components/ItemCard'
import StatCard from '../components/StatCard'
import { money } from '../lib/format'

export default function Dashboard() {
  const [items,setItems] = useState<Item[]>([])
  const [loading,setLoading] = useState(true)
  const [coverUrls,setCoverUrls] = useState<Record<string,string>>({})

  useEffect(() => {
    supabase.from('items').select('*').order('updated_at',{ascending:false}).limit(50)
      .then(async ({data}) => {
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
        setCoverUrls(Object.fromEntries(signed))
      })
  },[])

  const ready = items.filter(i=>i.sale_readiness === 'SELL_NOW' || i.status === 'READY_TO_SELL').length
  const review = items.filter(i=>i.status === 'SPECIALIST_REVIEW').length
  const quick = useMemo(()=>items.reduce((s,i)=>s + Number(i.quick_sale_value || 0),0),[items])

  return (
    <div>
      <div className="pageHeader">
        <div><div className="eyebrow">OVERVIEW</div><h1 style={{fontSize:"clamp(28px,3vw,40px)"}}>Your collection</h1></div><div className="heroActions"><Link className="primaryButton" to="/intake">+ Analyse photos</Link><Link className="secondaryButton" to="/inventory">All objects</Link></div>
      </div>
      <details style={{marginTop:12}}><summary style={{cursor:"pointer",color:"var(--muted)",fontWeight:700}}>Collection totals · {items.length} objects</summary><div className="statsGrid" style={{marginTop:12}}>
        <StatCard label="Objects catalogued" value={items.length} sub="Permanent CI records" icon={<Boxes/>}/>
        <StatCard label="Ready to sell" value={ready} sub="Can move to listing" icon={<ListChecks/>}/>
        <StatCard label="Quick-sale value" value={money(quick)} sub="Current visible inventory" icon={<CircleDollarSign/>}/>
        <StatCard label="Specialist review" value={review} sub="Protected from underselling" icon={<ShieldAlert/>}/>
      </div></details>

      <section className="section" style={{marginTop:20}}>
        <div className="sectionHeader"><div><h2>Continue with an object</h2></div></div>
        {loading ? <div className="empty">Loading…</div> :
          items.length === 0 ? <div className="empty"><h3>No items yet</h3><p>Your first five glass pieces can become CI-000001 onward.</p></div> :
          <div className="cardGrid">{items.slice(0,6).map(i=><ItemCard item={i} imageUrl={coverUrls[i.id]} key={i.id}/>)}</div>}
      </section>
    </div>
  )
}
