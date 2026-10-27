import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const login=readFileSync(new URL('../src/pages/Login.tsx',import.meta.url),'utf8')
test('private collection sign-in does not advertise public signup',()=>{
 assert.match(login,/supabase\.auth\.signInWithPassword/)
 assert.doesNotMatch(login,/supabase\.auth\.signUp/)
 assert.doesNotMatch(login,/Create a new account/)
 assert.match(login,/Owner access only\. Accounts are provisioned privately/)
})
test('existing owner can recover password without changing account identity',()=>{
 assert.match(login,/resetPasswordForEmail/)
 assert.match(login,/Forgot password\?/)
 assert.match(login,/Back to sign in/)
})
