import assert from 'node:assert/strict';
import { resolveApproved, SourceError, sha } from './resolver.mjs';

const owner='owner-a';
const keys=['02_MASTER_PROJECT_BRIEF.md','03_SOURCE_AND_EVIDENCE_POLICY.md','06_PHOTO_EXAMINATION.md'];
const document=(key,i)=>{const content=`Document ${i}: `+'a'.repeat(500);return {id:`doc-${i}`,owner_id:owner,document_key:key,source_version:'4.0',content,content_sha256:sha(content)}};
const docs=keys.map(document);
const approvals=docs.map(d=>({owner_id:owner,document_key:d.document_key,document_id:d.id,source_version:d.source_version,content_sha256:d.content_sha256,approved:true}));
let passed=0;
function expectFailure(label,code,run){assert.throws(run,e=>e instanceof SourceError&&e.code===code);passed++;console.log('PASS',label)}
assert.deepEqual(Object.keys(resolveApproved(docs,approvals,owner,keys)),keys);passed++;console.log('PASS all requested documents returned');
expectFailure('missing required key fails entire request','APPROVAL_COUNT_INVALID',()=>resolveApproved(docs,approvals.slice(0,2),owner,keys));
expectFailure('missing underlying document fails entire request','SOURCE_MISSING_OR_WRONG_OWNER',()=>resolveApproved(docs.slice(0,2),approvals,owner,keys));
expectFailure('missing source in truncated query fails closed','SOURCE_MISSING_OR_WRONG_OWNER',()=>resolveApproved(docs.slice(1),approvals,owner,keys));
expectFailure('duplicate approved pointer for one key fails entire request','APPROVAL_COUNT_INVALID',()=>resolveApproved(docs,[...approvals,approvals[1]],owner,keys));
expectFailure('different owner approval cannot be substituted','APPROVAL_COUNT_INVALID',()=>resolveApproved(docs,approvals.map(a=>a.document_key===keys[2]?{...a,owner_id:'owner-b'}:a),owner,keys));
expectFailure('one altered body fails entire request','HASH_MISMATCH',()=>resolveApproved(docs.map(d=>d.document_key===keys[2]?{...d,content:'tampered'.repeat(90)}:d),approvals,owner,keys));
console.log(`${passed} multi-document fail-closed assertions passed`);
