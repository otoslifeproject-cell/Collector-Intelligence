import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
test('Vercel packages server-source modules for live API',()=>{
 const cfg=JSON.parse(read('vercel.json'))
 assert.match(cfg.functions['api/*.ts'].includeFiles,/src\/lib/)
 const api=read('api/analyse-intake.ts')
 assert.match(api,/ci_claim_intake_paid_v1/)
 assert.match(api,/resume_saved/)
 assert.match(api,/provider_usage/)
})
test('saved owner-only manifest is the sole source for recovery',()=>{
 const api=read('api/analyse-intake.ts')
 assert.match(api,/const requested=resume_saved===true/)
 assert.match(api,/staged\.result\?\.image_manifest/)
 assert.match(api,/signedOriginalURL\(supabaseUrl,supabaseKey,token,p\.storage_path\)/)
 assert.match(api,/bindSavedIntakePhotos\(staged,requested,mode,supabaseUrl\)/)
})
test('photo limit is shown, overflow is rejected and photos are never silently dropped',()=>{
 const ui=read('src/pages/AIIntake.tsx')
 for(const forbidden of ['Held session details','Unconfirmed service reply','Saved session data','rawReply','<pre','<details'])
  assert.equal(ui.includes(forbidden),false,forbidden)
 assert.match(ui,/Too many photos/)
 assert.match(ui,/window\.alert/)
 assert.match(ui,/files\.length\+choices\.current\.length>max/)
 assert.match(ui,/Check result/)
 assert.match(ui,/Try again/)
})
test('saved plate can resume, but never presents developer JSON',()=>{
 const ui=read('src/pages/SavedIntakes.tsx')
 assert.match(ui,/resume_saved:true/)
 assert.match(ui,/Analyse saved photos/)
 assert.match(ui,/savedReportAvailable\(saved\)/)
 assert.doesNotMatch(ui,/JSON\.stringify\(row,null,2\)|Saved session ID|<pre|<details/)
})
