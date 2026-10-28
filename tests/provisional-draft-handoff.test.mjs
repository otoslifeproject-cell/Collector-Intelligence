import test from 'node:test'
import assert from 'node:assert/strict'
import {formatProvisionalDraftHandoff} from '../src/lib/provisionalDraftHandoff.ts'

const runId='0c8f217c-3d9e-407e-81fb-1fdbf0ae133c'
const object={
  working_title:'Clear heavily cut faceted glass bowl or small vase',
  object_type:'Small open vessel; bowl or posy vase',
  material:'Clear cut glass; lead-crystal composition unconfirmed',
  colour:'Clear/colourless, with rainbow refraction from faceting and lighting',
  maker:null,
  condition_summary:'Dust and minor scratches seen in photos; possible edge chips unconfirmed.'
}
const pack=(overrides={})=>formatProvisionalDraftHandoff({runId,index:0,object,photoIndices:[11,0,3],...overrides})

test('seller copy uses physical description without claiming provenance, price or publication',()=>{
  const p=pack()
  assert.equal(p.title,'Clear/colourless Small open vessel')
  assert.ok(p.title.length<=80)
  assert.match(p.text,/No verified sold comps found\./)
  assert.match(p.text,/Asking price: NOT ESTABLISHED/)
  assert.match(p.text,/NOT PUBLISHED/)
  assert.match(p.text,/Maker, designer, place and date: UNCONFIRMED/)
  assert.match(p.text,/Original photo positions \(1-based\): 1, 4, 12/)
  assert.doesNotMatch(p.text,/£12|£20|£35/)
  assert.match(p.text,/possible edge chips unconfirmed/)
})
test('unverified maker guesses stay out of a generic marketplace title',()=>{
  const p=pack({object:{...object,working_title:'Whitefriars 1950s vase',maker:'Whitefriars',designer:'Historical person',object_type:'Glass vase',colour:'Green'}})
  assert.equal(p.title,'Green Glass vase')
  assert.doesNotMatch(p.title,/Whitefriars|1950|Historical/)
  assert.match(p.text,/Original AI working title \(not authenticated\): Whitefriars/)
})
test('UV identification remains an uncertain material lead, not uranium proof',()=>{
  const p=pack({object:{...object,object_type:'Green shallow dish',working_title:'Green UV fluorescent bowl',material:'Possible uranium glass based on UV fluorescence'}})
  assert.match(p.text,/UV fluorescence does not by itself establish uranium content/)
  assert.match(p.text,/No verified sold comps found/)
})
test('electric lamp listing cannot imply wiring safety from a single image',()=>{
  const p=pack({object:{...object,object_type:'Ceramic table lamp base',working_title:'White floral lamp',material:'Ceramic body'}})
  assert.match(p.text,/Electrical safety and working status: UNKNOWN/)
})
test('photo index corruption and missing source identity block copy',()=>{
  assert.throws(()=>pack({photoIndices:[0,0]}),/unambiguous/)
  assert.throws(()=>pack({photoIndices:[-1]}),/unambiguous/)
  assert.throws(()=>pack({photoIndices:[]}),/unambiguous/)
  assert.throws(()=>pack({runId:'other'}),/saved report/)
})
test('a long AI description never breaks the 80-character title cap',()=>{
  const p=pack({object:{...object,object_type:'An extremely long descriptive form with multiple uncertain decorative elements plus imagined details that cannot actually be checked',colour:'Green with uncertain light-based colours across five views'}})
  assert.ok(p.title.length<=80)
  assert.doesNotMatch(p.title,/imagined|uncertain light-based/)
})
test('selecting a second object retains its own source index and source photographs',()=>{
  const p=pack({index:1,photoIndices:[8,9,16]})
  assert.match(p.text,/object 2/)
  assert.match(p.text,/positions \(1-based\): 9, 10, 17/)
  assert.doesNotMatch(p.text,/positions \(1-based\): 1, 4, 12/)
})
