import test from 'node:test'
import assert from 'node:assert/strict'
import {vamImageFromRecord,visualSearchTerm} from '../src/lib/vamVisual.ts'

test('official IIIF image identifier becomes bounded reference photo',()=>{
 assert.equal(vamImageFromRecord({_primaryImageId:'2012FJ7350'}),'https://framemark.vam.ac.uk/collections/2012FJ7350/full/!480,480/0/default.jpg')
})
test('unsafe images, arbitrary hosts and missing images do not render',()=>{
 assert.equal(vamImageFromRecord({_images:{_primary_thumbnail:'https://example.invalid/collections/fake.jpg'}}),null)
 assert.equal(vamImageFromRecord({_primaryImageId:'bad/path'}),null)
 assert.equal(vamImageFromRecord({}),null)
})
test('owner corrected metal controls search rather than model glass guess',()=>{
 assert.match(visualSearchTerm('Metal','Matching dark decorated glass pair of vases'),/^Metal /)
})
test('query remains bounded and handles unusual source text',()=>{
 assert.ok(visualSearchTerm('Enamelled metal','Left example — gilded and enamelled decorative vase').length<=100)
})
