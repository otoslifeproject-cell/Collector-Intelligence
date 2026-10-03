import { useEffect, useMemo, useState } from 'react'
import { Boxes, CircleDollarSign, ListChecks, ShieldAlert } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Item } from '../types'
import ItemCard from '../components/ItemCard'
import StatCard from '../components/StatCard'
import { money } from '../lib/format'

export default function Dashboard() {
  const [items,setItems] = useState<Item[]>([])
  const [loading,setLoading] = useState(true)

  useEffect(() => {
    supabase.from('items').select('*').order('updated_at',{ascending:false}).limit(50)
      .then(({data}) => { setItems((data || []) as Item[]); setLoading(false) })
  },[])

  const ready = items.filter(i=>i.sale_readiness === 'SELL_NOW' || i.status === 'READY_TO_SELL').length
  const review = items.filter(i=>i.status === 'SPECIALIST_REVIEW').length
  const quick = useMemo(()=>items.reduce((s,i)=>s + Number(i.quick_sale_value || 0),0),[items])

  return (
    <div>
      <div className="pageHeader">
        <div><div className="eyebrow">OVERVIEW</div><h1>Your collection at a glance.</h1><p>Research, value, catalogue and move stock from one place.</p></div>
      </div>
      <div className="statsGrid">
        <StatCard label="Objects catalogued" value={items.length} sub="Permanent CI records" icon={<Boxes/>}/>
        <StatCard label="Ready to sell" value={ready} sub="Can move to listing" icon={<ListChecks/>}/>
        <StatCard label="Quick-sale value" value={money(quick)} sub="Current visible inventory" icon={<CircleDollarSign/>}/>
        <StatCard label="Specialist review" value={review} sub="Protected from underselling" icon={<ShieldAlert/>}/>
      </div>

      <section className="section">
        <div className="sectionHeader"><div><h2>Recently worked</h2><p>Latest catalogue and research activity.</p></div></div>
        {loading ? <div className="empty">Loading…</div> :
          items.length === 0 ? <div className="empty"><h3>No items yet</h3><p>Your first five glass pieces can become CI-000001 onward.</p></div> :
          <div className="cardGrid">{items.slice(0,6).map(i=><ItemCard item={i} key={i.id}/>)}</div>}
      </section>
    </div>
  )
}
