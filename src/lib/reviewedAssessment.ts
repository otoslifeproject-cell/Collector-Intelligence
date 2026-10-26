// Only the database's privately reviewed, current-source projection can supply
// completion. Model output, owner holds and imported listing JSON cannot do so.
import type {SupabaseClient} from '@supabase/supabase-js'
import type {Item} from '../types'
import type {FinalResearchDecision} from './sellFastPlan'
import {auditResearch,researchTypes} from './researchSaleDecision.ts'
import type {ResearchAudit} from './researchSaleDecision'
import {readAssessmentContext} from './itemAssessment.ts'
import type {AssessmentContext} from './itemAssessment'
export type ReviewedAssessment={id:string;owner_id:string;item_id:string;facts_sha256:string;facts_snapshot:Record<string,unknown>;created_at:string;assessment:Omit<FinalResearchDecision,'id'|'itemId'|'ownerId'|'status'|'reviewStatus'|'reviewedAt'|'availableChecks'>&{decision:FinalResearchDecision['status'];nextAction:string;routeGuidance:string;unresolvedIssues:string;confidence:{identification:number|null;dating:number|null;valuation:number|null};sourceGraphSha256:string;reviewReference:string;verificationMethod:string;availableChecks:(FinalResearchDecision['availableChecks'][number]&{executionRef:string;checkedAt:string;detail:string;confidence:number|null})[]}}
const uuid=/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i,sha=/^[a-f\d]{64}$/
const plain=(v:any):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v)
const stable=(v:unknown)=>JSON.stringify(v,(_k,x)=>plain(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x)
const text=(v:unknown,min=1,max=6000)=>typeof v==='string'&&v.trim().length>=min&&v.length<=max
const refs=(v:unknown)=>Array.isArray(v)&&v.length>0&&v.length<=100&&new Set(v).size===v.length&&v.every(r=>text(r,1,1000))
const confidence=(v:unknown)=>v===null||typeof v==='number'&&Number.isInteger(v)&&v>=0&&v<=100
export function parseReviewedAssessment(row:unknown,item:Item,context:AssessmentContext,today=new Date().toISOString().slice(0,10)):ReviewedAssessment|null{
 if(!plain(row)||!uuid.test(row.id)||row.owner_id!==item.owner_id||row.item_id!==item.id||row.facts_sha256!==context.facts_sha256||!sha.test(row.facts_sha256)||stable(row.facts_snapshot)!==stable(context.facts_snapshot)||stable(item)!==stable(context.facts_snapshot)||!text(row.created_at)||!Number.isFinite(Date.parse(row.created_at))||row.created_at.slice(0,10)>today)return null
 const a=row.assessment;if(!plain(a)||!['READY_TO_LIST','DO_NOT_LIST_YET','SPECIALIST_REVIEW'].includes(a.decision)||!text(a.rationale,80)||!refs(a.sourceRefs)||!['nextAction','routeGuidance','unresolvedIssues','reviewReference','verificationMethod'].every(k=>text(a[k]))||!uuid.test(a.reviewerId)||a.reviewerId===item.owner_id||a.verificationMethod!=='INDEPENDENT_SOURCE_REVIEW'||!sha.test(a.sourceGraphSha256)||!plain(a.confidence)||Object.keys(a.confidence).sort().join(',')!=='dating,identification,valuation'||!Object.values(a.confidence).every(confidence))return null
 if(a.makerApproval!==undefined&&(!plain(a.makerApproval)||!text(a.makerApproval.maker)||a.makerApproval.maker!==item.maker||!refs(a.makerApproval.sourceRefs)||!a.makerApproval.sourceRefs.every((ref:string)=>a.sourceRefs.includes(ref))))return null
 const scope=a.availabilityScope,checks=a.availableChecks
 if(!plain(scope)||!Array.isArray(scope.checkIds)||scope.checkIds.length!==researchTypes.length||new Set(scope.checkIds).size!==researchTypes.length||!researchTypes.every(t=>scope.checkIds.includes(t))||!text(scope.rationale,80)||!refs(scope.sourceRefs)||!scope.sourceRefs.every((ref:string)=>a.sourceRefs.includes(ref)))return null
 if(!Array.isArray(checks)||checks.length!==researchTypes.length||new Set(checks.map(c=>c?.id)).size!==researchTypes.length||!checks.every(c=>plain(c)&&researchTypes.includes(c.id)&&c.status==='COMPLETE'&&refs(c.sourceRefs)&&c.sourceRefs.every((r:string)=>a.sourceRefs.includes(r))&&text(c.executionRef)&&text(c.detail,40)&&text(c.checkedAt)&&Number.isFinite(Date.parse(c.checkedAt))&&c.checkedAt.slice(0,10)<=today&&confidence(c.confidence)))return null
 return row as ReviewedAssessment
}
export const reviewedForItem=(row:ReviewedAssessment|null,item:Item|null)=>row&&item&&row.owner_id===item.owner_id&&row.item_id===item.id&&stable(row.facts_snapshot)===stable(item)?row:null
export function reviewedDecision(row:ReviewedAssessment):FinalResearchDecision{
 const a=row.assessment;return {id:row.id,itemId:row.item_id,ownerId:row.owner_id,status:a.decision,reviewStatus:'APPROVED',reviewedAt:row.created_at,sourceRefs:a.sourceRefs,rationale:a.rationale,availabilityScope:a.availabilityScope,availableChecks:a.availableChecks,makerApproval:a.makerApproval}
}
export function reviewedAudit(base:ResearchAudit,row:ReviewedAssessment|null):ResearchAudit{
 if(!row)return base
 return auditResearch(row.assessment.availableChecks.map(c=>({type:c.id as typeof researchTypes[number],status:'DONE_EVIDENCED',runId:c.executionRef,checkedAt:c.checkedAt,sourceRefs:c.sourceRefs,detail:c.detail,confidence:c.confidence})))
}
export async function readReviewedAssessment(client:SupabaseClient,item:Item,current:()=>boolean):Promise<ReviewedAssessment|null>{
 const stop=()=>{if(!current())throw Error('This owner or object is no longer selected.')};stop()
 const context=await readAssessmentContext(client,item,current);stop()
 const read=await client.from('item_reviewed_assessments_v1').select('*',{count:'exact'}).eq('owner_id',item.owner_id).eq('item_id',item.id).limit(2).abortSignal(AbortSignal.timeout(20000));stop()
 if(read.error){if(['42P01','PGRST205','PGRST202'].includes(read.error.code))throw Error('Independent final review storage is not active in this environment. Sale readiness remains blocked.');throw Error('Independent final review could not be confirmed. Reload research before preparing a sale-ready draft.')}
 if(!read.data||read.count===null||read.count<0||read.count>1||read.data.length!==read.count)throw Error('Independent final review returned an incomplete or conflicting result.')
 const confirmed=await readAssessmentContext(client,item,current);stop()
 if(stable(confirmed)!==stable(context))throw Error('Catalogue facts changed while final review was read. Reload the current object.')
 if(!read.count)return null
 const row=parseReviewedAssessment(read.data[0],item,context);if(!row)throw Error('The current independent final review could not be validated. No sale readiness was accepted.')
 return row
}
// Historical reviewer rows are retained separately from the current qualified
// projection. Reading history never makes a stale/revoked assessment current.
export async function readReviewedHistory(client:SupabaseClient,item:Item,current:()=>boolean):Promise<ReviewedAssessment[]>{
 const auth=async()=>{if(!current())throw Error('This owner or object is no longer selected.');const r=await client.auth.getUser();if(!current()||r.error||r.data.user?.id!==item.owner_id)throw Error('Sign in as this object’s owner to read reviewed history.')};await auth()
 const rows:ReviewedAssessment[]=[];let total:number|undefined
 do{const r=await client.from('item_research_assessments').select('*',{count:'exact'}).eq('owner_id',item.owner_id).eq('item_id',item.id).eq('review_status','SOURCE_REVIEWED').order('created_at',{ascending:false}).order('id',{ascending:false}).range(rows.length,rows.length+99).abortSignal(AbortSignal.timeout(20000))
  if(!current()||r.error||!r.data||r.count===null||r.count<0||r.count>500||(total!==undefined&&r.count!==total)||r.data.length!==Math.min(100,r.count-rows.length))throw Error('Complete independent review history could not be confirmed. No readiness was accepted from history.')
  total=r.count
  for(const row of r.data){const snapshot=row.facts_snapshot;if(!plain(snapshot)||snapshot.id!==item.id||snapshot.owner_id!==item.owner_id||!parseReviewedAssessment(row,snapshot as Item,{item_id:item.id,owner_id:item.owner_id,facts_snapshot:snapshot,facts_sha256:row.facts_sha256}))throw Error('Historical independent review has an unsupported format. Original rows are retained.');rows.push(row as ReviewedAssessment)}
 }while(rows.length<total)
 if(new Set(rows.map(r=>r.id)).size!==rows.length)throw Error('Conflicting independent review history requires investigation.');await auth();return rows
}
