import {useEffect,useRef,useState} from 'react'
import type {ChangeEvent,DragEvent} from 'react'
import {useNavigate} from 'react-router-dom'
import {Camera,Images,Sparkles,Trash2,UploadCloud} from 'lucide-react'
import {supabase} from '../lib/supabase'
import {IntakeError,prepareIntake,settleIntake,readIntake,hasIntakeReport,intakeDispatch,verifyIntakeOriginals} from '../lib/intakeSession'
import type {IntakeAttempt,IntakeContext,IntakeRow} from '../lib/intakeSession'

type UploadPhoto={index:number;file:File;preview:string}
const emptyContext:IntakeContext={purchase_price:'',currency:'GBP',weight_g:'',dimensions:'',storage_location:'',user_notes:''}
export default function AIIntake(){
 const nav=useNavigate(),alive=useRef(false),busy=useRef(false),held=useRef<IntakeAttempt|null>(null)
 const previewURLs=useRef(new Set<string>()),choices=useRef<UploadPhoto[]>([]),status=useRef<HTMLParagraphElement|null>(null)
 const current=()=>alive.current
 const [mode,setMode]=useState<'single'|'batch'>('single')
 const [photos,setPhotos]=useState<UploadPhoto[]>([]),[context,setContext]=useState<IntakeContext>(emptyContext)
 const [pending,setPending]=useState<IntakeAttempt|null>(null),[working,setWorking]=useState(false)
 const [message,setMessage]=useState(''),[dragActive,setDragActive]=useState(false)
 const [showDetails,setShowDetails]=useState(false),[canResume,setCanResume]=useState(false)
 const locked=!!pending||working
 const chooseMode=(value:'single'|'batch')=>{if(!busy.current&&!held.current)setMode(value)}
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;for(const url of previewURLs.current)URL.revokeObjectURL(url);previewURLs.current.clear()}},[])
 useEffect(()=>{if(message&&!working)status.current?.focus()},[message,working])
 const addIncomingFiles=(files:File[])=>{
  if(busy.current||held.current)return
  const max=mode==='single'?20:40
  if(!files.length)return
  if(files.some(f=>!['image/jpeg','image/png','image/webp'].includes(f.type))){
   window.alert('Please choose JPEG, PNG or WebP photos. Nothing was removed.');return
  }
  if(files.some(f=>f.size<1||f.size>26214400)){
   window.alert('One photo is empty or larger than 25 MB. Choose smaller photos. Nothing was removed.');return
  }
  if(files.length+choices.current.length>max){
   window.alert('Too many photos: '+max+' is the maximum. Choose up to '+max+'.');return
  }
  const accepted=files.map((file,index)=>{
   const preview=URL.createObjectURL(file);previewURLs.current.add(preview)
   return {index:choices.current.length+index,file,preview}
  })
  choices.current=[...choices.current,...accepted]
  setPhotos(choices.current)
  setMessage('')
 }

 const addFiles=(e:ChangeEvent<HTMLInputElement>)=>{addIncomingFiles(Array.from(e.target.files||[]));e.target.value=''}
 const handleDragOver=(e:DragEvent<HTMLLabelElement>)=>{e.preventDefault();e.stopPropagation();if(!busy.current&&!held.current){e.dataTransfer.dropEffect='copy';setDragActive(true)}}
 const handleDragLeave=(e:DragEvent<HTMLLabelElement>)=>{e.preventDefault();e.stopPropagation();if(!e.currentTarget.contains(e.relatedTarget as Node|null))setDragActive(false)}
 const handleDrop=(e:DragEvent<HTMLLabelElement>)=>{e.preventDefault();e.stopPropagation();setDragActive(false);addIncomingFiles(Array.from(e.dataTransfer.files||[]))}
 const removePhoto=(index:number)=>{
  if(busy.current||held.current)return
  const photo=choices.current[index];if(photo){URL.revokeObjectURL(photo.preview);previewURLs.current.delete(photo.preview)}
  choices.current=choices.current.filter(p=>p.index!==index).map((p,index)=>({...p,index}));setPhotos(choices.current)
 }
 const updateContext=(key:string,value:string)=>{if(!busy.current&&!held.current)setContext(v=>({...v,[key]:value}))}
 const openVerified=async(attempt:IntakeAttempt,row:IntakeRow|null)=>{
  if(!row)return false
  if(!hasIntakeReport(row))return false
  await verifyIntakeOriginals(supabase,attempt,current)
  if(current())nav('/draft/'+attempt.request.id)
  return true
 }
 const plainError=()=>{
  setMessage('The answer is not ready. Your photos are saved.')
 }
 const checkSaved=async(attempt:IntakeAttempt)=>{
  const row=await readIntake(supabase,attempt,current)
  if(await openVerified(attempt,row))return
  const stage=row?.result?.analysis_stage
  setCanResume(stage==='UPLOADED'&&row?.model==='PENDING')
  if(stage==='UPLOADED')setMessage('Your photos are saved and can be analysed again.')
  else if(stage==='PROCESSING')setMessage('Analysis is being checked. Your photos are safe.')
  else plainError()
 }
 const send=async(attempt:IntakeAttempt,resumeSaved=false)=>{
  setMessage('Analysing your photos…')
  if(!resumeSaved){
   const row=await settleIntake(supabase,attempt,current)
   if(await openVerified(attempt,row))return
  }
  const dispatch=resumeSaved?null:await intakeDispatch(supabase,attempt,current)
  if(!current())return
  // Only the server can claim payment. A previously claimed session cannot be charged again.
  attempt.dispatched=true;setCanResume(false)
  try{
   const session=await supabase.auth.getSession()
   if(session.error||!session.data.session)throw new Error('Sign in again to check your photos.')
   await fetch('/api/analyse-intake',{
    method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.data.session.access_token},
    body:JSON.stringify(resumeSaved?{run_id:attempt.request.id,mode:attempt.request.mode,resume_saved:true}:dispatch?.body),
    signal:AbortSignal.timeout(120000)
   })
  }catch{/* Always read the saved result; a lost acknowledgement never authorises a second call. */}
  if(!current())return
  await checkSaved(attempt)
 }

 const perform=async(action:()=>Promise<void>)=>{
  if(busy.current)return
  busy.current=true;setWorking(true)
  try{await action()}
  catch(error){if(current()){window.alert('Your photos could not be checked. Try again.');setMessage('Your photos are saved or still selected.')}}
  finally{busy.current=false;if(current())setWorking(false)}
 }
 const uploadAndAnalyse=()=>{if(!photos.length){window.alert('Choose at least one photo.');return}if(held.current)return;void perform(async()=>{
  const attempt=await prepareIntake(supabase,mode,choices.current.map(p=>p.file),context,current)
  if(!current())return
  held.current=attempt;setPending(attempt)
  await send(attempt)
 })}
 const check=()=>{const attempt=held.current;if(!attempt)return;void perform(()=>checkSaved(attempt))}
 const retry=()=>{const attempt=held.current;if(!attempt||!canResume)return;void perform(()=>send(attempt,true))}

  return (
    <div>
      <div className="pageHeader"><div><h1>Add photos</h1><p>Choose photos, then press Analyse.</p></div></div>

      <fieldset disabled={locked} style={{border:0,padding:0,margin:0,minWidth:0}}>
        <div className="intakeModeGrid" role="group" aria-label="Number of objects">
          <button className={mode==='single'?'intakeMode active':'intakeMode'} onClick={()=>chooseMode('single')}>
            <Camera/><strong>One object</strong><span>Up to 20 photographs of one physical object.</span>
          </button>
          <button className={mode==='batch'?'intakeMode active':'intakeMode'} onClick={()=>chooseMode('batch')}>
            <Images/><strong>Mixed batch — up to 5</strong><span>Upload mixed photographs. AI performs object separation first.</span>
          </button>
        </div>

        <div className="panel intakeDropPanel">
          <label
            className={dragActive ? "intakeDrop dragActive" : "intakeDrop"}
            onDragEnter={handleDragOver}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <UploadCloud size={34}/>
            <strong>Choose photos · Up to {mode==='single'?20:40} photos</strong>
            <span>{photos.length} of {mode==='single'?20:40} photos selected</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={addFiles}/>
          </label>
          {photos.length>0 && <div className="intakeThumbGrid">
            {photos.map(p=><div className="intakeThumb" key={p.index}>
              <img src={p.preview} alt={p.file.name}/>
              <span>#{p.index+1}</span>
              <button type="button" aria-label={"Remove photograph "+(p.index+1)} onClick={()=>removePhoto(p.index)}><Trash2 size={14}/></button>
            </div>)}
          </div>}
        </div>

        <button type="button" className="secondaryButton ci-disclosure-button" aria-expanded={showDetails} onClick={()=>setShowDetails(v=>!v)}>Add details (optional)</button>
        {showDetails&&<section className="panel ci-intake-advanced">
          <div className="panelHeader"><div><h2>Only what you know</h2><span>All fields optional. User facts are kept separate from AI inference.</span></div></div>
          <div className="formGrid">
            <label>Purchase price<input type="number" step="0.01" value={context.purchase_price} onChange={e=>updateContext('purchase_price',e.target.value)} placeholder="Optional"/></label>
            <label>Currency<select value={context.currency} onChange={e=>updateContext('currency',e.target.value)}><option>GBP</option><option>EUR</option><option>USD</option></select></label>
            <label>Weight (g)<input type="number" value={context.weight_g} onChange={e=>updateContext('weight_g',e.target.value)} placeholder="Optional"/></label>
            <label>Dimensions<input value={context.dimensions} onChange={e=>updateContext('dimensions',e.target.value)} placeholder="e.g. H 24 cm, W 15 cm"/></label>
            <label>Storage location<input value={context.storage_location} onChange={e=>updateContext('storage_location',e.target.value)} placeholder="Shelf / box / room"/></label>
            <label>Your notes / hypothesis<input value={context.user_notes} onChange={e=>updateContext('user_notes',e.target.value)} placeholder="Optional — treated as a hypothesis, not a fact"/></label>
          </div>
        </section>}

      </fieldset>
        <section className="ci-intake-journey" aria-label="Add item progress">
          <div className="ci-intake-journey-step" data-state={photos.length?'complete':'current'}><span>1</span><strong>Add photos</strong><small>{photos.length?photos.length+' selected':'Choose images'}</small></div>
          <div className="ci-intake-journey-step" data-state={pending?'complete':working?'current':'waiting'}><span>2</span><strong>Analyse</strong><small>{pending?'Session retained':working?'Checking uploads':'After Analyse'}</small></div>
          <div className="ci-intake-journey-step" data-state={pending?.dispatched?'current':'waiting'}><span>3</span><strong>Answer</strong><small>{pending?.dispatched?'Requested · awaiting saved result':'Not requested'}</small></div>
        </section>
        {message && <p className="note" role="status" tabIndex={-1} ref={status}>{message}</p>}
        <div className="intakeActions">
          <button className="primaryButton intakeBigButton ci-action-primary" disabled={locked} onClick={uploadAndAnalyse}><Sparkles size={18}/> Analyse photos</button>

        </div>


      {pending&&<section className="panel ci-recovery" aria-label="Saved photos">
       <p>{working?'Checking your saved photos…':canResume?'Your photos are ready to analyse.':'Your photos are saved.'}</p>
       <button type="button" className="primaryButton intakeBigButton" disabled={working} onClick={canResume?retry:check}>
        {canResume?'Try again':'Check result'}
       </button>
      </section>}
    </div>
  )
}
