import {useEffect,useState} from 'react'
import {Link,useParams} from 'react-router-dom'
import {supabase} from '../lib/supabase'

type SavedRun={id:string;status:string;mode:string;created_at:string;result:any;input_photo_count:number}
export default function SavedDraft(){
 const {id}=useParams()
 const [run,setRun]=useState<SavedRun|null>(null)
 const [images,setImages]=useState<Record<number,string>>({})
 const [error,setError]=useState('')
 const [busy,setBusy]=useState(true)
 const [edits,setEdits]=useState<Record<number,{working_title:string;condition_summary:string}>>({})
 const [saving,setSaving]=useState(false)
 const [saveStatus,setSaveStatus]=useState('')
 useEffect(()=>{
  let alive=true
  async function load(){
   setBusy(true);setError('');setRun(null);setImages({})
   const {data,error:e}=await supabase.from('ai_analysis_runs').select('id,status,mode,created_at,result,input_photo_count').eq('id',id||'').single()
   if(!alive)return
   if(e||!data){setError('Saved report unavailable or access denied.');setBusy(false);return}
   const report=data as SavedRun
   setRun(report)
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
 return <div className="ci-page ci-saved-draft">
  <header className="ci-page-header">
    <div><div className="eyebrow">SAVED ANALYSIS</div><h1>Original AI report</h1><p>Preserved provisional findings · No additional AI usage</p></div>
    <Link to="/inventory" className="secondaryButton inlineButton">← Inventory</Link>
  </header>
  {busy&&<p role="status">Opening your saved report…</p>}
  {error&&<p role="alert">{error}</p>}
  {run&&<>
   <p className="ci-page-meta">Saved {new Date(run.created_at).toLocaleString()} · {run.mode==='batch'?'Mixed batch':'Single item'} · {run.input_photo_count} original photographs reported · {run.status}</p>
   {!Array.isArray(run.result?.image_manifest)&&<div className="note ci-inline-note">This older report has no confirmed photograph manifest. The written findings are preserved; photographs cannot be attached safely until their source session is verified.</div>}
   {run.status==='DRAFT'&&<div className="ci-page-actions"><button className="primaryButton" disabled={saving} onClick={save}>{saving?'Saving…':'Save review changes'}</button></div>}
   {saveStatus&&<p role="status" className="note">{saveStatus}</p>}
   <div className="ci-record-grid">
    {(run.result?.objects||[]).map((o:any,i:number)=>{
     const keys=Array.isArray(o.image_indices)?o.image_indices:[]
     const photos=keys.filter((n:number)=>!!images[n])
     return <article className="ci-review-card" key={i}>
      {photos.length>0?<img src={images[photos[0]]} alt={o.working_title||'Object'} className="ci-review-photo"/>:<div className="ci-review-photo ci-review-no-photo">Original photo not linked</div>}
      <h2 className="ci-review-title">{edits[i]?.working_title||o.working_title||o.object_type||'Unidentified object'}</h2>
      {run.status==='DRAFT'&&<div className="ci-review-fields"><label>Working title<input value={edits[i]?.working_title||''} onChange={e=>setEdits(v=>({...v,[i]:{...v[i],working_title:e.target.value}}))}/></label><label>Condition notes<textarea rows={2} value={edits[i]?.condition_summary||''} onChange={e=>setEdits(v=>({...v,[i]:{...v[i],condition_summary:e.target.value}}))}/></label></div>}
      <p className="ci-review-caption">Object {i+1} of {run.result.objects.length} · Working hypothesis, not confirmed authentication</p>
      <p>{o.current_attribution||'Maker and attribution not confirmed'}</p>
      <p><strong>Original AI condition observation:</strong> {o.condition_summary||'Not recorded'}</p>
      {photos.length>1&&<details><summary>Original object photos · {photos.length}</summary><div className="intakeThumbGrid">{photos.map((n:number)=><img key={n} src={images[n]} alt={'Original photo '+(n+1)} style={{width:115,height:115,objectFit:'contain'}}/>)}</div></details>}
      <details><summary>Evidence and next checks</summary>
       {(o.evidence||[]).map((e:any,j:number)=><p key={j}><strong>{e.certainty_class||'Unverified'}:</strong> {e.claim}</p>)}
       {(o.next_evidence||[]).map((t:any,j:number)=><p key={'t'+j}>Next: {t.title}</p>)}
      </details>
      <p className="ci-review-caption">Catalogue approval and duplicate-safe resumption are still being developed. This view does not create a permanent item.</p>
     </article>
    })}
   </div>
  </>}
 </div>
}
