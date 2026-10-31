import {useEffect,useMemo,useState} from 'react'
import {Link} from 'react-router-dom'
import {Check,Download,Undo2} from 'lucide-react'
import {supabase} from '../lib/supabase'
import {listingPhotoPaths,readExtraPhotos,readPhotoOrders} from '../lib/extraPhotos'
import {ebayBatchCsv,ebayBatchProblems} from '../lib/ebayBatch'
import type {EbayBatchRow} from '../lib/ebayBatch'
import {Section} from '../components/ResultScreen'

// eBay batch (Dean, 31 Oct): finish each saved item here, sign it off, then
// download one file for eBay Seller Hub that puts the batch in eBay Drafts.
// Nothing is published by CI; the signed-off state lives in the listings table.
type Row={
 itemId:string;ownerId:string;code:string;itemTitle:string;runId:string|null;index:number|null
 title:string;price:number|null;description:string;categoryPath:string;categoryId:string;format:'FixedPrice'|'Auction'
 listingId:string|null;status:'TODO'|'READY'|'SENT';thumb:string;hasResearch:boolean;specifics:any
}
type Tab='TODO'|'READY'|'SENT'
const WEEK=7*24*3600

export default function EbayBatch(){
 const [rows,setRows]=useState<Row[]>([])
 const [loading,setLoading]=useState(true)
 const [message,setMessage]=useState('')
 const [tab,setTab]=useState<Tab>('TODO')
 const [busy,setBusy]=useState<string|null>(null)
 const [picked,setPicked]=useState<string[]>([])
 const [reload,setReload]=useState(0)

 useEffect(()=>{let live=true;(async()=>{
  setLoading(true);setMessage('')
  try{
   const {data:{session}}=await supabase.auth.getSession()
   if(!session)throw Error('Sign in again.')
   const uid=session.user.id
   const [items,research,listings]=await Promise.all([
    supabase.from('items').select('id,owner_id,item_code,title,object_type,status,source_analysis_run_id,source_object_index').eq('owner_id',uid).order('created_at',{ascending:false}).limit(500),
    supabase.from('ai_analysis_runs').select('id,created_at,user_context,stage:result->>analysis_stage,listing:result->listing,specifics:result->specifics').eq('owner_id',uid).eq('mode','research').order('created_at',{ascending:false}).limit(1500),
    supabase.from('listings').select('id,item_id,listing_status,platform_title,description,asking_price,item_specifics').eq('owner_id',uid).eq('platform','EBAY')
   ])
   for(const r of [items,research,listings])if(r.error)throw Error(r.error.message)
   const latest=new Map<string,any>()
   for(const r of research.data||[]){
    if(r.stage!=='COMPLETE'||!r.listing)continue
    const pair=Array.isArray(r.user_context?.pair_source_indices)&&r.user_context.pair_source_indices.length===2
    const key=r.user_context?.source_analysis_run_id+':'+(pair?'pair':r.user_context?.source_object_index)
    if(!latest.has(key))latest.set(key,r)
   }
   const byItem=new Map((listings.data||[]).map((l:any)=>[l.item_id,l]))
   const idForPath=new Map<string,string>()
   for(const l of listings.data||[]){const s=l.item_specifics||{};if(s.ebay_category_path&&s.ebay_category_id)idForPath.set(s.ebay_category_path,s.ebay_category_id)}
   const live_=(items.data||[]).filter((i:any)=>i.status!=='SOLD'&&i.status!=='ARCHIVED')
   // Main photo per item, in the owner's photo order.
   const photos=live_.length?await supabase.from('item_photos').select('item_id,storage_path,position').in('item_id',live_.map((i:any)=>i.id)).order('position'):{data:[],error:null}
   if(photos.error)throw Error(photos.error.message)
   const runIds=[...new Set(live_.map((i:any)=>i.source_analysis_run_id).filter(Boolean))] as string[]
   const orders=await readPhotoOrders(supabase,runIds)
   const extra=(await readExtraPhotos(supabase,runIds)).rows
   const mainPath=new Map<string,string>()
   for(const i of live_){
    const ps=(photos.data||[]).filter((p:any)=>p.item_id===i.id)
    const ex=extra.filter(e=>e.run_id===i.source_analysis_run_id&&e.object_index===i.source_object_index)
    const row=orders.find((o:any)=>o.run_id===i.source_analysis_run_id&&(o.scope===String(i.source_object_index)||o.scope==='pair'))
    const first=listingPhotoPaths(ps,ex,row)[0];if(first)mainPath.set(i.id,first)
   }
   const paths=[...mainPath.values()]
   const signed=paths.length?await supabase.storage.from('item-images').createSignedUrls(paths,3600):{data:[],error:null}
   const urlFor=new Map((signed.data||[]).map((s:any)=>[s.path,s.signedUrl]))
   const out:Row[]=live_.map((i:any)=>{
    const r=latest.get(i.source_analysis_run_id+':'+i.source_object_index)||latest.get(i.source_analysis_run_id+':pair')
    const l:any=byItem.get(i.id);const s=l?.item_specifics||{}
    const path=String(r?.listing?.ebay_category||s.ebay_category_path||'')
    return {itemId:i.id,ownerId:i.owner_id,code:i.item_code,itemTitle:i.title||i.object_type||'Item',runId:i.source_analysis_run_id,index:i.source_object_index,
     title:String(l?.platform_title??r?.listing?.ebay_title??i.title??'').slice(0,80),
     price:typeof l?.asking_price==='number'?l.asking_price:Number.isFinite(Number(l?.asking_price))&&l?.asking_price!==null?Number(l.asking_price):typeof r?.listing?.price==='number'?r.listing.price:null,
     description:String(l?.description??r?.listing?.description??''),categoryPath:path,
     categoryId:String(s.ebay_category_id||idForPath.get(path)||''),format:(s.format||r?.listing?.sale_format)==='AUCTION'||s.format==='Auction'?'Auction':'FixedPrice',
     listingId:l?.id||null,status:l?.listing_status==='READY'?(s.exported_at?'SENT':'READY'):'TODO',
     thumb:urlFor.get(mainPath.get(i.id)||'')||'',hasResearch:!!r,specifics:r?.specifics||null}
   })
   if(live)setRows(out)
  }catch(e:any){if(live)setMessage('Could not load your items: '+(e?.message||'unknown error'))}
  finally{if(live)setLoading(false)}
 })();return()=>{live=false}},[reload])

 const shown=useMemo(()=>rows.filter(r=>r.status===tab),[rows,tab])
 const set=(id:string,patch:Partial<Row>)=>setRows(v=>v.map(r=>r.itemId===id?{...r,...patch}:r))
 const asBatchRow=(r:Row,urls:string[]=r.thumb?[r.thumb]:[]):EbayBatchRow=>({sku:r.code,categoryId:r.categoryId.trim(),title:r.title,price:r.price,photoUrls:urls,condition:'USED',description:r.description,format:r.format})

 const save=async(r:Row,status:'READY'|'DRAFT',extra:Record<string,unknown>={})=>{
  setBusy(r.itemId);setMessage('')
  try{
   const specifics={ebay_category_id:r.categoryId.trim(),ebay_category_path:r.categoryPath,format:r.format,item_details:r.specifics,signed_off_at:status==='READY'?new Date().toISOString():null,...extra}
   const fields={platform_title:r.title.trim(),description:r.description,asking_price:r.price,currency:'GBP',listing_status:status,canonical_title:r.itemTitle,category:r.categoryPath||null,item_specifics:specifics}
   const res=r.listingId
    ?await supabase.from('listings').update(fields).eq('id',r.listingId).select('id').single()
    :await supabase.from('listings').insert({owner_id:r.ownerId,item_id:r.itemId,platform:'EBAY',...fields}).select('id').single()
   if(res.error||!res.data)throw Error(res.error?.message||'not confirmed')
   set(r.itemId,{listingId:res.data.id,status:status==='READY'?(extra.exported_at?'SENT':'READY'):'TODO'})
  }catch(e:any){setMessage(r.code+' not saved: '+(e?.message||'unknown error'))}
  finally{setBusy(null)}
 }

 const download=async()=>{
  const batch=rows.filter(r=>r.status==='READY'&&picked.includes(r.itemId))
  if(!batch.length){setMessage('Tick the items to put in this file.');return}
  setBusy('download');setMessage('')
  try{
   // Every photo, in the owner's order, as links eBay can fetch for 7 days.
   const photos=await supabase.from('item_photos').select('item_id,storage_path,position').in('item_id',batch.map(r=>r.itemId)).order('position')
   if(photos.error)throw Error(photos.error.message)
   const runIds=[...new Set(batch.map(r=>r.runId).filter(Boolean))] as string[]
   const orders=await readPhotoOrders(supabase,runIds)
   const extra=(await readExtraPhotos(supabase,runIds)).rows
   const rowsOut:EbayBatchRow[]=[]
   for(const r of batch){
    const ps=(photos.data||[]).filter((p:any)=>p.item_id===r.itemId)
    const ex=extra.filter(e=>e.run_id===r.runId&&e.object_index===r.index)
    const paths=listingPhotoPaths(ps,ex,orders.find((o:any)=>o.run_id===r.runId&&(o.scope===String(r.index)||o.scope==='pair')))
    const signed=paths.length?await supabase.storage.from('item-images').createSignedUrls(paths.slice(0,24),WEEK):{data:[],error:null}
    if(signed.error)throw Error(signed.error.message)
    rowsOut.push(asBatchRow(r,(signed.data||[]).map((s:any)=>s.signedUrl).filter(Boolean)))
   }
   const csv=ebayBatchCsv(rowsOut)
   const blob=new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8'})
   const a=document.createElement('a');a.href=URL.createObjectURL(blob)
   a.download='ebay-drafts-'+new Date().toISOString().slice(0,10)+'-'+batch.length+'-items.csv'
   document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(a.href)
   const at=new Date().toISOString()
   for(const r of batch)await save(r,'READY',{exported_at:at})
   setPicked([]);setMessage('File downloaded with '+batch.length+' item'+(batch.length===1?'':'s')+'. Upload it to eBay within 7 days (the photo links last 7 days).')
  }catch(e:any){setMessage('File not made: '+(e?.message||'unknown error'))}
  finally{setBusy(null)}
 }

 const count=(t:Tab)=>rows.filter(r=>r.status===t).length
 return <div className="ci-ebay">
  <div className="pageHeader"><div><h1>eBay batch</h1><p>Finish each item, sign it off, then download one file for eBay.</p></div></div>
  <div className="ci-ebay-tabs" role="tablist">
   {([['TODO','To finish'],['READY','Signed off'],['SENT','Sent to eBay']] as const).map(([k,l])=>
    <button key={k} type="button" role="tab" aria-selected={tab===k} className={'ci-big-button'+(tab===k?' is-chosen':'')} onClick={()=>{setTab(k);setPicked([])}}>{l} · {count(k)}</button>)}
  </div>
  {message&&<p className="ci-result-note ci-run-failed" role="status">{message}</p>}
  {loading&&<p className="ci-result-note">Loading your items…</p>}
  {tab==='READY'&&count('READY')>0&&<div className="ci-ebay-download">
   <label className="ci-ebay-all"><input type="checkbox" checked={picked.length===shown.length&&shown.length>0} onChange={e=>setPicked(e.target.checked?shown.map(r=>r.itemId):[])}/>Choose all {shown.length}</label>
   <button type="button" className="ci-big-button ci-big-button-primary" disabled={!picked.length||busy!==null} onClick={()=>void download()}>
    <Download size={22} aria-hidden="true"/>{busy==='download'?'Making the file…':'Download eBay file · '+picked.length}</button>
   <Section title="How to send the file to eBay">
    <ol className="ci-ebay-steps">
     <li>Open eBay Seller Hub, then <strong>Reports</strong>, then <strong>Uploads</strong>.</li>
     <li>Press <strong>Upload template</strong> and choose the file you downloaded.</li>
     <li>When it finishes, open your eBay <strong>Drafts</strong>: each item is there to check (postage, returns, condition) and list.</li>
    </ol>
   </Section>
  </div>}
  {!loading&&!shown.length&&<p className="ci-result-note">{tab==='TODO'?'Nothing to finish. Saved items appear here.':tab==='READY'?'Nothing signed off yet.':'Nothing sent yet.'}</p>}
  <div className="ci-ebay-list">{shown.map(r=>{const problems=ebayBatchProblems(asBatchRow(r));const locked=r.status!=='TODO';return <article key={r.itemId} className="ci-ebay-row">
   <div className="ci-ebay-thumb">{tab==='READY'&&<input type="checkbox" aria-label={'Put '+r.code+' in the file'} checked={picked.includes(r.itemId)} onChange={e=>setPicked(v=>e.target.checked?[...v,r.itemId]:v.filter(x=>x!==r.itemId))}/>}
    {r.thumb?<img src={r.thumb} alt=""/>:<span>No photo</span>}</div>
   <div className="ci-ebay-fields">
    <div className="ci-ebay-head"><Link to={'/item/'+r.itemId}>{r.code}</Link>{!r.hasResearch&&<span className="ci-ebay-warn">No research yet</span>}</div>
    <label>eBay title · {r.title.length}/80<input value={r.title} maxLength={80} disabled={locked} onChange={e=>set(r.itemId,{title:e.target.value})}/></label>
    <div className="ci-ebay-two">
     <label>Price £<input inputMode="decimal" value={r.price??''} disabled={locked} onChange={e=>{const n=Number(e.target.value);set(r.itemId,{price:e.target.value===''||!Number.isFinite(n)?null:n})}}/></label>
     <label>Format<select value={r.format} disabled={locked} onChange={e=>set(r.itemId,{format:e.target.value as Row['format']})}><option value="FixedPrice">Buy it now</option><option value="Auction">Auction</option></select></label>
    </div>
    <label>eBay category number{r.categoryPath&&<small>Suggested: {r.categoryPath}</small>}
     <input inputMode="numeric" value={r.categoryId} disabled={locked} placeholder="e.g. 262" onChange={e=>set(r.itemId,{categoryId:e.target.value.replace(/[^0-9]/g,'')})}/></label>
    <details className="ci-ebay-desc"><summary>Description</summary><textarea rows={8} value={r.description} disabled={locked} onChange={e=>set(r.itemId,{description:e.target.value})}/></details>
    {r.status==='TODO'&&problems.length>0&&<p className="ci-ebay-warn">To finish: {problems.join(', ')}</p>}
    <div className="ci-result-actions">
     {r.status==='TODO'&&<button type="button" className="ci-big-button ci-big-button-primary" disabled={problems.length>0||busy!==null} onClick={()=>void save(r,'READY')}><Check size={22} aria-hidden="true"/>{busy===r.itemId?'Saving…':'Sign off'}</button>}
     {r.status!=='TODO'&&<button type="button" className="ci-big-button" disabled={busy!==null} onClick={()=>void save(r,'DRAFT',{exported_at:null})}><Undo2 size={22} aria-hidden="true"/>Back to finishing</button>}
    </div>
   </div>
  </article>})}</div>
 </div>
}
