import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {canonicalCallerKeys} from '../../src/lib/approvedCanonicalSources.ts';
import {loadCanonicalForCaller,revalidateCanonicalBeforePaidCall,canonicalSourceAudit} from '../../src/lib/canonicalRuntime.ts';

const owner='00000000-0000-4000-8000-000000000001';
const id='00000000-0000-4000-8000-000000000002';
const event='00000000-0000-4000-8000-000000000003';
const config={url:'https://synthetic.invalid',key:'fixture',token:'fixture'};
async function sources(){return Promise.all(canonicalCallerKeys.research.map(async key=>{
  const content=key==='03_COMPARABLE_RESEARCH.md'?'Synthetic workflow. '+'x'.repeat(500):await readFile(new URL('../fixtures/governing-v4/'+key,import.meta.url),'utf8');
  return {id,owner_id:owner,document_key:key,source_version:key==='03_COMPARABLE_RESEARCH.md'?'fixture':'4.0',content,content_sha256:createHash('sha256').update(content).digest('hex'),approval_event_id:event};
}));}
function fetchRows(rows){return async url=>url.endsWith('/auth/v1/user')?new Response(JSON.stringify({id:owner})):new Response(JSON.stringify(rows),{headers:{'Content-Range':rows.length?`0-${rows.length-1}/${rows.length}`:'*/0'}});}
test('absent flag preserves legacy loader and honestly labels its audit',async()=>{
  let calls=0;const result=await loadCanonicalForCaller(config,'research',undefined,async()=>{calls++;return {instructions:'existing',hashes:{legacy:'old'}};},()=>{throw Error('unexpected approved query');});
  assert.equal(calls,1);assert.equal(result.instructions,'existing');assert.equal(result.sourceMode,'LEGACY_PINNED');assert.deepEqual(canonicalSourceAudit(result).publication_receipts,[]);
});
test('invalid server flag fails closed before either loader',async()=>assert.rejects(()=>loadCanonicalForCaller(config,'research','approvd',()=>{throw Error('unexpected legacy');}),e=>e.code==='CANONICAL_MODE_INVALID'));
test('approved mode uses genuine governing bytes and never legacy fallback',async()=>{
  const result=await loadCanonicalForCaller(config,'research','approved-v1',()=>{throw Error('unexpected legacy');},fetchRows(await sources()));
  assert.equal(result.sourceMode,'APPROVED_V1');assert.equal(result.receipts.length,3);assert.equal(canonicalSourceAudit(result).owner_id,owner);
});
test('missing approval does not invoke legacy or paid callback',async()=>{
  let legacy=0,paid=0;
  await assert.rejects(async()=>{await loadCanonicalForCaller(config,'research','approved-v1',async()=>{legacy++;return {instructions:'',hashes:{}};},fetchRows([]));paid++;},e=>e.code==='CANONICAL_RESULT_INCOMPLETE');
  assert.equal(legacy,0);assert.equal(paid,0);
});
test('same approval receipts pass a pre-dispatch recheck',async()=>{
  const rows=await sources(),fetcher=fetchRows(rows);
  const first=await loadCanonicalForCaller(config,'research','approved-v1',()=>{throw Error('legacy');},fetcher);
  const current=await revalidateCanonicalBeforePaidCall(config,'research',first,fetcher);
  assert.deepEqual(current.receipts,first.receipts);assert.equal(current.instructions,first.instructions);
});
test('new approval of same exact bytes invalidates old dispatch snapshot',async()=>{
  const rows=await sources();const first=await loadCanonicalForCaller(config,'research','approved-v1',()=>{throw Error('legacy');},fetchRows(rows));
  const changed=rows.map(r=>({...r,approval_event_id:owner}));
  await assert.rejects(()=>revalidateCanonicalBeforePaidCall(config,'research',first,fetchRows(changed)),e=>e.code==='CANONICAL_APPROVAL_CHANGED');
});
test('revoked required source fails recheck before paid operation',async()=>{
  const first=await loadCanonicalForCaller(config,'research','approved-v1',()=>{throw Error('legacy');},fetchRows(await sources()));
  let paid=0;await assert.rejects(async()=>{await revalidateCanonicalBeforePaidCall(config,'research',first,fetchRows([]));paid++;},e=>e.code==='CANONICAL_RESULT_INCOMPLETE');assert.equal(paid,0);
});
test('caller keysets cannot be mutated accidentally at runtime',()=>{
  assert.throws(()=>canonicalCallerKeys.research.push('other.md'),TypeError);
  assert.throws(()=>{canonicalCallerKeys.research=[];},TypeError);
});
