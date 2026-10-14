import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, SlidersHorizontal } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Item } from '../types'
import ItemCard from '../components/ItemCard'

export default function Inventory() {
  const [items,setItems] = useState<Item[]>([])
  const [covers,setCovers] = useState<Record<string,string>>({})
  const [query,setQuery] = useState('')
  const [status,setStatus] = useState('ALL')

  useEffect(()=>{
    let cancelled=false
    supabase.from('items').select('*').order('item_code').then(async ({data})=>{
      const rows=(data||[]) as Item[]
      if(cancelled)return
      setItems(rows)
      if(!rows.length)return
      const ids=rows.map(i=>i.id)
      const {data:photos,error}=await supabase.from('item_photos').select('item_id,storage_path,is_hero,position').in('item_id',ids).order('position',{ascending:true})
      if(error||cancelled)return
      const selected=new Map<string,string>()
      for(const p of (photos||[]).sort((a:any,b:any)=>Number(b.is_hero)-Number(a.is_hero))){
        if(!selected.has(p.item_id))selected.set(p.item_id,p.storage_path)
      }
      const urls=await Promise.all([...selected.entries()].map(async ([id,path])=>{
        const {data:url}=await supabase.storage.from('item-images').createSignedUrl(path,3600)
        return [id,url?.signedUrl||''] as const
      }))
      if(!cancelled)setCovers(Object.fromEntries(urls))
    })
    return ()=>{cancelled=true}
  },[])

  const filtered = useMemo(()=>items.filter(i=>{
    const text = [i.item_code,i.title,i.maker,i.current_attribution,i.object_type,i.category].filter(Boolean).join(' ').toLowerCase()
    return text.includes(query.toLowerCase()) && (status === 'ALL' || i.status === status)
  }),[items,query,status])

  return (
    <div>
      <div className="pageHeader rowHeader">
        <div><div className="eyebrow">YOUR OBJECTS</div><h1 style={{fontSize:"clamp(28px,3vw,40px)"}}>Inventory</h1></div>
        <Link to="/new" className="primaryButton inlineButton">+ Add item</Link>
      </div>
      <div className="toolbar">
        <div className="searchBox"><Search size={18}/><input placeholder="Find an object…" value={query} onChange={e=>setQuery(e.target.value)}/></div>
        <div className="selectWrap"><SlidersHorizontal size={18}/><select value={status} onChange={e=>setStatus(e.target.value)}>
          <option value="ALL">All statuses</option><option>CATALOGUED</option><option>RESEARCH</option><option>ONE_QUICK_CHECK</option>
          <option>SPECIALIST_REVIEW</option><option>READY_TO_SELL</option><option>LISTED</option><option>CONSIGNED</option><option>SOLD</option><option>ARCHIVED</option>
        </select></div>
      </div>
      <div className="inventorySummary">{filtered.length} object{filtered.length===1?'':'s'}</div>
      <div className="cardGrid">{filtered.map(i=><ItemCard item={i} imageUrl={covers[i.id]} key={i.id}/>)}</div>
    </div>
  )
}
