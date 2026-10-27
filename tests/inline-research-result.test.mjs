import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const screen=readFileSync(new URL('../src/pages/SavedDraft.tsx',import.meta.url),'utf8')
test('research result appears before visual search controls within object view',()=>{
 assert.ok(screen.indexOf('className="panel ci-fast-research-result"')<screen.indexOf('<VisualReferenceWorkbench'))
 assert.match(screen,/Identification, value and selling recommendation/)
 assert.match(screen,/Research running · examining matches and checking evidence/)
})
test('one start action and sale handoff retain guarded research',()=>{
 assert.match(screen,/label:researching\?'Research running…':'Start research'/)
 assert.match(screen,/Sell item · prepare listing/)
 assert.match(screen,/runDraftResearch\('deep_dive'\)/)
})

test('research is the default saved-object view, not an extra tab click',()=>{
 assert.match(screen,/get\('tab'\)\|\|'market'/)
 assert.match(screen,/catch\{return 'market'\}/)
})

test('save item approves only a single item or grouped pair from result',()=>{
 assert.match(screen,/if\(paired\|\|\(run\.result\.objects\|\|\[\]\)\.length===1\)void approveSaved\(\)/)
 assert.match(screen,/else setActiveTab\('catalogue'\)/)
 assert.match(screen,/Saving item…/)
})

test('saved research is the only primary view; extras are folded away',()=>{
 assert.doesNotMatch(screen,/className="tabBar" role="tablist"/)
 assert.match(screen,/Saved research navigation/)
 assert.match(screen,/More object details/)
 assert.match(screen,/Back to research result/)
 assert.match(screen,/Identification evidence/)
 assert.match(screen,/Original photos/)
})
