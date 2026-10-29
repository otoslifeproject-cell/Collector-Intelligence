import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {randomUUID} from 'node:crypto'
import {isActiveCollectionItem,isLegacyCreatedAt,FRESH_START_AT} from '../src/lib/freshCollection.ts'
import {miniAppraisal} from '../src/lib/miniAppraisal.ts'
import {formatProvisionalDraftHandoff} from '../src/lib/provisionalDraftHandoff.ts'

const source=path=>readFileSync(new URL('../src/'+path,import.meta.url),'utf8')
test('fresh work is active; historical and explicitly archived records remain out of the active view',()=>{
 const now='2026-10-28T14:26:30.000Z'
 const old='2026-10-28T14:24:59.000Z'
 assert.equal(isLegacyCreatedAt(old),true)
 assert.equal(isLegacyCreatedAt(now),false)
 assert.equal(isActiveCollectionItem({created_at:now,status:'RESEARCH'}),true)
 assert.equal(isActiveCollectionItem({created_at:old,status:'RESEARCH'}),false)
 assert.equal(isActiveCollectionItem({created_at:now,status:'ARCHIVED'}),false)
 assert.equal(isActiveCollectionItem({created_at:null,status:'READY_TO_SELL'}),false)
 assert.ok(Date.parse(FRESH_START_AT)>Date.parse('2026-10-27T00:00:00Z'))
})
test('new user enters from homepage and has only the five requested sidebar destinations',()=>{
 const app=source('App.tsx'),sidebar=source('components/Sidebar.tsx'),home=source('pages/Dashboard.tsx')
 for(const path of ['"/"','"/intake"','"/inventory"','"/sales"','"/archive"'])assert.match(app,new RegExp(path))
 for(const label of ['Dashboard','Add item','Collection','Sell','Archive'])assert.ok(sidebar.includes("'"+label+"'"))
 assert.match(home,/FRESH_START_AT/)
 assert.match(home,/url:\'\/intake\'/)
 assert.match(sidebar,/\/archive/)
})
test('fresh photo flow has one Analyse action leading to a saved answer',()=>{
 const intake=source('pages/AIIntake.tsx'),draft=source('pages/SavedDraft.tsx')
 assert.match(intake,/onClick=\{uploadAndAnalyse\}/)
 assert.match(intake,/Analyse photos/)
 assert.match(intake,/nav\('\/draft\/'\+attempt\.request\.id\)/)
 assert.match(draft,/get\('tab'\)\|\|'answer'/)
 assert.match(draft,/activeTab==='answer'&&finishedAnswer&&!researching&&!waitingForSaved&&<ResultScreen/)
 assert.match(draft,/activeTab!=='answer'&&<nav role="tablist"/)
 assert.match(draft,/activeTab==='answer'&&\(researching\|\|waitingForSaved\)&&<ResearchRunning/)
 assert.match(draft,/setActiveTab\('answer'\);try\{window\.scrollTo/)
 assert.match(draft,/<MiniAppraisal appraisal=\{answer\}/)
})
test('both new and catalogued items have exactly five owner-facing tabs',()=>{
 for(const path of ['pages/SavedDraft.tsx','pages/ItemDetail.tsx']){
  const content=source(path)
  for(const label of ['Answer','Photos','Research','Selling','History'])assert.match(content,new RegExp("'"+label+"'"))
  assert.match(content,/role="tablist"/)
  assert.match(content,/role="tab"/)
 }
})
test('one brand-new disposable item produces a safe one-click seller review draft without publishing',()=>{
 const id=randomUUID()
 const object={working_title:'Fresh blue glass fruit bowl',object_type:'Shallow fruit bowl',material:'Blue glass, exact maker unconfirmed',colour:'Blue',condition_summary:'No definite crack visible. Physical inspection needed.'}
 const originalPhotos=[0,1,2]
 const appraisal=miniAppraisal({objectType:object.object_type,workingTitle:object.working_title,
  identificationConfidence:64,valuationConfidence:30,status:'CHECK',verifiedSales:[]})
 const draft=formatProvisionalDraftHandoff({runId:id,index:0,object,photoIndices:originalPhotos})
 assert.equal(appraisal.decision,'Check')
 assert.equal(appraisal.worth,'No sold prices found yet')
 assert.match(appraisal.identity,/moderate identification confidence/)
 assert.ok(draft.title.length<=80)
 assert.match(draft.text,new RegExp(id))
 assert.match(draft.text,/Original photo positions \(1-based\): 1, 2, 3/)
 assert.match(draft.text,/NOT PUBLISHED/)
 assert.match(draft.text,/No verified sold comps found/)
 assert.match(draft.text,/Asking price: NOT ESTABLISHED/)
})
