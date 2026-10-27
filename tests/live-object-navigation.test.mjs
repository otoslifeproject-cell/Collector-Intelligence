import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const src=readFileSync(new URL('../src/pages/ItemDetail.tsx',import.meta.url),'utf8')
test('production object has one primary workflow navigation',()=>{
 assert.match(src,/aria-label="Object workflow"/)
 assert.match(src,/wizardSteps\.map/)
 assert.doesNotMatch(src,/className="heroActions"/)
 assert.doesNotMatch(src,/className="tabBar"/)
})
test('additional evidence views remain accessible without duplicated tabs',()=>{
 assert.match(src,/Additional object records/)
 assert.match(src,/setTab\('identification'\)/)
 assert.match(src,/setTab\('catalogue'\)/)
 assert.match(src,/SellFastPlan/)
})
