import {FormEvent,useState} from 'react'
import {supabase} from '../lib/supabase'

export default function PasswordRecovery({onDone}:{onDone:()=>void}){
  const [password,setPassword]=useState('')
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const submit=async(e:FormEvent)=>{
    e.preventDefault()
    if(busy)return
    setBusy(true);setMessage('')
    try{
      const {error}=await supabase.auth.updateUser({password})
      if(error){setMessage(error.message);return}
      setPassword('')
      onDone()
    }catch{setMessage('Password update could not be confirmed. Please try again.')}
    finally{setBusy(false)}
  }
  return <div className="loginPage"><div className="loginPanel">
    <div className="eyebrow">COLLECTOR INTELLIGENCE</div>
    <h1>Set a new password</h1>
    <p>Your original collection remains with this account.</p>
    <form onSubmit={submit}>
      <label>New password<input type="password" autoComplete="new-password" required minLength={12} value={password} onChange={e=>setPassword(e.target.value)}/></label>
      <button className="primaryButton" type="submit" disabled={busy}>{busy?'Saving password…':'Save password and open collection'}</button>
    </form>
    {message&&<p role="alert">{message}</p>}
  </div></div>
}
