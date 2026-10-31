import {useState} from 'react'
import DragPhotos from './DragPhotos'
import {Copy,Check,Save,ThumbsDown,Search} from 'lucide-react'

// The owner's end article: marketplace titles and a price. Nothing else unless
// he presses Disagree. Big rounded controls, the same feel as Add item.
export type ResultListing={
 ebayTitle:string
 etsyTitle:string|null
 etsyReason:string|null
 price:string|null
 priceBasis?:string|null
 format:string|null
 checks:string[]
 seen?:string[]
 priceChange?:string|null
 brain?:string|null
 specifics?:{name:string;value:string|null;status:string;evidence:string}[]
 sold?:{price:string;venue:string;date:string|null;url:string|null}[]
 description?:string|null
 stillChecking:boolean
}
export type DisagreeKind='MAKER'|'WHAT'|'PRICE'|'OTHER'
type Props={
 listing:ResultListing
 onSave?:()=>void
 saveDisabled?:boolean
 saved?:boolean
 onDisagree:(kind:DisagreeKind,note:string)=>void
 disagreeBusy?:boolean
 onDetails:()=>void
 status?:string
 onNext?:()=>void
 nextLabel?:string
 onConfirm?:(ticked:string[])=>void
 photos?:{index:number;url:string}[]
 onReorder?:(order:number[])=>void
 photoStatus?:string
 hiddenPhotos?:number[]
 onToggleHidden?:(key:number)=>void
 onAddPhotos?:(files:File[])=>Promise<string|null>
}
const STEPS=['Photos','Analyse','Result','Save','Sell']

export function StepStrip({current}:{current:number}){
 return <ol className="ci-steps" aria-label="Steps">
  {STEPS.map((label,i)=><li key={label} data-state={i<current?'done':i===current?'now':'next'}>
   <span>{i<current?'✓':i+1}</span>{label}
  </li>)}
 </ol>
}

// Long, large section bar that opens downwards when clicked and folds back up.
export function Section({title,children,defaultOpen=false}:{title:string;children:any;defaultOpen?:boolean}){
 return <details className="ci-section" open={defaultOpen}>
  <summary>{title}</summary>
  <div className="ci-section-body">{children}</div>
 </details>
}

function CopyBlock({text}:{text:string}){
 const [copied,setCopied]=useState(false)
 return <>
  <div className="ci-result-description">{text}</div>
  <button type="button" className="ci-big-button ci-big-button-small" onClick={()=>void navigator.clipboard.writeText(text).then(()=>{setCopied(true);window.setTimeout(()=>setCopied(false),2000)}).catch(()=>setCopied(false))}>
   {copied?<Check size={20} aria-hidden="true"/>:<Copy size={20} aria-hidden="true"/>}{copied?'Copied':'Copy description'}
  </button>
 </>
}

function CopyLine({label,text}:{label:string;text:string}){
 const [copied,setCopied]=useState(false)
 const copy=async()=>{
  try{await navigator.clipboard.writeText(text);setCopied(true);window.setTimeout(()=>setCopied(false),2000)}catch{setCopied(false)}
 }
 return <div className="ci-result-title">
  <small>{label}</small>
  <p>{text}</p>
  <button type="button" className="ci-big-button ci-big-button-small" onClick={()=>void copy()}>
   {copied?<Check size={20} aria-hidden="true"/>:<Copy size={20} aria-hidden="true"/>}{copied?'Copied':'Copy'}
  </button>
 </div>
}


// "Add photos" (Dean, 31 Oct): final photos for the follow-up research and listing.
export function AddPhotos({onAdd}:{onAdd:(files:File[])=>Promise<string|null>}){
 const [busy,setBusy]=useState(false),[note,setNote]=useState('')
 return <div className="ci-add-photos">
  <label className="ci-big-button ci-big-button-small">{busy?'Adding…':'+ Add photos'}
   <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple hidden disabled={busy}
    onChange={async e=>{const files=[...(e.target.files||[])];e.target.value='';if(!files.length)return;setBusy(true);setNote('');setNote(await onAdd(files)||'');setBusy(false)}}/></label>
  {note&&<span className="ci-result-note" role="status">{note}</span>}
 </div>
}

