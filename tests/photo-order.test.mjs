import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {applyPhotoOrder,movePhoto} from '../src/lib/photoOrder.ts'

test('saved order puts the chosen photo first and keeps every photo once',()=>{
 assert.deepEqual(applyPhotoOrder([0,1,2,3],[2,0]),[2,0,1,3])
 assert.deepEqual(applyPhotoOrder([0,1,2],[9,1,1]),[1,0,2])
 assert.deepEqual(applyPhotoOrder([0,1,2],null),[0,1,2])
})
test('dragging moves one photo to the new place',()=>{
 assert.deepEqual(movePhoto([0,1,2,3],3,0),[3,0,1,2])
 assert.deepEqual(movePhoto([0,1,2,3],0,2),[1,2,0,3])
 assert.deepEqual(movePhoto([0,1],0,5),[0,1])
})
test('photo order is its own owner-only table and never touches the saved analysis',()=>{
 const sql=readFileSync(new URL('../supabase/migrations/20261030001000_photo_order.sql',import.meta.url),'utf8')
 assert.match(sql,/create table if not exists public\.ci_photo_order_v1/)
 assert.match(sql,/enable row level security/)
 assert.match(sql,/r\.owner_id=auth\.uid\(\)/)
 assert.doesNotMatch(sql,/update public\.ai_analysis_runs|image_manifest/)
 const screen=readFileSync(new URL('../src/components/ResultScreen.tsx',import.meta.url),'utf8')
 assert.match(screen,/photo 1 is the main photo/)
 assert.match(screen,/draggable onDragStart/)
})
