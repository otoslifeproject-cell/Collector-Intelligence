import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8')
const intake=readFileSync(new URL('../src/pages/AIIntake.tsx',import.meta.url),'utf8')
const home=readFileSync(new URL('../src/pages/Dashboard.tsx',import.meta.url),'utf8')
test('legacy add and intake converge on one photographed route',()=>{
 assert.match(app,/<Route path="\/new" element=\{<Navigate to="\/intake" replace\/>\}\/>/)
 assert.ok(home.includes("label:'Add item'"))
})
test('one-object intake is default with two visible choices and optional-details button',()=>{
 assert.match(intake,/useState<'single'\|'batch'>\('single'\)/)
 assert.match(intake,/role="group" aria-label="Number of objects"/)
 assert.match(intake,/Add details \(optional\)/)
 assert.match(intake,/> Analyse photos<\/button>/)
})

test('real-stage progress has no invented or contradictory analysis status',()=>{
 assert.match(intake,/IntakeProgress/)
 assert.match(intake,/FIRST_PASS_SAVED/)
 assert.match(intake,/PROCESSING/)
 assert.doesNotMatch(intake,/Session retained|Requested · awaiting saved result|100% complete|Visual matches found/)
})
