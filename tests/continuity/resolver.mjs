import {createHash} from 'node:crypto';
export const sha = s => createHash('sha256').update(s).digest('hex');
export class SourceError extends Error { constructor(code){super(code);this.code=code} }
export function resolveApproved(rows, approvals, owner, keys, role='authenticated') {
 if(role!=='authenticated'||!owner)throw new SourceError('ACCESS_DENIED');
 const output={};
 for(const key of keys){
  const pointers=approvals.filter(x=>x.owner_id===owner&&x.document_key===key&&x.approved===true);
  if(pointers.length!==1)throw new SourceError('APPROVAL_COUNT_INVALID');
  const p=pointers[0];
  const matches=rows.filter(r=>r.id===p.document_id&&r.owner_id===owner&&r.document_key===key);
  if(matches.length!==1)throw new SourceError('SOURCE_MISSING_OR_WRONG_OWNER');
  const d=matches[0];
  if(d.source_version!==p.source_version)throw new SourceError('VERSION_MISMATCH');
  if(!d.content || d.content.length<400 || d.content.startsWith('No readable content'))throw new SourceError('INVALID_SOURCE');
  if(d.content_sha256!==sha(d.content)||p.content_sha256!==d.content_sha256)throw new SourceError('HASH_MISMATCH');
  output[key]={id:d.id,source_version:d.source_version,content_sha256:d.content_sha256,content:d.content};
 }
 return output;
}
