import type {SupabaseClient} from '@supabase/supabase-js';

export type ArchiveVersion={id:string;owner_id:string;document_key:string;source_version:string|null;source_class:string;content_sha256:string;ingested_at:string};
export type ArchiveDocument=ArchiveVersion & {content:string;integrity:'MATCH'|'MISMATCH';contentWarning:'placeholder'|'short-import'|null};
const fields='id,owner_id,document_key,source_version,source_class,content_sha256,ingested_at';
const uuid=(x:unknown):x is string=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(x);
function failure(message:string):never{throw new Error(message);}
const requestSignal=(signal?:AbortSignal)=>signal?AbortSignal.any([signal,AbortSignal.timeout(10000)]):AbortSignal.timeout(10000);
async function ownerOf(client:SupabaseClient,signal?:AbortSignal){
  signal?.throwIfAborted();
  const {data,error}=await client.auth.getUser();
  signal?.throwIfAborted();
  if(error||!uuid(data.user?.id))failure('Sign in again to read your source archive.');
  return data.user!.id;
}
function validVersion(value:unknown,owner:string):value is ArchiveVersion{
  if(!value||typeof value!=='object')return false;
  const row=value as ArchiveVersion;
  return uuid(row.id)&&row.owner_id===owner&&typeof row.document_key==='string'&&!!row.document_key.trim()
    &&(row.source_version===null||typeof row.source_version==='string')&&typeof row.source_class==='string'
    &&/^[a-f0-9]{64}$/.test(row.content_sha256)&&typeof row.ingested_at==='string'&&Number.isFinite(Date.parse(row.ingested_at));
}

// Read-only archive inventory, not approval resolution. Never use these results
// as a replacement for the server's explicitly approved-source reader.
export async function loadCanonicalArchive(client:SupabaseClient,signal?:AbortSignal):Promise<ArchiveVersion[]>{
  const owner=await ownerOf(client,signal),rows:ArchiveVersion[]=[],seen=new Set<string>();
  const pageSize=100,maxRows=10000;
  let total:number|undefined;
  for(let offset=0;offset<(total??1);offset+=pageSize){
    const response=await client.from('canonical_documents').select(fields,{count:'exact'}).eq('owner_id',owner)
      .order('document_key',{ascending:true}).order('ingested_at',{ascending:false}).order('id',{ascending:true})
      .range(offset,offset+pageSize-1).abortSignal(requestSignal(signal));
    signal?.throwIfAborted();
    if(response.error)failure('Source archive could not be loaded. Try again.');
    if(typeof response.count!=='number'||!Number.isSafeInteger(response.count)||response.count<0||response.count>maxRows)failure('Source archive count is unavailable or exceeds the review limit.');
    if(total!==undefined&&response.count!==total)failure('Source archive changed while loading. Reload the archive.');
    total=response.count;
    if(!Array.isArray(response.data)||response.data.length!==Math.min(pageSize,total-offset))failure('Source archive is incomplete. Reload the archive.');
    for(const row of response.data){
      if(!validVersion(row,owner)||seen.has(row.id))failure('Source archive returned inconsistent versions. Reload the archive.');
      seen.add(row.id);rows.push(row);
    }
  }
  return rows;
}

export async function readCanonicalArchiveVersion(client:SupabaseClient,expected:ArchiveVersion,signal?:AbortSignal):Promise<ArchiveDocument>{
  const owner=await ownerOf(client,signal);
  if(!validVersion(expected,owner))failure('This archive version is not available for your account.');
  const {data,error}=await client.from('canonical_documents').select(fields+',content')
    .eq('owner_id',owner).eq('id',expected.id).abortSignal(requestSignal(signal)).maybeSingle();
  signal?.throwIfAborted();
  if(error||!data)failure('This archive version could not be read. Reload the archive.');
  const record=data as unknown as ArchiveVersion & {content:string};
  const identityKeys=['id','owner_id','document_key','source_version','content_sha256'] as const;
  if(!validVersion(record,owner)||typeof record.content!=='string'
    ||identityKeys.some(key=>record[key]!==expected[key]))
    failure('This archive version changed. Reload the archive.');
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(record.content));
  signal?.throwIfAborted();
  const actual=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
  return {...record,integrity:actual===record.content_sha256?'MATCH':'MISMATCH',
    contentWarning:record.content.startsWith('No readable content')?'placeholder':[...record.content].length<400?'short-import':null};
}

export function groupArchiveVersions(rows:readonly ArchiveVersion[]){
  const groups=new Map<string,ArchiveVersion[]>();
  for(const row of rows){const list=groups.get(row.document_key)??[];list.push(row);groups.set(row.document_key,list);}
  return [...groups].map(([documentKey,versions])=>({documentKey,versions}));
}
