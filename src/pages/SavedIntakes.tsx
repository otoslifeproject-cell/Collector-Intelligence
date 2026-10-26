import {useEffect,useRef,useState} from 'react'
import {Link,useLocation,useParams} from 'react-router-dom'
import {supabase} from '../lib/supabase'
import {intakePageSize,listSavedIntakes,readSavedIntake,savedIntakePreviews,savedIntakeState,savedIntakeTitle,savedReportAvailable,SavedIntakeError,type SavedIntake} from '../lib/savedIntakes'

type Photo={index:number;name:string;url:string}
type Checked={key:string;rows:SavedIntake[];total:number;previewsChecked:boolean;previews:Record<string,Photo[]>}
function SavedPhoto({photo}:{photo:Photo}){
 const [failed,setFailed]=useState(false)
 return <div className="photoTile">
  {photo.url&&!failed?<img src={photo.url} alt={'Source photograph '+(photo.index+1)+': '+photo.name} style={{objectFit:'contain'}} onError={()=>setFailed(true)}/>:<p className="note">Preview unavailable</p>}
  <div><strong>Source photograph #{photo.index+1}</strong><span>{photo.name}</span></div>
 </div>
}
export default function SavedIntakes(){
 const {id}=useParams(),location=useLocation(),[reload,setReload]=useState(0)
 const query=new URLSearchParams(location.search).get('page')||'1',page=/^[1-9]\d*$/.test(query)?Number(query):NaN
 const key=(id||'list:'+query)+':'+reload
 const [checked,setChecked]=useState<Checked|null>(null),[error,setError]=useState<{key:string;message:string}|null>(null)
 const [previewNote,setPreviewNote]=useState(''),serial=useRef(0)
 useEffect(()=>{
  const turn=++serial.current;let mounted=true;const current=()=>mounted&&turn===serial.current
  setChecked(null);setError(null);setPreviewNote('')
  void (async()=>{
   try{
    const result=id?{rows:await readSavedIntake(supabase,id,current).then(row=>row?[row]:[]),total:1}:await listSavedIntakes(supabase,page,current)
    if(!current())return
    setChecked({key,rows:result.rows,total:result.total,previewsChecked:false,previews:{}})
    try{
     const previews=await savedIntakePreviews(supabase,result.rows,!!id,current)
     if(current())setChecked({key,rows:result.rows,total:result.total,previewsChecked:true,previews})
    }catch{if(current()){
     setChecked({key,rows:result.rows,total:result.total,previewsChecked:true,previews:{}})
     setPreviewNote('Photo previews could not be checked. The saved session data is still available; check again to refresh private links.')
    }}
   }catch(e){if(current())setError({key,message:e instanceof SavedIntakeError?e.message:'Saved uploads could not be checked. Try again without requesting a new analysis.'})}
  })()
  return()=>{mounted=false}
 },[id,page,key])
 const data=checked?.key===key?checked:null,message=error?.key===key?error.message:'',row=data?.rows[0]
 const refresh=<button type="button" className="secondaryButton" onClick={()=>setReload(v=>v+1)}>Check saved {id?'session':'uploads'}</button>
 return <div>
  <div className="pageHeader"><div><div className="eyebrow">PRIVATE PHOTO UPLOADS</div><h1>{id?'Saved photo session':'Saved uploads'}</h1>
   <p>{id?'Check the original saved response before requesting another analysis.':'Find your drafts and earlier uploads. Checking this list does not run AI.'}</p></div>
   <div className="intakeActions">{id?<Link className="secondaryButton" to="/uploads">Saved uploads</Link>:<Link className="primaryButton" to="/intake">New photo upload</Link>}{refresh}</div>
  </div>
  <section aria-label={id?'Saved photo session':'Saved uploads'} aria-busy={(!data&&!message)||!!data&&!data.previewsChecked}>
   {message?<div className="panel"><p role="alert">{message}</p><Link to="/uploads">Return to first page</Link></div>:!data?<p role="status">Checking saved uploads…</p>:id?
    !row?<p className="note">This saved session is unavailable for your account.</p>:<>
     <div className="panel"><div className="panelHeader"><h2>{savedIntakeTitle(row)}</h2><span>{savedIntakeState(row)}</span></div>
      <p>{row.input_photo_count} source {row.input_photo_count===1?'photograph':'photographs'} · {new Date(row.created_at).toLocaleString('en-GB')} · {row.mode==='batch'?'Mixed batch':'One object'}</p>
      {savedReportAvailable(row)?<Link className="primaryButton" to={'/draft/'+row.id}>Open saved draft</Link>:<p className="note">A complete usable draft is not confirmed. The original response is retained below. Checking this session will not start another paid analysis.</p>}
      <details><summary>Session details</summary><p>Model: {row.model}</p><label>Saved session ID<input readOnly value={row.id}/></label></details>
     </div>
     {!data.previewsChecked?<p role="status">Checking photo previews…</p>:data.previews[row.id]?.length>0?<div className="panel"><h2>Saved source photographs</h2><div className="photoGrid">{data.previews[row.id].map(photo=><SavedPhoto key={photo.index} photo={photo}/>)}</div></div>:<p className="ci-page-meta">Photo previews are unavailable or the saved manifest needs review. Original session data is preserved below.</p>}
     <details className="panel"><summary>Saved session data</summary><p>Original saved data. Model statements and saved responses do not independently verify an attribution or sale.</p><pre className="ci-research-response">{JSON.stringify(row,null,2)}</pre></details>
    </>:
    <><p className="ci-page-meta">{data.total?`Showing ${(page-1)*intakePageSize+1}–${(page-1)*intakePageSize+data.rows.length} of ${data.total} saved uploads`:'No saved photo uploads for this account.'}</p>
     <div className="cardGrid ci-object-grid ci-view-tiles">{data.rows.map(record=><Link key={record.id} to={'/uploads/'+record.id} className="itemCard ci-record-card">
      <div className="itemCardImage placeholderGlass">{data.previews[record.id]?.[0]?.url?<img src={data.previews[record.id][0].url} alt={savedIntakeTitle(record)} onError={e=>{e.currentTarget.hidden=true}}/>:<span className="ci-missing-photo">Saved source photos</span>}</div>
      <div className="itemCardBody"><div className="itemMeta"><span>{record.mode==='batch'?'Mixed batch':'One object'}</span><span>{record.input_photo_count} photos</span></div><h2 className="ci-record-title">{savedIntakeTitle(record)}</h2><p className="ci-record-stage">{savedIntakeState(record)}</p><p>{new Date(record.created_at).toLocaleString('en-GB')}</p><span className="primaryButton ci-card-action">Open saved session →</span></div>
     </Link>)}</div>
     <nav aria-label="Saved upload pages" className="intakeActions">{page>1&&<Link className="secondaryButton" to={'/uploads?page='+(page-1)}>Newer uploads</Link>}{page*intakePageSize<data.total&&<Link className="secondaryButton" to={'/uploads?page='+(page+1)}>Older uploads</Link>}</nav>
    </>}
   {previewNote&&<p className="note" role="status">{previewNote}</p>}
  </section>
 </div>
}
