import test from 'node:test'
import assert from 'node:assert/strict'
import {ebaySellerReview,formatEbaySellerHandoff} from '../src/lib/ebaySellerReview.ts'
const item={id:'obj-1',owner_id:'owner',item_code:'CI-000101',title:'Large glass bowl',
 object_type:'Shallow serving bowl',maker:'Unverified famous designer',material:'Glass',
 colour:'Blue',period_wording:'Mid century',category:'Glass',condition_summary:'Light surface wear on base.',
 dimensions:{diameter:'12 in'},status:'RESEARCH',currency:'GBP'}
const sold={item_id:'obj-1',price_type:'MARKETPLACE_SOLD',verification_status:'VERIFIED_DIRECT',
 venue:'eBay',sale_date:'2026-10-01',source_url:'https://www.ebay.co.uk/itm/123',
 description:'Blue Glass Shallow Serving Bowl used',listing_format:'FIXED_PRICE'}
test('seller draft never asserts unverified maker or unknown sale value',()=>{
 const d=ebaySellerReview(item,[],null,17)
 assert.ok(d.title.length<=80)
 assert.match(d.title,/Shallow serving bowl/)
 assert.doesNotMatch(d.title,/Unverified famous designer|Mid century|amazing|bargain/i)
 assert.equal(d.verifiedSoldCount,0)
 assert.equal(d.listingStatus,'NOT_PUBLISHED')
 assert.match(formatEbaySellerHandoff(d),/No verified|0/)
 assert.match(d.itemSpecifics['Maker / Brand'],/Check this/)
 assert.match(d.description,/Light surface wear/)
 assert.match(d.description,/fragile glass/i)
})
test('only actual source-reviewed eBay sold records determine format and keywords',()=>{
 const d=ebaySellerReview(item,[sold,{...sold,source_url:'https://www.ebay.co.uk/itm/124'},
 {...sold,source_url:'https://www.ebay.co.uk/itm/125'},
 {...sold,verification_status:'UNVERIFIED',source_url:'https://www.ebay.co.uk/itm/126'}],null,20)
 assert.equal(d.verifiedSoldCount,3)
 assert.equal(d.format,'FIXED_PRICE')
 assert.ok(d.soldKeywords.includes('blue'))
 const no=ebaySellerReview(item,[{...sold,price_type:'MARKETPLACE_ASKING'}],null,20)
 assert.equal(no.verifiedSoldCount,0)
 assert.equal(no.format,'AUCTION_7_DAYS')
})
test('maker enters title only with independent approval, and photo policy is a check',()=>{
 const d=ebaySellerReview(item,[], 'Confirmed Maker',25)
 assert.match(d.title,/^Confirmed Maker Shallow serving bowl/)
 assert.ok(d.title.length<=80)
 assert.match(d.photoGuidance.join(' '),/24/)
 assert.match(d.photoGuidance.join(' '),/1600/)
 assert.match(formatEbaySellerHandoff(d),/NOT PUBLISHED/)
})
