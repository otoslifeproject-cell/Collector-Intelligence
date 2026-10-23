import assert from 'node:assert/strict'
import {classifyComparables} from '../src/lib/comparableEvidence.ts'
const comp={id:'c1',item_id:'i1',venue:'Auction House',sale_date:'2026-09-12',price_type:'AUCTION_REALISED',price:80,currency:'GBP',description:'Comparable vase',source_url:'https://example.org/lot/1',verification_status:'VERIFIED',comparability_grade:'A'}
let n=0
function check(label,test){test();n++;console.log('PASS',label)}
check('verified achieved sale is labelled recorded verified',()=>assert.equal(classifyComparables([comp])[0].verified,true))
check('asking never verified',()=>assert.equal(classifyComparables([{...comp,price_type:'DEALER_ASKING'}])[0].verified,false))
check('unverified sale never verified',()=>assert.equal(classifyComparables([{...comp,verification_status:'UNVERIFIED'}])[0].verified,false))
check('missing date never verified',()=>assert.equal(classifyComparables([{...comp,sale_date:null}])[0].verified,false))
check('missing link never verified',()=>assert.equal(classifyComparables([{...comp,source_url:null}])[0].verified,false))
check('missing currency never verified',()=>assert.equal(classifyComparables([{...comp,currency:null}])[0].verified,false))
check('zero achieved price is allowed',()=>assert.equal(classifyComparables([{...comp,price:0}])[0].verified,true))
check('negative price never verified',()=>assert.equal(classifyComparables([{...comp,price:-1}])[0].verified,false))
check('invalid URL never verified',()=>assert.equal(classifyComparables([{...comp,source_url:'https://example.org/lot/1 javascript:evil'}])[0].verified,false))
console.log(n+' comparable evidence checks passed')
