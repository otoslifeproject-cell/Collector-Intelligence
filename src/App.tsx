import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Session } from '@supabase/supabase-js'
import {applyAppearance,storedAppearance,type Appearance} from './lib/appearance'
import Sidebar from './components/Sidebar'
import { supabase, supabaseConfigured } from './lib/supabase'
import Dashboard from './pages/Dashboard'
import Inventory from './pages/Inventory'
import NewItem from './pages/NewItem'
import ItemDetail from './pages/ItemDetail'
import Research from './pages/Research'
import Sales from './pages/Sales'
import Contacts from './pages/Contacts'
import Reports from './pages/Reports'
import Login from './pages/Login'
import PasswordRecovery from './pages/PasswordRecovery'
import AIIntake from './pages/AIIntake'
import SavedDraft from './pages/SavedDraft'
import SavedIntakes from './pages/SavedIntakes'
import LotOptimiser from './pages/LotOptimiser'

export default function App() {
  const [session,setSession] = useState<Session|null>(null)
  const [ready,setReady] = useState(false)
  const [authError,setAuthError] = useState(false)
  const [passwordRecovery,setPasswordRecovery] = useState(false)
  const [appearance,setAppearance] = useState<Appearance>(storedAppearance)
  useEffect(()=>applyAppearance(appearance),[appearance])

  useEffect(()=>{
    if (!supabaseConfigured) { setReady(true); return }
    let active = true
    supabase.auth.getSession().then(({data,error})=>{
      if (!active) return
      if (error) setAuthError(true)
      else setSession(data.session)
    }).catch(()=>{if (active) setAuthError(true)}).finally(()=>{if (active) setReady(true)})
    const {data:{subscription}} = supabase.auth.onAuthStateChange((event,s)=>{setSession(s);if(event==='PASSWORD_RECOVERY')setPasswordRecovery(true)})
    return ()=>{active=false;subscription.unsubscribe()}
  },[])

  if (!supabaseConfigured) return <div className="loginPage"><div className="loginPanel" role="alert"><div className="eyebrow">COLLECTION OS · PREVIEW SETUP</div><h1>Collector Intelligence</h1><p>This test deployment is awaiting an isolated Supabase connection. Your live collection has not been connected.</p><p>Configure Preview-only Supabase URL and publishable key, then redeploy to enable owner sign-in.</p></div></div>
  if (!ready) return <div className="bootScreen">Collector Intelligence</div>
  if (authError) return <div className="loginPage"><div className="loginPanel" role="alert"><h1>Sign-in service unavailable</h1><p>The authentication session could not be checked. No collection data has been loaded. Please refresh or contact the owner administrator.</p></div></div>
  if (!session) return <Login/>
  if (passwordRecovery) return <PasswordRecovery onDone={()=>setPasswordRecovery(false)}/>

  return (
    <div className="appShell" key={session.user.id}>
      <Sidebar appearance={appearance} onToggleAppearance={()=>setAppearance(v=>v==='dark'?'light':'dark')}/>
      <main className="mainContent">
        <Routes>
          <Route path="/" element={<Dashboard/>}/>
          <Route path="/inventory" element={<Inventory/>}/>
          <Route path="/new" element={<Navigate to="/intake" replace/>}/>
          <Route path="/intake" element={<AIIntake/>}/>
          <Route path="/uploads" element={<SavedIntakes/>}/>
          <Route path="/uploads/:id" element={<SavedIntakes/>}/>
          <Route path="/draft/:id" element={<SavedDraft/>}/>
          <Route path="/item/:id" element={<ItemDetail/>}/>
          <Route path="/research" element={<Research/>}/>
          <Route path="/sales" element={<Sales/>}/>
          <Route path="/lots" element={<LotOptimiser/>}/>
          <Route path="/contacts" element={<Contacts/>}/>
          <Route path="/reports" element={<Reports/>}/>
          <Route path="*" element={<Navigate to="/" replace/>}/>
        </Routes>
      </main>
    </div>
  )
}
