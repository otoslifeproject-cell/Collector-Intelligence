import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const read=x=>readFileSync(x,'utf8')
const css=read('src/styles.css')
const draft=read('src/pages/SavedDraft.tsx')
const item=read('src/pages/ItemDetail.tsx')
const app=read('src/App.tsx')
const sidebar=read('src/components/Sidebar.tsx')
const research=read('src/components/ResearchDecisionPanel.tsx')
const actions=read('src/components/WorkspaceActionPanel.tsx')

test('both object research workspaces use one shared action panel',()=>{
 assert.match(draft,/<WorkspaceActionPanel/)
 assert.match(item,/<WorkspaceActionPanel/)
 assert.doesNotMatch(draft,/className="panel researchLauncher"/)
 assert.doesNotMatch(item,/className="panel researchLauncher"/)
 assert.match(actions,/ci-workspace-action-controls/)
 assert.match(actions,/className="primaryButton"/)
})
test('no sticky global promotional banner obscures active work',()=>{
 assert.doesNotMatch(app,/Collector Intelligence brand vision/)
})
test('light/dark mode is shared and available on both desktop and mobile',()=>{
 assert.match(app,/applyAppearance\(appearance\)/)
 assert.match(sidebar,/ci-appearance-mobile/)
 assert.match(sidebar,/onToggleAppearance/)
 assert.match(css,/html\[data-theme="light"\]/)
 assert.match(css,/\.researchLauncher,\.ci-workspace-action-panel\{\s*display:grid/)
 assert.match(css,/\.sidebar nav \.navItem\{width:auto!important/)
})
test('detailed economics is hidden by default and summary stays visible',()=>{
 assert.doesNotMatch(research,/<details className="ci-review-section ci-review-source" open>/)
 assert.match(research,/Full research summary/)
})
test('all major controls meet minimum button height and visible focus rules',()=>{
 assert.match(css,/--ci-control-height:44px/)
 assert.match(css,/:focus-visible\{outline:2px solid var\(--focus-color\)/)
})

test('report metadata and correction controls are inside one closed menu, never above navigation',()=>{
 assert.match(draft,/ci-report-menu/)
 assert.match(draft,/aria-label="Report notifications and actions"/)
 assert.match(draft,/Disagree with verdict/)
 assert.match(draft,/Source photo index needs review/)
 assert.match(draft,/Report details/)
 for(const oldClass of ['ci-owner-status','ci-photo-review-status','ci-report-meta','ci-report-top-actions']){
  assert.doesNotMatch(draft,new RegExp('className="'+oldClass))
 }
 const menuStart=draft.indexOf('className="ci-report-menu"')
 const navStart=draft.indexOf('className="tabBar"')
 const notice=draft.indexOf('Source photo index needs review')
 const reportDetail=draft.indexOf('Report details')
 assert.ok(menuStart>=0&&notice>menuStart&&reportDetail>menuStart&&navStart>reportDetail)
 assert.match(draft,/activeTab==='catalogue'&&needsPhotoCorrection&&<label className="ci-catalogue-photo-confirm"/)
})
test('compare action is visible in two clicks without filling screen with advice',()=>{
 const compare=read('src/components/VisualReferenceWorkbench.tsx')
 const info=read('src/components/InfoDisclosure.tsx')
 assert.match(compare,/<p className="ci-action-hint">Search by material, shape or decoration/)
 assert.match(compare,/<InfoDisclosure label="About search">/)
 assert.doesNotMatch(compare,/Need a wider visual search\?/)
 assert.match(info,/className=.*ci-info-disclosure/)
 assert.match(info,/<summary aria-label=\{label\}/)
 assert.match(info,/sr-only/)
 assert.match(info,/title=\{label\}/)
})
test('shared typography scale applies to dark and light without distinct font metrics',()=>{
 assert.match(css,/--ci-body-size:14px/)
 assert.match(css,/--ci-support-size:13px/)
 assert.match(css,/--ci-label-size:12px/)
 assert.match(css,/\.ci-visual-workbench,\.ci-research-decision,\.ci-workspace-action-panel/)
})
