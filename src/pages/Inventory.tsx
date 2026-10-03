import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, SlidersHorizontal } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Item } from '../types'
import ItemCard from '../components/ItemCard'

export default function Inventory() {
  const [items,setItems] = useState<Item[]>([])
  const [query,setQuery] = useState('')
  const [status,setStatus] = useState('ALL')

  useEffect(()=>{ supabase.from('items').select('*').order('item_code').then(({data})=>setItems((data||[]) as Item[])) },[])

  const filtered = useMemo(()=>items.filter(i=>{
    const text = [i.item_code,i.title,i.maker,i.current_attribution,i.object_type,i.category].filter(Boolean).join(' ').toLowerCase()
    return text.includes(query.toLowerCase()) && (status === 'ALL' || i.status === status)
  }),[items,query,status])

  return (
    <div>
      <div className="pageHeader rowHeader">
        <div><div className="eyebrow">CATALOGUE</div><h1>Inventory</h1><p>Every physical object gets one permanent Collector Intelligence record.</p></div>
        <Link to="/new" className="primaryButton inlineButton">+ Add item</Link>
      </div>
      <div className="toolbar">
        <div className="searchBox"><Search size={18}/><input placeholder="Search ID, maker, attribution, category…" value={query} onChange={e=>setQuery(e.target.value)}/></div>
        <div className="selectWrap"><SlidersHorizontal size={18}/><select value={status} onChange={e=>setStatus(e.target.value)}>
          <option value="ALL">All statuses</option><option>CATALOGUED</option><option>RESEARCH</option><option>ONE_QUICK_CHECK</option>
          <option>SPECIALIST_REVIEW</option><option>READY_TO_SELL</option><option>LISTED</option><option>CONSIGNED</option><option>SOLD</option><option>ARCHIVED</option>
        </select></div>
      </div>
      <div className="inventorySummary">{filtered.length} object{filtered.length===1?'':'s'}</div>
      <div className="cardGrid">{filtered.map(i=><ItemCard item={i} key={i.id}/>)}</div>
    </div>
  )
}
