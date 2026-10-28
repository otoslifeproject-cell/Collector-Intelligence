import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {validIntakeRunId} from '../src/lib/validIntakeRunId.ts'
const api=readFileSync(new URL('../api/analyse-intake.ts',import.meta.url),'utf8')
test('a genuine saved intake UUID passes before any paid provider call',()=>{
 assert.equal(validIntakeRunId('2a79524a-3e58-4d71-9966-f653ffde3408'),true)
 assert.equal(validIntakeRunId('56d084a9-ac9a-4559-b913-50ba4436905f'),true)
})
test('incomplete or malformed IDs are rejected without any claim',()=>{
 for(const id of [
  '2a79524a-3e58-4d71-f653ffde3408',
  '2a79524a-3e58-4d71-9966-f653ffde3408extra',
  '2a79524a-3e58-4d71-9966-f653ffde340',
  '../../../secret',
  null,
  {},''
 ])assert.equal(validIntakeRunId(id),false)
})
test('both audit log and intake paid gate use identical validator',()=>{
 assert.match(api,/const runForAudit = validIntakeRunId\(intakeBody\.run_id\)/)
 assert.match(api,/if\(!validIntakeRunId\(run_id\)\)/)
 assert.ok(api.indexOf('if(!validIntakeRunId(run_id))')<api.indexOf('readStagedRun(supabaseUrl,supabaseKey,token,run_id)'))
 assert.ok(api.indexOf('if(!validIntakeRunId(run_id))')<api.indexOf('ci_claim_intake_paid_v1'))
})
