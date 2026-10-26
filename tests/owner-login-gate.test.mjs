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
