import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8')
test('owner photo analysis is exclusively direct OpenAI, with no Vercel gateway fallback',()=>{
 const api=read('api/analyse-intake.ts')
 assert.match(api,/process\.env\.OPENAI_API_KEY/)
 assert.match(api,/https:\/\/api\.openai\.com\/v1\/responses/)
 assert.match(api,/https:\/\/api\.openai\.com\/v1\/models\//)
 assert.match(api,/gpt-6-luna/)
 assert.doesNotMatch(api,/useGateway|ai-gateway\.vercel\.sh|AI_GATEWAY_API_KEY|VERCEL_OIDC_TOKEN/)
})
test('all precharge checks and private diagnostics remain server-side',()=>{
 const api=read('api/analyse-intake.ts')
 for(const stage of ['OPENAI_KEY','MODEL_ACCESS','CANONICAL_POLICY','TRUSTED_KNOWLEDGE','OWNER_CORRECTIONS','SAVED_PHOTOS','CANONICAL_RECHECK','PAID_CLAIM'])
  assert.ok(api.includes("'"+stage+"'"),stage)
 assert.match(api,/ci_intake_stop_events_v1/)
 assert.match(api,/ci_claim_intake_paid_v1/)
 const sql=read('supabase/migrations/20261028170500_paid_intake_claim_ledger_and_private_stops.sql')
 assert.match(sql,/ci_paid_intake_claims_v1/)
 assert.match(sql,/ci_intake_stop_events_v1/)
 assert.match(sql,/advisory_xact_lock/)
})
test('both paths show a large real-stage progress tracker rather than old contradictory labels',()=>{
 const saved=read('src/pages/SavedIntakes.tsx'),intake=read('src/pages/AIIntake.tsx'),tracker=read('src/components/IntakeProgress.tsx')
 for(const s of [saved,intake]){
  assert.match(s,/IntakeProgress/)
  assert.match(s,/setInterval/)
  assert.doesNotMatch(s,/Session retained|Requested · awaiting saved result/)
 }
 for(const label of ['Photos saved','Google Lens','Reading your photos','Questions for you','Deep research','Your result'])
  assert.ok(tracker.includes(label),label)
 assert.match(tracker,/Try again/)
})

test('one run: a single 6-step tracker from upload to result, Google Lens first, never restarted',()=>{
 const tracker=read('src/components/IntakeProgress.tsx'),answer=read('src/components/ResearchAnswer.tsx'),draft=read('src/pages/SavedDraft.tsx')
 assert.match(tracker,/ONE_RUN_STEPS=\['Photos saved','Google Lens','Reading your photos','Questions for you','Deep research','Your result'\]/)
 assert.match(answer,/<ItemProgress step=\{quick\?3:4\}/)
 assert.doesNotMatch(answer.slice(answer.indexOf('export function ResearchRunning')),/'Researching your item'|'Quick check'|'Deep dive'/)
 assert.match(draft,/const showChainRaw=researching\|\|waitingForSaved\|\|chainWillStart/)
 assert.match(draft,/const showChain=showChainRaw&&!questionsPending/)
 assert.match(draft,/The last deep research stopped\./)
 assert.match(draft,/OpenAI says: /)
})
