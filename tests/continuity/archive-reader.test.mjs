import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {loadCanonicalArchive,readCanonicalArchiveVersion,groupArchiveVersions} from '../../src/lib/canonicalArchive.ts';

const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const text='Original UTF-8 source — preserve the final newline.\n'+'x'.repeat(450)+'\n';
const hash=s=>createHash('sha256').update(s).digest('hex');
const row=(n,extra={})=>({id:'00000000-0000-4000-8000-'+String(n).padStart(12,'0'),owner_id:A,document_key:'workflow.md',source_version:'archive-'+n,source_class:'WORKFLOW_SKILL',content_sha256:hash(text),ingested_at:'2026-10-20T12:00:00.000Z',...extra});
function fixture({rows=[row(1)],page,document,owner=A,authError=null}={}){
  const requests=[];
  const client=createClient('http://fixture.invalid','fixture-public-key',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(input,init)=>{
    const url=new URL(input);requests.push({url,init});
    assert.equal(url.pathname,'/rest/v1/canonical_documents');assert.equal(url.searchParams.get('owner_id'),'eq.'+owner);
    if(url.searchParams.get('id'))return new Response(JSON.stringify(document===undefined?[{...rows[0],content:text}]:document),{status:200,headers:{'Content-Type':'application/json'}});
    assert.equal(url.searchParams.get('order'),'document_key.asc,ingested_at.desc,id.asc');
    const offset=Number(url.searchParams.get('offset')||0),limit=Number(url.searchParams.get('limit'));
    assert.equal(limit,100);assert.ok(!url.searchParams.get('select').split(',').includes('content'));
    const result=page?page(offset):{data:rows.slice(offset,offset+limit),count:rows.length};
    return new Response(JSON.stringify(result.data),{status:result.status||200,headers:{'Content-Type':'application/json',...(result.count===null?{}:{'Content-Range':`${offset}-${offset+result.data.length-1}/${result.count}`})}});
  }}});
  client.auth.getUser=async()=>({data:{user:owner?{id:owner}:null},error:authError});
  return {client,requests};
}
test('all 205 archived versions are loaded over three deterministic counted pages',async()=>{
  const f=fixture({rows:Array.from({length:205},(_,n)=>row(n+1))});
  const rows=await loadCanonicalArchive(f.client);assert.equal(rows.length,205);assert.equal(f.requests.length,3);
  assert.equal(groupArchiveVersions(rows)[0].versions.length,205);
});
test('empty owner archive is an actual counted empty result',async()=>assert.deepEqual(await loadCanonicalArchive(fixture({rows:[]}).client),[]));
test('archive versions with no recorded source version remain visible',async()=>{
  const rows=await loadCanonicalArchive(fixture({rows:[row(1,{source_version:null})]}).client);assert.equal(rows[0].source_version,null);
});
for(const [name,options,pattern] of [
  ['missing exact count',{page:()=>({data:[row(1)],count:null})},/count is unavailable/],
  ['review limit exceeded',{page:()=>({data:[row(1)],count:10001})},/review limit/],
  ['partial page',{page:()=>({data:[row(1)],count:101})},/incomplete/],
  ['duplicate identities',{rows:[row(1),row(1)]},/inconsistent/],
  ['cross-owner result',{rows:[row(1,{owner_id:B})]},/inconsistent/],
  ['malformed metadata',{rows:[row(1,{content_sha256:'not-a-digest'})]},/inconsistent/],
  ['server error',{page:()=>({data:{message:'Unavailable'},count:null,status:503})},/could not be loaded/],
  ['count changed between pages',{page:offset=>({data:Array.from({length:100},(_,n)=>row(offset+n+1)),count:offset?201:200})},/changed while loading/],
])test(name+' does not produce a misleading complete archive',async()=>assert.rejects(loadCanonicalArchive(fixture(options).client),pattern));
test('invalid or absent verified principal prevents any archive request',async()=>{
  for(const owner of [null,'not-a-user']){const f=fixture({owner});await assert.rejects(loadCanonicalArchive(f.client),/Sign in again/);assert.equal(f.requests.length,0);}
});
test('owner content read recomputes the exact UTF-8/newline digest',async()=>{
  const f=fixture(),doc=await readCanonicalArchiveVersion(f.client,row(1));
  assert.equal(doc.content,text);assert.equal(doc.integrity,'MATCH');assert.equal(doc.contentWarning,null);
  assert.equal(f.requests[0].url.searchParams.get('id'),'eq.'+row(1).id);
});
test('tampered body is preserved for inspection with a hash mismatch, never verified',async()=>{
  const f=fixture({document:[{...row(1),content:text.trimEnd()}]});
  assert.equal((await readCanonicalArchiveVersion(f.client,row(1))).integrity,'MISMATCH');
});
test('a valid digest does not turn a short import or placeholder into an instruction',async()=>{
  for(const [content,warning] of [['Short archived text','short-import'],['No readable content was returned for this source','placeholder']]){
    const metadata=row(1,{content_sha256:hash(content)}),f=fixture({rows:[metadata],document:[{...metadata,content}]});
    const doc=await readCanonicalArchiveVersion(f.client,metadata);assert.equal(doc.integrity,'MATCH');assert.equal(doc.contentWarning,warning);
  }
});
test('account switch blocks opening a previous owner version before querying content',async()=>{
  const f=fixture({owner:B});await assert.rejects(readCanonicalArchiveVersion(f.client,row(1)),/not available for your account/);assert.equal(f.requests.length,0);
});
test('missing or changed exact source identity cannot be displayed as the selected version',async()=>{
  for(const document of [[],[{...row(1),source_version:'different',content:text}]])await assert.rejects(readCanonicalArchiveVersion(fixture({document}).client,row(1)),/could not be read|version changed/);
});
test('already-aborted reads cannot issue network requests',async()=>{
  const controller=new AbortController();controller.abort();const f=fixture();
  await assert.rejects(loadCanonicalArchive(f.client,controller.signal));await assert.rejects(readCanonicalArchiveVersion(f.client,row(1),controller.signal));assert.equal(f.requests.length,0);
});
test('grouping preserves every distinct version without changing input order',()=>{
  const rows=[row(1),row(2,{document_key:'another.md'}),row(3)];
  const before=structuredClone(rows),groups=groupArchiveVersions(rows);
  assert.deepEqual(groups.map(g=>g.versions.map(v=>v.id)),[[rows[0].id,rows[2].id],[rows[1].id]]);assert.deepEqual(rows,before);
});
