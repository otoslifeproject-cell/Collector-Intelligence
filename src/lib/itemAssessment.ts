import type {SupabaseClient} from '@supabase/supabase-js'
import type {Item} from '../types'
import {auditResearch, researchTypes} from './researchSaleDecision.ts'
import type {ResearchAudit, ResearchStatus, ResearchType} from './researchSaleDecision'

export type HoldDecision='DO_NOT_LIST_YET'|'SPECIALIST_REVIEW'
export type HoldAdvice={decision:HoldDecision;rationale:string;unresolvedIssues:string;nextAction:string;routeGuidance:string;confidence:{identification:number|null;dating:number|null;valuation:number|null};sourceRefs:string[]}
export type HoldCheck={id:ResearchType;status:'REQUIRES_REVIEW';observedStatus:ResearchStatus;sourceRefs:string[];executionRef:string|null;checkedAt:string|null;detail:string}
export type HoldPayload=HoldAdvice&{availableChecks:HoldCheck[]}
export type AssessmentContext={item_id:string;owner_id:string;facts_snapshot:Record<string,unknown>;facts_sha256:string}
export type StoredItemAssessment={id:string;owner_id:string;item_id:string;client_event_id:string;decision:HoldDecision;review_status:'OWNER_REPORTED_UNVERIFIED';assessment:HoldPayload;facts_snapshot:Record<string,unknown>;facts_sha256:string;request_fingerprint:string;created_at:string}
export type AssessmentRequest={readonly ownerId:string;readonly itemId:string;readonly eventId:string;readonly context:AssessmentContext;readonly payload:HoldPayload}
export type AssessmentSettlement={row:StoredItemAssessment;current:boolean}
export class ItemAssessmentError extends Error{}
export class ItemAssessmentUnavailableError extends ItemAssessmentError{}
export class ItemAssessmentStaleMissingError extends ItemAssessmentError{}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, sha=/^[0-9a-f]{64}$/
const plain=(value:unknown):value is Record<string,any>=>!!value&&typeof value==='object'&&!Array.isArray(value)
const stable=(value:unknown):string=>JSON.stringify(value,(_key,v)=>plain(v)?Object.fromEntries(Object.keys(v).sort().map(key=>[key,v[key]])):v)
const equal=(a:unknown,b:unknown)=>stable(a)===stable(b)
const freeze=<T,>(value:T):T=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value)}return value}
const stop=(current:()=>boolean)=>{if(!current())throw new ItemAssessmentError('This owner or collection object is no longer selected.')}
const text=(value:unknown,min:number,max:number):value is string=>typeof value==='string'&&value.trim().length>=min&&value.length<=max
const references=(value:unknown)=>Array.isArray(value)&&value.length<=100&&value.every(ref=>text(ref,1,1000))
const confidence=(n:unknown)=>n===null||(typeof n==='number'&&Number.isInteger(n)&&n>=0&&n<=100)
const status=new Set<ResearchStatus>(['NOT_RUN','RUNNING','DONE_EVIDENCED','INCONCLUSIVE','FAILED','BLOCKED','RECEIPT_MISSING'])
const fail=(message:string):never=>{throw new ItemAssessmentError(message)}
function databaseError(error:any,message:string):never{
 if(['42P01','PGRST205','PGRST202'].includes(error?.code))throw new ItemAssessmentUnavailableError('Final assessment storage is not active in this environment. Your review can be exported; no database record has been confirmed.')
 return fail(message)
}
export function validHoldPayload(value:unknown):value is HoldPayload {
 if(!plain(value)||!['DO_NOT_LIST_YET','SPECIALIST_REVIEW'].includes(value.decision)||Object.keys(value).sort().join(',')!=='availableChecks,confidence,decision,nextAction,rationale,routeGuidance,sourceRefs,unresolvedIssues')return false
 if(!text(value.rationale,40,6000)||!['unresolvedIssues','nextAction','routeGuidance'].every(key=>text(value[key],2,6000))||!references(value.sourceRefs))return false
 if(!plain(value.confidence)||Object.keys(value.confidence).sort().join(',')!=='dating,identification,valuation'||!Object.values(value.confidence).every(confidence))return false
 const checks=value.availableChecks
 if(!Array.isArray(checks)||checks.length!==researchTypes.length||new Set(checks.map(c=>c?.id)).size!==researchTypes.length)return false
 return checks.every(c=>plain(c)&&Object.keys(c).sort().join(',')==='checkedAt,detail,executionRef,id,observedStatus,sourceRefs,status'&&researchTypes.includes(c.id)&&c.status==='REQUIRES_REVIEW'&&status.has(c.observedStatus)&&references(c.sourceRefs)&&
  (c.executionRef===null||text(c.executionRef,0,1000))&&(c.checkedAt===null||text(c.checkedAt,0,1000))&&text(c.detail,0,4000))
}
export function holdPayload(advice:HoldAdvice,audit:ResearchAudit):HoldPayload{
 const observed=auditResearch(audit.receipts)
 const payload={...advice,availableChecks:observed.receipts.map(r=>({id:r.type,status:'REQUIRES_REVIEW' as const,observedStatus:r.status,sourceRefs:r.sourceRefs||[],executionRef:r.runId||null,checkedAt:r.checkedAt||null,detail:r.detail||''}))}
 if(!validHoldPayload(payload))return fail('Complete the hold decision, reason, unresolved issues, next action and route guidance. Use whole confidence percentages from 0–100 or leave them unknown.')
 return payload
}
async function authenticate(client:SupabaseClient,ownerId:string,current:()=>boolean){
 stop(current);const auth=await client.auth.getUser();stop(current)
 if(auth.error||auth.data.user?.id!==ownerId)return fail('Sign in as this collection object’s owner before reading or recording a final assessment.')
}
export async function readAssessmentContext(client:SupabaseClient,item:Pick<Item,'id'|'owner_id'>,current:()=>boolean):Promise<AssessmentContext>{
 if(!uuid.test(item.id)||!uuid.test(item.owner_id))return fail('Valid owner and collection object identifiers are required.')
 await authenticate(client,item.owner_id,current)
 const read=await client.from('item_assessment_context_v1').select('item_id,owner_id,facts_snapshot,facts_sha256')
  .eq('item_id',item.id).eq('owner_id',item.owner_id).abortSignal(AbortSignal.timeout(20000)).maybeSingle();stop(current)
 if(read.error)databaseError(read.error,'Current item facts could not be read. Keep your advice and retry the read.')
 const row=read.data
 if(!row||row.item_id!==item.id||row.owner_id!==item.owner_id||!plain(row.facts_snapshot)||row.facts_snapshot.id!==item.id||row.facts_snapshot.owner_id!==item.owner_id||!sha.test(row.facts_sha256))return fail('The owner-scoped item snapshot could not be verified.')
 await authenticate(client,item.owner_id,current)
 return row as AssessmentContext
}
function checkedRow(row:any,item:Pick<Item,'id'|'owner_id'>):StoredItemAssessment{
 if(!plain(row)||!uuid.test(row.id)||!uuid.test(row.client_event_id)||row.owner_id!==item.owner_id||row.item_id!==item.id||
  row.review_status!=='OWNER_REPORTED_UNVERIFIED'||!['DO_NOT_LIST_YET','SPECIALIST_REVIEW'].includes(row.decision)||!validHoldPayload(row.assessment)||row.decision!==row.assessment.decision||
  !plain(row.facts_snapshot)||row.facts_snapshot.id!==item.id||row.facts_snapshot.owner_id!==item.owner_id||!sha.test(row.facts_sha256)||!sha.test(row.request_fingerprint)||typeof row.created_at!=='string'||!Number.isFinite(Date.parse(row.created_at)))return fail('Stored final-assessment history could not be verified. No sale-ready decision is accepted.')
 return row as StoredItemAssessment
}
export async function readAssessmentHistory(client:SupabaseClient,item:Pick<Item,'id'|'owner_id'>,current:()=>boolean):Promise<{context:AssessmentContext;rows:StoredItemAssessment[]}>{
 const context=await readAssessmentContext(client,item,current)
 const rows:StoredItemAssessment[]=[];let total:number|undefined
 do{
  const read=await client.from('item_research_assessments').select('*',{count:'exact'}).eq('owner_id',item.owner_id).eq('item_id',item.id).eq('review_status','OWNER_REPORTED_UNVERIFIED')
   .order('created_at',{ascending:false}).order('id',{ascending:false}).range(rows.length,rows.length+99).abortSignal(AbortSignal.timeout(20000));stop(current)
  if(read.error)databaseError(read.error,'Complete final-assessment history could not be read. Your current advice remains here.')
  if(!read.data||read.count===null||read.count<0||read.count>500||(total!==undefined&&read.count!==total))return fail('Final-assessment history changed or is incomplete. Reload before recording another decision.')
  total=read.count
  if(read.data.length!==Math.min(100,total-rows.length))return fail('Final-assessment history is incomplete. No stored decision has been selected.')
  rows.push(...read.data.map(row=>checkedRow(row,item)))
 }while(rows.length<total)
 if(new Set(rows.map(row=>row.id)).size!==rows.length||new Set(rows.map(row=>row.client_event_id)).size!==rows.length)return fail('Conflicting final-assessment history requires review.')
 const confirmed=await readAssessmentContext(client,item,current)
 if(confirmed.facts_sha256!==context.facts_sha256||!equal(confirmed.facts_snapshot,context.facts_snapshot))return fail('Item facts changed while assessment history loaded. Reload the current record.')
 return {context,rows}
}
export const assessmentIsCurrent=(row:StoredItemAssessment,context:AssessmentContext)=>row.owner_id===context.owner_id&&row.item_id===context.item_id&&row.facts_sha256===context.facts_sha256&&equal(row.facts_snapshot,context.facts_snapshot)
export async function prepareItemAssessment(client:SupabaseClient,item:Item,advice:HoldAdvice,audit:ResearchAudit,current:()=>boolean,eventId=crypto.randomUUID()):Promise<AssessmentRequest>{
 if(!uuid.test(eventId))return fail('A valid immutable client event identifier is required.')
 const payload=holdPayload(advice,audit),context=await readAssessmentContext(client,item,current)
 if(Object.entries(item).some(([key,value])=>!equal(value,context.facts_snapshot[key])))return fail('Save your catalogue edits and reload its current facts before recording a final assessment. Your advice remains here.')
 return freeze(JSON.parse(JSON.stringify({ownerId:item.owner_id,itemId:item.id,eventId,context,payload})))
}
async function inspect(client:SupabaseClient,request:AssessmentRequest,current:()=>boolean):Promise<AssessmentSettlement|null>{
 const item={id:request.itemId,owner_id:request.ownerId}
 const context=await readAssessmentContext(client,item,current)
 const read=await client.from('item_research_assessments').select('*',{count:'exact'}).eq('owner_id',request.ownerId).eq('client_event_id',request.eventId)
  .limit(2).abortSignal(AbortSignal.timeout(20000));stop(current)
 if(read.error)databaseError(read.error,'The same assessment save could not be checked. Keep this page open and use Check saved decision before retrying.')
 if(!read.data||read.count===null||read.count!==read.data.length||read.count>1)return fail('The exact assessment event could not be verified. Keep the held advice and check again.')
 const raw=read.data[0]
 if(raw){
  const row=checkedRow(raw,item)
  if(row.client_event_id!==request.eventId||row.facts_sha256!==request.context.facts_sha256||!equal(row.facts_snapshot,request.context.facts_snapshot)||!equal(row.assessment,request.payload))return fail('This event belongs to different assessment facts. Your held advice was not overwritten.')
  await authenticate(client,request.ownerId,current)
  return {row,current:assessmentIsCurrent(row,context)}
 }
 if(context.facts_sha256!==request.context.facts_sha256||!equal(context.facts_snapshot,request.context.facts_snapshot))throw new ItemAssessmentStaleMissingError('Item facts changed and the exact held event was not found. Export the held advice and start a new review from current facts.')
 await authenticate(client,request.ownerId,current)
 return null
}
export async function settleItemAssessment(client:SupabaseClient,request:AssessmentRequest,current:()=>boolean,submit:boolean):Promise<AssessmentSettlement|null>{
 if(!uuid.test(request.ownerId)||!uuid.test(request.itemId)||!uuid.test(request.eventId)||!sha.test(request.context.facts_sha256)||request.context.owner_id!==request.ownerId||request.context.item_id!==request.itemId||!validHoldPayload(request.payload))return fail('The held assessment request is not valid; no write was attempted.')
 const saved=await inspect(client,request,current)
 if(saved||!submit)return saved
 stop(current)
 // Acknowledgements (including successful-looking ones) are not save evidence.
 try{await client.rpc('ci_record_item_hold_assessment_v1',{p_item_id:request.itemId,p_client_event_id:request.eventId,p_expected_facts_sha256:request.context.facts_sha256,p_assessment:request.payload}).abortSignal(AbortSignal.timeout(20000))}catch{/* Resolve only by independent GET readback. */}
 stop(current)
 return inspect(client,request,current)
}
