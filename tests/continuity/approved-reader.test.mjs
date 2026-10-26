import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {loadApprovedCanonicalContext,validateApprovedSourceSet,canonicalCallerKeys,CanonicalSourceError} from '../../src/lib/approvedCanonicalSources.ts';

const owner='00000000-0000-4000-8000-000000000001';
const id='00000000-0000-4000-8000-000000000002';
const config={url:'https://synthetic.invalid',key:'fixture-key',token:'fixture-token'};
const sha=s=>createHash('sha256').update(s).digest('hex');
// No real governing text is copied into test fixtures. Successful policy-pin tests
// need genuine approved policy bytes in a separate authenticated staging acceptance.
const rows=canonicalCallerKeys.research.map(document_key=>({id,owner_id:owner,document_key,source_version:'4.0',content:'synthetic body '.repeat(50),content_sha256:sha('synthetic body '.repeat(50)),approval_event_id:id}));
function mock({auth={id:owner},authStatus=200,status=200,data=rows,range='0-2/3'}={}){
  const calls=[];
  const fetcher=async(url,init)=>{
    calls.push({url,init});
    if(url.endsWith('/auth/v1/user'))return new Response(JSON.stringify(auth),{status:authStatus});
    return new Response(JSON.stringify(data),{status,headers:range?{'Content-Range':range}:{}});
  };
  return {calls,fetcher};
}
async function fails(code,settings={},mode='research'){
  const m=mock(settings);
  await assert.rejects(()=>loadApprovedCanonicalContext(config,mode,m.fetcher),e=>e instanceof CanonicalSourceError && e.code===code);
  return m;
}
test('owner derives only from verified Auth response and request forwards JWT',async()=>{
  const m=await fails('CANONICAL_POLICY_PIN_MISMATCH');
  assert.equal(m.calls.length,2);
  const query=new URL(m.calls[1].url);
  assert.equal(query.pathname,'/rest/v1/ci_canonical_approved_v1');
  assert.equal(query.searchParams.get('owner_id'),`eq.${owner}`);
  assert.equal(query.searchParams.get('limit'),'4');
  assert.equal(m.calls[1].init.headers.Authorization,'Bearer fixture-token');
  assert.equal(m.calls[1].init.headers.Prefer,'count=exact');
  assert.ok(!query.searchParams.has('order'));
});
test('unauthorised user stops before source read',async()=>assert.equal((await fails('CANONICAL_ACCESS_DENIED',{authStatus:401})).calls.length,1));
test('invalid authenticated principal stops before source read',async()=>assert.equal((await fails('CANONICAL_AUTH_INVALID',{auth:{id:'not-a-uuid'}})).calls.length,1));
test('network failure is a safe source error',async()=>assert.rejects(()=>loadApprovedCanonicalContext(config,'research',async()=>{throw Error('secret transport text');}),e=>e.code==='CANONICAL_NETWORK_ERROR' && !e.message.includes('secret')));
test('missing approved view fails, with no raw archive fallback',async()=>assert.equal((await fails('CANONICAL_APPROVED_ACCESS_FAILED',{status:404})).calls.length,2));
test('uncounted response rejected',()=>fails('CANONICAL_RESULT_INCOMPLETE',{range:null}));
test('wildcard total rejected',()=>fails('CANONICAL_RESULT_INCOMPLETE',{range:'0-2/*'}));
test('truncated count rejected',()=>fails('CANONICAL_RESULT_INCOMPLETE',{range:'0-1/3',data:rows.slice(0,2)}));
test('overfull result rejected',()=>fails('CANONICAL_RESULT_INCOMPLETE',{range:'0-2/4'}));
test('wrong response shape rejected',()=>fails('CANONICAL_RESULT_INCOMPLETE',{data:{rows}}));
test('duplicate approval rejected',()=>fails('CANONICAL_APPROVAL_COUNT_INVALID',{data:[rows[0],rows[0],rows[2]]}));
test('other owner rejected',()=>fails('CANONICAL_SOURCE_IDENTITY_INVALID',{data:rows.map(r=>({...r,owner_id:id}))}));
test('missing event receipt rejected',()=>fails('CANONICAL_SOURCE_IDENTITY_INVALID',{data:rows.map(r=>({...r,approval_event_id:null}))}));
test('short content rejected',()=>fails('CANONICAL_SOURCE_INVALID',{data:rows.map(r=>({...r,content:'short'}))}));
test('placeholder rejected',()=>fails('CANONICAL_SOURCE_INVALID',{data:rows.map(r=>({...r,content:'No readable content'+'x'.repeat(500)}))}));
test('body tampering rejected even if stored hash looks valid',()=>fails('CANONICAL_HASH_MISMATCH',{data:rows.map(r=>({...r,content:r.content+'changed'}))}));
test('synthetic governing substitute cannot satisfy pinned policy',()=>fails('CANONICAL_POLICY_PIN_MISMATCH'));
test('unknown caller rejected before Auth',async()=>{const m=mock();await assert.rejects(()=>loadApprovedCanonicalContext(config,'arbitrary',m.fetcher),e=>e.code==='CANONICAL_CALLER_INVALID');assert.equal(m.calls.length,0);});
test('configuration incomplete rejected before Auth',async()=>{const m=mock();await assert.rejects(()=>loadApprovedCanonicalContext({...config,token:''},'research',m.fetcher),e=>e.code==='CANONICAL_CONFIG_MISSING');assert.equal(m.calls.length,0);});
test('valid workflow source returns exact bytes, digest and publication receipt',async()=>{
  const source={...rows[2],document_key:'workflow.md'};
  const result=await validateApprovedSourceSet([source],owner,['workflow.md']);
  assert.equal(result.ownerId,owner);
  assert.equal(result.hashes['workflow.md'],sha(source.content));
  assert.ok(result.instructions.endsWith(source.content));
  assert.deepEqual(result.receipts,[{document_key:'workflow.md',document_id:id,source_version:'4.0',content_sha256:source.content_sha256,approval_event_id:id}]);
});
test('valid workflow sources return deterministic requested order without mutating rows',async()=>{
  const a={...rows[2],document_key:'a.md'},b={...rows[2],document_key:'b.md'};
  const input=Object.freeze([Object.freeze(b),Object.freeze(a)]);
  const result=await validateApprovedSourceSet(input,owner,['a.md','b.md']);
  assert.deepEqual(result.receipts.map(x=>x.document_key),['a.md','b.md']);
  assert.equal(input[0].document_key,'b.md');
});
test('empty or duplicated requested keyset cannot succeed vacuously',async()=>{
  for(const keys of [[],['a.md','a.md']])await assert.rejects(()=>validateApprovedSourceSet([],owner,keys),e=>e.code==='CANONICAL_SOURCE_IDENTITY_INVALID');
});
