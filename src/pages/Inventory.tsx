import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, SlidersHorizontal, LayoutGrid, List, Grid2X2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Item } from '../types'
import ItemCard from '../components/ItemCard'

export default function Inventory() {
  const [items,setItems] = useState<Item[]>([])
  const [draftRuns,setDraftRuns] = useState<any[]>([])
  const [draftCovers,setDraftCovers] = useState<Record<string,string>>({})
  const [covers,setCovers] = useState<Record<string,string>>({})
  const [query,setQuery] = useState('')
  const [status,setStatus] = useState('ALL')
  const [view,setView] = useState<'tiles'|'list'|'compact'>(()=>{
    try {const stored=window.localStorage.getItem('ci-inventory-view');return stored==='list'||stored==='compact'?stored:'tiles'}catch{return 'tiles'}
  })
  const changeView=(next:'tiles'|'list'|'compact')=>{setView(next);try{window.localStorage.setItem('ci-inventory-view',next)}catch{ /* Storage optional */ }}

  useEffect(()=>{
    supabase.from('ai_analysis_runs').select('id,mode,status,created_at,input_photo_count,result').eq('status','DRAFT').in('mode',['single','batch']).order('created_at',{ascending:false}).limit(30).then(async ({data,error})=>{
      if(error)return
      const runs=(data||[]).filter((run:any)=>Array.isArray(run.result?.objects))
      setDraftRuns(runs)
      const photoRequests:{key:string,path:string}[]=[]
      for(const run of runs){
        const manifest=Array.isArray(run.result?.image_manifest)?run.result.image_manifest:[]
        for(let index=0;index<run.result.objects.length;index++){
          const obj=run.result.objects[index]
          const indices=Array.isArray(obj.image_indices)?obj.image_indices:[]
          const chosen=manifest.find((p:any)=>indices.includes(p.index)&&typeof p.storage_path==='string')
          if(chosen)photoRequests.push({key:run.id+':'+index,path:chosen.storage_path})
        }
      }
      const results=await Promise.all(photoRequests.map(async ({key,path})=>{
        const {data:url}=await supabase.storage.from('item-images').createSignedUrl(path,1800)
        return [key,url?.signedUrl||''] as const
      }))
      setDraftCovers(Object.fromEntries(results))
    })
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
  const currentBatchId=draftRuns.find((r:any)=>r.mode==='batch')?.id
  const currentDrafts=unfinished.filter(({run}:any)=>run.id===currentBatchId)
  const earlierDrafts=unfinished.filter(({run}:any)=>run.id!==currentBatchId)
  return (
    <div>
      <div className="pageHeader rowHeader">
        <div><div className="eyebrow">YOUR OBJECTS</div><h1 style={{fontSize:"clamp(28px,3vw,40px)"}}>Inventory</h1></div>
        <Link to="/new" className="primaryButton inlineButton">+ Add item</Link>
      </div>
      <div className="ci-inventory-controls">
        <div className="ci-search-control searchBox"><Search size={18}/><input aria-label="Search objects" placeholder="Find an object…" value={query} onChange={e=>setQuery(e.target.value)}/></div>
        <div className="ci-toolbar-actions">
          <div className="ci-status-control selectWrap"><SlidersHorizontal size={18}/><select aria-label="Filter objects by status" value={status} onChange={e=>setStatus(e.target.value)}>
            <option value="ALL">All statuses</option><option value="DRAFT">Unfinished drafts</option><option>CATALOGUED</option><option>RESEARCH</option><option>ONE_QUICK_CHECK</option>
            <option>SPECIALIST_REVIEW</option><option>READY_TO_SELL</option><option>LISTED</option><option>CONSIGNED</option><option>SOLD</option><option>ARCHIVED</option>
          </select></div>
          <div className="ci-view-switch" role="group" aria-label="Inventory layout">
            <button type="button" className={view==='tiles'?'active':''} aria-label="Tile view" aria-pressed={view==='tiles'} onClick={()=>changeView('tiles')} title="Tiles"><LayoutGrid size={18}/><span>Tiles</span></button>
            <button type="button" className={view==='list'?'active':''} aria-label="List view" aria-pressed={view==='list'} onClick={()=>changeView('list')} title="List"><List size={18}/><span>List</span></button>
            <button type="button" className={view==='compact'?'active':''} aria-label="Compact icon view" aria-pressed={view==='compact'} onClick={()=>changeView('compact')} title="Icons"><Grid2X2 size={18}/><span>Icons</span></button>
          </div>
        </div>
      </div>
      <div className="inventorySummary">{(status==='DRAFT'?0:filtered.length)+(showDrafts?unfinished.length:0)} objects · {unfinished.length} unfinished drafts</div>
      {showDrafts&&unfinished.length>0&&<section className="section">
        <h2 className="ci-section-title">Latest mixed batch <span>{currentDrafts.length} objects</span></h2> 
        <div className={`cardGrid ci-object-grid ci-view-${view}`}>{currentDrafts.map(({run,object,index}:any)=><article className="itemCard ci-record-card" key={run.id+':'+index}>
          <div className="itemCardImage placeholderGlass">{draftCovers[run.id+':'+index] ? <img src={draftCovers[run.id+':'+index]} alt={object.working_title||'Draft photograph'} style={{height:'100%',width:'100%',objectFit:'contain'}} /> : <span className="ci-missing-photo">Photo not linked</span>}</div>
          <div className="itemCardBody">
            <div className="itemMeta"><span>Draft {String.fromCharCode(65+index)}</span><span>UNFINISHED</span></div>
            <h3 className="ci-record-title">{object.working_title||object.object_type||'Untitled object'}</h3>
            <p>AI report saved · Maker {object.maker||'not confirmed'}</p>
            <p className="ci-record-stage">Initial AI report saved · Review outstanding</p>
            <details><summary style={{cursor:'pointer',fontWeight:700}}>View original analysis</summary>
              <p>{object.current_attribution||'Attribution unresolved'}</p>
              <p>Identification confidence {object.identification_confidence??'Unknown'}% — separate from workflow progress</p>
              <p>{object.condition_summary}</p>
              <p style={{fontSize:12}}>Source report saved {new Date(run.created_at).toLocaleDateString()}. Original image access and full draft resumption still require restoration.</p>
            </details>
            <Link className="primaryButton ci-card-action" to={'/draft/'+run.id}>View report →</Link>
          </div>
        </article>)}</div>
      </section>}
      {showDrafts&&earlierDrafts.length>0&&<details className="ci-archive-section"><summary style={{cursor:'pointer',fontWeight:700}}>Earlier unfinished reports · {earlierDrafts.length}</summary>
        <p style={{fontSize:12,color:'var(--muted)'}}>Earlier analysis records are preserved separately; some may describe the same physical item.</p>
        <div className={`cardGrid ci-object-grid ci-view-${view}`}>{earlierDrafts.map(({run,object,index}:any)=><article className="itemCard ci-record-card" key={run.id+':'+index}>
          <div className="itemCardImage placeholderGlass"><span className="ci-missing-photo">Photo not linked</span></div><div className="itemCardBody"><div className="itemMeta"><span>Earlier report</span><span>Draft</span></div><h3 className="ci-record-title">{object.working_title||object.object_type||'Untitled draft'}</h3><p className="ci-record-stage">Saved · Not catalogued</p><Link className="primaryButton ci-card-action" to={'/draft/'+run.id}>View report →</Link></div>
        </article>)}</div>
      </details>}
      {status!=='DRAFT'&&<div className={`cardGrid ci-object-grid ci-view-${view}`}>{filtered.map(i=><ItemCard item={i} imageUrl={covers[i.id]} key={i.id}/>)}</div>}
    </div>
  )
}