// Questions BEFORE deep research (Dean, 31 Oct): each question shows the photo
// it is about and what Yes and No mean, so a "yes" can never be misread.
export type OwnerQuestion={question:string;photo:number|null;why:string;if_yes:string;if_no:string;price_if_yes:number|null;price_if_no:number|null}
type Answer='YES'|'NO'|'NOT_SURE'
export function QuestionsScreen({questions,photoFor,busy,onSubmit,onSkip,onAddPhotos}:{onAddPhotos?:(files:File[])=>Promise<string|null>;questions:OwnerQuestion[];photoFor:(n:number|null)=>{url:string;number:number}|null;busy:boolean;onSubmit:(a:{question:string;answer:Answer;note?:string}[],note:string)=>void;onSkip:()=>void}){
 const [answers,setAnswers]=useState<Record<number,Answer>>({})
 const [notes,setNotes]=useState<Record<number,string>>({})
 const [general,setGeneral]=useState('')
 const all=questions.every((_q,i)=>answers[i])
 const gbp=(n:number|null)=>typeof n==='number'&&Number.isFinite(n)?' · about £'+Math.round(n):''
 return <section className="ci-questions" aria-label="Questions before research">
  <h2>{questions.length===1?'One question':questions.length+' quick questions'} before the deep research</h2>
  <p className="ci-result-note">Look at the item, then answer. Your answers go into the research and the price.</p>
  {questions.map((q,i)=>{const photo=photoFor(q.photo);return <article key={i} className={'ci-question'+(photo?'':' no-photo')}>
   {photo&&<a className="ci-question-photo" href={photo.url} target="_blank" rel="noreferrer noopener" title="Open the photo full size">
    <img src={photo.url} alt={'Photo '+photo.number}/><span>Photo {photo.number} · tap to enlarge</span></a>}
   <div className="ci-question-body">
    <h3>{q.question}</h3>
    {q.why&&<p className="ci-result-note">{q.why}</p>}
    <div className="ci-question-answers" role="group" aria-label={q.question}>
     {([['YES','Yes'],['NO','No'],['NOT_SURE','Not sure']] as const).map(([k,l])=>
      <button type="button" key={k} className={'ci-big-button'+(answers[i]===k?' is-chosen':'')} aria-pressed={answers[i]===k} onClick={()=>setAnswers(v=>({...v,[i]:k}))}>{l}</button>)}
    </div>
    <label className="ci-question-note">What do you see? (optional)
     <input type="text" maxLength={400} value={notes[i]||''} onChange={e=>{const v=e.target.value;setNotes(n=>({...n,[i]:v}))}}/></label>
    <p className="ci-question-effects"><span><strong>Yes</strong> → {q.if_yes}{gbp(q.price_if_yes)}</span><span><strong>No</strong> → {q.if_no}{gbp(q.price_if_no)}</span></p>
   </div>
  </article>})}
  {onAddPhotos&&<AddPhotos onAdd={onAddPhotos}/>}
  <label className="ci-question-note ci-question-general">Anything else you noticed on the item? Marks, stamps, labels, materials (optional)
   <textarea rows={2} maxLength={800} value={general} onChange={e=>setGeneral(e.target.value)}/></label>
  <div className="ci-result-actions">
   <button type="button" className="ci-big-button ci-big-button-primary" disabled={!all||busy} onClick={()=>onSubmit(questions.map((q,i)=>({question:q.question,answer:answers[i],...(notes[i]?.trim()?{note:notes[i].trim()}:{})})),general.trim())}>
    <Search size={24} aria-hidden="true"/>Research with my answers</button>
   <button type="button" className="ci-big-button" disabled={busy} onClick={onSkip}>Skip questions</button>
  </div>
 </section>
}

