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
}
const STEPS=['Photos','Analyse','Result','Save','Sell']

export function StepStrip({current}:{current:number}){
 return <ol className="ci-steps" aria-label="Steps">
  {STEPS.map((label,i)=><li key={label} data-state={i<current?'done':i===current?'now':'next'}>
   <span>{i<current?'✓':i+1}</span>{label}
  </li>)}
 </ol>
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

export default function ResultScreen({listing,onSave,saveDisabled=false,saved=false,onDisagree,disagreeBusy=false,onDetails,status}:Props){
 const [open,setOpen]=useState(false)
 const [kind,setKind]=useState<DisagreeKind|null>(null)
 const [note,setNote]=useState('')
 return <section className="ci-result" aria-label="Your result">
  <StepStrip current={saved?4:2}/>
  <CopyLine label="eBay title" text={listing.ebayTitle}/>
  {listing.etsyTitle&&<CopyLine label="Etsy title" text={listing.etsyTitle}/>}
  <div className="ci-result-price">
   <small>Suggested price</small>
   <p>{listing.price||'Not found yet'}</p>
   {listing.priceBasis&&<small className="ci-result-basis">{listing.priceBasis}</small>}
   {listing.format&&<span>{listing.format}</span>}
  </div>
  {listing.checks.length>0&&<div className="ci-result-checks">
   <small>Check before posting</small>
   {listing.checks.slice(0,2).map((c,i)=><p key={i}>{c}</p>)}
  </div>}
  {listing.stillChecking&&<p className="ci-result-note">Quick check only: low value, so no full research was run.</p>}
  {!open&&<div className="ci-result-actions">
   {onSave&&<button type="button" className="ci-big-button ci-big-button-primary" disabled={saveDisabled||saved} onClick={onSave}>
    <Save size={24} aria-hidden="true"/>{saved?'Saved':'Save to collection'}</button>}
   <button type="button" className="ci-big-button" onClick={()=>setOpen(true)}><ThumbsDown size={24} aria-hidden="true"/>Disagree</button>
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
