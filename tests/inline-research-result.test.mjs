import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const screen=readFileSync(new URL('../src/pages/SavedDraft.tsx',import.meta.url),'utf8')
test('Google matches come first, then the research result; museum keyword search is off the main path',()=>{
 assert.ok(screen.indexOf('className="panel ci-google-first-look"')<screen.indexOf('className="panel ci-fast-research-result"'))
 assert.doesNotMatch(screen,/<VisualReferenceWorkbench/)
 assert.doesNotMatch(screen,/Preliminary AI estimate/)
 assert.match(screen,/Identification, value and selling recommendation/)
 assert.match(screen,/Research running · Google first, then sold prices/)
 assert.match(screen,/Open in Google Lens/)
})
test('research starts by itself once per object; paid repeats stay manual',()=>{
 assert.match(screen,/autoResearchTried\.current\.add\(autoKey\)/)
 assert.match(screen,/void runDraftResearch\('standard'\)/)
 assert.match(screen,/VITE_CI_AUTO_RESEARCH==='off'/)
 assert.match(screen,/Research again · paid/)
 assert.match(screen,/runDraftResearch\('deep_dive'\)/)
 assert.match(screen,/Sell item · prepare listing/)
 assert.match(screen,/<ResearchRunning/)
})

test('Answer is the default saved-object view, Research remains one tab away',()=>{
 assert.match(screen,/get\('tab'\)\|\|'answer'/)
 assert.match(screen,/catch\{return 'answer'\}/)
 assert.match(screen,/\['market','Research'\]/)
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

test('visual reference suggestions start without a second manual action but never claim photo recognition',()=>{
 const visual=readFileSync(new URL('../src/components/VisualReferenceWorkbench.tsx',import.meta.url),'utf8')
 assert.match(visual,/autoSearched\.current\.add\(key\)/)
 assert.match(visual,/void search\(\)/)
 assert.match(visual,/They are not photo matches/)
 assert.match(visual,/Google Lens requires you to upload or select the image manually/)
})

test('paste-from-Lens saves an owner lead and starts research from it',()=>{
 assert.match(screen,/What did Google Lens find\?/)
 assert.match(screen,/OWNER GOOGLE LENS RESULT \(lead to check, not a fact\)/)
 assert.match(screen,/Use this and research again · paid/)
 assert.match(screen,/Google Lens matches/)
})
