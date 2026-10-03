import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Item } from '../types'
import { money } from '../lib/format'

export default function Sales() {
  const [items,setItems]=useState<Item[]>([])
  useEffect(()=>{supabase.from('items').select('*').in('status',['READY_TO_SELL','LISTED','CONSIGNED','SOLD']).order('updated_at',{ascending:false}).then(({data})=>setItems((data||[]) as Item[]))},[])
  return <div><div className="pageHeader"><div className="eyebrow">SELL FAST</div><h1>Sales pipeline</h1><p>Keep price, route, listing and actual outcome distinct.</p></div>
    <div className="tableWrap panel"><table><thead><tr><th>Item</th><th>Status</th><th>Readiness</th><th>Best venue</th><th>Fast cash</th><th>Balanced</th><th>Expected net</th></tr></thead>
    <tbody>{items.map(i=><tr key={i.id}><td><Link to={`/item/${i.id}`}>{i.item_code} · {i.current_attribution||i.title||i.object_type}</Link></td><td>{i.status.replaceAll('_',' ')}</td><td>{i.sale_readiness?.replaceAll('_',' ')||'—'}</td><td>{i.best_venue||'—'}</td><td>{money(i.quick_sale_value)}</td><td>{money(i.balanced_value_low)}–{money(i.balanced_value_high)}</td><td>{money(i.expected_net)}</td></tr>)}</tbody></table></div>
  </div>
}
