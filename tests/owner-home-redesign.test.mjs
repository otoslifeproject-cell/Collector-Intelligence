import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const dashboard=readFileSync(new URL('../src/pages/Dashboard.tsx',import.meta.url),'utf8')
const sidebar=readFileSync(new URL('../src/components/Sidebar.tsx',import.meta.url),'utf8')
const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8')
test('owner home only offers fresh work and the current resume journey',()=>{
 assert.match(dashboard,/label:'Add item'/)
 assert.doesNotMatch(dashboard,/label:'Collection'/)
 assert.doesNotMatch(dashboard,/label:'Sell'/)
 assert.match(dashboard,/Continue your work/)
 assert.match(dashboard,/FRESH_START_AT/)
 assert.match(dashboard,/to=\{\x60\/item\/\$\{latest\.id\}\x60\}/)
})
test('collection query remains owner-scoped and preserves archive state',()=>{
 assert.match(dashboard,/\.eq\('owner_id',user\.id\)/)
 assert.match(dashboard,/\.neq\('status','ARCHIVED'\)/)
 assert.doesNotMatch(dashboard,/\.delete\(|\.update\(|\.insert\(/)
})
test('legacy tools are hidden from the five-area owner menu, not deleted',()=>{
 assert.match(sidebar,/\['\/archive', 'Archive', Archive\]/)
 assert.match(sidebar,/\{false&&<details className="ci-more-navigation"/)
 assert.doesNotMatch(dashboard,/Saved uploads and tools/)
 assert.match(css,/\.ci-home-actions\{display:grid/)
})

test('live dashboard has no duplicate manual Add Item action',()=>{
 assert.doesNotMatch(dashboard,/Manual catalogue entry/)
 assert.match(dashboard,/url:'\/intake'/)
 assert.match(sidebar,/\['\/inventory', 'Collection', Boxes\]/)
})
