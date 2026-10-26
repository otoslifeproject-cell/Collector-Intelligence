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
test('one-object intake is default with advanced choices folded away',()=>{
 assert.match(intake,/useState<'single'\|'batch'>\('single'\)/)
 assert.match(intake,/<summary>More than one object\? Choose batch mode<\/summary>/)
 assert.match(intake,/<summary>Optional details \(purchase, size, notes\)<\/summary>/)
 assert.match(intake,/> Start research<\/button>/)
})
