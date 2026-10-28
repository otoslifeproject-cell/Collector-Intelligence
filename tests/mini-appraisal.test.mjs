import test from 'node:test'
import assert from 'node:assert/strict'
import {approvedSoldEvidence,miniAppraisal} from '../src/lib/miniAppraisal.ts'
const achieved={price:45,price_type:'MARKETPLACE_SOLD',verification_status:'VERIFIED_DIRECT',currency:'GBP',sale_date:'2026-09-22',source_url:'https://example.org/sold/23',venue:'eBay'}
test('CI-000006 is a single Check answer, not a fast cash recommendation',()=>{
 const a=miniAppraisal({objectType:'Shallow bowl or dish',identificationConfidence:70,valuationConfidence:20,status:'ONE_QUICK_CHECK',period:'Date unknown; possibly 20th century',verifiedSales:[]})
 assert.equal(a.decision,'Check')
 assert.equal(a.worth,'No sold prices found yet')
 assert.match(a.worthBasis,/matching completed/)
 assert.match(a.venue,/eBay/)
 assert.equal(a.hasVerifiedSold,false)
 assert.equal(a.etsyAgeUnconfirmed,true)
 assert.doesNotMatch(JSON.stringify(a),/£15|£25|£50/)
})
test('unverified asks, estimates and model-proposed sold results never become price evidence',()=>{
 const comps=[{...achieved,price_type:'DEALER_ASKING'}, {...achieved,price_type:'AUCTION_ESTIMATE'}, {...achieved,verification_status:'UNVERIFIED'}]
 assert.deepEqual(approvedSoldEvidence(comps),[])
 const a=miniAppraisal({objectType:'Green glass vase',verifiedSales:comps,period:'possibly Victorian'})
 assert.equal(a.worth,'No sold prices found yet')
 assert.notEqual(a.venue.split(' · ')[0],'Etsy')
})
test('directly verified achieved prices are observed context only, not an asking price',()=>{
 const b={...achieved,price:70,source_url:'https://example.org/sold/24'}
 const a=miniAppraisal({objectType:'Glass bowl',verifiedSales:[achieved,b],status:'RESEARCH',valuationConfidence:20})
 assert.match(a.worth,/£45\.00–£70\.00/)
 assert.match(a.worthBasis,/not a valuation/)
 assert.equal(a.decision,'Check')
})
test('specialist risk requires a check before any listing',()=>{
 const a=miniAppraisal({objectType:'Unidentified glass vase',status:'SPECIALIST_REVIEW',verifiedSales:[]})
 assert.equal(a.decision,'Check');assert.match(a.venue,/Specialist auction/)
})
test('seller-ready decision requires an independently signalled ready state',()=>{
 const base={objectType:'Vase',status:'READY_TO_SELL',verifiedSales:[achieved]}
 assert.equal(miniAppraisal(base).decision,'Check')
 assert.equal(miniAppraisal({...base,readyToList:true}).decision,'Sell')
})
test('lamp uses a cautious local route with electrical uncertainty',()=>{
 const a=miniAppraisal({objectType:'Ceramic table lamp base',status:'ONE_QUICK_CHECK'})
 assert.equal(a.decision,'Check');assert.match(a.venue,/Local/)
})
test('all identity and price confidence inputs remain independent',()=>{
 const a=miniAppraisal({objectType:'Vase',identificationConfidence:90,valuationConfidence:10})
 assert.match(a.identity,/higher identification confidence/)
 assert.equal(a.worth,'No sold prices found yet')
})
