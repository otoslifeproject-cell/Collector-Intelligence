import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Contacts() {
  const [rows,setRows]=useState<any[]>([])
  useEffect(()=>{supabase.from('contacts').select('*').order('name').then(({data})=>setRows(data||[]))},[])
  return <div><div className="pageHeader"><div className="eyebrow">BUYERS & ROUTES</div><h1>Contacts & specialists</h1><p>Separate actual buyer matches from general specialist routes.</p></div>
    <div className="panel">{rows.length===0?<div className="empty">No contacts yet. Verified auction houses, specialist dealers, collectors and societies can be logged here.</div>:
    <div className="tableWrap"><table><thead><tr><th>Name</th><th>Type</th><th>Geography</th><th>Wanted capability</th><th>Last verified</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{r.name}</td><td>{r.contact_type}</td><td>{r.geography||'—'}</td><td>{r.wanted_capability?'Yes':'—'}</td><td>{r.last_verified||'—'}</td></tr>)}</tbody></table></div>}</div>
  </div>
}
