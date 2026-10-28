import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Item } from '../types'
import {catalogueSaleLabel} from '../lib/catalogueSaleState'
import {FRESH_START_AT} from '../lib/freshCollection'

export default function Sales() {
  const [items,setItems]=useState<Item[]>([])
  const [error,setError]=useState(''),[reload,setReload]=useState(0)
  useEffect(()=>{let alive=true;setError('');void(async()=>{const auth=await supabase.auth.getUser();if(!alive)return;if(auth.error||!auth.data.user){setError('Sign in to read the selling pipeline.');return}const read=await supabase.from('items').select('*').eq('owner_id',auth.data.user.id).gte('created_at',FRESH_START_AT).neq('status','ARCHIVED').order('updated_at',{ascending:false});if(!alive)return;if(read.error||!read.data){setItems([]);setError('Selling pipeline unavailable. Reload to recover saved records.');return}setItems(read.data as Item[])})();return()=>{alive=false}},[reload])
  return <div><div className="pageHeader"><div className="eyebrow">SELL FAST</div><h1>Sell</h1><p>Choose a current item to prepare its listing.</p></div>
    {error&&<p role="alert">{error}<button className="secondaryButton" onClick={()=>setReload(n=>n+1)}>Reload selling pipeline</button></p>}
    {!error&&<div className="tableWrap panel"><table><thead><tr><th>Item</th><th>Research decision</th><th>Next step</th></tr></thead><tbody>{items.map(i=><tr key={i.id}><td><Link to={`/item/${i.id}?tab=sales`}>{i.item_code} · {i.title||i.object_type}</Link></td><td>{catalogueSaleLabel(i)}</td><td><Link to={`/item/${i.id}?tab=overview`} className="primaryButton inlineButton">Open answer</Link></td></tr>)}</tbody></table></div>}
  </div>
}
