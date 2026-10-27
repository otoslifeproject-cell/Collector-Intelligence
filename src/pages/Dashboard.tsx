import {useEffect,useState} from 'react'
import {Link} from 'react-router-dom'
import {ArrowRight,Camera,FolderOpen,Search,Tag,ShieldCheck,RefreshCw} from 'lucide-react'
import {supabase} from '../lib/supabase'
import type {Item} from '../types'

type Mode='loading'|'ready'|'error'
export default function Dashboard(){
 const [items,setItems]=useState<Item[]>([])
 const [mode,setMode]=useState<Mode>('loading')
 const [message,setMessage]=useState('')
 const [retry,setRetry]=useState(0)
 useEffect(()=>{
  let active=true
  const load=async()=>{
   setMode('loading');setMessage('')
   try{
    const {data:{user},error:authError}=await supabase.auth.getUser()
    if(authError||!user)throw new Error('Your session needs refreshing. Sign in again.')
    const {data,error}=await supabase.from('items').select('*').eq('owner_id',user.id).neq('status','ARCHIVED').order('updated_at',{ascending:false}).limit(24)
    if(error||!data)throw new Error('The collection could not be loaded. Your saved records have not been changed.')
    if(active){setItems(data as Item[]);setMode('ready')}
   }catch(error){if(active){setMessage(error instanceof Error?error.message:'Could not load your collection.');setMode('error')}}
  }
  void load()
  return()=>{active=false}
 },[retry])
 const latest=items[0]
 const incomplete=items.filter(i=>i.status!=='SOLD'&&i.status!=='ARCHIVED')
 const actions=[
  {label:'Add item',description:'Add photographs and start research',url:'/intake',Icon:Camera},
  {label:'Collection',description:'Browse your objects',url:'/inventory',Icon:FolderOpen},
  {label:'Research',description:'Continue saved investigations',url:'/research',Icon:Search},
  {label:'Sell',description:'Plan a realistic sale',url:'/sales',Icon:Tag}
 ]
 return <div className="ci-home">
  <header className="ci-home-header">
   <div><div className="ci-home-kicker">COLLECTOR INTELLIGENCE</div><h1>What would you like to do?</h1><p>One object at a time. Your research and photographs stay connected.</p></div>
   <div className="ci-home-private"><ShieldCheck size={16}/> Private workspace</div>
  </header>
  <nav className="ci-home-actions" aria-label="Start an activity">
   {actions.map(({label,description,url,Icon})=><Link key={label} to={url} className="ci-home-action">
    <span className="ci-home-action-icon"><Icon size={26}/></span>
    <span><strong>{label}</strong><small>{description}</small></span><ArrowRight className="ci-home-arrow" size={19}/>
   </Link>)}
  </nav>
  {mode==='error'&&<section className="ci-home-alert" role="alert"><p>{message}</p><button className="secondaryButton" onClick={()=>setRetry(v=>v+1)}><RefreshCw size={16}/> Retry</button></section>}
  {mode==='loading'&&<p role="status" className="ci-home-loading">Opening your collection…</p>}
  {mode==='ready'&&<section className="ci-home-continue" aria-label="Continue your work">
   <div className="ci-home-section-heading"><div><span>CONTINUE</span><h2>{latest?'Pick up where you left off':'Your first object'}</h2></div><Link to="/inventory">View collection <ArrowRight size={16}/></Link></div>
   {latest?<Link className="ci-home-feature" to={`/item/${latest.id}`}>
    <span className="ci-home-object-mark">{latest.item_code}</span>
    <span className="ci-home-object-copy"><strong>{latest.title||latest.object_type||'Unidentified object'}</strong><small>{latest.maker||'Maker not yet established'} · {latest.status==='SOLD'?'Sold':'Research and sale decisions remain subject to review'}</small></span>
    <span className="ci-home-resume">Continue <ArrowRight size={18}/></span>
   </Link>:<div className="ci-home-empty"><p>No catalogue objects yet. Begin with photographs of one item.</p><Link className="primaryButton inlineButton" to="/intake">Add your first object</Link></div>}
   {items.length>0&&<p className="ci-home-footnote">{items.length} recent objects · {incomplete.length} not recorded sold · Values require verified evidence</p>}
  </section>}
  <details className="ci-home-advanced"><summary>Saved uploads and tools</summary><div><Link to="/uploads">Saved photo sessions</Link><Link to="/lots">Lot optimiser</Link><Link to="/reports">Reports</Link><Link to="/contacts">Contacts</Link></div></details>
 </div>
}
