import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Item } from '../types'
import {catalogueSaleLabel,provisionalMoney} from '../lib/catalogueSaleState'

export default function Sales() {
  const [items,setItems]=useState<Item[]>([])
  const [error,setError]=useState(''),[reload,setReload]=useState(0)
  useEffect(()=>{let alive=true;setError('');void(async()=>{const auth=await supabase.auth.getUser();if(!alive)return;if(auth.error||!auth.data.user){setError('Sign in to read the selling pipeline.');return}const read=await supabase.from('items').select('*').eq('owner_id',auth.data.user.id).neq('status','ARCHIVED').order('updated_at',{ascending:false});if(!alive)return;if(read.error||!read.data){setItems([]);setError('Selling pipeline unavailable. Reload to recover saved records.');return}setItems(read.data as Item[])})();return()=>{alive=false}},[reload])
  return <div><div className="pageHeader"><div className="eyebrow">SELL FAST</div><h1>Sales pipeline</h1><p>Keep price, route, listing and actual outcome distinct.</p></div>
    <p className="ci-page-meta">Earlier catalogue flags and model estimates do not establish sale readiness, a recommended route or publication. Open an object to review its research and final decision.</p>
    {error&&<p role="alert">{error}<button className="secondaryButton" onClick={()=>setReload(n=>n+1)}>Reload selling pipeline</button></p>}
    {!error&&<div className="tableWrap panel"><table><thead><tr><th>Item</th><th>Research decision</th><th>Earlier venue suggestion</th><th>Fast cash · provisional</th><th>Balanced · provisional</th><th>Earlier net · unverified</th></tr></thead><tbody>{items.map(i=><tr key={i.id}><td><Link to={`/item/${i.id}`}>{i.item_code} · {i.title||i.object_type}</Link></td><td>{catalogueSaleLabel(i)}</td><td>{i.best_venue?`${i.best_venue} · review required`:'Not established'}</td><td>{provisionalMoney(i.quick_sale_value,i.currency)}</td><td>{provisionalMoney(i.balanced_value_low,i.currency)}–{provisionalMoney(i.balanced_value_high,i.currency)}</td><td>{provisionalMoney(i.expected_net,i.currency)}</td></tr>)}</tbody></table></div>}
  </div>
}
