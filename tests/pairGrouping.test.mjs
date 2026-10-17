import test from 'node:test'
import assert from 'node:assert/strict'
import {suggestSingleIntakePair} from '../src/lib/pairGrouping.ts'

const left={working_title:'Matching pale yellow-green bubble-glass vase — left example',image_indices:[0,1,3,4,5,7]}
const right={working_title:'Matching pale yellow-green bubble-glass vase — right example',image_indices:[0,2,3,4,6,7]}

test('one matching pair is suggested as one catalogue lot of two original physical pieces',()=>{
 const result=suggestSingleIntakePair([left,right],'single')
 assert.ok(result)
 assert.deepEqual(result.indices,[0,1])
 assert.match(result.title,/matched pair/i)
})
test('no automatic pair inference from the same labels in batch intake',()=>{
 assert.equal(suggestSingleIntakePair([left,right],'batch'),null)
})
test('one physical item photographed repeatedly does not create two physical pieces',()=>{
 assert.equal(suggestSingleIntakePair([left],'single'),null)
})
test('unrelated left and right objects must not be grouped',()=>{
 assert.equal(suggestSingleIntakePair([
  {working_title:'Red studio glass bowl — left example'},
  {working_title:'Green pottery vase — right example'}
 ],'single'),null)
})
test('unrelated objects with similar colours are not automatically grouped',()=>{
 assert.equal(suggestSingleIntakePair([
  {working_title:'Matching amber pottery vase — left example'},
  {working_title:'Matching amber glass bowl — right example'}
 ],'single'),null)
})


test('latest October dark decorated pair is grouped even when image assignment is uncertain',()=>{
 const pair=[
  {working_title:'Left vessel from apparent matching pair: dark decorated tapered glass vase',image_indices:[0]},
  {working_title:'Right/detail-photographed vessel from apparent matching pair: dark decorated tapered glass vase',image_indices:[0,1,2,3,4,5,6]}
 ]
 const result=suggestSingleIntakePair(pair,'single')
 assert.ok(result)
 assert.deepEqual(result.indices,[0,1])
 assert.match(result.title,/pair/i)
})
