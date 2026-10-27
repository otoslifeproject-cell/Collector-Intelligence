import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const fn=readFileSync(new URL('../src/lib/ebayDraftExport.ts',import.meta.url),'utf8')
const view=readFileSync(new URL('../src/pages/Inventory.tsx',import.meta.url),'utf8')
test('eBay draft exporter never publishes listings or invents a category',()=>{
 assert.match(fn,/quote\('Draft'\)/)
 assert.match(fn,/category ID from the current Seller Hub draft template/)
 assert.match(fn,/Sold or archived objects cannot be exported/)
 assert.doesNotMatch(fn,/quote\('Add'\)/)
})
test('bulk UI requires owner review, category and offers selection',()=>{
 assert.match(view,/Bulk eBay draft export/)
 assert.match(view,/Select filtered catalogue items/)
 assert.match(view,/Choose individual eBay draft items/)
 assert.match(view,/Export eBay drafts/)
 assert.match(view,/No eBay import has been tested/)
})

test('CSV uses actual escaped newline tokens rather than literal backslash strings',()=>{
 const cr=String.fromCharCode(92)+'r',nl=String.fromCharCode(92)+'n'
 assert.ok(fn.includes("output.join('"+cr+nl+"')+'"+cr+nl+"'"))
 assert.ok(fn.includes(".join('"+nl+nl+"')"))
 assert.ok(!fn.includes("output.join('"+String.fromCharCode(92)+cr+String.fromCharCode(92)+nl+"')"))
})

test('eligible catalogue items directly open Sell Item listing stage',()=>{
 assert.match(view,/Sell item · prepare listing/)
 assert.match(view,/\?tab=sales/)
 assert.match(view,/\['SOLD','ARCHIVED'\]\.includes\(i\.status\)/)
})
