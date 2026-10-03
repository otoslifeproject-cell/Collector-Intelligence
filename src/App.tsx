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
        <Routes>
          <Route path="/" element={<Dashboard/>}/>
          <Route path="/inventory" element={<Inventory/>}/>
          <Route path="/new" element={<NewItem/>}/>
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
