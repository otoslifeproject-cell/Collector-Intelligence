import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const intake=readFileSync(new URL('../api/analyse-intake.ts',import.meta.url),'utf8')
const research=readFileSync(new URL('../api/research-item.ts',import.meta.url),'utf8')
test('yellow/green and fluorescent glass triggers uranium hypothesis but never assumed authentication',()=>{
 for(const value of ['uranium/vaseline glass','daylight-only','UV response UNKNOWN','non-uranium alternatives'])assert.ok(intake.includes(value),value)
})
test('research carries forward uranium question with evidence controls',()=>{
 for(const value of ['uranium/vaseline glass','paired daylight and UV photographs','not sole chemical authentication','unverified composition'])assert.ok(research.includes(value),value)
})

test('functional-form discriminator tests hyacinth bulb vase before maker speculation',()=>{
 assert.ok(intake.includes('FUNCTION BEFORE MAKER'))
 assert.ok(intake.includes('hyacinth forcing vase / bulb vase'))
 assert.ok(research.includes('functional-object-type challenge'))
 assert.ok(research.includes('hyacinth forcing vase / bulb vase'))
})
test('owner Lens findings are leads, not authenticated facts',()=>{
 assert.ok(research.includes('EXTERNAL SEARCH LEADS'))
 assert.ok(research.includes('Do not claim access to unseen Google Lens results'))
})
