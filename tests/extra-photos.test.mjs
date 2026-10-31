import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {listingPhotoPaths} from '../src/lib/extraPhotos.ts'

test('listing photos: owner order first, extras included, hidden ones left out',()=>{
 const item=[{storage_path:'u/intake/a.jpg',position:0},{storage_path:'u/intake/b.jpg',position:1}]
 const extra=[{photo_key:1000,storage_path:'u/extra/r/c.jpg'},{photo_key:1001,storage_path:'u/extra/r/d.jpg'}]
 assert.deepEqual(listingPhotoPaths(item,extra,{photo_order:[1001,0],hidden:[1]}),['u/extra/r/d.jpg','u/intake/a.jpg','u/extra/r/c.jpg'])
 assert.deepEqual(listingPhotoPaths(item,extra,null),['u/intake/a.jpg','u/intake/b.jpg','u/extra/r/c.jpg','u/extra/r/d.jpg'])
})
test('extra photos live in their own owner-only table; the original analysis is never touched',()=>{
 const sql=readFileSync(new URL('../supabase/migrations/20261031210000_extra_photos.sql',import.meta.url),'utf8')
 assert.match(sql,/create table if not exists public\.ci_extra_photos_v1/)
 assert.match(sql,/storage_path like auth\.uid\(\)::text\|\|'\/extra\/%'/)
 assert.match(sql,/add column if not exists hidden integer\[\]/)
 assert.doesNotMatch(sql,/update public\.ai_analysis_runs|image_manifest/)
 const screen=readFileSync(new URL('../src/components/ResultScreen.tsx',import.meta.url),'utf8')
 assert.match(screen,/\+ Add photos/)
})
