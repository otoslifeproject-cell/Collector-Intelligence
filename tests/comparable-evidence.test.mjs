import assert from 'node:assert/strict'
import {classifyComparables} from '../src/lib/comparableEvidence.ts'
const comp={id:'c1',item_id:'i1',venue:'Auction House',sale_date:'2026-09-12',price_type:'HAMMER_REALIZED',price:80,currency:'GBP',description:'Comparable vase',source_url:'https://example.org/lot/1',verification_status:'VERIFIED_DIRECT',comparability_grade:'HIGH'}
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
for(const price_type of ['HAMMER_REALIZED','REALIZED_INCL_BP','MARKETPLACE_SOLD','DEALER_SOLD_CONFIRMED'])check('policy achieved class '+price_type,()=>assert.equal(classifyComparables([{...comp,price_type}])[0].verified,true))
for(const price_type of ['AUCTION_REALISED','AUCTION_REALIZED','AUCTION_ESTIMATE','UNSOLD','INDEXED_SOLD_NOT_DIRECTLY_VERIFIED','DEALER_ARCHIVED_LAST_ASK_ACHIEVED_UNKNOWN'])check('unproven sale class '+price_type,()=>assert.equal(classifyComparables([{...comp,price_type}])[0].verified,false))
for(const verification_status of ['VERIFIED','SOURCE_VERIFIED','CONFIRMED','INDEXED_SOLD'])check('legacy label cannot certify '+verification_status,()=>assert.equal(classifyComparables([{...comp,verification_status}])[0].verified,false))
for(const sale_date of ['2026-02-30','not a date','2026-01-01T00:00:00Z'])check('invalid date rejected '+sale_date,()=>assert.equal(classifyComparables([{...comp,sale_date}])[0].verified,false))
check('whitespace currency rejected',()=>assert.equal(classifyComparables([{...comp,currency:' '}])[0].verified,false))
check('URL credentials rejected',()=>assert.equal(classifyComparables([{...comp,source_url:'https://user:password@example.org/lot'}])[0].verified,false))
console.log(n+' comparable evidence checks passed')

check('future achieved result remains unverified lead',()=>assert.equal(classifyComparables([{...comp,sale_date:'2099-12-31'}],'2026-10-23')[0].verified,false))
