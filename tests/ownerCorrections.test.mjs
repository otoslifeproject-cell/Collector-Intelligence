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
test('wood observation contradicts a glass guess while remaining compatible with wooden wording',()=>{
 assert.equal(materialContradictsVisualGuess('Wood','Decorated glass'),true)
 assert.equal(materialContradictsVisualGuess('Wood','Carved wooden object'),false)
})
test('stone observation distinguishes a glass guess from ceramic stoneware wording',()=>{
 assert.equal(materialContradictsVisualGuess('Stone','Glass'),true)
 assert.equal(materialContradictsVisualGuess('Ceramic','Stoneware'),false)
 assert.equal(materialContradictsVisualGuess('Stone','Stoneware'),true)
})
test('textile observation contradicts a wooden guess and recognises fabric wording',()=>{
 assert.equal(materialContradictsVisualGuess('Textile','Wood'),true)
 assert.equal(materialContradictsVisualGuess('Textile','Woven fabric'),false)
})
test('unknown and mixed observations do not invent a specific contradiction',()=>{
 assert.equal(materialContradictsVisualGuess('Unknown','Glass'),false)
 assert.equal(materialContradictsVisualGuess('Mixed materials','Glass'),false)
 assert.equal(materialContradictsVisualGuess('__proto__','Glass'),false)
 assert.equal(materialContradictsVisualGuess('constructor','Glass'),false)
})
test('explicit mixed model materials remain compatible with a listed owner material',()=>{
 assert.equal(materialContradictsVisualGuess('Wood','Glass and wood'),false)
 assert.equal(materialContradictsVisualGuess('Metal','Glass with metal fittings'),false)
})
test('an unclassified model description does not become a definite rejected material',()=>{
 assert.equal(materialContradictsVisualGuess('Wood','Unidentified construction'),false)
 assert.equal(materialContradictsVisualGuess('Stone',''),false)
})
