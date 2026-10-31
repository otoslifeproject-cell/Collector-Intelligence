import {useEffect,useState} from 'react'
import {Link} from 'react-router-dom'
import {Search,RefreshCw} from 'lucide-react'
import {supabase} from '../lib/supabase'
import {collectAll,loadCatchUp,startResearch,workingRunIds} from '../lib/bulkResearch'
import type {Answer,CatchUpItem} from '../lib/bulkResearch'
import {QuestionsScreen} from '../components/ResultScreen'

// Catch up (Dean, 31 Oct): every uploaded item brought to the questions point in
// bulk, then all questions answered on this one page.
async function inTurns<T>(list:T[],size:number,work:(x:T)=>Promise<void>){
 let next=0
 await Promise.all(Array.from({length:Math.min(size,list.length)},async()=>{while(next<list.length){const x=list[next++];await work(x)}}))
}

export default function CatchUp(){
 const [items,setItems]=useState<CatchUpItem[]>([])
 const [loading,setLoading]=useState(true)
 const [reload,setReload]=useState(0)
 const [message,setMessage]=useState('')
 const [progress,setProgress]=useState<{label:string;done:number;total:number}|null>(null)
 const [errors,setErrors]=useState<string[]>([])
 const [urls,setUrls]=useState<Record<string,string>>({})
 const [busyKey,setBusyKey]=useState<string|null>(null)

 useEffect(()=>{let live=true;(async()=>{
  setLoading(true)
  try{
   const list=await loadCatchUp(supabase)
   if(!live)return
   setItems(list)
   const paths=[...new Set(list.flatMap(i=>i.state==='QUESTIONS'?i.photoPaths:i.photoPaths.slice(0,1)))]
   if(paths.length){
    const s=await supabase.storage.from('item-images').createSignedUrls(paths,3600)
    if(live&&!s.error)setUrls(Object.fromEntries((s.data||[]).filter((x:any)=>x.path).map((x:any)=>[x.path,x.signedUrl])))
   }
  }catch(e:any){if(live)setMessage('Could not load your items: '+(e?.message||'unknown error'))}
  finally{if(live)setLoading(false)}
 })();return()=>{live=false}},[reload])

 // While anything is working, collect finished research every 30 s (free).
 const working=items.filter(i=>i.state==='WORKING').length
 useEffect(()=>{
  if(!working)return
  const t=window.setInterval(()=>void(async()=>{const ids=await workingRunIds(supabase);if(ids.length&&await collectAll(supabase,ids))setReload(v=>v+1);else if(!ids.length)setReload(v=>v+1)})(),30000)
  return()=>window.clearInterval(t)
 },[working])

 const runMany=async(label:string,list:CatchUpItem[],depth:'quick'|'deep_dive')=>{
  setErrors([]);setMessage('');setProgress({label,done:0,total:list.length})
  const errs:string[]=[]
  await inTurns(list,3,async item=>{
   const fail=await startResearch(supabase,item,depth)
   if(fail)errs.push(item.title+': '+fail)
   setProgress(p=>p?{...p,done:p.done+1}:p)
  })
  setErrors(errs);setProgress(null)
  setMessage(list.length-errs.length+' of '+list.length+' started.'+(errs.length?' '+errs.length+' did not start (below).':''))
  setReload(v=>v+1)
 }
 const answer=async(item:CatchUpItem,answers:Answer[]|null,note:string)=>{
  setBusyKey(item.key);setMessage('')
  const fail=await startResearch(supabase,item,'deep_dive',answers?{answers,note}:{})
  setBusyKey(null)
  if(fail)setMessage(item.title+': '+fail)
  else setItems(v=>v.map(x=>x.key===item.key?{...x,state:'WORKING'}:x))
 }

 const by=(s:CatchUpItem['state'])=>items.filter(i=>i.state===s)
 const needs=by('NEEDS_CHECK'),questions=by('QUESTIONS'),ready=by('READY_FOR_DEEP'),done=by('DONE')
 return <div className="ci-catchup">
  <div className="pageHeader"><div><h1>Catch up</h1><p>Bring every item to the same point, then answer all the questions here.</p></div>
   <button type="button" className="ci-big-button ci-big-button-small" onClick={()=>setReload(v=>v+1)}><RefreshCw size={18} aria-hidden="true"/>Refresh</button></div>
  {loading&&<p className="ci-result-note">Loading your items…</p>}
  {!loading&&<div className="ci-catchup-counts">
   <div><strong>{needs.length}</strong><span>need a quick check</span></div>
   <div><strong>{questions.length}</strong><span>have questions for you</span></div>
   <div><strong>{ready.length}</strong><span>ready for deep research</span></div>
   <div><strong>{working}</strong><span>working now</span></div>
   <div><strong>{done.length}</strong><span>done</span></div>
  </div>}
  {progress&&<p className="ci-result-note" role="status">{progress.label}: {progress.done} of {progress.total}…</p>}
  {message&&<p className="ci-result-note ci-run-failed" role="status">{message}</p>}
  {errors.length>0&&<ul className="ci-catchup-errors">{errors.map((e,i)=><li key={i}>{e}</li>)}</ul>}
  {!loading&&!progress&&<div className="ci-result-actions">
   {needs.length>0&&<button type="button" className="ci-big-button ci-big-button-primary" onClick={()=>void runMany('Quick checks',needs,'quick')}>
    <Search size={22} aria-hidden="true"/>Prepare questions for {needs.length} item{needs.length===1?'':'s'} · paid</button>}
   {ready.length>0&&<button type="button" className="ci-big-button" onClick={()=>void runMany('Deep research',ready,'deep_dive')}>
    Deep research for {ready.length} item{ready.length===1?'':'s'} with no questions · paid</button>}
  </div>}
  {working>0&&<p className="ci-result-note">{working} working. This page checks for finished research every 30 seconds; you can also leave and come back.</p>}
  {questions.map(item=><section key={item.key} className="ci-catchup-item">
   <div className="ci-catchup-title">
    {urls[item.photoPaths[0]]&&<img src={urls[item.photoPaths[0]]} alt=""/>}
    <div><h2>{item.title}</h2><Link to={'/draft/'+item.runId+'?object='+item.index}>Open the item</Link>{item.saved&&<span> · saved</span>}</div>
   </div>
   <QuestionsScreen questions={item.questions}
    photoFor={(n:number|null)=>{const p=n&&n>0?item.photoPaths[n-1]:undefined;return p&&urls[p]?{url:urls[p],number:n as number}:null}}
    busy={busyKey!==null} onSubmit={(a,note)=>void answer(item,a,note)} onSkip={()=>void answer(item,null,'')}/>
  </section>)}
  {!loading&&!questions.length&&!needs.length&&!ready.length&&!working&&<p className="ci-result-note">Everything is up to date.</p>}
 </div>
}
