import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
test('an UPLOADED session always offers Analyse saved photos after stopped progress',()=>{
 const ui=source('src/pages/SavedIntakes.tsx')
 assert.match(ui,/row\.result\?\.analysis_stage==='UPLOADED'&&row\.model==='PENDING'&&!analysing/)
 assert.doesNotMatch(ui,/row\.model==='PENDING'&&phase==='idle'/)
 assert.match(ui,/onClick=\{\(\)=>void analyseSaved\(\)\}/)
 assert.match(ui,/!id&&refresh/)
})
test('server parses JSON body and logs pre-paid failures even when database audit fails',()=>{
 const api=source('api/analyse-intake.ts')
 assert.match(api,/parsedIntakeBody/)
 assert.match(api,/const intakeBody=await parsedIntakeBody\(req\)/)
 assert.match(api,/CI_INTAKE_START/)
 assert.match(api,/CI_INTAKE_STOP_LOG_FAILED/)
 for(const reason of ['PHOTO_LIST_MISSING','PHOTO_COUNT_OVER_LIMIT','RUN_ID_INVALID'])
  assert.ok(api.includes(reason))
 assert.match(api,/ci_intake_stop_events_v1/)
 assert.match(api,/ci_claim_intake_paid_v1/)
 assert.ok(api.indexOf("'RUN_ID_INVALID'")<api.indexOf('/rest/v1/rpc/ci_claim_intake_paid_v1'))
})