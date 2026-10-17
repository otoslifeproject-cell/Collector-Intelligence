import test from 'node:test'
import assert from 'node:assert/strict'
import {safeMetImage,visualSearchTerm} from '../src/lib/openAccessVisual.ts'

test('Open Access source images require exact official Met host and JPEG/PNG path',()=>{
 assert.equal(safeMetImage('https://images.metmuseum.org/CRDImages/ep/web-large/DT1567.jpg'),
   'https://images.metmuseum.org/CRDImages/ep/web-large/DT1567.jpg')
 assert.equal(safeMetImage('https://not-the-met.example/CRDImages/ep/fake.jpg'),null)
 assert.equal(safeMetImage('http://images.metmuseum.org/CRDImages/ep/fake.jpg'),null)
 assert.equal(safeMetImage('https://images.metmuseum.org.evil.example/CRDImages/ep/fake.jpg'),null)
})
test('material correction removes earlier glass assumption from museum search',()=>{
 const q=visualSearchTerm('Metal','Matching dark decorated glass pair of vases')
 assert.match(q,/^Metal /)
 assert.doesNotMatch(q,/glass/i)
})
test('search terms are bounded and useful with material-only queries',()=>{
 assert.ok(visualSearchTerm('Metal','').length<=100)
 assert.ok(visualSearchTerm('Metal','vase '.repeat(100)).length<=100)
})
