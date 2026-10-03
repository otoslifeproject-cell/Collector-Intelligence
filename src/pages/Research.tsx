import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Research() {
  const [tasks,setTasks]=useState<any[]>([])
  useEffect(()=>{supabase.from('research_tasks').select('*,items(item_code,title,current_attribution)').order('information_value',{ascending:false}).then(({data})=>setTasks(data||[]))},[])
  return <div><div className="pageHeader"><div className="eyebrow">RESEARCH QUEUE</div><h1>Highest-value next evidence</h1><p>Research effort should be driven by information value, not curiosity alone.</p></div>
  <div className="panel">{tasks.length===0?<div className="empty">No research tasks yet. The first five-item run will create these when another photo, measurement or test materially matters.</div>:
  <div className="tableWrap"><table><thead><tr><th>Item</th><th>Task</th><th>Type</th><th>Information value</th><th>Status</th></tr></thead><tbody>{tasks.map(t=><tr key={t.id}><td>{t.items?.item_code}</td><td>{t.title}</td><td>{t.task_type||'—'}</td><td>{t.information_value??'—'}</td><td>{t.status}</td></tr>)}</tbody></table></div>}</div></div>
}
