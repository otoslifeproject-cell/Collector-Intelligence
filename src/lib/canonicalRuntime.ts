import {loadApprovedCanonicalContext,CanonicalSourceError} from './approvedCanonicalSources.ts';
import type {CanonicalCaller,CanonicalSourceConfig} from './approvedCanonicalSources.ts';

type Approved=Awaited<ReturnType<typeof loadApprovedCanonicalContext>>;
type Legacy={instructions:string;hashes:Record<string,string>};
export type CanonicalRuntimeContext=Legacy & {
  sourceMode:'APPROVED_V1'|'LEGACY_PINNED';
  receipts:Approved['receipts'];
  ownerId?:string;
  validatedAt:string;
};
// Server-only opt-in. An absent mode retains the existing deployed loader.
// Production publication/cutover is an explicit separate operation, never automatic.
function modeOf(value:string|undefined){
  if(value===undefined || value==='' || value==='legacy')return 'LEGACY_PINNED';
  if(value==='approved-v1')return 'APPROVED_V1';
  throw new CanonicalSourceError('CANONICAL_MODE_INVALID');
}
export async function loadCanonicalForCaller(
  config:CanonicalSourceConfig,caller:CanonicalCaller,mode:string|undefined,
  legacy:()=>Promise<Legacy>,fetcher:typeof fetch=fetch,
):Promise<CanonicalRuntimeContext>{
  const sourceMode=modeOf(mode);
  if(sourceMode==='LEGACY_PINNED')return {...await legacy(),sourceMode,receipts:[],validatedAt:new Date().toISOString()};
  // Never call legacy if approvals are missing, revoked or inaccessible.
  return {...await loadApprovedCanonicalContext(config,caller,fetcher),sourceMode,validatedAt:new Date().toISOString()};
}
export async function revalidateCanonicalBeforePaidCall(
  config:CanonicalSourceConfig,caller:CanonicalCaller,expected:CanonicalRuntimeContext,fetcher:typeof fetch=fetch,
):Promise<CanonicalRuntimeContext>{
  if(expected.sourceMode==='LEGACY_PINNED')return expected;
  const current=await loadApprovedCanonicalContext(config,caller,fetcher);
  if(current.ownerId!==expected.ownerId || JSON.stringify(current.receipts)!==JSON.stringify(expected.receipts))
    throw new CanonicalSourceError('CANONICAL_APPROVAL_CHANGED');
  return {...current,sourceMode:'APPROVED_V1',validatedAt:new Date().toISOString()};
}
export function canonicalSourceAudit(context:CanonicalRuntimeContext){
  return {schema_version:1,resolution_mode:context.sourceMode,validated_at:context.validatedAt,
    owner_id:context.ownerId??null,publication_receipts:context.receipts};
}
