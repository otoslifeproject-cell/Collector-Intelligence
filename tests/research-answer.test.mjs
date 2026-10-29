import test from 'node:test'
import assert from 'node:assert/strict'
import {researchAnswer,researchStep} from '../src/lib/researchAnswer.ts'

const research={
 identification_update:{attribution:'Whitefriars tinted and threaded bowl, pattern 8266 (lead)',maker:'Whitefriars',period_wording:'c.1930',identification_confidence:62},
 valuation:{currency:'GBP',balanced_low:60,balanced_high:120},
 routing:{best_venue:'eBay UK',sale_readiness:'ONE_QUICK_CHECK_THEN_SELL'},
 next_evidence:[{title:'Measure the diameter',why:'8266 is 13 inches'},{title:'Photograph the base',why:'pontil'}],
 comparables:[
  {price_type:'MARKETPLACE_SOLD',price:85,currency:'GBP',venue:'eBay UK',source_url:'https://www.ebay.co.uk/itm/1'},
  {price_type:'HAMMER_REALIZED',price:110,currency:'GBP',venue:'Fieldings',source_url:'https://example.com/lot'},
  {price_type:'MARKETPLACE_ASKING',price:249,currency:'GBP',venue:'eBay UK',source_url:'https://www.ebay.co.uk/itm/2'}],
 google_first_look:{status:'CALLED',best_guess:['whitefriars glass'],entities:[],pages:[{url:'https://a',title:'a'},{url:'https://b',title:'b'}]}
}

test('sold and asking prices stay apart; the £249 ask never becomes a sale',()=>{
 const a=researchAnswer(research,'Bowl')
 assert.equal(a.sold,'Sold: £85–£110 (2 results)')
 assert.match(a.soldBasis,/not independently checked/)
 assert.equal(a.asking,'Asking: £249 (1 listing, not sales)')
 assert.equal(a.range,'Provisional range £60–£120')
 assert.match(a.identity,/Whitefriars/)
 assert.match(a.identity,/c\.1930/)
 assert.equal(a.google,'Google: whitefriars glass · 2 matching pages')
 assert.equal(a.decision,'One quick check, then list')
 assert.deepEqual(a.checks,['Measure the diameter','Photograph the base'])
})

test('no sold evidence and no Google run are said plainly',()=>{
 const a=researchAnswer({identification_update:{},comparables:[{price_type:'DEALER_ASKING',price:40,currency:'GBP'}],google_first_look:{status:'NOT_RUN',reason:'Google key not configured',best_guess:[],entities:[],pages:[]}},'Green glass bowl')
 assert.equal(a.sold,'No sold prices found')
 assert.equal(a.google,'Google check not run: Google key not configured')
 assert.equal(researchAnswer({},'X').google,'Google check not run for this research')
})

test('tracker moves with time but never claims ready',()=>{
 assert.deepEqual([0,20000,60000,200000].map(researchStep),[0,1,2,3])
})

test('the answer names the first Lens match when Lens ran',()=>{
 const a=researchAnswer({...research,google_first_look:{status:'CALLED',best_guess:['circle'],entities:[],pages:[],
  lens:{status:'CALLED',reason:null,matches:[{title:'WHITEFRIARS TINTED & THREADED ART GLASS BOWL',url:'https://e',source:'eBay UK',price:'£249'}]}}},'Bowl')
 assert.equal(a.google,'Google Lens: WHITEFRIARS TINTED & THREADED ART GLASS BOWL · 1 visual match')
})

test('quick check shows the triage decision instead of a listing decision',()=>{
 const a=researchAnswer({...research,research_depth:'quick',triage:{decision:'FULL_RESEARCH_WORTH_IT',reason:'Lens names Val Saint Lambert Duplex E.L.52.'}},'Bowl')
 assert.equal(a.quick,true)
 assert.equal(a.decision,'Worth full research')
 assert.match(a.triageText,/Val Saint Lambert/)
 const low=researchAnswer({...research,research_depth:'quick',triage:{decision:'LOW_VALUE',reason:'Generic pressed glass.'}},'Bowl')
 assert.equal(low.decision,'Low value: sell quickly')
 assert.equal(researchAnswer(research,'Bowl').quick,false)
})

test('result screen: eBay title max 80, Etsy title, price and format, checks',async()=>{
 const {resultListing}=await import('../src/lib/researchAnswer.ts')
 const r=resultListing({...research,listing:{ebay_title:'Val Saint Lambert Duplex Green Cut to Clear Crystal Coupe Bowl Belgian 1920s Art Deco Vintage Used Extra Words',etsy_title:'Vintage Val Saint Lambert green cut to clear crystal bowl',etsy_reason:'',price:180,currency:'GBP',sale_format:'AUCTION',auction_start:99,title_checks:['Val Saint Lambert: confirm etched signature']}},'Bowl')
 assert.ok(r.ebayTitle.length<=80)
 assert.ok(!r.ebayTitle.endsWith(' '))
 assert.equal(r.price,'£180')
 assert.equal(r.format,'Auction · start £99')
 assert.deepEqual(r.checks,['Val Saint Lambert: confirm etched signature'])
 assert.equal(r.priceBasis,'Based on 2 sold results')
 const old=resultListing(research,'Green glass bowl')
 assert.equal(old.ebayTitle,'Green glass bowl')
 assert.equal(old.price,'£60–£120')
})

test('result always has a price when any sold or asking lead exists',async()=>{
 const {resultListing}=await import('../src/lib/researchAnswer.ts')
 const r=resultListing({comparables:[{price_type:'MARKETPLACE_ASKING',price:30,currency:'GBP'},{price_type:'DEALER_ASKING',price:40,currency:'GBP'}],valuation:{}},'Mouse candle holder')
 assert.equal(r.price,'£27')
 assert.equal(r.priceBasis,'Just under similar items for sale')
})

test('description comes through ready to copy',async()=>{
 const {resultListing}=await import('../src/lib/researchAnswer.ts')
 const r=resultListing({listing:{ebay_title:'Caithness Oban Twist Bud Vase',description:'Caithness Glass Oban twist bud vase.\nKey features:\n- Green ribbons\nEra: c.1970\nMarkings: none visible\nCondition: please see photographs.'}},'Vase')
 assert.match(r.description,/Key features:/)
 assert.equal(resultListing({},'X').description,null)
})

test('marks read from the photos are shown as confirmed, never as checks',async()=>{
 const {resultListing}=await import('../src/lib/researchAnswer.ts')
 const r=resultListing({listing:{ebay_title:'Copeland Spode Peacock Tureen',seen_in_photos:['Mark: Copeland Spode (photo 4)'],title_checks:[
  'Copeland Spode: photographed factory mark supports attribution.',
  'Peacock: photographed mark reads \u201cSpode\u2019s Peacock.\u201d',
  'Set: confirm the matching dish/stand is included and fits.']}},'Tureen')
 assert.deepEqual(r.checks,['Set: confirm the matching dish/stand is included and fits.'])
 assert.equal(r.seen.length,3)
 assert.equal(r.seen[0],'Mark: Copeland Spode (photo 4)')
})
