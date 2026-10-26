import { FormEvent, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email,setEmail] = useState('')
  const [password,setPassword] = useState('')
  const [message,setMessage] = useState('')

  const submit = async (e:FormEvent) => {
    e.preventDefault()
    setMessage('')
    const result = await supabase.auth.signInWithPassword({email,password})
    if (result.error) setMessage(result.error.message)
    else setMessage('Signed in.')
  }

  return (
    <div className="loginPage">
      <div className="loginPanel">
        <div className="loginBrand"><img src="/brand/app-icon.png" alt="Collector Intelligence faceted mark" width="70" height="70" style={{objectFit:"contain"}} onError={e=>{e.currentTarget.style.display="none";e.currentTarget.parentElement!.textContent="CI"}} /></div>
        <div className="eyebrow">COLLECTION OS</div>
        <h1>Collector Intelligence</h1>
        <p>Advanced intelligence. Verified evidence. Confident decisions.</p>
        <form onSubmit={submit}>
          <label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required /></label>
          <label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength={6} required /></label>
          <button className="primaryButton" type="submit">Sign in</button>
        </form>
        {message && <div className="formMessage" role="alert">{message}</div>}
        <p>Owner access only. Accounts are provisioned privately.</p>
      </div>
    </div>
  )
}
