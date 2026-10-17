import {useEffect,useMemo,useState} from 'react'
import {supabase} from '../lib/supabase'
import {visualSearchTerm} from '../lib/vamVisual'

type RecordLead={
 id:string;title:string;objectType:string;maker:string;date:string
 sourceUrl:string;provider:string;imageUrl:string|null
 accessionNumber?:string;cataloguedMaterial?:string
}
type Review={id:string;reference_system_number:string;review_decision:string;created_at:string;review_note:string}
type Props={
 analysisRunId?:string;itemId?:string;itemPhotoIdsByIndex?:Record<number,string>
 legacySourceRunId?:string|null;legacyObjectIndex?:number|null;legacyPaired?:boolean
 objectIndex?:number;paired?:boolean
 photos:Record<number,string>;photoIndices:number[]
 ownerMaterial:string|null;workingTitle:string;latestResearchAt?:string|null
}
export default function VisualReferenceWorkbench({analysisRunId,itemId,itemPhotoIdsByIndex={},legacySourceRunId=null,legacyObjectIndex=null,legacyPaired=false,objectIndex=0,paired=false,photos,photoIndices,ownerMaterial,workingTitle,latestResearchAt=null}:Props){
 const eligible=useMemo(()=>[...new Set(photoIndices)].filter(i=>Number.isInteger(i)&&!!photos[i]),[photoIndices,photos])
 const [photoIndex,setPhotoIndex]=useState<number|null>(eligible[0]??null)
 const initial=visualSearchTerm(ownerMaterial||'',workingTitle)
 const [query,setQuery]=useState(initial)
 const [items,setItems]=useState<RecordLead[]>([])
 const [active,setActive]=useState<RecordLead|null>(null)
 const [reviews,setReviews]=useState<Review[]>([])
 const [historyReady,setHistoryReady]=useState(false)
 const [note,setNote]=useState('')
 const [loading,setLoading]=useState(false)
 const [saving,setSaving]=useState(false)
 const [status,setStatus]=useState('')
 useEffect(()=>{
  setPhotoIndex(eligible[0]??null)
  setQuery(visualSearchTerm(ownerMaterial||'',workingTitle))
  setItems([]);setActive(null);setStatus('')
 },[analysisRunId,itemId,objectIndex,paired,ownerMaterial,workingTitle])
 useEffect(()=>{
  let alive=true
  setHistoryReady(false)
  const load=async()=>{
   let request=supabase.from('ai_visual_reference_reviews')
     .select('id,reference_system_number,review_decision,created_at,review_note')
   if(itemId)request=request.eq('item_id',itemId)
   else if(analysisRunId)request=request.eq('source_analysis_run_id',analysisRunId)
     .eq('source_object_index',objectIndex).eq('paired_lot',paired)
   else {if(alive)setStatus('A saved item or upload is required.');return}
   const {data,error}=await request.order('created_at',{ascending:false}).limit(100)
   let previous:any[]=[]
   let priorError:any=null
   if(itemId&&legacySourceRunId&&legacyObjectIndex!==null){
    const older=await supabase.from('ai_visual_reference_reviews')
      .select('id,reference_system_number,review_decision,created_at,review_note')
      .eq('source_analysis_run_id',legacySourceRunId)
      .eq('source_object_index',legacyObjectIndex).eq('paired_lot',legacyPaired)
      .order('created_at',{ascending:false}).limit(100)
    previous=older.data||[]
    priorError=older.error
   }
   if(alive){
    if(error||priorError)setStatus('Prior visual evidence could not be loaded. Saving is blocked until history is accessible.')
    else{
     setReviews([...(data||[]),...previous].sort((a:any,b:any)=>Date.parse(b.created_at)-Date.parse(a.created_at)))
     setHistoryReady(true)
    }
   }
  }
  void load()
  return ()=>{alive=false}
 },[analysisRunId,itemId,objectIndex,paired,legacySourceRunId,legacyObjectIndex,legacyPaired])
 const search=async()=>{
  const q=query.trim()
  if(q.length<3||q.length>100){setStatus('Enter 3–100 characters using the corrected material, form and decoration.');return}
  setLoading(true);setStatus('Searching official illustrated V&A catalogue records…')
  try{
   const {data:{session}}=await supabase.auth.getSession()
   if(!session)throw Error('Sign in again to search museum sources.')
   const response=await fetch('/api/museum-search?source=vam&visual=1&q='+encodeURIComponent(q),{
    headers:{Authorization:'Bearer '+session.access_token}
   })
   const result=await response.json()
   if(!response.ok)throw Error(result.error||'Museum image search failed.')
   const seen=(result.records||[]).filter((x:any)=>x?.imageUrl&&/^O\d{1,12}$/.test(String(x.id)))
   setItems(seen);setActive(seen[0]||null)
   setStatus(seen.length
    ?seen.length+' illustrated reference candidates. Compare their actual shape, material, construction and decoration; none is a confirmed match.'
    :'No illustrated records matched this search. Try a broader material + object-type description.')
  }catch(e:any){setStatus(e.message||'Reference catalogue temporarily unavailable.')}
  finally{setLoading(false)}
 }
 const record=async(decision:'POSSIBLE_LOOKALIKE'|'NOT_A_MATCH'|'NEEDS_REVIEW')=>{
  if(!active||photoIndex===null||saving||!historyReady)return
  if(!/^O\d{1,12}$/.test(active.id)||active.sourceUrl!=='https://collections.vam.ac.uk/item/'+active.id+'/'){
   setStatus('Original museum reference is invalid; nothing was saved.');return
  }
  setSaving(true);setStatus('Preserving comparison and source reference…')
  try{
   if(!analysisRunId&&!itemId)throw Error('No saved source record to attach evidence.')
   if(itemId&&!itemPhotoIdsByIndex[photoIndex])throw Error('The selected original photo does not have a verified collection photo ID.')
   const scope=itemId?{
      item_id:itemId,item_photo_id:itemPhotoIdsByIndex[photoIndex],paired_lot:false
     }:{
      source_analysis_run_id:analysisRunId,source_object_index:objectIndex,
      paired_lot:paired,source_photo_index:photoIndex
     }
   const payload={
    ...scope,
    reference_provider:'Victoria and Albert Museum',
    reference_system_number:active.id,reference_url:active.sourceUrl,
    reference_title:active.title.slice(0,250),
    reference_maker:active.maker?.slice(0,180)||null,
    reference_date:active.date?.slice(0,100)||null,
    reference_material:active.cataloguedMaterial?.slice(0,180)||null,
    reference_image_url:active.imageUrl,search_query:query.slice(0,120),
    review_decision:decision,review_note:note.slice(0,1200),
    evidence_status:'OWNER_VISUAL_COMPARISON_UNVERIFIED'
   }
   const {data,error}=await supabase.from('ai_visual_reference_reviews').insert(payload as any)
      .select('id,reference_system_number,review_decision,created_at,review_note').single()
   if(error||!data)throw Error(error?.message||'Reference review was not saved')
   const {data:check,error:readError}=await supabase.from('ai_visual_reference_reviews')
      .select('id,reference_system_number,review_decision,created_at,review_note').eq('id',data.id).single()
   if(readError||!check)throw Error('Reference saved but readback unavailable. Do not click again until history is refreshed.')
   setReviews(prev=>[check,...prev]);setNote('')
   setStatus(decision==='NOT_A_MATCH'?'Lookalike rejection preserved. Later Deep Dive can avoid this false lead.':'Visual reference decision preserved as a lead, NOT as a maker or date authentication.')
  }catch(e:any){setStatus(e.message||'Reference decision not confirmed')}
  finally{setSaving(false)}
 }
 const latestReview=(systemNumber:string)=>reviews.find(x=>x.reference_system_number===systemNumber)
 const newerVisualEvidence=!!latestResearchAt&&reviews.some(r=>Date.parse(r.created_at)>Date.parse(latestResearchAt))
 return <section className="panel ci-visual-workbench" aria-label="Illustrated source comparison">
   <div className="panelHeader">
    <div><div className="eyebrow">COMPARE ORIGINAL PHOTOS</div><h2>Find visual reference matches</h2></div>
    <span>No paid AI · museum illustration leads</span>
   </div>
   <p className="ci-page-meta">Use the corrected material and visible construction to search official museum photographs. Similarity is not attribution, proof of age, or a sold comparable. You decide what resembles the real object.</p>
   {newerVisualEvidence&&<p className="note" role="status">Your visual comparison decisions are newer than the displayed AI research. A new Deep Dive will use them; the older maker and price conclusions have NOT been recalculated yet.</p>}
   <div className="ci-visual-search-controls">
    <label>Visual search terms<input value={query} onChange={e=>{setQuery(e.target.value);setItems([]);setActive(null)}} placeholder="e.g. metal gilded vase" maxLength={100} onKeyDown={e=>{if(e.key==='Enter')void search()}}/></label>
    <button className="secondaryButton" disabled={loading} onClick={()=>void search()}>{loading?'Searching images…':'Find illustrated references'}</button>
   </div>
   <p className="ci-page-meta">Need a wider visual search? <a href={'https://www.google.com/search?tbm=isch&q='+encodeURIComponent(query)} target="_blank" rel="noopener noreferrer">Open Google Images manually ↗</a>. Search images are only visual clues; check the original maker or sale record before relying on a label.</p>
   <div className="ci-visual-columns">
    <div className="ci-visual-source">
     <strong>Your original photograph</strong>
     {eligible.length>1&&<label>Choose source view
      <select value={photoIndex??''} onChange={e=>setPhotoIndex(Number(e.target.value))}>
       {eligible.map(i=><option value={i} key={i}>Photo {i+1}</option>)}
      </select></label>}
     {photoIndex!==null&&photos[photoIndex]
      ?<img src={photos[photoIndex]} alt={'Your original uploaded photograph '+(photoIndex+1)}/>
      :<p className="note">No verified photo association is available for this object. Do not compare another object's photographs.</p>}
    </div>
    <div className="ci-visual-source ci-visual-reference">
     <strong>Official V&A catalogue illustration</strong>
     {active?.imageUrl?<img src={active.imageUrl} alt={'V&A reference '+active.title} loading="lazy" referrerPolicy="no-referrer"/>:
       <p className="ci-page-meta">Search illustrated references to compare with your original photograph.</p>}
     {active&&<div className="ci-visual-caption">
      <strong>{active.title}</strong>
      <p>{[active.objectType,active.cataloguedMaterial,active.maker,active.date].filter(Boolean).join(' · ')}</p>
      <a href={active.sourceUrl} target="_blank" rel="noopener noreferrer">View actual V&A object record ↗</a>
      <small>Image source: Victoria and Albert Museum, London. Check catalogue image reuse terms at source.</small>
     </div>}
    </div>
   </div>
   {items.length>0&&<div className="ci-visual-results" aria-label="Other illustrated comparison leads">
    {items.map(x=><button type="button" key={x.id} className={'ci-visual-result '+(active?.id===x.id?'is-selected':'')}
       onClick={()=>{setActive(x);setNote('')}} aria-pressed={active?.id===x.id}>
     <img src={x.imageUrl||''} alt="" loading="lazy" referrerPolicy="no-referrer"/>
     <span>{x.title}</span>
     {latestReview(x.id)&&<small>{latestReview(x.id)?.review_decision==='NOT_A_MATCH'?'Rejected lookalike':'Owner review saved'}</small>}
    </button>)}
   </div>}
   {active&&eligible.length>0&&<div className="ci-visual-decision">
     <label>What did you actually notice? (optional)
      <textarea value={note} maxLength={1200} rows={2} onChange={e=>setNote(e.target.value)} placeholder="e.g. similar floral layout, but different foot and casting joins"/></label>
     <div className="ci-page-actions">
      <button className="secondaryButton" disabled={saving||!historyReady} onClick={()=>void record('NOT_A_MATCH')}>Not a match</button>
      <button className="primaryButton inlineButton" disabled={saving||!historyReady} onClick={()=>void record('POSSIBLE_LOOKALIKE')}>Keep as possible lookalike</button>
     </div>
   </div>}
   {status&&<p className="note" role="status">{status}</p>}
   {reviews.length>0&&<details className="ci-archive-section">
     <summary>{reviews.length} saved visual decision(s) · original reference preserved</summary>
     {reviews.slice(0,16).map(r=><p className="ci-page-meta" key={r.id}>
       {new Date(r.created_at).toLocaleString()} — {r.review_decision.replaceAll('_',' ')} — V&A {r.reference_system_number}
       {r.review_note?' · '+r.review_note:''}
      </p>)}
   </details>}
 </section>
}
