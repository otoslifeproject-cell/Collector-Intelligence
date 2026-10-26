import test from 'node:test'
import assert from 'node:assert/strict'
import {applyInscriptionReview} from '../src/lib/inscriptionReview.ts'
const piece=(image_indices)=>({image_indices,marks_signatures_labels:'MEDINA (owner observation)',identification_confidence:21,next_evidence:[{title:'Examine this signature'}]})
const review={mark_visible:true,candidate_transcription:'Mdina?',transcription_confidence:60,evidence_image_indices:[0],candidate_maker:'Mdina',rationale:'Uncertain letters',needs_new_photograph:true}
test('MEDINA clear-mark reading applies only to its independently scoped physical piece',()=>{
 const r={objects:[piece([0]),piece([1])]};applyInscriptionReview(r,review)
 assert.match(r.objects[0].marks_signatures_labels,/MEDINA.*Mdina\?/);assert.equal(r.objects[1].marks_signatures_labels,'MEDINA (owner observation)')
 assert.equal(r.objects[0].identification_confidence,21);assert.equal(r.inscription_scope_audit.maker_authenticated,false)
})
test('second MEDINA signature can retain a different independent reading confidence',()=>{
 const r={objects:[piece([0]),piece([1])]};applyInscriptionReview(r,{...review,transcription_confidence:82,candidate_transcription:'Mdina'});applyInscriptionReview(r,{...review,evidence_image_indices:[1],transcription_confidence:35,candidate_transcription:'M?ina?'})
 assert.match(r.objects[0].marks_signatures_labels,/82% transcription/);assert.doesNotMatch(r.objects[0].marks_signatures_labels,/35%/)
 assert.match(r.objects[1].marks_signatures_labels,/35% transcription/);assert.doesNotMatch(r.objects[1].marks_signatures_labels,/82%/)
})
for(const indices of [[0,1],[2]])test('global/shared source images cannot copy one reading onto both marks '+indices,()=>{
 const r={objects:[piece([0,2]),piece([1,2])]};const before=structuredClone(r.objects);applyInscriptionReview(r,{...review,evidence_image_indices:indices})
 assert.deepEqual(r.objects,before);assert.equal(r.inscription_scope_audit.status,'UNASSIGNED');assert.deepEqual(r.inscription_scope_audit.object_indices,[0,1])
})
test('missing or unrelated mark indices remain unassigned without inventing either inscription',()=>{
 for(const indices of [[],[42]]){const r={objects:[piece([0]),piece([1])]};const before=structuredClone(r.objects);applyInscriptionReview(r,{...review,evidence_image_indices:indices});assert.deepEqual(r.objects,before);assert.equal(r.inscription_scope_audit.status,'UNASSIGNED')}
})
