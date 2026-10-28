import {useEffect,useState} from 'react'
import {Link} from 'react-router-dom'
import {supabase} from '../lib/supabase'
import type {Item} from '../types'
import {FRESH_START_AT,isLegacyCreatedAt} from '../lib/freshCollection'

type SavedReport={id:string;mode:string;status:string;created_at:string;result:any;input_photo_count:number}
export default function Archive(){
 const [items,setItems]=useState<Item[]>([])
 const [reports,setReports]=useState<SavedReport[]>([])
 const [error,setError]=useState('')
 const [loading,setLoading]=useState(true)
 const [reload,setReload]=useState(0)
 useEffect(()=>{
  let active=true
  void(async()=>{
   setLoading(true);setError('')
   try{
    const auth=await supabase.auth.getUser()
    if(auth.error||!auth.data.user)throw Error('Please sign in again.')
    const owner=auth.data.user.id
    const [itemRead,reportRead]=await Promise.all([
     supabase.from('items').select('*',{count:'exact'}).eq('owner_id',owner).order('created_at',{ascending:false}).limit(500),
     supabase.from('ai_analysis_runs').select('id,mode,status,created_at,result,input_photo_count',{count:'exact'})
      .eq('owner_id',owner).in('mode',['single','batch']).eq('status','DRAFT').order('created_at',{ascending:false}).limit(500)
    ])
    if(itemRead.error||reportRead.error||!itemRead.data||!reportRead.data||
     itemRead.count===null||reportRead.count===null||
     itemRead.count>500||reportRead.count>500||itemRead.data.length!==itemRead.count||reportRead.data.length!==reportRead.count)
     throw Error('The full archive could not be confirmed. Reload to recover it.')
    if(!active)return
    setItems((itemRead.data as Item[]).filter(i=>isLegacyCreatedAt(i.created_at)||i.status==='ARCHIVED'))
    setReports((reportRead.data as SavedReport[]).filter(r=>isLegacyCreatedAt(r.created_at)))
   }catch(e){if(active)setError(e instanceof Error?e.message:'Archive could not be read.')}
   finally{if(active)setLoading(false)}
  })()
  return()=>{active=false}
 },[reload])
 return <div className="ci-archive-page">
  <header className="pageHeader"><div><h1>Archive</h1><p>Earlier objects and research, kept safely.</p></div></header>
  {loading&&<p role="status">Opening archive…</p>}
  {error&&<div role="alert">{error} <button className="secondaryButton" onClick={()=>setReload(n=>n+1)}>Retry</button></div>}
  {!loading&&!error&&<>
   <section className="panel"><h2>Earlier collection · {items.length}</h2>
    {items.length? <div className="ci-archive-links">{items.map(item=><Link key={item.id} to={'/item/'+item.id}>{item.title||item.object_type||item.item_code} <small>{item.item_code}</small></Link>)}</div>:<p>No earlier catalogue items.</p>}
   </section>
   <section className="panel"><h2>Unfinished earlier reports · {reports.length}</h2>
    {reports.length?<div className="ci-archive-links">{reports.flatMap(run=>{
     const objects=Array.isArray(run.result?.objects)?run.result.objects:[]
     return objects.length?objects.map((o:any,index:number)=><Link key={run.id+':'+index} to={'/draft/'+run.id+'?object='+index}>
      {o.working_title||o.object_type||'Saved object'} <small>Open original research</small></Link>):
      [<Link key={run.id} to={'/uploads/'+run.id}>{run.input_photo_count} saved photographs <small>Unfinished upload</small></Link>]
    })}</div>:<p>No unfinished earlier reports.</p>}
   </section>
  </>}
 </div>
}
