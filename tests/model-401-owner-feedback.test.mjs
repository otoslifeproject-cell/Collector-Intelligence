import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=(p)=>readFileSync(new URL('../'+p,import.meta.url),'utf8')

test('free model check 401 is a key problem, not proof the model is absent',()=>{
 const api=read('api/analyse-intake.ts')
 assert.match(api,/available\.status===401/)
 assert.match(api,/OpenAI rejected the API key/)
 assert.match(api,/MODEL_CHECK_HTTP_/)
 const check=api.indexOf('https://api.openai.com/v1/models/')
 const claim=api.indexOf('ci_claim_intake_paid_v1')
 assert.ok(check>=0&&claim>check,'free model preflight must precede claim')
})

test('saved owner view reads and shows only allowlisted simple errors',()=>{
 const ui=read('src/pages/SavedIntakes.tsx')
 assert.match(ui,/const reply=await fetch\('\/api\/analyse-intake'/)
 assert.match(ui,/if\(!reply\.ok\)/)
 assert.match(ui,/safeMessages\.includes\(candidate\)/)
 assert.match(ui,/stopMessage\|\|/)
 assert.doesNotMatch(ui,/JSON\.stringify\(payload\)|<pre>\{payload/)
 assert.match(ui,/The connection was interrupted/)
})
