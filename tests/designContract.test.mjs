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
 assert.match(css,/\.ci-workspace-action-panel\{\s*display:grid/)
 assert.match(css,/\.sidebar nav \.navItem\{width:auto!important/)
})
test('detailed economics is hidden by default and summary stays visible',()=>{
 assert.doesNotMatch(research,/<details className="ci-review-section ci-review-source" open>/)
 assert.match(research,/Read complete research summary/)
})
test('all major controls meet minimum button height and visible focus rules',()=>{
 assert.match(css,/--ci-control-height:44px/)
 assert.match(css,/:focus-visible\{outline:2px solid var\(--focus-color\)/)
})
