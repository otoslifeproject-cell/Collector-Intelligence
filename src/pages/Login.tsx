import { FormEvent, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email,setEmail] = useState('')
  const [password,setPassword] = useState('')
  const [message,setMessage] = useState('')
  const [mode,setMode] = useState<'login'|'signup'>('login')

  const submit = async (e:FormEvent) => {
    e.preventDefault()
    setMessage('')
    const result = mode === 'login'
      ? await supabase.auth.signInWithPassword({email,password})
      : await supabase.auth.signUp({email,password})
    if (result.error) setMessage(result.error.message)
    else setMessage(mode === 'signup' ? 'Account created. If email confirmation is enabled, check your inbox.' : 'Signed in.')
  }

  return (
    <div className="loginPage">
      <div className="loginPanel">
        <div className="loginBrand">CI</div>
        <div className="eyebrow">COLLECTION OS</div>
        <h1>Collector Intelligence</h1>
        <p>Private collection management, identification, valuation and sales intelligence.</p>
        <form onSubmit={submit}>
          <label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required /></label>
          <label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength={6} required /></label>
          <button className="primaryButton" type="submit">{mode === 'login' ? 'Sign in' : 'Create account'}</button>
        </form>
        {message && <div className="formMessage">{message}</div>}
        <button className="textButton" onClick={()=>setMode(mode === 'login' ? 'signup' : 'login')}>
          {mode === 'login' ? 'First use? Create the owner account' : 'Already created? Sign in'}
        </button>
      </div>
    </div>
  )
}
