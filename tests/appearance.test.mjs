import test from 'node:test'
import assert from 'node:assert/strict'
import {appearanceFromPreference} from '../src/lib/appearance.ts'

test('explicit light choice wins against system dark',()=>assert.equal(appearanceFromPreference('light',false),'light'))
test('explicit dark choice wins against system light',()=>assert.equal(appearanceFromPreference('dark',true),'dark'))
test('without preference follow system choice',()=>{
 assert.equal(appearanceFromPreference(null,true),'light')
 assert.equal(appearanceFromPreference(null,false),'dark')
})
test('corrupt storage values do not become arbitrary theme names',()=>assert.equal(appearanceFromPreference('<script>',false),'dark'))
