// Native, bounded workflow receipts. These roles do not certify the separate
// seven-category research audit and never dispatch a provider or publish a lot.
import type {SupabaseClient} from '@supabase/supabase-js'
import type {Item} from '../types'
import {researchTypes} from './researchSaleDecision.ts'
import type {ResearchType} from './researchSaleDecision'
import {readAssessmentContext} from './itemAssessment.ts'
import type {AssessmentContext} from './itemAssessment'
import {readItemPhotographs} from './itemPhotographs.ts'
import type {OwnedPhotograph} from './itemPhotographs'

export const armyRoles=['COORDINATOR','PHOTO_EXAMINER','ATTRIBUTION_RESEARCHER','RIVAL_CHALLENGER','SOURCE_VERIFIER','COMPARABLE_SPECIALIST','SELLING_REVIEWER'] as const
export type ArmyRole=typeof armyRoles[number]
export const armyRoleTitles:Record<ArmyRole,string>={COORDINATOR:'Coordinator',PHOTO_EXAMINER:'Object and photograph examiner',ATTRIBUTION_RESEARCHER:'Documentary attribution researcher',RIVAL_CHALLENGER:'Adversarial rival challenger',SOURCE_VERIFIER:'Independent source verifier',COMPARABLE_SPECIALIST:'Achieved-price comparable specialist',SELLING_REVIEWER:'Selling economics and grouping reviewer'}
export type ArmyStatus='NOT_RUN'|'RUNNING'|'INCONCLUSIVE'|'EVIDENCED'|'BLOCKED'|'FAILED'
export type ArmyRoleReport={categoryIds:ResearchType[];question:string;query:string;tool:string;summary:string;sourceUrls:string[];photoIds:string[];unresolvedIssues:string;hypotheses:{candidate:string;status:'SUPPORTED'|'REJECTED'|'UNRESOLVED';reason:string;sourceUrls:string[]}[];disagreements:string[];outcome:'INCONCLUSIVE'|'BLOCKED'|'FAILED'}
type ArmyBase={version:1;eventId:string;workflowId:string;ownerId:string;itemId:string;factsSha256:string;createdAt:string;executorId:string;providerAmount:0;providerCalls:0}
export type ArmyPlan=ArmyBase&{kind:'PLAN';role:null;taskId:null;status:'NOT_RUN';payload:{objective:string;photoIds:string[];tasks:{role:ArmyRole;taskId:string}[]}}
export type ArmyEvent=ArmyBase&{attestationCurrent?:boolean;kind:'START'|'RESULT'|'ATTESTATION';role:ArmyRole;taskId:string;status:Exclude<ArmyStatus,'NOT_RUN'>;startedAt:string;finishedAt:string|null;payload:{report:ArmyRoleReport;startEventId:string|null;resultEventId?:string;assessmentId?:string;reviewerId?:string;rationale?:string;sourceRefs?:string[]}}
export type ArmyRecord=ArmyPlan|ArmyEvent
export type ArmyWorkflow={plan:ArmyPlan;events:ArmyEvent[];roles:{role:ArmyRole;taskId:string;status:ArmyStatus;latest:ArmyEvent|null;history:ArmyEvent[]}[];currentFacts:boolean;nextAction:string}
export type ArmyHistory={workflows:ArmyWorkflow[];photos:OwnedPhotograph[]}
export type ArmyRequest={readonly ownerId:string;readonly itemId:string;readonly eventId:string;readonly workflowId:string;readonly kind:'PLAN'|'START'|'RESULT';readonly role:ArmyRole|null;readonly factsSha256:string;readonly payload:ArmyPlan['payload']|ArmyEvent['payload']}
export class ResearchArmyError extends Error{}
export class ResearchArmyUnavailableError extends ResearchArmyError{}
const uuid=/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i,sha=/^[a-f\d]{64}$/
const plain=(v:any):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v)
const stable=(v:unknown)=>JSON.stringify(v,(_k,x)=>plain(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x)
const same=(a:unknown,b:unknown)=>stable(a)===stable(b)
const text=(v:unknown,min=0,max=6000):v is string=>typeof v==='string'&&v.trim().length>=min&&v.length<=max
const ids=(v:unknown,max=100):v is string[]=>Array.isArray(v)&&v.length<=max&&new Set(v).size===v.length&&v.every(id=>typeof id==='string'&&uuid.test(id))
const timestamp=(v:unknown):v is string=>typeof v==='string'&&Number.isFinite(Date.parse(v))
const strings=(v:unknown,max=100):v is string[]=>Array.isArray(v)&&v.length<=max&&v.every(s=>text(s,1,2000))
const fail=(message:string):never=>{throw new ResearchArmyError(message)}
const stop=(current:()=>boolean)=>{if(!current())fail('This object or account is no longer selected.')}
const freeze=<T,>(v:T):T=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v)}return v}
export function armySourceUrl(v:unknown):v is string{
 if(typeof v!=='string'||v.length>2000)return false
 try{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password&&!!u.hostname&&!['localhost','127.0.0.1','[::1]'].includes(u.hostname)}catch{return false}
}
export function validArmyReport(value:unknown,terminal=true):value is ArmyRoleReport{
 if(!plain(value)||Object.keys(value).sort().join(',')!=='categoryIds,disagreements,hypotheses,outcome,photoIds,query,question,sourceUrls,summary,tool,unresolvedIssues')return false
 if(!Array.isArray(value.categoryIds)||value.categoryIds.length>7||new Set(value.categoryIds).size!==value.categoryIds.length||!value.categoryIds.every(c=>researchTypes.includes(c)))return false
 if(!text(value.question,10,3000)||!text(value.query,1,2000)||!text(value.tool,1,200)||!text(value.summary,terminal?20:0)||!text(value.unresolvedIssues,terminal?2:0)||!ids(value.photoIds))return false
 if(!Array.isArray(value.sourceUrls)||value.sourceUrls.length>100||new Set(value.sourceUrls).size!==value.sourceUrls.length||!value.sourceUrls.every(armySourceUrl)||!strings(value.disagreements,30))return false
 if(!['INCONCLUSIVE','BLOCKED','FAILED'].includes(value.outcome)||!Array.isArray(value.hypotheses)||value.hypotheses.length>30)return false
 return value.hypotheses.every(h=>plain(h)&&Object.keys(h).sort().join(',')==='candidate,reason,sourceUrls,status'&&text(h.candidate,2,500)&&['SUPPORTED','REJECTED','UNRESOLVED'].includes(h.status)&&text(h.reason,10,3000)&&Array.isArray(h.sourceUrls)&&h.sourceUrls.length<=100&&h.sourceUrls.every(armySourceUrl))
}
export function emptyArmyReport(photoIds:string[]=[]):ArmyRoleReport{return{categoryIds:[],question:'',query:'',tool:'Owner manual investigation',summary:'',sourceUrls:[],photoIds:[...photoIds],unresolvedIssues:'',hypotheses:[],disagreements:[],outcome:'INCONCLUSIVE'}}
function validPlanPayload(value:unknown):value is ArmyPlan['payload']{
 return plain(value)&&Object.keys(value).sort().join(',')==='objective,photoIds,tasks'&&text(value.objective,10,3000)&&ids(value.photoIds)&&value.photoIds.length>0&&Array.isArray(value.tasks)&&value.tasks.length===7&&new Set(value.tasks.map(t=>t?.role)).size===7&&new Set(value.tasks.map(t=>t?.taskId)).size===7&&value.tasks.every(t=>plain(t)&&Object.keys(t).sort().join(',')==='role,taskId'&&armyRoles.includes(t.role)&&uuid.test(t.taskId))
}
export function parseArmyRecord(row:unknown,item:Pick<Item,'id'|'owner_id'>):ArmyRecord|null{
 if(!plain(row)||row.owner_id!==item.owner_id||row.mode!=='research'||row.model!=='NATIVE_MANUAL_WORKFLOW_V1'||!plain(row.user_context)||row.user_context.item_id!==item.id||!plain(row.result))return null
 const r=row.result.research_army_v1
 if(!plain(r)||r.version!==1||!uuid.test(r.eventId)||row.id!==r.eventId||row.user_context.research_army_event_id!==r.eventId||!uuid.test(r.workflowId)||row.user_context.research_army_workflow_id!==r.workflowId||r.ownerId!==item.owner_id||r.itemId!==item.id||!sha.test(r.factsSha256)||!timestamp(r.createdAt)||!timestamp(row.created_at)||Date.parse(row.created_at)!==Date.parse(r.createdAt)||!uuid.test(r.executorId)||r.providerAmount!==0||r.providerCalls!==0)return null
 if(r.kind==='PLAN')return row.result.analysis_stage==='ARMY_PLAN'&&r.workflowId===r.eventId&&r.executorId===item.owner_id&&r.role===null&&r.taskId===null&&r.status==='NOT_RUN'&&validPlanPayload(r.payload)?r as ArmyPlan:null
 if(!['START','RESULT','ATTESTATION'].includes(r.kind)||row.result.analysis_stage!=='ARMY_ROLE'||!armyRoles.includes(r.role)||!uuid.test(r.taskId)||!timestamp(r.startedAt)||Date.parse(r.startedAt)>Date.parse(r.createdAt)||!plain(r.payload)||!validArmyReport(r.payload.report,r.kind!=='START'))return null
 if(r.kind==='START')return r.status==='RUNNING'&&r.executorId===item.owner_id&&r.finishedAt===null&&r.payload.startEventId===null?r as ArmyEvent:null
 if(!timestamp(r.finishedAt)||Date.parse(r.finishedAt)<Date.parse(r.startedAt)||Date.parse(r.finishedAt)>Date.parse(r.createdAt)||!uuid.test(r.payload.startEventId))return null
 if(r.kind==='RESULT')return r.executorId===item.owner_id&&r.status===r.payload.report.outcome?r as ArmyEvent:null
 if(r.status!=='EVIDENCED'||r.executorId===item.owner_id||r.payload.reviewerId!==r.executorId||!uuid.test(r.payload.resultEventId)||!uuid.test(r.payload.assessmentId)||!text(r.payload.rationale,40)||!strings(r.payload.sourceRefs)||r.payload.sourceRefs.length<1)return null
 return {...r,attestationCurrent:row.army_attestation_current===true} as ArmyEvent
}
export function projectArmyWorkflows(records:ArmyRecord[],context:AssessmentContext):ArmyWorkflow[]{
 if(new Set(records.map(r=>r.eventId)).size!==records.length)return fail('Conflicting native research events require review.')
 const plans=records.filter((r):r is ArmyPlan=>r.kind==='PLAN')
 if(records.some(r=>r.kind!=='PLAN'&&!plans.some(p=>p.workflowId===r.workflowId)))return fail('A native role receipt is missing its original research plan.')
 return plans.map(plan=>{
  const events=records.filter((r):r is ArmyEvent=>r.kind!=='PLAN'&&r.workflowId===plan.workflowId).sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt)||a.createdAt.localeCompare(b.createdAt)||a.eventId.localeCompare(b.eventId))
  const previous=new Map<ArmyRole,ArmyEvent>()
  for(const event of events){
   if(event.ownerId!==plan.ownerId||event.itemId!==plan.itemId||event.factsSha256!==plan.factsSha256||!plan.payload.tasks.some(t=>t.role===event.role&&t.taskId===event.taskId)||!event.payload.report.photoIds.every(id=>plan.payload.photoIds.includes(id)))return fail('A role receipt has different object, photograph or task scope.')
   const prior=previous.get(event.role)
   if(event.kind==='START'&&prior?.kind==='START'||event.kind==='RESULT'&&(prior?.kind!=='START'||prior.eventId!==event.payload.startEventId)||event.kind==='ATTESTATION'&&(prior?.kind!=='RESULT'||prior.eventId!==event.payload.resultEventId))return fail('A native role receipt does not follow its latest actual execution.')
   previous.set(event.role,event)
   const start=event.kind==='START'?event:events.find(e=>e.eventId===event.payload.startEventId&&e.kind==='START'&&e.role===event.role)
   if(!start||event.startedAt!==start.startedAt)return fail('A role result is missing its exact recorded start.')
   if(event.kind==='ATTESTATION'){
    const result=events.find(e=>e.eventId===event.payload.resultEventId&&e.kind==='RESULT'&&e.role===event.role)
    if(!result||result.executorId===event.executorId||!same(result.payload.report,event.payload.report)||result.payload.startEventId!==event.payload.startEventId)return fail('Independent role verification is missing its separate original execution.')
   }
  }
  const currentFacts=plan.factsSha256===context.facts_sha256
  const roles=plan.payload.tasks.map(task=>{const history=events.filter(e=>e.role===task.role),latest=history.at(-1)||null;return{...task,status:(latest?.status==='EVIDENCED'&&!latest.attestationCurrent?'BLOCKED':latest?.status||'NOT_RUN') as ArmyStatus,latest,history}})
  const next=roles.find(r=>r.status==='RUNNING')||roles.find(r=>r.status!=='EVIDENCED')
  return{plan,events,roles,currentFacts,nextAction:!currentFacts?'Catalogue facts changed. Preserve this history and create a plan for the current object.':next?`${armyRoleTitles[next.role]}: ${next.status==='RUNNING'?'resume the recorded investigation; do not dispatch another provider request.':next.latest?.payload.report.unresolvedIssues||'No recorded execution. Start this bounded check when its required evidence is available.'}`:'All seven role receipts have independent review. The separate current final item assessment and selling checks still govern listing readiness.'}
 }).sort((a,b)=>Date.parse(b.plan.createdAt)-Date.parse(a.plan.createdAt)||b.plan.createdAt.localeCompare(a.plan.createdAt)||b.plan.eventId.localeCompare(a.plan.eventId))
}
async function auth(client:SupabaseClient,item:Pick<Item,'owner_id'>,current:()=>boolean){stop(current);const a=await client.auth.getUser();stop(current);if(a.error||a.data.user?.id!==item.owner_id)fail('Sign in as this object’s owner to use its research workflow.')}
function unavailable(error:any):never{if(['42P01','PGRST202','PGRST205'].includes(error?.code))throw new ResearchArmyUnavailableError('Native research workflow storage is not active in this environment. No workflow execution has been confirmed.');return fail('Complete native research receipts could not be verified. Recover the same saved workflow before retrying.')}
async function readRecords(client:SupabaseClient,item:Pick<Item,'id'|'owner_id'>,current:()=>boolean,eventId?:string):Promise<ArmyRecord[]>{
 const records:ArmyRecord[]=[];let total:number|undefined
 do{
  let q=client.from('research_army_receipts_v1').select('*',{count:'exact'}).eq('owner_id',item.owner_id).eq('mode','research').eq('user_context->>item_id',item.id)
  if(eventId)q=q.eq('user_context->>research_army_event_id',eventId);else q=q.not('user_context->>research_army_workflow_id','is',null)
  const r=await q.order('created_at',{ascending:true}).order('id',{ascending:true}).range(records.length,records.length+99).abortSignal(AbortSignal.timeout(20000));stop(current)
  if(r.error)unavailable(r.error)
  if(!r.data||r.count===null||r.count<0||r.count>500||(total!==undefined&&r.count!==total)||r.data.length!==Math.min(100,r.count-records.length))fail('Native research history is incomplete or changed during reading.')
  total=r.count!
  for(const raw of r.data){const record=parseArmyRecord(raw,item);if(!record)return fail('A native research receipt has an unsupported or conflicting scope. Its original record is retained.');records.push(record)}
 }while(records.length<(total??0))
 return records
}
export async function readResearchArmy(client:SupabaseClient,item:Item,current:()=>boolean):Promise<ArmyHistory>{
 await auth(client,item,current)
 const before=await readAssessmentContext(client,item,current)
 const[records,photos]=await Promise.all([readRecords(client,item,current),readItemPhotographs(client,item.id,current)]);stop(current)
 const after=await readAssessmentContext(client,item,current);if(!same(before,after))fail('Object facts changed while its research workflow loaded. Reload the current object.')
 await auth(client,item,current);return{workflows:projectArmyWorkflows(records,after),photos:photos.rows}
}
async function currentContext(client:SupabaseClient,item:Item,current:()=>boolean){const context=await readAssessmentContext(client,item,current);if(!same(item,context.facts_snapshot))fail('Save catalogue edits and reload current facts before recording research work.');return context}
export async function prepareArmyPlan(client:SupabaseClient,item:Item,photoIds:string[],objective:string,current:()=>boolean,eventId=crypto.randomUUID()):Promise<ArmyRequest>{
 if(!uuid.test(eventId)||!ids(photoIds)||!photoIds.length||!text(objective,10,3000))fail('Choose this object’s original photographs and a specific research objective.')
 const context=await currentContext(client,item,current),{rows}=await readItemPhotographs(client,item.id,current)
 if(!photoIds.every(id=>rows.some(p=>p.id===id)))fail('Every selected photograph must belong to this exact object and owner.')
 const payload={objective,photoIds:[...photoIds],tasks:armyRoles.map(role=>({role,taskId:crypto.randomUUID()}))}
 return freeze({ownerId:item.owner_id,itemId:item.id,eventId,workflowId:eventId,kind:'PLAN',role:null,factsSha256:context.facts_sha256,payload})
}
export async function prepareArmyEvent(client:SupabaseClient,item:Item,workflow:ArmyWorkflow,role:ArmyRole,kind:'START'|'RESULT',report:ArmyRoleReport,current:()=>boolean,eventId=crypto.randomUUID()):Promise<ArmyRequest>{
 if(!uuid.test(eventId)||!armyRoles.includes(role)||!['START','RESULT'].includes(kind)||!validArmyReport(report,kind==='RESULT'))fail('Record the actual question, query, manual tool, outcome, sources and unresolved work for this role.')
 const context=await currentContext(client,item,current)
 if(workflow.plan.ownerId!==item.owner_id||workflow.plan.itemId!==item.id||workflow.plan.factsSha256!==context.facts_sha256||!report.photoIds.every(id=>workflow.plan.payload.photoIds.includes(id)))fail('This workflow has different object facts or photograph scope. Preserve it and use current facts for a new plan.')
 const state=workflow.roles.find(r=>r.role===role);if(!state)return fail('This role is not part of the recorded plan.')
 if(kind==='START'&&state.status==='RUNNING')fail('Resume the existing recorded role start rather than starting it again.')
 if(kind==='RESULT'&&state.latest?.kind!=='START')fail('A role result must follow its exact recorded manual start.')
 const payload={report:structuredClone(report),startEventId:kind==='RESULT'?state.latest!.eventId:null}
 return freeze({ownerId:item.owner_id,itemId:item.id,eventId,workflowId:workflow.plan.workflowId,kind,role,factsSha256:context.facts_sha256,payload})
}
function requestMatches(request:ArmyRequest,record:ArmyRecord){return record.eventId===request.eventId&&record.workflowId===request.workflowId&&record.ownerId===request.ownerId&&record.itemId===request.itemId&&record.kind===request.kind&&record.role===request.role&&record.factsSha256===request.factsSha256&&same(record.payload,request.payload)}
export async function settleArmyRequest(client:SupabaseClient,request:ArmyRequest,current:()=>boolean,submit:boolean):Promise<ArmyRecord|null>{
 if(!plain(request)||!uuid.test(request.ownerId)||!uuid.test(request.itemId)||!uuid.test(request.eventId)||!uuid.test(request.workflowId)||!sha.test(request.factsSha256))fail('The held native research request is invalid. No write was attempted.')
 const payload:unknown=request.payload
 if(request.kind==='PLAN'?request.role!==null||request.workflowId!==request.eventId||!validPlanPayload(payload):!['START','RESULT'].includes(request.kind)||!armyRoles.includes(request.role as ArmyRole)||!plain(payload)||Object.keys(payload).sort().join(',')!=='report,startEventId'||!validArmyReport(payload.report,request.kind==='RESULT')||(request.kind==='START'?payload.startEventId!==null:!uuid.test(payload.startEventId)))fail('The held native research payload is invalid. No write was attempted.')
 const scope={id:request.itemId,owner_id:request.ownerId};await auth(client,scope,current)
 const inspect=async()=>{const records=await readRecords(client,scope,current,request.eventId);if(records.length>1)fail('Conflicting records use this native research event.');const record=records[0];if(record&&!requestMatches(request,record))fail('This event belongs to different immutable research work. It was not overwritten.');await auth(client,scope,current);return record||null}
 const saved=await inspect();if(saved||!submit)return saved
 const context=await readAssessmentContext(client,scope,current);if(context.facts_sha256!==request.factsSha256)fail('Catalogue facts changed and this exact held event is absent. Export the held notes before starting a current review.')
 try{await client.rpc('ci_record_research_army_event_v1',{p_item_id:request.itemId,p_event_id:request.eventId,p_workflow_id:request.workflowId,p_kind:request.kind,p_role:request.role,p_expected_facts_sha256:request.factsSha256,p_payload:request.payload}).abortSignal(AbortSignal.timeout(20000))}catch{/* Acknowledgements never prove storage; resolve by the exact event read. */}
 stop(current);return inspect()
}
