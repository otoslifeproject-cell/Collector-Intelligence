// Server-side candidate reader. Deliberately NOT wired to live paid routes yet.
// Rollout requires approved publication, Auth/PostgREST acceptance and explicit cutover.
const governingHashes: Record<string,string> = {
  '02_MASTER_PROJECT_BRIEF.md':'4237146b7142b62f9bc423fcbbb42d3205899eef67ca8135cf7dc066904292a2',
  '03_SOURCE_AND_EVIDENCE_POLICY.md':'1eeab79c9ac903ff7ca69b6dcf15f9c38a9e2a273698e910c7926dd60e74b7e4',
};
export const canonicalCallerKeys = Object.freeze({
  intake:Object.freeze(['02_MASTER_PROJECT_BRIEF.md','03_SOURCE_AND_EVIDENCE_POLICY.md','01_PROJECT_INSTRUCTIONS.md','06_PHOTO_EXAMINATION.md'] as const),
  research:Object.freeze(['02_MASTER_PROJECT_BRIEF.md','03_SOURCE_AND_EVIDENCE_POLICY.md','03_COMPARABLE_RESEARCH.md'] as const),
});
export type CanonicalCaller = keyof typeof canonicalCallerKeys;
export type CanonicalSourceConfig = {url:string;key:string;token:string};
type Source = {id:string;owner_id:string;document_key:string;source_version:string;content_sha256:string;content:string;approval_event_id:string};
export class CanonicalSourceError extends Error {
  code:string;
  constructor(code:string){super(code);this.name='CanonicalSourceError';this.code=code;}
}
function fail(code:string):never{throw new CanonicalSourceError(code);}
const uuid=(x:unknown):x is string=>typeof x==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
async function sha256(content:string){
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(content));
  return Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
}

export async function loadApprovedCanonicalContext(config:CanonicalSourceConfig,caller:CanonicalCaller,fetcher:typeof fetch=fetch){
  if(!config.token || !config.key || !config.url)fail('CANONICAL_CONFIG_MISSING');
  if(!Object.hasOwn(canonicalCallerKeys,caller))fail('CANONICAL_CALLER_INVALID');
  const keys:readonly string[]=canonicalCallerKeys[caller];
  const headers={apikey:config.key,Authorization:`Bearer ${config.token}`};
  async function request(path:string,extraHeaders:Record<string,string>={}):Promise<Response>{
    try{return await fetcher(`${config.url.replace(/\/$/,'')}${path}`,{headers:{...headers,...extraHeaders},signal:AbortSignal.timeout(10000)});}
    catch{fail('CANONICAL_NETWORK_ERROR');}
  }
  const auth=await request('/auth/v1/user');
  if(!auth.ok)fail('CANONICAL_ACCESS_DENIED');
  let principal:unknown;
  try{principal=await auth.json();}catch{fail('CANONICAL_AUTH_INVALID');}
  if(!principal || typeof principal!=='object' || !('id' in principal) || !uuid(principal.id))fail('CANONICAL_AUTH_INVALID');
  const owner=(principal as {id:string}).id;
  const qp=new URLSearchParams({
    select:'id,owner_id,document_key,source_version,content_sha256,content,approval_event_id',
    owner_id:`eq.${owner}`,document_key:`in.(${keys.join(',')})`,
    // One extra row detects duplicate/overfull responses. No newest/recency ordering.
    limit:String(keys.length+1),
  });
  const response=await request(`/rest/v1/ci_canonical_approved_v1?${qp}`,{Prefer:'count=exact'});
  if(!response.ok)fail('CANONICAL_APPROVED_ACCESS_FAILED');
  // A partial, capped or uncounted response cannot prove the complete approved set.
  const range=response.headers.get('Content-Range');
  const match=range?.match(/^(\d+)-(\d+)\/(\d+)$/);
  if(!match || Number(match[1])!==0 || Number(match[2])!==keys.length-1 || Number(match[3])!==keys.length)fail('CANONICAL_RESULT_INCOMPLETE');
  let rows:unknown;
  try{rows=await response.json();}catch{fail('CANONICAL_RESULT_INVALID');}
  return validateApprovedSourceSet(rows,owner,keys);
}

// Pure integrity validator, NOT an authentication boundary. Server callers must
// use loadApprovedCanonicalContext, which fixes the key set and verifies Auth.
export async function validateApprovedSourceSet(rows:unknown,owner:string,keys:readonly string[]){
  if(!uuid(owner) || keys.length===0 || new Set(keys).size!==keys.length)fail('CANONICAL_SOURCE_IDENTITY_INVALID');
  if(!Array.isArray(rows) || rows.length!==keys.length)fail('CANONICAL_RESULT_INCOMPLETE');
  const selected:Source[]=[];
  for(const key of keys){
    const candidates=rows.filter(x=>x && typeof x==='object' && x.document_key===key);
    if(candidates.length!==1)fail('CANONICAL_APPROVAL_COUNT_INVALID');
    const source=candidates[0] as Source;
    if(source.owner_id!==owner || !uuid(source.id) || !uuid(source.approval_event_id))fail('CANONICAL_SOURCE_IDENTITY_INVALID');
    if(typeof source.source_version!=='string' || !source.source_version.trim()
      || typeof source.content!=='string' || [...source.content].length<400
      || source.content.startsWith('No readable content'))fail('CANONICAL_SOURCE_INVALID');
    if(source.content_sha256!==await sha256(source.content))fail('CANONICAL_HASH_MISMATCH');
    if(governingHashes[key] && (source.source_version!=='4.0' || source.content_sha256!==governingHashes[key]))fail('CANONICAL_POLICY_PIN_MISMATCH');
    selected.push(source);
  }
  return {
    ownerId:owner,
    instructions:selected.map(x=>`SOURCE DOCUMENT ${x.document_key} [SHA256 ${x.content_sha256}]\n${x.content}`).join('\n\n'),
    hashes:Object.fromEntries(selected.map(x=>[x.document_key,x.content_sha256])),
    receipts:selected.map(x=>({document_key:x.document_key,document_id:x.id,source_version:x.source_version,content_sha256:x.content_sha256,approval_event_id:x.approval_event_id})),
  };
}
