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

test('dashboard has one clear resume route without implying approved research',()=>{
  const dashboard=readFileSync(new URL('../src/pages/Dashboard.tsx',import.meta.url),'utf8')
  assert.match(dashboard,/aria-label="Next action"/)
  assert.match(dashboard,/Continue your last object/)
  assert.match(dashboard,/Research and sale approval still require evidence/)
  assert.match(dashboard,/to=\{\x60\/item\/\$\{items\[0\]\.id\}\x60\}/)
})

test('advanced research details are collapsed outside evidence work',()=>{
  assert.match(detail,/<details className="panel" open=\{tab==='market'\|\|tab==='identification'\}>/)
  assert.match(detail,/Research evidence and expert controls/)
  assert.match(detail,/Detailed evidence, assessments and verification/)
  assert.match(detail,/Sell \/ route/)
})

test('wizard retains direct research and selling entry points for existing browser journeys',()=>{
  assert.match(detail,/onClick=\{\(\)=>setTab\('market'\)\}>Research & value<\/button>/)
  assert.match(detail,/onClick=\{\(\)=>setTab\('sales'\)\}>Sell \/ route<\/button>/)
})

test('workflow progress is concise and accessible',()=>{
  assert.match(detail,/const activeWizardStep = wizardSteps\.findIndex/)
  assert.match(detail,/aria-live="polite"/)
  assert.match(detail,/Step \$\{activeWizardStep\+1\} of \$\{wizardSteps\.length\}/)
})

test('unread photo manifest is not represented as an empty original-photo record',()=>{
  assert.match(detail,/!photographsLoaded\?'Check photographs'/)
  assert.match(detail,/!photos\.length\?'Add photographs'/)
})
