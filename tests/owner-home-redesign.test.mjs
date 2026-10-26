import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const dashboard=readFileSync(new URL('../src/pages/Dashboard.tsx',import.meta.url),'utf8')
const sidebar=readFileSync(new URL('../src/components/Sidebar.tsx',import.meta.url),'utf8')
const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8')
test('owner home offers four immediate tasks and a single resume journey',()=>{
 for(const label of ["Identify","Collection","Research","Sell"])assert.ok(dashboard.includes("label:'"+label+"'"))
 assert.match(dashboard,/Continue your work/)
 assert.match(dashboard,/to=\{\x60\/item\/\$\{latest\.id\}\x60\}/)
})
test('collection query remains owner-scoped and preserves archive state',()=>{
 assert.match(dashboard,/\.eq\('owner_id',user\.id\)/)
 assert.match(dashboard,/\.neq\('status','ARCHIVED'\)/)
 assert.doesNotMatch(dashboard,/\.delete\(|\.update\(|\.insert\(/)
})
test('secondary tools are available without crowding main navigation',()=>{
 assert.match(sidebar,/More tools/)
 assert.match(dashboard,/Advanced tools/)
 assert.match(css,/\.ci-home-actions\{display:grid/)
})
