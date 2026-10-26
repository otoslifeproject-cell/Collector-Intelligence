import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

// Source-level guard only: the full browser and owner-auth acceptance remain separate.
const client = readFileSync(new URL('../src/lib/supabase.ts',import.meta.url),'utf8')
const app = readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8')

test('missing Preview backend does not throw during Supabase module import',()=>{
  assert.match(client,/export const supabaseConfigured = Boolean\(url && key\)/)
  assert.doesNotMatch(client,/if \(!url \|\| !key\)\s*\{\s*throw/)
  assert.ok(client.includes("url || 'https://preview-not-configured.invalid'"))
})

test('unconfigured Preview never opens an auth session or owner content',()=>{
  assert.match(app,/if \(!supabaseConfigured\) \{ setReady\(true\); return \}/)
  assert.match(app,/if \(!supabaseConfigured\) return <div className="loginPage">/)
  assert.match(app,/awaiting an isolated Supabase connection/)
  assert.ok(app.indexOf('if (!supabaseConfigured) return <div') < app.indexOf('if (!session) return <Login/>'))
})

test('failed authentication handshake shows an error instead of indefinite boot',()=>{
  assert.match(app,/\.catch\(\(\)=>\{if \(active\) setAuthError\(true\)\}\)/)
  assert.match(app,/\.finally\(\(\)=>\{if \(active\) setReady\(true\)\}\)/)
  assert.match(app,/if \(authError\) return <div className="loginPage">/)
  assert.match(app,/Sign-in service unavailable/)
})
