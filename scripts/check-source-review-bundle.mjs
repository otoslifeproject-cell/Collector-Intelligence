#!/usr/bin/env node
// Offline preservation/review check. No database, publication or environment writes.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {canonicalCallerKeys} from '../src/lib/approvedCanonicalSources.ts';

const root=new URL('../',import.meta.url);
const policyPins={
  '02_MASTER_PROJECT_BRIEF.md':'4237146b7142b62f9bc423fcbbb42d3205899eef67ca8135cf7dc066904292a2',
  '03_SOURCE_AND_EVIDENCE_POLICY.md':'1eeab79c9ac903ff7ca69b6dcf15f9c38a9e2a273698e910c7926dd60e74b7e4',
};
const requiredKeys=[...new Set(Object.values(canonicalCallerKeys).flat())];
const states=['policy-pinned','needs-semantic-review','missing-exact-current'];
const sha=b=>createHash('sha256').update(b).digest('hex');
function fail(message){throw new Error('SOURCE_REVIEW_INVALID: '+message);}

export async function inspectSourceReviewBundle(manifest,read=path=>readFile(new URL(path,root))){
  if(manifest?.schema_version!==1 || manifest.purpose!=='review-only' || !Array.isArray(manifest.sources))fail('review-only schema required');
  const keys=manifest.sources.map(x=>x?.document_key);
  if(keys.length!==requiredKeys.length || new Set(keys).size!==keys.length || requiredKeys.some(k=>!keys.includes(k)))fail('exact caller key union required');
  const verified=[],blockers=[];
  for(const row of manifest.sources){
    if(!states.includes(row.review_state) || !Array.isArray(row.preserved))fail('review state/history invalid');
    if(row.review_state==='missing-exact-current'){
      if(row.candidate!==null || typeof row.required_version!=='string' || !row.required_version.trim())fail('missing current manuscript must stay absent');
      blockers.push({document_key:row.document_key,reason:'Exact required manuscript unavailable',required_version:row.required_version});
    }else if(!row.candidate)fail('candidate missing');
    else if(row.review_state==='needs-semantic-review')blockers.push({document_key:row.document_key,reason:'Semantic review and explicit publication decision pending'});
    const manuscripts=[...(row.candidate?[['candidate',row.candidate]]:[]),...row.preserved.map(x=>['historical',x])];
    for(const [kind,source] of manuscripts){
      if(typeof source.path!=='string' || !/^(tests\/fixtures\/(governing-v4|source-archive)|docs\/source-reconciliation\/proposed)\/[A-Za-z0-9_-]+\.md$/.test(source.path))fail('manuscript path invalid');
      if(typeof source.source_version!=='string' || !source.source_version.trim() || !/^[a-f0-9]{64}$/.test(source.sha256) || !Number.isInteger(source.utf8_bytes))fail('exact manuscript identity required');
      const bytes=await read(source.path);
      let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{fail('invalid UTF-8');}
      if(bytes.length!==source.utf8_bytes || sha(bytes)!==source.sha256)fail('byte/hash mismatch: '+source.path);
      if([...text].length<400 || text.startsWith('No readable content'))fail('placeholder/short manuscript');
      if(kind==='candidate' && row.required_version!==null && source.source_version!==row.required_version)fail('required version mismatch');
      if(policyPins[row.document_key] && (source.source_version!=='4.0' || source.sha256!==policyPins[row.document_key] || row.review_state!=='policy-pinned'))fail('controlling policy pin mismatch');
      if(row.review_state==='policy-pinned' && !policyPins[row.document_key])fail('workflow cannot declare itself a governing policy');
      verified.push({document_key:row.document_key,kind,...source,unicode_characters:[...text].length});
    }
  }
  return {integrity:'PASS',purpose:'review-only',publication:'BLOCKED',publication_authorized:false,verified,blockers};
}

if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  const manifest=JSON.parse(await readFile(new URL('docs/source-reconciliation/manifest.json',root),'utf8'));
  console.log(JSON.stringify(await inspectSourceReviewBundle(manifest),null,2));
}
