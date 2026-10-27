import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const item=readFileSync(new URL('../src/pages/ItemDetail.tsx',import.meta.url),'utf8')
const home=readFileSync(new URL('../src/pages/Dashboard.tsx',import.meta.url),'utf8')
test('one item wizard is the sole primary stage navigation, not three competing navs',()=>{
 assert.match(item,/Object workflow/)
 assert.match(item,/wizardSteps\.map/)
 assert.doesNotMatch(item,/className="heroActions"/)
 assert.doesNotMatch(item,/className="tabBar"/)
 assert.match(item,/Additional object records/)
})
test('home links never duplicate a manual Add Item route',()=>{
 assert.doesNotMatch(home,/Manual catalogue entry/)
 assert.match(home,/url:'\/intake'/)
})
