import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Session } from '@supabase/supabase-js'
import {applyAppearance,storedAppearance,type Appearance} from './lib/appearance'
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
import SavedIntakes from './pages/SavedIntakes'

export default function App() {
  const [session,setSession] = useState<Session|null>(null)
  const [ready,setReady] = useState(false)
  const [appearance,setAppearance] = useState<Appearance>(storedAppearance)
  useEffect(()=>applyAppearance(appearance),[appearance])

  useEffect(()=>{
    supabase.auth.getSession().then(({data})=>{setSession(data.session);setReady(true)})
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_event,s)=>setSession(s))
    return ()=>subscription.unsubscribe()
  },[])

  if (!ready) return <div className="bootScreen">Collector Intelligence</div>
  if (!session) return <Login/>

  return (
    <div className="appShell" key={session.user.id}>
      <Sidebar appearance={appearance} onToggleAppearance={()=>setAppearance(v=>v==='dark'?'light':'dark')}/>
      <main className="mainContent">
        <Routes>
          <Route path="/" element={<Dashboard/>}/>
          <Route path="/inventory" element={<Inventory/>}/>
          <Route path="/new" element={<NewItem/>}/>
          <Route path="/intake" element={<AIIntake/>}/>
          <Route path="/uploads" element={<SavedIntakes/>}/>
          <Route path="/uploads/:id" element={<SavedIntakes/>}/>
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
