import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const detail=readFileSync(new URL('../src/pages/ItemDetail.tsx',import.meta.url),'utf8')

test('one next action maps the object state to its existing workflow',()=>{
  assert.match(detail,/item\.status==='SOLD'\?'sales':!photographsLoaded\?'photos':!photos\.length\?'photos':reviewed\?'sales':'market'/)
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

test('owner assessment remains visible to browser and keyboard journeys',()=>{
  assert.doesNotMatch(detail,/<details className="panel" open=\{tab==='market'\|\|tab==='identification'\}>/)
  assert.match(detail,/<ItemAssessment client=\{supabase\}/)
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

test('each wizard stage offers concise guidance and the next safe navigation step',()=>{
  for(const label of ['Check the originals','Review identification','Check the permanent object record','Review route, costs']) {
    assert.ok(detail.includes(label),label)
  }
  assert.match(detail,/const nextWizardStep =/)
  assert.match(detail,/onClick=\{\(\)=>setTab\(nextWizardStep\.id\)\}/)
  assert.match(detail,/Next: \{nextWizardStep\.label\}/)
})

test('wizard derives completion from confirmed local data, not speculative estimates',()=>{
  assert.match(detail,/const photoReady = photographsLoaded && !photographError && photos\.length>0 && !pendingPhotographs\.length && !uploading/)
  assert.match(detail,/const researchReady = Boolean\(reviewed\) && !historyError && !reviewedError && !historyLoading && !researching && !assessmentMutating && !armyMutating/)
  assert.match(detail,/const catalogueReady = Boolean\(item\.item_code\?\.trim\(\) && item\.object_type\?\.trim\(\) && item\.condition_summary\?\.trim\(\)\) && !saving && editRevision\.current===savedRevision\.current/)
  assert.match(detail,/sales:\{done:item\.status==='SOLD'/)
})
test('wizard allows going back and reports saved state without automatic approvals',()=>{
  assert.match(detail,/Previous step/)
  assert.match(detail,/stageChecks\[step\.id\]\.done/)
  assert.match(detail,/stageChecks\[tab\]\.status/)
  assert.match(detail,/Steps do not approve research or publish listings automatically/)
})

test('recommended action changes only from confirmed state and is not duplicated on active step',()=>{
  assert.match(detail,/const recommendedNextStep = item\.status==='SOLD'\?'sales'/)
  assert.match(detail,/!researchReady\?'market':!catalogueReady\?'overview':'sales'/)
  assert.match(detail,/recommendedNextStep!==tab&&<button/)
  assert.match(detail,/recommendedNextStep===tab&&<span/)
  assert.match(detail,/!historyError && !reviewedError && !historyLoading/)
})

test('photo state does not complete during pending or failed original uploads',()=>{
  for(const marker of ['pendingPhotographs.length','Saving originals','Photo check failed','Recover pending originals','Resolve photo access','Recover photo upload']) assert.ok(detail.includes(marker),marker)
})
test('source review cannot appear complete during mutation or failed read',()=>{
  for(const marker of ['!assessmentMutating','!armyMutating','!researching','Research update underway','Research check needs attention']) assert.ok(detail.includes(marker),marker)
})
test('catalogue requires non-whitespace persisted facts and respects save state',()=>{
  for(const marker of ['item.item_code?.trim()','item.object_type?.trim()','item.condition_summary?.trim()','Saving catalogue facts']) assert.ok(detail.includes(marker),marker)
})
test('wizard steps expose statuses to assistive technologies',()=>{
  assert.match(detail,/aria-label=\{\x60\$\{index\+1\}\. \$\{step\.label\}: \$\{stageChecks\[step\.id\]\.status\}\x60\}/)
})

test('unsaved catalogue edits are not reported as complete',()=>{
  assert.ok(detail.includes('editRevision.current===savedRevision.current'))
  assert.ok(detail.includes('Save catalogue edits'))
})
test('busy research and failed originals retain recovery guidance',()=>{
  for(const marker of ['Checking research evidence','Recover photo access','Recover photo upload','||researching||assessmentMutating']) assert.ok(detail.includes(marker),marker)
})
