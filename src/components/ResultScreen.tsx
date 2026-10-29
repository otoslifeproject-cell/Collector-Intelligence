import {useState} from 'react'
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
  <pre className="ci-result-description">{text}</pre>
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

function CheckList({checks,onConfirm,busy}:{checks:string[];onConfirm?:(t:string[])=>void;busy:boolean}){
 const [ticked,setTicked]=useState<string[]>([])
 const toggle=(c:string)=>setTicked(v=>v.includes(c)?v.filter(x=>x!==c):[...v,c])
 return <div className="ci-check-list">
  {checks.map(c=><label key={c} className={'ci-check'+(ticked.includes(c)?' is-ticked':'')}>
   <input type="checkbox" checked={ticked.includes(c)} onChange={()=>toggle(c)}/>{c}
  </label>)}
  {onConfirm&&ticked.length>0&&<button type="button" className="ci-big-button ci-big-button-primary" disabled={busy} onClick={()=>onConfirm(ticked)}>
   <Check size={22} aria-hidden="true"/>{busy?'Saving…':'Confirmed: update the result · paid'}</button>}
 </div>
}

export default function ResultScreen({listing,onSave,saveDisabled=false,saved=false,onDisagree,disagreeBusy=false,onDetails,status,onNext,nextLabel='Next item →',onConfirm}:Props){
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
   {listing.format&&<span>{listing.format}</span>}
  </div>
  {listing.description&&<Section title="Description"><CopyBlock text={listing.description}/></Section>}
  {listing.checks.length>0&&<Section title={'Check before posting · '+listing.checks.length}>
   <CheckList checks={listing.checks} onConfirm={onConfirm} busy={disagreeBusy}/>
  </Section>}
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
  {status&&<p className="ci-result-note" role="status">{status}</p>}
 </section>
}
