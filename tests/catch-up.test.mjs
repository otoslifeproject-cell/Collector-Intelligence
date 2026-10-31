import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {catchUpState} from '../src/lib/bulkResearch.ts'

const iso=(msAgo)=>new Date(Date.now()-msAgo).toISOString()
test('catch-up state: old-format research needs a quick check; questions; ready; done; working',()=>{
 assert.equal(catchUpState([]).state,'NEEDS_CHECK')
 assert.equal(catchUpState([{stage:'COMPLETE',created_at:iso(1e6),depth:'standard',listing:{price:20}}]).state,'NEEDS_CHECK')
 assert.equal(catchUpState([{stage:'COMPLETE',created_at:iso(1e5),depth:'quick',specifics:[],questions:[{question:'Chip?'}]}]).state,'QUESTIONS')
 assert.equal(catchUpState([{stage:'COMPLETE',created_at:iso(1e5),depth:'quick',specifics:[],questions:[]}]).state,'READY_FOR_DEEP')
 assert.equal(catchUpState([{stage:'COMPLETE',created_at:iso(1e5),depth:'deep_dive',specifics:[]}]).state,'DONE')
 assert.equal(catchUpState([{stage:'PROCESSING',created_at:iso(6e4),job:'resp_1'},{stage:'COMPLETE',created_at:iso(1e6),depth:'quick',specifics:[],questions:[]}]).state,'WORKING')
 assert.equal(catchUpState([{stage:'FAILED',created_at:iso(6e4)},{stage:'COMPLETE',created_at:iso(1e6),depth:'deep_dive',specifics:[]}]).state,'DONE')
})
test('bulk deep runs return at once and saved items can be researched',()=>{
 const research=readFileSync(new URL('../api/research-item.ts',import.meta.url),'utf8')
 assert.match(research,/req\.body\?\.no_wait===true/)
 assert.match(research,/\['DRAFT','APPROVED'\]\.includes\(rows\[0\]\.status\)/)
})
