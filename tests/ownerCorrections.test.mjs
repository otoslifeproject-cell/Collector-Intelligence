import test from 'node:test'
import assert from 'node:assert/strict'
import {feedbackForObject,currentOwnerMaterial,researchPredatesCorrection,materialContradictsVisualGuess} from '../src/lib/ownerCorrections.ts'

const feedback=[
 {id:'owner-metal',source_object_index:null,feedback_type:'MATERIAL_CORRECTION',corrected_material:'Metal',owner_statement:'These are metal',created_at:'2026-10-17T01:25:00Z'},
 {id:'old-owner',source_object_index:1,feedback_type:'MATERIAL_CORRECTION',corrected_material:'Glass',owner_statement:'Mistaken earlier observation',created_at:'2026-10-15T01:25:00Z'}
]
test('latest owner material correction takes precedence over older guesses',()=>{
 assert.equal(currentOwnerMaterial(feedback),'Metal')
})
test('correction for whole pair applies to both physical members',()=>{
 assert.equal(feedbackForObject(feedback,0,true).length,2)
 assert.equal(feedbackForObject(feedback,1,true).length,2)
})
test('a sibling-specific correction does not contaminate an unrelated single object',()=>{
 assert.equal(feedbackForObject(feedback,0,false).length,1)
})
test('research preceding correction is superseded while new research stays live',()=>{
 assert.equal(researchPredatesCorrection('2026-10-16T01:00:00Z',feedback),true)
 assert.equal(researchPredatesCorrection('2026-10-18T01:00:00Z',feedback),false)
})
test('metal correction contradicts mistaken glass description but does not transfer to already-metal evidence',()=>{
 assert.equal(materialContradictsVisualGuess('Metal','Dark enamelled glass vase'),true)
 assert.equal(materialContradictsVisualGuess('Metal','Gilded metal cylinder'),false)
})
test('unknown material cannot overrule image evidence as a false certainty',()=>{
 assert.equal(materialContradictsVisualGuess(null,'Dark glass object'),false)
})
