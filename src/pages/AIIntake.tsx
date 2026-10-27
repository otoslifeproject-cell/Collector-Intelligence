import {useEffect,useRef,useState} from 'react'
import type {ChangeEvent,DragEvent} from 'react'
import {Link,useNavigate} from 'react-router-dom'
import {Camera,Images,Sparkles,Trash2,UploadCloud} from 'lucide-react'
import {supabase} from '../lib/supabase'
import InfoDisclosure from '../components/InfoDisclosure'
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
 const [rawReply,setRawReply]=useState(''),[savedData,setSavedData]=useState('')
 const locked=!!pending||working
 const chooseMode=(value:'single'|'batch')=>{if(!busy.current&&!held.current)setMode(value)}
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;for(const url of previewURLs.current)URL.revokeObjectURL(url);previewURLs.current.clear()}},[])
 useEffect(()=>{if(message&&!working)status.current?.focus()},[message,working])
 const addIncomingFiles=(files:File[])=>{
  if(busy.current||held.current)return
  const supported=files.filter(f=>['image/jpeg','image/png','image/webp'].includes(f.type)),max=mode==='single'?20:40
  const room=Math.max(0,max-choices.current.length),accepted=supported.slice(0,room).map((file,index)=>{
   const preview=URL.createObjectURL(file);previewURLs.current.add(preview)
   return {index:choices.current.length+index,file,preview}
  })
  choices.current=[...choices.current,...accepted];setPhotos(choices.current)
  setMessage(supported.length!==files.length?'Unsupported files were ignored. Use JPEG, PNG or WebP.':supported.length>room?'Photo limit reached: '+max+' for this intake mode.':accepted.length+' photographs added.')
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
  setSavedData(JSON.stringify(row,null,2))
  if(!hasIntakeReport(row))return false
  await verifyIntakeOriginals(supabase,attempt,current)
  if(current())nav('/draft/'+attempt.request.id)
  return true
 }
 const send=async(attempt:IntakeAttempt)=>{
  setMessage('Saving and checking the original photographs and their private session…')
  const row=await settleIntake(supabase,attempt,current)
  if(await openVerified(attempt,row))return
  const dispatch=await intakeDispatch(supabase,attempt,current)
  if(!current())return
  // A page-local attempt is dispatched at most once, including lost replies and
  // timeouts. A timeout cannot establish that the server cancelled its work.
  attempt.dispatched=true;setMessage('Photo session confirmed. Examining the evidence; the result will be checked independently…')
  let response:Response|undefined,reply=''
  try{
   response=await fetch('/api/analyse-intake',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+dispatch.token},body:JSON.stringify(dispatch.body),signal:AbortSignal.timeout(120000)})
   reply=await response.text()
  }catch{/* Always check the same saved identity after an uncertain response. */}
  if(!current())return
  setRawReply(reply)
  const saved=await readIntake(supabase,attempt,current)
  if(await openVerified(attempt,saved))return
  let reason=''
  try{const parsed=JSON.parse(reply);if(typeof parsed?.error==='string')reason=parsed.error.slice(0,1000)+' '}catch{/* Raw reply remains inspectable. */}
  setMessage(reason+'Analysis was requested, but a complete saved result is not yet confirmed. Check saved analysis; do not pay for a second run to recover it.')
 }
 const perform=async(action:()=>Promise<void>)=>{
  if(busy.current)return
  busy.current=true;setWorking(true)
  try{await action()}
  catch(error){if(current())setMessage(error instanceof IntakeError?error.message:'The photo session could not be confirmed. Keep this page open and check the same session before continuing.')}
  finally{busy.current=false;if(current())setWorking(false)}
 }
 const uploadAndAnalyse=()=>{if(held.current||!photos.length)return;void perform(async()=>{
  const attempt=await prepareIntake(supabase,mode,choices.current.map(p=>p.file),context,current)
  if(!current())return
  held.current=attempt;setPending(attempt)
  await send(attempt)
 })}
 const retry=()=>{const attempt=held.current;if(!attempt||attempt.dispatched)return;void perform(()=>send(attempt))}
 const check=()=>{const attempt=held.current;if(!attempt)return;void perform(async()=>{
  setMessage('Checking this saved photo session without requesting another analysis…')
  const row=await readIntake(supabase,attempt,current)
  if(await openVerified(attempt,row))return
  if(current())setMessage(row?'The saved session is retained, but its analysis is not complete or needs review. No new analysis was requested.':'No saved session is confirmed yet. The selected files are retained here; retry the same photo session before analysis.')
 })}
  return (
    <div>
      <div className="pageHeader">
        <div>
          <div className="eyebrow">AI CATALOGUE INTAKE</div>
          <h1>Add item</h1><p>Choose photos, then start research. You can add measurements later.</p>
          <InfoDisclosure label="How intake works"><p>Photos are analysed into draft objects. You review and approve before anything enters your catalogue.</p></InfoDisclosure>
        </div>
        <Link className="secondaryButton" to="/uploads">Saved uploads</Link>
      </div>

      <fieldset disabled={locked} style={{border:0,padding:0,margin:0,minWidth:0}}>
        <details className="ci-intake-advanced"><summary>More than one object? Choose batch mode</summary><div className="intakeModeGrid">
          <button className={mode==='single'?'intakeMode active':'intakeMode'} onClick={()=>chooseMode('single')}>
            <Camera/><strong>One object</strong><span>Up to 20 photographs of one physical object.</span>
          </button>
          <button className={mode==='batch'?'intakeMode active':'intakeMode'} onClick={()=>chooseMode('batch')}>
            <Images/><strong>Mixed batch — up to 5</strong><span>Upload mixed photographs. AI performs object separation first.</span>
          </button>
        </div></details>

        <div className="panel intakeDropPanel">
          <label
            className={dragActive ? "intakeDrop dragActive" : "intakeDrop"}
            onDragEnter={handleDragOver}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <UploadCloud size={34}/>
            <strong>Drop or choose photographs</strong>
            <span>{mode==='single'?'Overall, base, rim, mark, condition and detail shots are ideal.':'All photographs for up to five objects. Order does not need to be perfect.'}</span>
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

        <details className="panel ci-intake-advanced"><summary>Optional details (purchase, size, notes)</summary>
          <div className="panelHeader"><div><h2>Only what you know</h2><span>All fields optional. User facts are kept separate from AI inference.</span></div></div>
          <div className="formGrid">
            <label>Purchase price<input type="number" step="0.01" value={context.purchase_price} onChange={e=>updateContext('purchase_price',e.target.value)} placeholder="Optional"/></label>
            <label>Currency<select value={context.currency} onChange={e=>updateContext('currency',e.target.value)}><option>GBP</option><option>EUR</option><option>USD</option></select></label>
            <label>Weight (g)<input type="number" value={context.weight_g} onChange={e=>updateContext('weight_g',e.target.value)} placeholder="Optional"/></label>
            <label>Dimensions<input value={context.dimensions} onChange={e=>updateContext('dimensions',e.target.value)} placeholder="e.g. H 24 cm, W 15 cm"/></label>
            <label>Storage location<input value={context.storage_location} onChange={e=>updateContext('storage_location',e.target.value)} placeholder="Shelf / box / room"/></label>
            <label>Your notes / hypothesis<input value={context.user_notes} onChange={e=>updateContext('user_notes',e.target.value)} placeholder="Optional — treated as a hypothesis, not a fact"/></label>
          </div>
        </details>

      </fieldset>
        <section className="ci-intake-journey" aria-label="Add item progress">
          <div className="ci-intake-journey-step" data-state={photos.length?'complete':'current'}><span>1</span><strong>Photographs</strong><small>{photos.length?photos.length+' selected':'Choose images'}</small></div>
          <div className="ci-intake-journey-step" data-state={pending?'complete':working?'current':'waiting'}><span>2</span><strong>Secure originals</strong><small>{pending?'Session retained':working?'Checking uploads':'After Start research'}</small></div>
          <div className="ci-intake-journey-step" data-state={pending?.dispatched?'current':'waiting'}><span>3</span><strong>Initial identification</strong><small>{pending?.dispatched?'Requested · awaiting saved result':'Not requested'}</small></div>
        </section>
        {message && <p className="note" role="status" tabIndex={-1} ref={status}>{message}</p>}
        <div className="intakeActions">
          <button className="primaryButton intakeBigButton ci-action-primary" disabled={!photos.length||locked} onClick={uploadAndAnalyse}><Sparkles size={18}/> Start research</button>
          <span>One requested AI analysis may incur a provider charge. Extra HIGH-cost inscription review is off unless separately approved. Nothing enters your catalogue until you approve.</span>
        </div>


      {pending&&<section className="panel" aria-label="Held photo session">
        <h2>{pending.dispatched?'Check your saved analysis':'Original photo session retained'}</h2>
        <p>{pending.dispatched?'An analysis request has been sent. Check its saved result before any further paid run.':'The same original files, notes and session ID are held for recovery. Retrying reuses them.'}</p>
        <label>Held session details<textarea aria-label="Held session details" readOnly rows={5} value={JSON.stringify({run_id:pending.request.id,mode:pending.request.mode,notes:pending.request.context,photographs:pending.request.originals.map(p=>({index:p.index,file_name:p.file_name,sha256:p.sha256}))},null,2)}/></label>
        <div className="intakeActions">
          <button type="button" className="secondaryButton" disabled={working} onClick={check}>Check saved analysis</button>
          {!pending.dispatched&&<button type="button" className="primaryButton" disabled={working} onClick={retry}>Retry same photo session</button>}
        </div>
        <p className="ci-page-meta">Keep this page open during recovery. Reloading or leaving this page loses unsent choices; saved sessions and originals remain private.</p>
        <Link to={'/uploads/'+pending.request.id}>Open this saved session</Link>
        {savedData&&<details><summary>Saved session data</summary><pre className="ci-research-response">{savedData}</pre></details>}
        {rawReply&&<details><summary>Unconfirmed service reply</summary><pre className="ci-research-response">{rawReply}</pre></details>}
      </section>}
    </div>
  )
}
