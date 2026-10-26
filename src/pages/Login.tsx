import { FormEvent, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email,setEmail] = useState('')
  const [password,setPassword] = useState('')
  const [message,setMessage] = useState('')
  const [submitting,setSubmitting] = useState(false)
  const [creating,setCreating] = useState(false)

  const submit = async (e:FormEvent) => {
    e.preventDefault()
    setMessage('')
    if (submitting) return
    setSubmitting(true)
    try {
      if (creating) {
        const result = await supabase.auth.signUp({email,password})
        if (result.error) setMessage(result.error.message)
        else if (!result.data.session) setMessage('Account request received. Check your email for a confirmation link. If this email already has an account, registration may not create another one.')
        else setMessage('Account created and signed in.')
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
          <label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength={6} required /></label>
          <button className="primaryButton" type="submit" disabled={submitting}>{submitting ? (creating?'Creating…':'Signing in…') : (creating?'Create account':'Sign in')}</button>
        </form>
        <button type="button" className="secondaryButton" disabled={submitting} onClick={()=>{setCreating(v=>!v);setMessage('')}}>{creating?'Back to sign in':'Create a new account'}</button>
        {message && <div className="formMessage" role="alert">{message}</div>}
        <p>{creating?'A new account has a separate identity and may not see records owned by your earlier account.':'Private collection access. Your records remain attached to their original owner account.'}</p>
      </div>
    </div>
  )
}
