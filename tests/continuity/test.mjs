import assert from 'node:assert/strict';
import {resolveApproved,SourceError,sha} from './resolver.mjs';
const owner='owner-a', key='02_MASTER_PROJECT_BRIEF.md', txt='Governing source. '+ 'a'.repeat(500);
const doc={id:'d1',owner_id:owner,document_key:key,source_version:'4.0',content:txt,content_sha256:sha(txt),is_current:true};
const appr={owner_id:owner,document_key:key,document_id:'d1',source_version:'4.0',content_sha256:sha(txt),approved:true};
let passed=0;function ok(name,fn){fn();passed++;console.log('PASS',name)}
function rejected(name,code,rows=[doc],approvals=[appr],who=owner,keys=[key],role='authenticated'){ok(name,()=>assert.throws(()=>resolveApproved(rows,approvals,who,keys,role),e=>e instanceof SourceError&&e.code===code))}
ok('A one approved valid source',()=>assert.equal(resolveApproved([doc],[appr],owner,[key])[key].id,'d1'));
rejected('B conflicting current rows with no approved pointer','APPROVAL_COUNT_INVALID',[doc,{...doc,id:'d2',content:'b'.repeat(500),content_sha256:sha('b'.repeat(500))}],[]);
rejected('C two approved pointers','APPROVAL_COUNT_INVALID',[doc],[appr,{...appr,document_id:'d2'}]);
rejected('D missing pointer','APPROVAL_COUNT_INVALID',[doc],[]);
rejected('E altered document hash','HASH_MISMATCH',[{...doc,content:'c'.repeat(500)}]);
rejected('F placeholder source','INVALID_SOURCE',[{...doc,content:'No readable content '+'a'.repeat(500)}]);
rejected('G different owner','APPROVAL_COUNT_INVALID',[doc],[appr],'owner-b');
rejected('H anonymous user','ACCESS_DENIED',[doc],[appr],owner,[key],'anon');
ok('I newest is not authoritative',()=>assert.equal(resolveApproved([doc,{...doc,id:'d2',source_version:'4.2',content:'z'.repeat(500),content_sha256:sha('z'.repeat(500)),ingested_at:'2099'}],[appr],owner,[key])[key].id,'d1'));
ok('J both callers get identical pin',()=>assert.equal(resolveApproved([doc],[appr],owner,[key])[key].content_sha256,resolveApproved([doc],[appr],owner,[key])[key].content_sha256));
rejected('K conflicting approval during publication','APPROVAL_COUNT_INVALID',[doc],[appr,{...appr,document_id:'d2'}]);
rejected('L no source means no output','SOURCE_MISSING_OR_WRONG_OWNER',[]);
ok('M source arrays remain immutable',()=>{const a=[doc],b=[appr];resolveApproved(a,b,owner,[key]);assert.equal(a.length,1);assert.equal(b.length,1)});
ok('N new version selected by explicitly changed approval',()=>{const v={...doc,id:'d2',source_version:'5.0',content:'new'.repeat(200),content_sha256:sha('new'.repeat(200))};assert.equal(resolveApproved([doc,v],[{...appr,document_id:'d2',source_version:'5.0',content_sha256:v.content_sha256}],owner,[key])[key].id,'d2')});
ok('O no side effect on unrelated record',()=>{const other={...doc,id:'d3',owner_id:'other'};resolveApproved([doc,other],[appr],owner,[key]);assert.equal(other.owner_id,'other')});
rejected('P tampered approved hash','HASH_MISMATCH',[doc],[{...appr,content_sha256:'bad'}]);
rejected('Q empty body','INVALID_SOURCE',[{...doc,content:''}]);
rejected('R mismatched version','VERSION_MISMATCH',[doc],[{...appr,source_version:'5.0'}]);
console.log(`${passed} offline fixture assertions passed`);
