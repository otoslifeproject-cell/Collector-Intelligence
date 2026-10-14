import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, SlidersHorizontal } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Item } from '../types'
import ItemCard from '../components/ItemCard'

export default function Inventory() {
  const [items,setItems] = useState<Item[]>([])
  const [draftRuns,setDraftRuns] = useState<any[]>([])
  const [covers,setCovers] = useState<Record<string,string>>({})
  const [query,setQuery] = useState('')
  const [status,setStatus] = useState('ALL')

  useEffect(()=>{
    supabase.from('ai_analysis_runs').select('id,mode,status,created_at,result').eq('status','DRAFT').in('mode',['single','batch']).order('created_at',{ascending:false}).limit(30).then(({data,error})=>{if(!error)setDraftRuns((data||[]).filter((run:any)=>Array.isArray(run.result?.objects)))})
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

  const unfinished=draftRuns.flatMap((run:any)=>run.result.objects.map((object:any,index:number)=>({run,object,index}))).filter(({object}:any)=>[object.working_title,object.object_type,object.maker].filter(Boolean).join(' ').toLowerCase().includes(query.toLowerCase()))
  const showDrafts=status==='ALL'||status==='DRAFT'
  return (
    <div>
      <div className="pageHeader rowHeader">
        <div><div className="eyebrow">YOUR OBJECTS</div><h1 style={{fontSize:"clamp(28px,3vw,40px)"}}>Inventory</h1></div>
        <Link to="/new" className="primaryButton inlineButton">+ Add item</Link>
      </div>
      <div className="toolbar">
        <div className="searchBox"><Search size={18}/><input placeholder="Find an object…" value={query} onChange={e=>setQuery(e.target.value)}/></div>
        <div className="selectWrap"><SlidersHorizontal size={18}/><select value={status} onChange={e=>setStatus(e.target.value)}>
          <option value="ALL">All statuses</option><option value="DRAFT">Unfinished drafts</option><option>CATALOGUED</option><option>RESEARCH</option><option>ONE_QUICK_CHECK</option>
          <option>SPECIALIST_REVIEW</option><option>READY_TO_SELL</option><option>LISTED</option><option>CONSIGNED</option><option>SOLD</option><option>ARCHIVED</option>
        </select></div>
      </div>
      <div className="inventorySummary">{(status==='DRAFT'?0:filtered.length)+(showDrafts?unfinished.length:0)} objects · {unfinished.length} unfinished drafts</div>
      {showDrafts&&unfinished.length>0&&<section className="section">
        <h2 style={{fontSize:18}}>Unfinished AI reports · {unfinished.length}</h2>
        <div className="cardGrid">{unfinished.map(({run,object,index}:any)=><div className="itemCard" key={run.id+':'+index}>
          <div className="itemCardBody" style={{padding:16}}>
            <div className="itemMeta"><span>Draft {String.fromCharCode(65+index)}</span><span>UNFINISHED</span></div>
            <h3>{object.working_title||object.object_type||'Untitled object'}</h3>
            <p>AI report saved · Maker {object.maker||'not confirmed'}</p>
            <div role="progressbar" aria-valuenow={25} aria-valuemin={0} aria-valuemax={100} aria-label="Workflow completion" style={{background:'var(--line)',height:8,borderRadius:9,overflow:'hidden'}}><div style={{background:'var(--accent)',width:'25%',height:'100%'}}/></div>
            <p style={{fontSize:12}}>25% · Initial report complete; catalogue approval pending</p>
            <details><summary style={{cursor:'pointer',fontWeight:700}}>View original analysis</summary>
              <p>{object.current_attribution||'Attribution unresolved'}</p>
              <p>Identification confidence {object.identification_confidence??'Unknown'}% — separate from workflow progress</p>
              <p>{object.condition_summary}</p>
              <p style={{fontSize:12}}>Source report saved {new Date(run.created_at).toLocaleDateString()}. Original image access and full draft resumption still require restoration.</p>
            </details>
            <Link className="primaryButton" style={{display:'inline-flex',marginTop:12}} to="/intake">Open intake</Link>
          </div>
        </div>)}</div>
      </section>}
      {status!=='DRAFT'&&<div className="cardGrid">{filtered.map(i=><ItemCard item={i} imageUrl={covers[i.id]} key={i.id}/>)}</div>}
    </div>
  )
}
