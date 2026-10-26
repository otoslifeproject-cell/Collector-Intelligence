import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const login=readFileSync(new URL('../src/pages/Login.tsx',import.meta.url),'utf8')

test('owner login UI contains no publicly accessible account creation action',()=>{
  assert.match(login,/supabase\.auth\.signInWithPassword/)
  assert.doesNotMatch(login,/supabase\.auth\.signUp\s*\(/)
  assert.doesNotMatch(login,/setMode\(|Create account|Create the owner account/)
  assert.match(login,/Owner access only\. Accounts are provisioned privately\./)
})

test('owner sign-in handles network outages and blocks repeated submits',()=>{
  assert.match(login,/if \(submitting\) return/)
  assert.match(login,/catch \{/)
  assert.match(login,/Sign-in service could not be reached/)
  assert.match(login,/finally \{/)
  assert.match(login,/disabled=\{submitting\}/)
})
