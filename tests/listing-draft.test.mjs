import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {prepareListingDraft,restoreListingDraft,settleListingDraft} from '../src/lib/listingDraft.ts';
import {emptySaleScenario,sellModes} from '../src/lib/sellFastPlan.ts';
const item={id:randomUUID(),owner_id:randomUUID(),title:'Signed mark; maker unverified',currency:'GBP',condition_summary:'Condition unresolved'};
const payload={format:'collector-sale-review-v1',itemId:item.id,ownerId:item.owner_id,facts:item,scenarios:sellModes.map(m=>emptySaleScenario(m,'GBP')),review:{conditionReviewed:false,comparableReviewed:false,photosReviewed:false,attribution:'UNRESOLVED',makerSource:'',specialistRisk:true,shippingInstructions:''},objective:'FAST_CASH',draftMode:'FAST_CASH',listing:{publicationStatus:'NOT_PUBLISHED',platform:'Local collection',title:'Signed mark — research review',description:'Provisional copy, not approved for sale.',itemSpecifics:{},keywords:[],recommendedPrice:null},capturedAt:'2026-10-23T00:00:00Z'};
test('review draft restore requires the same owner, object, facts and unsupported-ready cannot publish',()=>{
 const request=prepareListingDraft(item,payload);assert.ok(Object.isFrozen(request.row));assert.equal(request.row.listing_status,'DRAFT');assert.equal(request.row.listing_url,null);assert.ok(restoreListingDraft(request.row,item));
 assert.equal(restoreListingDraft({...request.row,listing_status:'PUBLISHED'},item),null);assert.equal(restoreListingDraft(request.row,{...item,title:'Changed facts'}),null);assert.equal(restoreListingDraft(request.row,{...item,owner_id:randomUUID()}),null);
 const malformed={...request.row,item_specifics:{collector_sale_review_v1:{...payload,scenarios:[null,{mode:'FAST_CASH'},{mode:'BALANCED'}]}}};assert.equal(restoreListingDraft(malformed,item),null);
 assert.throws(()=>prepareListingDraft(item,{...payload,listing:{...payload.listing,publicationStatus:'PUBLISHED'}}),/current item facts/);
});
test('lost draft acknowledgement is resolved by independent GET and replay never duplicates',async()=>{
 const request=prepareListingDraft(item,payload),rows=[],calls=[];const client={auth:{getUser:async()=>({error:null,data:{user:{id:item.owner_id}}})},from(){const q={select(){calls.push('GET');return q},eq(){return q},limit(){return q},abortSignal(){return q},insert(row){calls.push('INSERT');rows.push(structuredClone(row));return {abortSignal:async()=>{throw Error('Lost acknowledgement after commit')}}},then(resolve,reject){return Promise.resolve({data:rows,error:null,count:rows.length}).then(resolve,reject)}};return q}};
 assert.equal(await settleListingDraft(client,request,()=>true,false),null);assert.deepEqual(calls,['GET']);
 const saved=await settleListingDraft(client,request,()=>true,true);assert.equal(saved.id,request.id);assert.equal(rows.length,1);assert.equal((await settleListingDraft(client,request,()=>true,true)).id,request.id);assert.equal(calls.filter(c=>c==='INSERT').length,1);
});
