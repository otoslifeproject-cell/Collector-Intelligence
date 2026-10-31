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
test('answered questions leave the list at once and come back only if sending fails',()=>{
 const page=readFileSync(new URL('../src/pages/CatchUp.tsx',import.meta.url),'utf8')
 assert.ok(page.indexOf("state:'WORKING'}:x))")<page.indexOf("await startResearch(supabase,item,'deep_dive'"))
 assert.match(page,/your answers were not sent; answer again/)
})
test('my sort of stuff: a pasted search becomes an owner taste note in the brain',async()=>{
 const {tasteFromInput}=await import('../src/lib/taste.ts')
 const t=tasteFromInput('https://www.etsy.com/search/vintage?q=Stiva+Italian+Hand-Blown+Green+Art+Glass+Trumpet+%2F+Calla+Lily+Vase&page=3')
 assert.equal(t.claim,'Owner taste (etsy.com search): Stiva Italian Hand Blown Green Art Glass Trumpet / Calla Lily Vase')
 assert.equal(tasteFromInput('  '),null)
 const research=readFileSync(new URL('../api/research-item.ts',import.meta.url),'utf8')
 assert.match(research,/OWNER_CONFIRMED_FINDING,LEARNED_TELL,OWNER_TASTE/)
})
