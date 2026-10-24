import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {inspectSourceReviewBundle} from '../../scripts/check-source-review-bundle.mjs';

const root=new URL('../../',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('docs/source-reconciliation/manifest.json',root),'utf8'));
const clone=()=>structuredClone(manifest);
const inspect=async(m,read)=>inspectSourceReviewBundle(m,read);
test('actual source bytes are intact; missing v4.3 cannot fall back to historical v4.1',async()=>{
  const result=await inspect(manifest);
  assert.equal(result.integrity,'PASS');assert.equal(result.publication,'BLOCKED');assert.equal(result.publication_authorized,false);
  assert.equal(result.verified.length,6);assert.equal(result.blockers.length,3);
  assert.ok(result.verified.some(x=>x.document_key==='01_PROJECT_INSTRUCTIONS.md'&&x.kind==='historical'&&x.source_version==='4.1'));
  assert.ok(!result.verified.some(x=>x.document_key==='01_PROJECT_INSTRUCTIONS.md'&&x.kind==='candidate'));
});
test('a stale instructions manuscript cannot be relabelled as the current candidate',async()=>{
  const m=clone(),row=m.sources.find(x=>x.document_key==='01_PROJECT_INSTRUCTIONS.md');
  row.review_state='needs-semantic-review';row.candidate=row.preserved[0];
  await assert.rejects(inspect(m),/required version mismatch/);
});
for(const scenario of ['missing key','duplicate key','extra key'])test('review refuses '+scenario,async()=>{
  const m=clone();if(scenario==='missing key')m.sources.pop();else if(scenario==='duplicate key')m.sources[0]=m.sources[1];else m.sources.push({...m.sources[0],document_key:'unrelated'});
  await assert.rejects(inspect(m),/exact caller key union/);
});
test('a final-newline change is detected even if characters remain readable',async()=>{
  await assert.rejects(inspect(manifest,async path=>Buffer.from((await readFile(new URL(path,root),'utf8')).trimEnd())),/byte\/hash mismatch/);
});
test('changed source bytes cannot use an unchanged stored digest',async()=>{
  await assert.rejects(inspect(manifest,async path=>Buffer.from((await readFile(new URL(path,root),'utf8')).replace('MASTER','ALTERED'))),/byte\/hash mismatch/);
});
test('recomputed metadata does not bypass the frozen governing v4.0 hash',async()=>{
  const m=clone(),source=m.sources[0].candidate,content=Buffer.from('ALTERED POLICY '+ 'x'.repeat(500));
  source.sha256=createHash('sha256').update(content).digest('hex');source.utf8_bytes=content.length;
  await assert.rejects(inspect(m,async()=>content),/controlling policy pin mismatch/);
});
test('review metadata cannot turn the manifest into an activation plan',async()=>{
  const m=clone();m.purpose='publish';await assert.rejects(inspect(m),/review-only schema/);
});
test('historical instructions cannot fill an explicitly missing manuscript',async()=>{
  const m=clone(),row=m.sources[2];row.candidate=row.preserved[0];await assert.rejects(inspect(m),/must stay absent/);
});
test('source bundle cannot read paths outside the source directories',async()=>{
  const m=clone();m.sources[0].candidate.path='../../outside.md';await assert.rejects(inspect(m),/path invalid/);
});
test('proposed comparable hierarchy matches the v4.0 policy, preserving old conflict separately',async()=>{
  const policy=await readFile(new URL('tests/fixtures/governing-v4/03_SOURCE_AND_EVIDENCE_POLICY.md',root),'utf8');
  const draft=await readFile(new URL('docs/source-reconciliation/proposed/03_COMPARABLE_RESEARCH.md',root),'utf8');
  const old=await readFile(new URL('tests/fixtures/source-archive/03_COMPARABLE_RESEARCH.md',root),'utf8');
  const tiers=s=>s.slice(s.indexOf('### Tier A'),s.indexOf('Tier D is context'));
  assert.equal(tiers(draft),tiers(policy));assert.match(old,/Tier C: specialist dealers; 1stDibs/);
  assert.match(draft,/REVIEW CANDIDATE/);assert.match(draft,/model-generated label is not verification/);
});
