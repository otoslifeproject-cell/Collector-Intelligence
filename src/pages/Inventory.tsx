import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import ObjectCollectionToolbar from '../components/ObjectCollectionToolbar'
import { supabase } from '../lib/supabase'
import { Item } from '../types'
import ItemCard from '../components/ItemCard'
import {suggestSingleIntakePair} from '../lib/pairGrouping'
import InfoDisclosure from '../components/InfoDisclosure'

export default function Inventory() {
  const [items,setItems] = useState<Item[]>([])
  const [draftRuns,setDraftRuns] = useState<any[]>([])
  const [ownerMaterialCorrections,setOwnerMaterialCorrections]=useState<any[]>([])
  const [draftCovers,setDraftCovers] = useState<Record<string,string>>({})
  const [covers,setCovers] = useState<Record<string,string>>({})
  const [query,setQuery] = useState('')
  const [status,setStatus] = useState('ALL')
  const [view,setView] = useState<'tiles'|'list'|'compact'>(()=>{
    try {const stored=window.localStorage.getItem('ci-inventory-view');return stored==='list'||stored==='compact'?stored:'tiles'}catch{return 'tiles'}
  })
  const changeView=(next:'tiles'|'list'|'compact')=>{setView(next);try{window.localStorage.setItem('ci-inventory-view',next)}catch{ /* Storage optional */ }}

  useEffect(()=>{
    supabase.from('ai_verdict_feedback').select('source_analysis_run_id,source_object_index,corrected_material,feedback_type,created_at')
      .eq('feedback_type','MATERIAL_CORRECTION').order('created_at',{ascending:false}).limit(100)
      .then(({data})=>setOwnerMaterialCorrections(data||[]))
    supabase.from('ai_analysis_runs').select('id,mode,status,created_at,input_photo_count,result').eq('status','DRAFT').in('mode',['single','batch']).order('created_at',{ascending:false}).limit(30).then(async ({data,error})=>{
      if(error)return
      const runs=(data||[]).filter((run:any)=>Array.isArray(run.result?.objects)||Array.isArray(run.result?.image_manifest))
      setDraftRuns(runs)
      const photoRequests:{key:string,path:string}[]=[]
      for(const run of runs){
        const manifest=Array.isArray(run.result?.image_manifest)?run.result.image_manifest:[]
        if(!Array.isArray(run.result?.objects)||!run.result.objects.length){
          const initial=manifest.find((p:any)=>typeof p.storage_path==='string')
          if(initial)photoRequests.push({key:run.id+':pending',path:initial.storage_path})
          continue
        }
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

  const unfinished=draftRuns.flatMap((run:any)=>{
    const objects=Array.isArray(run.result?.objects)?run.result.objects:[]
    const correction=ownerMaterialCorrections.find((x:any)=>x.source_analysis_run_id===run.id&&x.source_object_index==null)
    const correctedMaterial=correction?.corrected_material||null
    const pair=suggestSingleIntakePair(objects,run.mode)
    if(pair){
      const union=[...new Set<number>(objects.flatMap((o:any)=>Array.isArray(o.image_indices)?o.image_indices:[]))]
      return [{run,object:{...objects[0],working_title:correctedMaterial?pair.title.replace(/\bglass\b/gi,correctedMaterial.toLowerCase()):pair.title,image_indices:union,material:correctedMaterial||objects[0]?.material},index:0,pairPieces:2,searchText:objects.map((o:any)=>o.working_title).join(' ')}]
    }
    return objects.map((object:any,index:number)=>({run,object,index,pairPieces:0,searchText:object.working_title||''}))
  }).filter(({object,searchText}:any)=>[searchText,object.working_title,object.object_type,object.maker].filter(Boolean).join(' ').toLowerCase().includes(query.toLowerCase()))
  const showDrafts=status==='ALL'||status==='DRAFT'
  const pendingSessions=draftRuns.filter((run:any)=>(!Array.isArray(run.result?.objects)||!run.result.objects.length)&&Array.isArray(run.result?.image_manifest)&&['saved','upload','intake',run.mode,run.id].join(' ').toLowerCase().includes(query.toLowerCase()))
  const currentBatchId=draftRuns.find((r:any)=>Array.isArray(r.result?.objects)&&r.result.objects.length>0)?.id
  const currentDrafts=unfinished.filter(({run}:any)=>run.id===currentBatchId)
  const earlierDrafts=unfinished.filter(({run}:any)=>run.id!==currentBatchId)
  return (
    <div>
      <div className="pageHeader rowHeader">
        <div><div className="eyebrow">YOUR OBJECTS</div><h1 style={{fontSize:"clamp(28px,3vw,40px)"}}>Inventory</h1></div>
        <Link to="/new" className="primaryButton inlineButton">+ Add item</Link>
      </div>
      <ObjectCollectionToolbar
        query={query} onQueryChange={setQuery} view={view} onViewChange={changeView}
        searchLabel="Search inventory" filterLabel="Filter inventory by status"
        filter={status} onFilterChange={setStatus}
        filters={[
         {value:'ALL',label:'All statuses'},
         {value:'DRAFT',label:'Unfinished drafts'},
         ...['CATALOGUED','RESEARCH','ONE_QUICK_CHECK','SPECIALIST_REVIEW','READY_TO_SELL','LISTED','CONSIGNED','SOLD','ARCHIVED'].map(value=>({value,label:value.replaceAll('_',' ')}))
        ]}
      />
      <div className="inventorySummary">{filtered.length} permanent catalogue items · {unfinished.length} unfinished draft lots/objects{pendingSessions.length>0?' · '+pendingSessions.length+' incomplete upload sessions':''}</div>
      {showDrafts&&pendingSessions.length>0&&<section className="section">
        <h2 className="ci-section-title">Uploaded photographs awaiting a completed AI report <span>{pendingSessions.length} sessions</span></h2>
        <InfoDisclosure label="About incomplete uploads"><p>Original photos remain in private storage. An unfinished AI report cannot be approved as an item.</p></InfoDisclosure>
        <div className={`cardGrid ci-object-grid ci-view-${view}`}>{pendingSessions.map((run:any)=><article className="itemCard ci-record-card" key={run.id}>
          <div className="itemCardImage placeholderGlass">{draftCovers[run.id+':pending']?<img src={draftCovers[run.id+':pending']} alt="Saved source photograph"/>:<span className="ci-missing-photo">Original upload stored</span>}</div>
          <div className="itemCardBody">
            <div className="itemMeta"><span>Upload session</span><span>Not catalogued</span></div>
            <h3 className="ci-record-title">{run.input_photo_count} saved source photographs</h3>
            <p className="ci-record-stage">AI report not complete · No confirmed object identification</p>
            <Link className="primaryButton ci-card-action" to={'/draft/'+run.id}>View saved session →</Link>
          </div>
        </article>)}</div>
      </section>}
      {showDrafts&&currentDrafts.length>0&&<section className="section">
        <h2 className="ci-section-title">Most recent AI report <span>{currentDrafts.length} lot(s) / object(s)</span></h2> 
        <div className={`cardGrid ci-object-grid ci-view-${view}`}>{currentDrafts.map(({run,object,index,pairPieces}:any)=><article className="itemCard ci-record-card" key={run.id+':'+index}>
          <div className="itemCardImage placeholderGlass">{draftCovers[run.id+':'+index] ? <img src={draftCovers[run.id+':'+index]} alt={object.working_title||'Draft photograph'} style={{height:'100%',width:'100%',objectFit:'contain'}} /> : <span className="ci-missing-photo">Photo not linked</span>}</div>
          <div className="itemCardBody">
            <div className="itemMeta"><span>{pairPieces?'Matched pair · 2 pieces':'Draft '+String.fromCharCode(65+index)}</span><span>UNFINISHED</span></div>
            <h3 className="ci-record-title">{object.working_title||object.object_type||'Untitled object'}</h3>
            <p>AI report saved · Maker {object.maker||'not confirmed'}</p>
            <p className="ci-record-stage">Initial AI report saved · Review outstanding</p>
            <details><summary style={{cursor:'pointer',fontWeight:700}}>View original analysis</summary>
              <p>{object.current_attribution||'Attribution unresolved'}</p>
              <p>Identification confidence {object.identification_confidence??'Unknown'}% — separate from workflow progress</p>
              <p>{object.condition_summary}</p>
              <p style={{fontSize:12}}>Source report saved {new Date(run.created_at).toLocaleDateString()}. {Array.isArray(run.result?.image_manifest)?'Original source photos saved and accessible through this report.':'Legacy report awaits verified source-photo linking.'}</p>
            </details>
            <Link className="primaryButton ci-card-action" to={'/draft/'+run.id}>View report →</Link>
          </div>
        </article>)}</div>
      </section>}
      {showDrafts&&earlierDrafts.length>0&&<details className="ci-archive-section"><summary style={{cursor:'pointer',fontWeight:700}}>Earlier unfinished reports · {earlierDrafts.length}</summary>
        <p style={{fontSize:12,color:'var(--muted)'}}>Earlier analysis records are preserved separately; some may describe the same physical item.</p>
        <div className={`cardGrid ci-object-grid ci-view-${view}`}>{earlierDrafts.map(({run,object,index,pairPieces}:any)=><article className="itemCard ci-record-card" key={run.id+':'+index}>
          <div className="itemCardImage placeholderGlass">{draftCovers[run.id+':'+index]?<img src={draftCovers[run.id+':'+index]} alt={object.working_title||'Saved draft'}/>:<span className="ci-missing-photo">Photo not linked</span>}</div><div className="itemCardBody"><div className="itemMeta"><span>{pairPieces?'Matched pair · 2 pieces':'Earlier report'}</span><span>Draft</span></div><h3 className="ci-record-title">{object.working_title||object.object_type||'Untitled draft'}</h3><p className="ci-record-stage">Saved · Not catalogued</p><Link className="primaryButton ci-card-action" to={'/draft/'+run.id}>View report →</Link></div>
        </article>)}</div>
      </details>}
      {status!=='DRAFT'&&<div className={`cardGrid ci-object-grid ci-view-${view}`}>{filtered.map(i=><ItemCard item={i} imageUrl={covers[i.id]} key={i.id}/>)}</div>}
    </div>
  )
}
