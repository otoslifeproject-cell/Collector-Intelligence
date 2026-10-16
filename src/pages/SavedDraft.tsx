import {useEffect,useState} from 'react'
import {Link,useNavigate,useParams} from 'react-router-dom'
import ObjectCollectionToolbar from '../components/ObjectCollectionToolbar'
import {supabase} from '../lib/supabase'

type SavedRun={id:string;status:string;mode:string;created_at:string;result:any;input_photo_count:number}
export default function SavedDraft(){
 const {id}=useParams()
 const navigate=useNavigate()
 const [run,setRun]=useState<SavedRun|null>(null)
 const [images,setImages]=useState<Record<number,string>>({})
 const [error,setError]=useState('')
 const [busy,setBusy]=useState(true)
 const [edits,setEdits]=useState<Record<number,{working_title:string;condition_summary:string}>>({})
 const [saving,setSaving]=useState(false)
 const [approving,setApproving]=useState(false)
 const [selected,setSelected]=useState<Record<number,boolean>>({})
 const [catalogued,setCatalogued]=useState<Array<{item_id:string;item_code:string;title:string;object_index:number}>>([])
 const [saveStatus,setSaveStatus]=useState('')
 const [query,setQuery]=useState('')
 const [filter,setFilter]=useState('ALL')
 const [view,setView]=useState<'tiles'|'list'|'compact'>(()=>{try{const v=window.localStorage.getItem('ci-inventory-view');return v==='list'||v==='compact'?v:'tiles'}catch{return 'tiles'}})
 const changeView=(v:'tiles'|'list'|'compact')=>{setView(v);try{window.localStorage.setItem('ci-inventory-view',v)}catch{}}
 useEffect(()=>{
  let alive=true
  async function load(){
   setBusy(true);setError('');setRun(null);setImages({})
   const {data,error:e}=await supabase.from('ai_analysis_runs').select('id,status,mode,created_at,result,input_photo_count').eq('id',id||'').single()
   if(!alive)return
   if(e||!data){setError('Saved report unavailable or access denied.');setBusy(false);return}
   const report=data as SavedRun
   setRun(report)
   setSelected(Object.fromEntries((report.result?.objects||[]).map((_:any,i:number)=>[i,true])))
   const overrides=report.result?.owner_review?.objects || {}
   setEdits(Object.fromEntries((report.result?.objects||[]).map((o:any,i:number)=>[i,{working_title:overrides[i]?.working_title??o.working_title??'',condition_summary:overrides[i]?.condition_summary??o.condition_summary??''}])))
   const manifest=Array.isArray(report.result?.image_manifest)?report.result.image_manifest:[]
   const requests=manifest.filter((p:any)=>Number.isInteger(p.index)&&typeof p.storage_path==='string')
   const signed=await Promise.all(requests.map(async(p:any)=>{
    const {data:u}=await supabase.storage.from('item-images').createSignedUrl(p.storage_path,1800)
    return [p.index,u?.signedUrl||''] as const
   }))
   if(alive){setImages(Object.fromEntries(signed));setBusy(false)}
  }
  load()
  return ()=>{alive=false}
 },[id])
 const save=async()=>{
  if(!run||run.status!=='DRAFT')return
  setSaving(true);setSaveStatus('')
  try{
   const {data:latest,error:readError}=await supabase.from('ai_analysis_runs').select('result,status').eq('id',run.id).single()
   if(readError||!latest||latest.status!=='DRAFT')throw Error('This report is no longer an editable draft.')
   const next={...latest.result,owner_review:{...(latest.result.owner_review||{}),objects:{...(latest.result.owner_review?.objects||{}),...edits},edited_at:new Date().toISOString()}}
   const {data:updated,error:writeError}=await supabase.from('ai_analysis_runs').update({result:next}).eq('id',run.id).eq('status','DRAFT').select('result').single()
   if(writeError||!updated)throw Error('Could not save the reviewed draft. Your original analysis has not been replaced.')
   setRun(r=>r?{...r,result:updated.result}:r)
   setSaveStatus('Changes saved to your original report. No AI analysis or catalogue approval was run.')
  }catch(e:any){setSaveStatus(e?.message||'Save failed')}
  finally{setSaving(false)}
 }
 const openSavedObject=(i:number)=>{
  changeView('tiles')
  requestAnimationFrame(()=>{
   const card=document.getElementById('ci-object-'+i)
   card?.scrollIntoView({block:'center',behavior:'auto'})
   const review=card?.querySelector('details.ci-object-review') as HTMLDetailsElement|null
   if(review)review.open=true
  })
 }
 const selectedIndices=(run?.result?.objects||[]).flatMap((_:any,i:number)=>selected[i]===false?[]:[i]) as number[]
 const hasReviewObjects=!!run && Array.isArray(run.result?.objects) && run.result.objects.length>0
 const isPhotoManifestReady=!!run && Array.isArray(run.result?.image_manifest) &&
    run.result.image_manifest.length===run.input_photo_count && run.input_photo_count>0 &&
    run.result?.analysis_stage==='COMPLETE'
 const approveSaved=async()=>{
  if(!run || run.status!=='DRAFT'||!isPhotoManifestReady||approving||saving)return
  if(!selectedIndices.length){setSaveStatus('Select at least one object to catalogue.');return}
  setApproving(true);setSaveStatus('Saving catalogue and linking original photographs…')
  try{
   const reviews:Record<string,object>={}
   for(const i of selectedIndices)reviews[String(i)]={...edits[i]}
   const {data,error:e}=await supabase.rpc('ci_approve_saved_intake_v1',{
    p_run_id:run.id,p_object_indices:selectedIndices,p_reviews:reviews
   })
   if(e)throw Error(e.message)
   if(!Array.isArray(data)||data.length!==selectedIndices.length)
    throw Error('Approval response incomplete. Check Inventory before retrying.')
   setCatalogued(data)
   setRun(r=>r?{...r,status:'APPROVED'}:r)
   setSaveStatus(data.length+' catalogue records safely saved with original photo links. No AI rerun.')
  }catch(e:any){
   setSaveStatus('Approval not confirmed: '+(e?.message||'Unknown failure')+'. The saved report remains available.')
  }finally{setApproving(false)}
 }
 return <div className="ci-page ci-saved-draft">
  <header className="ci-page-header">
    <div><div className="eyebrow">SAVED ANALYSIS</div><h1>Original AI report</h1><p>Preserved provisional findings · No additional AI usage</p></div>
    <Link to="/inventory" className="secondaryButton inlineButton">← Inventory</Link>
  </header>
  {busy&&<p role="status">Opening your saved report…</p>}
  {error&&<p role="alert">{error}</p>}
  {run&&<>
   <p className="ci-page-meta">Saved {new Date(run.created_at).toLocaleString()} · {run.mode==='batch'?'Mixed batch':'Single item'} · {run.input_photo_count} original photographs reported · {run.status}</p>
   {!hasReviewObjects&&run.status==='DRAFT'&&<div className="note ci-inline-note">Original upload session saved. The paid AI report did not reach a saved first-pass result, so there are no objects to review or catalogue here. Your uploaded source photographs remain in private storage.</div>}
   {Array.isArray(run.result?.image_manifest)&&run.result?.analysis_stage!=='COMPLETE'&&run.status==='DRAFT'&&
     <div className="note ci-inline-note">A source report exists but its second-stage checks have not been saved. Review the preserved original findings; catalogue approval remains disabled until the analysis is complete.</div>}
   {!Array.isArray(run.result?.image_manifest)&&<div className="note ci-inline-note">This older report has no confirmed photograph manifest. The written findings are preserved; photographs cannot be attached safely until their source session is verified.</div>}
   {run.status==='DRAFT'&&hasReviewObjects&&<div className="ci-page-actions">
    <button className="secondaryButton" disabled={saving||approving} onClick={save}>{saving?'Saving…':'Save review changes'}</button>
    <button className="primaryButton" disabled={approving||saving||!isPhotoManifestReady||!selectedIndices.length} onClick={approveSaved}>
     {approving?'Saving safely…':'Catalogue '+selectedIndices.length+' selected'}
    </button>
   </div>}
   {run.status==='DRAFT'&&isPhotoManifestReady&&<p className="ci-page-meta">Select objects below before approval. Original AI findings and photographs will remain preserved.</p>}
   {catalogued.length>0&&<div className="panel ci-catalogued-result" role="status">
    <h2>Objects safely catalogued</h2>
    <div className="ci-catalogued-links">{catalogued.map(item=><Link key={item.item_id} to={'/item/'+item.item_id} className="secondaryButton inlineButton">{item.item_code} · {item.title||'Object'}</Link>)}</div>
   </div>}
   {saveStatus&&<p role="status" className="note">{saveStatus}</p>}
   <ObjectCollectionToolbar
     query={query} onQueryChange={setQuery} view={view} onViewChange={changeView}
     searchLabel="Search report objects" filterLabel="Filter reviewed objects"
     filter={filter} onFilterChange={setFilter}
     filters={[{value:'ALL',label:'All objects'},{value:'NEEDS_PHOTO',label:'Photos missing'},{value:'HAS_PHOTO',label:'With photos'}]}
   />
   <div className="inventorySummary">{(run.result?.objects||[]).length} objects in this report · Select an object to review</div>
   <div className={`cardGrid ci-object-grid ci-view-${view}`}>
   {(run.result?.objects||[]).map((o:any,i:number)=>{
    const keys=Array.isArray(o.image_indices)?o.image_indices:[]
    const photos=keys.filter((n:number)=>!!images[n])
    const title=edits[i]?.working_title||o.working_title||o.object_type||'Unidentified object'
    if(![title,o.object_type,o.current_attribution].filter(Boolean).join(' ').toLowerCase().includes(query.toLowerCase()))return null
    if(filter==='HAS_PHOTO'&&!photos.length)return null
    if(filter==='NEEDS_PHOTO'&&photos.length)return null
    return <article className="itemCard ci-record-card" key={i} tabIndex={view==='compact'?0:undefined} role={view==='compact'?'link':undefined} aria-label={view==='compact'?'Open '+title:undefined} onClick={view==='compact'?()=>openSavedObject(i):undefined} onKeyDown={view==='compact'?e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openSavedObject(i)}}:undefined} id={'ci-object-'+i}>
     <div className="itemCardImage placeholderGlass">{photos.length?<img src={images[photos[0]]} alt={title}/>:<span className="ci-missing-photo">Photo not linked</span>}</div>
     <div className="itemCardBody">
      <div className="itemMeta"><span>Object {i+1}</span><span>{run.status==='DRAFT'?'Unfinished':run.status}</span></div>
      {run.status==='DRAFT'&&isPhotoManifestReady&&<label className="ci-record-selection" onClick={e=>e.stopPropagation()}>
       <input type="checkbox" checked={selected[i]!==false} onChange={e=>setSelected(v=>({...v,[i]:e.target.checked}))}/>
       <span>Include in catalogue</span>
      </label>}
      <h3 className="ci-record-title">{title}</h3>
      <p className="ci-record-stage">{o.maker||'Maker not confirmed'} · Provisional identification</p>
      <details className="ci-object-review">
       <summary>Review object & evidence</summary>
       <div className="ci-object-review-content">
        <div className="ci-review-section ci-review-section-primary">
         <div className="ci-review-section-heading"><span className="ci-review-section-number">01</span><h4>Your review</h4><span className="ci-review-section-hint">Editable information</span></div>
         {run.status==='DRAFT'?<div className="ci-review-fields">
          <label>Object title<input value={edits[i]?.working_title||''} onChange={e=>setEdits(v=>({...v,[i]:{...v[i],working_title:e.target.value}}))}/></label>
          <label>Your condition notes<textarea rows={3} value={edits[i]?.condition_summary||''} onChange={e=>setEdits(v=>({...v,[i]:{...v[i],condition_summary:e.target.value}}))}/></label>
         </div>:<p>Previously saved review</p>}
        </div>
        <details className="ci-review-section ci-review-source">
         <summary><span className="ci-review-section-number">02</span><span>AI identification & observations</span><span className="ci-review-section-hint">Unverified source notes</span></summary>
         <div className="ci-review-source-content">
          <div><small>Suggested attribution</small><p>{o.current_attribution||'Unconfirmed'}</p></div>
          <div><small>Original condition observation</small><p>{o.condition_summary||'Not recorded'}</p></div>
          {run.result?.initial_ai_result?.objects?.[i]&&<div>
            <small>Archived initial model interpretation (before extra checks)</small>
            <p>{run.result.initial_ai_result.objects[i].current_attribution||run.result.initial_ai_result.objects[i].working_title||'Not identified'}</p>
          </div>}
         </div>
        </details>
        {photos.length>1&&<details className="ci-review-section ci-review-source"><summary><span className="ci-review-section-number">03</span><span>Original photographs</span><span className="ci-review-section-hint">{photos.length} linked</span></summary><div className="intakeThumbGrid">{photos.map((n:number)=><img key={n} src={images[n]} alt={'Photo '+(n+1)} style={{width:115,height:115,objectFit:'contain'}}/>)}</div></details>}
        <details className="ci-review-section ci-review-source">
         <summary><span className="ci-review-section-number">{photos.length>1?'04':'03'}</span><span>Evidence & next checks</span><span className="ci-review-section-hint">Advanced</span></summary>
         <div className="ci-review-source-content">
          {(o.evidence||[]).map((e:any,j:number)=><div key={j}><small>{e.certainty_class||'Unverified'}</small><p>{e.claim}</p></div>)}
          {(o.next_evidence||[]).map((t:any,j:number)=><div key={'t'+j}><small>Next check</small><p>{t.title}</p></div>)}
         </div>
        </details>
       </div>
      </details>
     </div>
    </article>
   })}</div>
  </>}
 </div>
}
