import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const detail=readFileSync(new URL('../src/pages/ItemDetail.tsx',import.meta.url),'utf8')

test('one guided object workflow survives without competing hero actions',()=>{ assert.match(detail,/aria-label="Object workflow"/); assert.match(detail,/wizardSteps\.map/); assert.doesNotMatch(detail,/className="heroActions"/); assert.doesNotMatch(detail,/className="tabBar"/); })
test('wizard navigates without replacing evidence and sales safeguards',()=>{
  for(const token of ['<ResearchProgress','<ItemAssessment','<ResearchArmyWorkspace','<SellFastPlan','<RecordSaleOutcome']) {
    assert.ok(detail.includes(token),`Existing controlled workflow remains: ${token}`)
  }
  assert.match(detail,/Steps do not approve research or publish listings automatically/)
})

test('dashboard has one clear resume route without implying approved research',()=>{
  const dashboard=readFileSync(new URL('../src/pages/Dashboard.tsx',import.meta.url),'utf8')
  assert.match(dashboard,/aria-label="Continue your work"/)
  assert.match(dashboard,/Pick up where you left off/)
  assert.match(dashboard,/Values require verified evidence/)
  assert.match(dashboard,/to=\{\x60\/item\/\$\{latest\.id\}\x60\}/)
})

test('owner assessment remains visible to browser and keyboard journeys',()=>{
  assert.doesNotMatch(detail,/<details className="panel" open=\{tab==='market'\|\|tab==='identification'\}>/)
  assert.match(detail,/<ItemAssessment client=\{supabase\}/)
  assert.match(detail,/<SellFastPlan/)
})

test('wizard directly reaches market and sales without duplicate buttons',()=>{ assert.match(detail,/id:'market',label:'Research & value'/); assert.match(detail,/id:'sales',label:'Sell'/); assert.match(detail,/onClick=\{\(\)=>setTab\(step.id\)\}/); })

test('workflow progress is concise and accessible',()=>{
  assert.match(detail,/const activeWizardStep = wizardSteps\.findIndex/)
  assert.match(detail,/aria-live="polite"/)
  assert.match(detail,/Step \$\{activeWizardStep\+1\} of \$\{wizardSteps\.length\}/)
})

test('unread or failed original photos cannot become a completed photo step',()=>{ assert.match(detail,/photographsLoaded && !photographError && photos.length>0/); assert.match(detail,/!photographsLoaded\?'Checking originals'/); })

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
test('research and original-photo recovery remain guarded',()=>{ for(const marker of ['Research update underway','Photo check failed','Recover pending originals','||researching||assessmentMutating']) assert.ok(detail.includes(marker),marker) })
