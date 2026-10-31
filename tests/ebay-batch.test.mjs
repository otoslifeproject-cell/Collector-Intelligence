import test from 'node:test'
import assert from 'node:assert/strict'
import {ebayBatchCsv,ebayBatchProblems,descriptionHtml,EBAY_DRAFT_HEADER} from '../src/lib/ebayBatch.ts'

const row={sku:'CI-000012',categoryId:'262',title:'Holmegaard Selandia Smoked Glass Bowl Per Lütken 1959',price:60,photoUrls:['https://x/a b.jpg','https://x/2.jpg'],condition:'USED',description:'Holmegaard bowl.\nKey features:\n- Smoke glass',format:'FixedPrice'}
test('eBay draft file: Draft action, UK header, photos piped, simple HTML description',()=>{
 const csv=ebayBatchCsv([row])
 const lines=csv.trim().split('\r\n')
 assert.match(lines[0],/eBay-draft-listings-template/)
 assert.equal(EBAY_DRAFT_HEADER[0],'Action(SiteID=UK|Country=GB|Currency=GBP|Version=1193|CC=UTF-8)')
 assert.match(lines[2],/^"Draft","CI-000012","262",/)
 assert.match(lines[2],/https:\/\/x\/a%20b\.jpg\|https:\/\/x\/2\.jpg/)
 assert.match(lines[2],/"60\.00","1"/)
 assert.match(lines[2],/"USED"/)
 assert.equal(descriptionHtml('a\nb\n\nc'),'<p>a<br>b</p><p>c</p>')
})
test('an item cannot go in the file until it is complete',()=>{
 assert.deepEqual(ebayBatchProblems({...row,categoryId:'',price:null,photoUrls:[]}),['eBay category number missing','price missing','no photos'])
 assert.throws(()=>ebayBatchCsv([row,row]),/twice/)
 assert.throws(()=>ebayBatchCsv([]),/at least one/)
})
