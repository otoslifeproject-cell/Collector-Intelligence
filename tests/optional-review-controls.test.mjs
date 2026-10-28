import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const source=readFileSync(new URL('../src/pages/ItemDetail.tsx',import.meta.url),'utf8')
test('advanced owner-review controls stay hidden until read-only backing-store probes succeed',()=>{
 assert.match(source,/optionalTools\.hold&&<ItemAssessment/)
 assert.match(source,/optionalTools\.army&&<ResearchArmyWorkspace/)
 for(const view of ['item_assessment_context_v1','item_research_assessments','research_army_receipts_v1'])assert.ok(source.includes(".from('"+view+"')"))
 assert.match(source,/storage is not active in this environment/)
 assert.doesNotMatch(source,/setOptionalTools\(\{hold:true,army:true\}\)/)
})
