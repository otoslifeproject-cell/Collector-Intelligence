import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const detail=readFileSync(new URL('../src/pages/ItemDetail.tsx',import.meta.url),'utf8')

test('one next action maps the object state to its existing workflow',()=>{
  assert.match(detail,/item\.status==='SOLD'\?'sales':!photos\.length\?'photos':reviewed\?'sales':'market'/)
  assert.match(detail,/const suggestedLabel/)
  assert.match(detail,/onClick=\{\(\)=>setTab\(suggestedStage\)\}/)
  assert.match(detail,/aria-label="Object workflow"/)
})
test('wizard navigates without replacing evidence and sales safeguards',()=>{
  for(const token of ['<ResearchProgress','<ItemAssessment','<ResearchArmyWorkspace','<SellFastPlan','<RecordSaleOutcome']) {
    assert.ok(detail.includes(token),`Existing controlled workflow remains: ${token}`)
  }
  assert.match(detail,/Steps do not approve research or publish listings automatically/)
})
