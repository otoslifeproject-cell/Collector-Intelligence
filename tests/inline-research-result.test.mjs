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
