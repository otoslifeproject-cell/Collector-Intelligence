import { FormEvent, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email,setEmail] = useState('')
  const [password,setPassword] = useState('')
  const [message,setMessage] = useState('')
  const [submitting,setSubmitting] = useState(false)
  const [recovering,setRecovering] = useState(false)

  const submit = async (e:FormEvent) => {
    e.preventDefault()
    setMessage('')
    if (submitting) return
    setSubmitting(true)
    try {
      if (recovering) {
        const result = await supabase.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin+window.location.pathname})
        setMessage(result.error?result.error.message:'If this address has an account, a password recovery link has been sent. Open the link from your email.')
      } else {
        const result = await supabase.auth.signInWithPassword({email,password})
        if (result.error) setMessage(result.error.message)
        else setMessage('Signed in.')
      }
    } catch {
      setMessage('Sign-in service could not be reached. Check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
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
          {!recovering&&<label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength={6} required /></label>}
          <button className="primaryButton" type="submit" disabled={submitting}>{submitting ? 'Working…' : recovering?'Send password reset link':'Sign in'}</button>
        </form>
        <button type="button" className="secondaryButton" disabled={submitting} onClick={()=>{setRecovering(v=>!v);setMessage('')}}>{recovering?'Back to sign in':'Forgot password?'}</button>
        {message && <div className="formMessage" role="alert">{message}</div>}
        <p>Owner access only. Accounts are provisioned privately.</p>
      </div>
    </div>
  )
}
