import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=x=>readFileSync(new URL('../'+x,import.meta.url),'utf8')
test('model preflight runs before paid claim',()=>{
 const s=read('api/analyse-intake.ts')
 assert.ok(s.indexOf('/v1/models/')<s.indexOf('ci_claim_intake_paid_v1'))
 assert.ok(s.indexOf('ci_claim_intake_paid_v1')<s.indexOf('/v1/responses'))
})
test('only definite OpenAI errors without usage release the claim',()=>{
 const s=read('api/analyse-intake.ts')
 assert.match(s,/refusedWithoutUsage/)
 assert.match(s,/!payload/)
 assert.match(s,/releaseRejectedIntake/)
 assert.match(s,/PROVIDER_ERROR_SAVED/)
})
test('releasing a refusal is restricted to a server credential',()=>{
 const sql=read('supabase/migrations/20261028173500_release_definitively_refused_intake.sql')
 assert.ok(sql.includes('to service_role'))
 assert.ok(sql.includes('from public,anon,authenticated'))
 assert.ok(sql.includes('provider_usage'))
 assert.ok(sql.includes('original_manifest'))
})
