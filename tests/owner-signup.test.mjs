import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const login=readFileSync(new URL('../src/pages/Login.tsx',import.meta.url),'utf8')
test('owner may choose account creation without losing sign-in',()=>{
 assert.match(login,/supabase\.auth\.signUp\(\{email,password\}\)/)
 assert.match(login,/supabase\.auth\.signInWithPassword\(\{email,password\}\)/)
 assert.match(login,/Create a new account/)
 assert.match(login,/Back to sign in/)
})
test('new identity is not presented as a way to recover original owner records',()=>{
 assert.match(login,/may not see records owned by your earlier account/)
 assert.match(login,/Check your email for a confirmation link/)
})
