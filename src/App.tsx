import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Session } from '@supabase/supabase-js'
import Sidebar from './components/Sidebar'
import { supabase } from './lib/supabase'
import Dashboard from './pages/Dashboard'
import Inventory from './pages/Inventory'
import NewItem from './pages/NewItem'
import ItemDetail from './pages/ItemDetail'
import Research from './pages/Research'
import Sales from './pages/Sales'
import Contacts from './pages/Contacts'
import Reports from './pages/Reports'
import Login from './pages/Login'
import AIIntake from './pages/AIIntake'
import SavedDraft from './pages/SavedDraft'

export default function App() {
  const [session,setSession] = useState<Session|null>(null)
  const [ready,setReady] = useState(false)

  useEffect(()=>{
    supabase.auth.getSession().then(({data})=>{setSession(data.session);setReady(true)})
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_event,s)=>setSession(s))
    return ()=>subscription.unsubscribe()
  },[])

  if (!ready) return <div className="bootScreen">Collector Intelligence</div>
  if (!session) return <Login/>

  return (
    <div className="appShell">
      <Sidebar/>
      <main className="mainContent">
        <aside aria-label="Collector Intelligence brand vision" style={{
          position:'sticky',top:0,zIndex:15,background:'rgba(17,23,28,0.97)',
          border:'1px solid rgba(203,163,83,0.28)',borderRadius:10,
          padding:'10px 14px',marginBottom:18,boxShadow:'0 3px 12px rgba(0,0,0,0.14)'
        }}>
          <div style={{fontSize:10,fontWeight:800,letterSpacing:'0.15em',color:'#dcb765',marginBottom:4}}>OUR STANDARD</div>
          <p style={{fontSize:'clamp(12px,1.05vw,14px)',lineHeight:1.45,margin:0,color:'#e8edf0'}}>
            Collector Intelligence is a premium, evidence-led technology platform — combining the precision of a specialist appraisal laboratory, the trustworthiness of an established auction house, and the intelligence of modern AI software.
          </p>
        </aside>
        <Routes>
          <Route path="/" element={<Dashboard/>}/>
          <Route path="/inventory" element={<Inventory/>}/>
          <Route path="/new" element={<NewItem/>}/>
          <Route path="/intake" element={<AIIntake/>}/>
          <Route path="/draft/:id" element={<SavedDraft/>}/>
          <Route path="/item/:id" element={<ItemDetail/>}/>
          <Route path="/research" element={<Research/>}/>
          <Route path="/sales" element={<Sales/>}/>
          <Route path="/contacts" element={<Contacts/>}/>
          <Route path="/reports" element={<Reports/>}/>
          <Route path="*" element={<Navigate to="/" replace/>}/>
        </Routes>
      </main>
    </div>
  )
}