export default function ResultScreen({listing,onSave,saveDisabled=false,saved=false,onDisagree,disagreeBusy=false,onDetails,status,onNext,nextLabel='Next item →',onConfirm,photos=[],onReorder,photoStatus,hiddenPhotos=[],onToggleHidden,onAddPhotos}:Props){
 const [open,setOpen]=useState(false)
 const [kind,setKind]=useState<DisagreeKind|null>(null)
 const [note,setNote]=useState('')
 return <section className="ci-result" aria-label="Your result">
  <CopyLine label="eBay title" text={listing.ebayTitle}/>
  {listing.etsyTitle&&<CopyLine label="Etsy title" text={listing.etsyTitle}/>}
  <div className="ci-result-price">
   <small>Suggested price</small>
   <p>{listing.price||'Not found yet'}</p>
   {listing.priceBasis&&<small className="ci-result-basis">{listing.priceBasis}</small>}
   {listing.priceChange&&<small className="ci-result-change">{listing.priceChange}</small>}
   {listing.format&&<span>{listing.format}</span>}
   {(listing.sold?.length??0)>0
    ?<ul className="ci-sold-list" aria-label="Sold examples">{listing.sold!.map((s,i)=><li key={i}>
      {s.url?<a href={s.url} target="_blank" rel="noreferrer noopener">{s.price} · {s.venue}{s.date?' · '+s.date:''} ↗</a>:<span>{s.price} · {s.venue}{s.date?' · '+s.date:''}</span>}
     </li>)}</ul>
    :listing.price&&<small className="ci-result-basis">No sold examples found: price from items for sale</small>}
  </div>
  {photos.length>0&&onReorder&&<Section title={'Photos · drag to reorder · photo 1 is the main photo'} defaultOpen>
   <DragPhotos photos={photos.map(p=>({key:p.index,url:p.url}))} onReorder={keys=>onReorder(keys.map(Number))} status={photoStatus}
    hidden={hiddenPhotos} onToggleHidden={onToggleHidden?k=>onToggleHidden(Number(k)):undefined}/>
   {onAddPhotos&&<AddPhotos onAdd={onAddPhotos}/>}
  </Section>}
  {(listing.seen?.length??0)>0&&<Section title={'✓ Read from your photos · '+listing.seen!.length}>
   <ul className="ci-seen-list">{listing.seen!.map(s=><li key={s}><Check size={20} aria-hidden="true"/>{s}</li>)}</ul>
  </Section>}
  {(listing.specifics?.length??0)>0&&<Section title={'Item details · '+listing.specifics!.filter(s=>s.status==='CONFIRMED').length+' confirmed of '+listing.specifics!.length}>
   <dl className="ci-specifics">{listing.specifics!.map(s=><div key={s.name} data-status={s.status}>
    <dt>{s.name}</dt><dd><span aria-hidden="true">{s.status==='CONFIRMED'?'✓':s.status==='LIKELY'?'~':'?'}</span>{s.value||'Not known'}{s.evidence&&<small>{s.evidence}</small>}</dd>
   </div>)}</dl>
   <p className="ci-result-note">✓ confirmed · ~ likely · ? not known</p>
  </Section>}
  {listing.description&&<Section title="Description"><CopyBlock text={listing.description}/></Section>}
  {listing.stillChecking&&<p className="ci-result-note">Quick check only: low value, so no full research was run.</p>}
  {!open&&<div className="ci-result-actions">
   {onSave&&<button type="button" className="ci-big-button ci-big-button-primary" disabled={saveDisabled||saved} onClick={onSave}>
    <Save size={24} aria-hidden="true"/>{saved?'Saved':'Save to collection'}</button>}
   <button type="button" className="ci-big-button" onClick={()=>setOpen(true)}><ThumbsDown size={24} aria-hidden="true"/>Disagree</button>
   {saved&&onNext&&<button type="button" className="ci-big-button ci-big-button-primary" onClick={onNext}>{nextLabel}</button>}
  </div>}
  {open&&<div className="ci-disagree" role="group" aria-label="What is wrong?">
   <h3>What is wrong?</h3>
   <div className="ci-disagree-options">
    {([['MAKER','The maker'],['WHAT','What it is'],['PRICE','The price'],['OTHER','Something else']] as const).map(([k,l])=>
     <button type="button" key={k} className={'ci-big-button'+(kind===k?' is-chosen':'')} aria-pressed={kind===k} onClick={()=>setKind(k)}>{l}</button>)}
   </div>
   {kind&&<>
    <label className="ci-disagree-note">What is right? (optional)
     <textarea rows={2} maxLength={1200} value={note} onChange={e=>setNote(e.target.value)} placeholder="For example: it is Val Saint Lambert, signed on the base"/>
    </label>
    <button type="button" className="ci-big-button ci-big-button-primary" disabled={disagreeBusy} onClick={()=>onDisagree(kind,note)}>
     <Search size={24} aria-hidden="true"/>{disagreeBusy?'Saving…':'Research again with this · paid'}</button>
   </>}
   <div className="ci-disagree-foot">
    <button type="button" className="ci-mini-text-action" onClick={()=>{setOpen(false);setKind(null)}}>Cancel</button>
    <button type="button" className="ci-mini-text-action" onClick={onDetails}>See all details</button>
   </div>
  </div>}
  {listing.brain&&<p className="ci-result-note">Knowledge Brain: {listing.brain}</p>}
  {status&&<p className="ci-result-note" role="status">{status}</p>}
 </section>
}
