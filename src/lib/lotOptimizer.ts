// Collection planning only. A hypothetical group never authenticates an object,
// apportions a mixed-lot sale, publishes a listing or certifies its own sources.
import type {SupabaseClient} from '@supabase/supabase-js'
import type {Item} from '../types'
import {knownSaleCurrency,researchSaleBlockers,safeSourceUrl,sellModes,validReviewDate} from './sellFastPlan.ts'
import type {ResearchSaleGate,SellMode} from './sellFastPlan'

export const groupRelations=['MATCHED_ORIGINAL_SET','SAME_MAKER_PATTERN','THEMED_CURATED','MIXED_CLEARANCE'] as const
export type GroupRelation=typeof groupRelations[number]
export const lotStrategies=['ALL_SOLO','MATCHED_SETS','CURATED_BUNDLES','HYBRID','AUCTION_OR_DEALER'] as const
export type LotStrategy=typeof lotStrategies[number]
export const lotStrategyTitles:Record<LotStrategy,string>={ALL_SOLO:'Separate items',MATCHED_SETS:'Matching sets',CURATED_BUNDLES:'Curated bundles',HYBRID:'Hybrid',AUCTION_OR_DEALER:'Auction / dealer clearance'}
export type SaleGroupMember={itemId:string;photoIds:string[]}
export type SaleGroupDraft={format:'collector-sale-group-v1';ownerId:string;groupId:string;revision:number;title:string;relation:GroupRelation;members:SaleGroupMember[];rationale:string;sourceRefs:string[];uncertainty:string;plans:LotPlan[]}
export type LotComparable={id:string;ownerId:string;sourceUrl:string;sourceReference:string;venue:string;saleDate:string;currency:string;totalPrice:number|null;priceType:string;quantity:number;members:{description:string;makerConfidence:string;condition:string}[];unitPrice:null;compositionReviewId?:string;conversionSource?:string}
export type LotCosts={sellerCommissionPercent:number|null;commissionVatPercent:number|null;minimumCommission:number|null;listingFee:number|null;unsoldFee:number|null;paymentPercent:number|null;paymentFixed:number|null;packing:number|null;delivery:number|null;insurance:number|null;breakageReturnAllowance:number|null;unsoldPreparation:number|null}
export type LotLine={id:string;itemIds:string[];groupId:string|null;venue:string;comparableId:string;priceAdjustment:string;grossLow:number|null;grossHigh:number|null;grossBasis:'UNKNOWN'|'SELLER_GROSS'|'BUYER_TOTAL';costs:LotCosts;saleProbability:number|null;daysLow:number|null;daysHigh:number|null;workHours:number|null;feeSource:string;eligibilitySource:string;checkedAt:string;shippingInstructions:string}
export type LotPlan={id:string;strategy:LotStrategy;objective:SellMode;currency:string;itemIds:string[];lines:LotLine[]}
export type LotInventoryMember={item:Item;photoIds:string[];research:ResearchSaleGate;specialistRisk:boolean;acquisitionCost?:number|null;acquisitionCurrency?:string|null}
export type LotLineAssessment={line:LotLine;conditionalNetLow:number|null;conditionalNetHigh:number|null;expectedNetLow:number|null;expectedNetHigh:number|null;feesLow:number|null;feesHigh:number|null;blockers:string[]}
export type LotPlanAssessment={plan:LotPlan;lines:LotLineAssessment[];conditionalNetLow:number|null;conditionalNetHigh:number|null;expectedNetLow:number|null;expectedNetHigh:number|null;profitLow:number|null;profitHigh:number|null;daysHigh:number|null;workHours:number|null;blockers:string[];ready:boolean}
const uuid=/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i
const sha=/^[a-f\d]{64}$/
const money=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=100000000
const text=(v:unknown,min=1,max=6000):v is string=>typeof v==='string'&&v.trim().length>=min&&v.length<=max
const cents=(n:number)=>Math.round((n+Number.EPSILON)*100)/100
const unique=(xs:unknown):xs is string[]=>Array.isArray(xs)&&xs.length>0&&new Set(xs).size===xs.length&&xs.every(x=>typeof x==='string'&&uuid.test(x))
const stable=(v:unknown):string=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x)
const clone=<T,>(v:T):T=>JSON.parse(JSON.stringify(v))
const freeze=<T,>(v:T):T=>{if(v&&typeof v==='object'){for(const x of Object.values(v))freeze(x);Object.freeze(v)}return v}
const achieved=new Set(['HAMMER_REALIZED','REALIZED_INCL_BP','MARKETPLACE_SOLD','DEALER_SOLD_CONFIRMED'])
const costKeys=['sellerCommissionPercent','commissionVatPercent','minimumCommission','listingFee','unsoldFee','paymentPercent','paymentFixed','packing','delivery','insurance','breakageReturnAllowance','unsoldPreparation'] as const
export function emptyLotCosts():LotCosts{return {sellerCommissionPercent:null,commissionVatPercent:null,minimumCommission:null,listingFee:null,unsoldFee:null,paymentPercent:null,paymentFixed:null,packing:null,delivery:null,insurance:null,breakageReturnAllowance:null,unsoldPreparation:null}}
export function immutableLotComparable(input:Omit<LotComparable,'unitPrice'>|LotComparable):Readonly<LotComparable>{
 if(!uuid.test(input.id)||!uuid.test(input.ownerId)||!safeSourceUrl(input.sourceUrl)||!text(input.sourceReference)||!text(input.venue)||!knownSaleCurrency(input.currency)||!Number.isInteger(input.quantity)||input.quantity<1||input.quantity>100||!Array.isArray(input.members)||input.members.length!==input.quantity||input.members.some(m=>!m||!text(m.description)||!text(m.condition)||!text(m.makerConfidence))||input.totalPrice!==null&&!money(input.totalPrice))throw Error('Whole-lot source identity, complete composition and total are required.')
 // Ignore any caller-supplied unit value: even a real £320/three sale supplies
 // no authenticated component price. Decomposition needs another source record.
 return freeze({...clone(input),unitPrice:null})
}
export function validateSaleGroup(group:SaleGroupDraft,inventory:LotInventoryMember[]):string[]{
 const errors:string[]=[]
 if(!group||group.format!=='collector-sale-group-v1'||!uuid.test(group.ownerId)||!uuid.test(group.groupId)||!Number.isInteger(group.revision)||group.revision<1||!text(group.title,1,200)||!groupRelations.includes(group.relation)||!text(group.rationale,40)||!text(group.uncertainty)||!Array.isArray(group.sourceRefs)||group.sourceRefs.some(s=>!safeSourceUrl(s))||!Array.isArray(group.plans))return ['The sale group has an unsupported or incomplete format.']
 if(!Array.isArray(group.members)||group.members.length<1||group.members.length>100||new Set(group.members.map(m=>m?.itemId)).size!==group.members.length)return ['Choose each physical object once in a group.']
 const assigned=new Set<string>()
 for(const m of group.members){
  const found=inventory.filter(x=>x.item.id===m?.itemId&&x.item.owner_id===group.ownerId)
  if(!m||found.length!==1||!unique(m.photoIds)||m.photoIds.some(id=>!found[0].photoIds.includes(id)||assigned.has(id)))errors.push('Every member and selected original photo must belong to this owner and exact object.')
  if(Array.isArray(m?.photoIds))m.photoIds.forEach(id=>assigned.add(id))
 }
 if(['MATCHED_ORIGINAL_SET','SAME_MAKER_PATTERN'].includes(group.relation)&&!group.sourceRefs.length)errors.push('A matching-set or maker/pattern relationship needs documentary references; colour or UV glow is insufficient.')
 return [...new Set(errors)]
}
function assessLine(line:LotLine,plan:LotPlan,inventory:LotInventoryMember[],comparables:LotComparable[],qualifiedIds:string[],today:string):LotLineAssessment{
 const blockers:string[]=[];const c=line.costs||emptyLotCosts()
 const complete=Object.keys(c).length===costKeys.length&&costKeys.every(k=>money(c[k]))&&c.sellerCommissionPercent!<=100&&c.commissionVatPercent!<=100&&c.paymentPercent!<=100&&money(line.grossLow)&&money(line.grossHigh)&&line.grossHigh>=line.grossLow&&line.grossBasis==='SELLER_GROSS'
 if(!complete)blockers.push('Enter seller gross and every fee, VAT and fulfilment assumption; unknown is not zero and buyer premium is not seller revenue.')
 const fees=(gross:number)=>Math.max(gross*c.sellerCommissionPercent!/100,c.minimumCommission!)*(1+c.commissionVatPercent!/100)+gross*c.paymentPercent!/100+c.paymentFixed!+c.listingFee!
 const after=(gross:number)=>gross-fees(gross)-c.packing!-c.delivery!-c.insurance!-c.breakageReturnAllowance!
 const low=complete?cents(after(line.grossLow!)):null,high=complete?cents(after(line.grossHigh!)):null
 const probability=money(line.saleProbability)&&line.saleProbability<=1?line.saleProbability:null
 if(probability===null)blockers.push('Record a bounded sale probability; conditional proceeds are not guaranteed or probability-adjusted proceeds.')
 const expected=(net:number|null)=>net===null||probability===null?null:cents(probability*net-(1-probability)*(c.listingFee!+c.unsoldFee!+c.unsoldPreparation!))
 if(!unique(line.itemIds)||!text(line.venue)||!text(line.priceAdjustment,40))blockers.push('Record exact member IDs, venue and a source-linked physical/composition/price adjustment.')
 const members=inventory.filter(x=>line.itemIds?.includes(x.item.id))
 if(members.length!==line.itemIds?.length||new Set(members.map(x=>x.item.owner_id)).size!==1)blockers.push('A plan line contains missing or foreign physical objects.')
 for(const m of members){
  blockers.push(...researchSaleBlockers(m.item,m.research,today).map(b=>`${m.item.item_code}: ${b}`))
  if(!m.item.condition_summary?.trim()||!m.photoIds.length||m.item.status==='SOLD'||m.specialistRisk)blockers.push(`${m.item.item_code}: condition, complete originals or material attribution uncertainty prevents approval.`)
  if(m.item.currency!==plan.currency)blockers.push('Use one confirmed currency; no conversion is assumed.')
 }
 const comps=comparables.filter(x=>x.id===line.comparableId),comp=comps.length===1?comps[0]:undefined
 if(!comp||!qualifiedIds.includes(comp.id)||!achieved.has(comp.priceType)||comp.currency!==plan.currency||members.some(m=>m.item.owner_id!==comp.ownerId)||comp.totalPrice===null||comp.quantity!==line.itemIds.length||!comp.compositionReviewId||!uuid.test(comp.compositionReviewId))blockers.push('A separately source-reviewed achieved lot with verified complete composition and matching quantity is required; a group total cannot price one component.')
 if(comp&&(!/^\d{4}-\d{2}-\d{2}$/.test(comp.saleDate)||!Number.isFinite(Date.parse(comp.saleDate))||new Date(comp.saleDate).toISOString().slice(0,10)!==comp.saleDate||comp.saleDate>today))blockers.push('Comparable sale date must be a real recorded date, not a future or unreadable value.')
 if(comp?.priceType==='REALIZED_INCL_BP'&&!safeSourceUrl(comp.conversionSource))blockers.push('Document the premium-to-seller-gross conversion; buyer premium is not a seller fee.')
 if(!safeSourceUrl(line.feeSource)||!safeSourceUrl(line.eligibilitySource)||!validReviewDate(line.checkedAt,today))blockers.push('Record current fee/eligibility sources checked within 30 days.')
 if(!text(line.shippingInstructions,20))blockers.push('Record packing, collection or insured delivery arrangements and exclusions.')
 if(!money(line.daysLow)||!money(line.daysHigh)||line.daysHigh<line.daysLow||!money(line.workHours))blockers.push('Record realistic sale time and practical workload.')
 return {line,conditionalNetLow:low,conditionalNetHigh:high,expectedNetLow:expected(low),expectedNetHigh:expected(high),feesLow:complete?cents(fees(line.grossLow!)):null,feesHigh:complete?cents(fees(line.grossHigh!)):null,blockers:[...new Set(blockers)]}
}
export function assessLotPlan(plan:LotPlan,inventory:LotInventoryMember[],comparables:LotComparable[],qualifiedComparableIds:string[]=[],today=new Date().toISOString().slice(0,10)):LotPlanAssessment{
 const blockers:string[]=[]
 if(!plan||!lotStrategies.includes(plan.strategy)||!sellModes.includes(plan.objective)||!knownSaleCurrency(plan.currency)||!unique(plan.itemIds)||!Array.isArray(plan.lines)||!plan.lines.length||plan.lines.some(l=>!l||!Array.isArray(l.itemIds)))return {plan,lines:[],conditionalNetLow:null,conditionalNetHigh:null,expectedNetLow:null,expectedNetHigh:null,profitLow:null,profitHigh:null,daysHigh:null,workHours:null,blockers:['Choose a complete supported strategy, confirmed currency and exact collection scope.'],ready:false}
 const scoped=inventory.filter(m=>plan.itemIds.includes(m.item.id));if(scoped.length!==plan.itemIds.length||new Set(scoped.map(m=>m.item.id)).size!==scoped.length||new Set(scoped.map(m=>m.item.owner_id)).size!==1)blockers.push('The strategy must cover an exact collection belonging to one owner.')
 const assigned=plan.lines.flatMap(l=>Array.isArray(l.itemIds)?l.itemIds:[])
 if(new Set(assigned).size!==assigned.length||assigned.length!==plan.itemIds.length||plan.itemIds.some(id=>!assigned.includes(id)))blockers.push('Every physical object must appear exactly once within a portfolio strategy. Competing draft strategies may overlap each other.')
 if(plan.strategy==='ALL_SOLO'&&plan.lines.some(l=>l.itemIds.length!==1))blockers.push('An all-solo strategy cannot contain a grouped lot.')
 if(plan.strategy==='HYBRID'&&(!plan.lines.some(l=>l.itemIds.length===1)||!plan.lines.some(l=>l.itemIds.length>1)))blockers.push('A hybrid needs both solo and grouped lots.')
 if(['MATCHED_SETS','CURATED_BUNDLES'].includes(plan.strategy)&&!plan.lines.some(l=>l.itemIds.length>1))blockers.push('The selected group strategy needs a real multi-object lot.')
 const lines=plan.lines.map(l=>assessLine(l,plan,inventory,comparables,qualifiedComparableIds,today));blockers.push(...lines.flatMap(l=>l.blockers))
 const sum=(key:'conditionalNetLow'|'conditionalNetHigh'|'expectedNetLow'|'expectedNetHigh')=>lines.every(l=>l[key]!==null)?cents(lines.reduce((n,l)=>n+l[key]!,0)):null
 const low=sum('conditionalNetLow'),high=sum('conditionalNetHigh'),expectedLow=sum('expectedNetLow'),expectedHigh=sum('expectedNetHigh')
 const members=inventory.filter(x=>plan.itemIds.includes(x.item.id)),costKnown=members.length===plan.itemIds.length&&members.every(m=>money(m.acquisitionCost)&&m.acquisitionCurrency===plan.currency)
 const purchase=costKnown?members.reduce((s,m)=>s+m.acquisitionCost!,0):null
 if(low!==null&&low<=0)blockers.push('Conservative conditional proceeds are nonpositive; do not recommend a clearance loss silently.')
 if(expectedLow!==null&&expectedLow<=0)blockers.push('Conservative probability-adjusted proceeds are nonpositive.')
 const ready=blockers.length===0
 return {plan,lines,conditionalNetLow:low,conditionalNetHigh:high,expectedNetLow:expectedLow,expectedNetHigh:expectedHigh,profitLow:purchase!==null&&low!==null?cents(low-purchase):null,profitHigh:purchase!==null&&high!==null?cents(high-purchase):null,daysHigh:lines.every(l=>money(l.line.daysHigh))?Math.max(...lines.map(l=>l.line.daysHigh!)):null,workHours:lines.every(l=>money(l.line.workHours))?cents(lines.reduce((s,l)=>s+l.line.workHours!,0)):null,blockers:[...new Set(blockers)],ready}
}
export function compareLotPlans(assessments:LotPlanAssessment[],objective:SellMode='FAST_CASH'){
 const rank=(rows:LotPlanAssessment[])=>[...rows].sort((a,b)=>objective==='FAST_CASH'?(a.daysHigh??Infinity)-(b.daysHigh??Infinity)||(b.expectedNetLow??-Infinity)-(a.expectedNetLow??-Infinity):(b.expectedNetLow??-Infinity)-(a.expectedNetLow??-Infinity)||(a.workHours??Infinity)-(b.workHours??Infinity))
 // Plans must cover the same physical collection and currency to be compared.
 const first=assessments[0]?.plan,scope=first?[...first.itemIds].sort().join(','):''
 const comparable=assessments.filter(a=>a.plan.currency===first?.currency&&[...a.plan.itemIds].sort().join(',')===scope)
 const recommendation=rank(comparable.filter(a=>a.ready))[0]||null
 const conditionalChoice=rank(comparable.filter(a=>a.expectedNetLow!==null&&a.daysHigh!==null&&a.workHours!==null))[0]||null
 return {recommendation,conditionalChoice,reason:recommendation?`${lotStrategyTitles[recommendation.plan.strategy]} is the best supported entered ${objective.replaceAll('_',' ')} plan, using ${objective==='FAST_CASH'?'the shorter assumed sale window, then conservative expected net':'conservative expected net, then practical workload'}. These are conditional plans, not guaranteed prices or publication approval.`:'No strategy has complete independent research, composition evidence and current economics. Any highlighted arithmetic remains hypothetical; there is no evidence-backed sale recommendation.'}
}

export type StoredGroupRevision={id:string;owner_id:string;group_id:string;revision:number;client_event_id:string;group_data:SaleGroupDraft;member_graphs:Record<string,string>;created_at:string}
export type StoredGroupEvent={id:string;owner_id:string;group_id:string;revision_id:string;client_event_id:string;kind:'APPROVE'|'RELEASE'|'SOLD';payload:Record<string,unknown>;created_at:string}
export type SaleClaim={owner_id:string;item_id:string;source_kind:'GROUP'|'LISTING'|'OUTCOME';source_id:string;state:'RESERVED'|'SOLD'}
export type SaleGroupRequest={kind:'REVISION'|'EVENT';eventId:string;ownerId:string;groupId:string;table:'sale_group_revisions'|'sale_group_events';rpc:string;args:Record<string,unknown>;expected:Record<string,unknown>}
const checkSelected=(current:()=>boolean)=>{if(!current())throw Error('This owner or collection is no longer selected.')}
async function owner(client:SupabaseClient,current:()=>boolean){checkSelected(current);const a=await client.auth.getUser();checkSelected(current);if(a.error||!a.data.user?.id)throw Error('Sign in again to read your private lot plans.');return a.data.user.id}
async function completeRows(client:SupabaseClient,table:string,ownerId:string,current:()=>boolean){
 const all:any[]=[];let count:number|undefined
 do{const r=await client.from(table).select('*',{count:'exact'}).eq('owner_id',ownerId).order(table==='active_item_sale_claims_v1'?'item_id':'created_at',{ascending:true}).range(all.length,all.length+99).abortSignal(AbortSignal.timeout(20000));checkSelected(current)
  if(r.error||!r.data||r.count===null||r.count>1000||(count!==undefined&&count!==r.count)||r.data.length!==Math.min(100,r.count-all.length))throw Error('Complete lot history is unavailable. Reload before saving or approving; missing history is not an empty collection.')
  count=r.count;all.push(...r.data)
 }while(all.length<count)
 if(all.some(r=>r.owner_id!==ownerId))throw Error('Lot history belongs to a different account.');return all
}
export async function readSaleGroups(client:SupabaseClient,current:()=>boolean){
 const ownerId=await owner(client,current),[revisions,events,claims]=await Promise.all([completeRows(client,'sale_group_revisions',ownerId,current),completeRows(client,'sale_group_events',ownerId,current),completeRows(client,'active_item_sale_claims_v1',ownerId,current)])
 if(await owner(client,current)!==ownerId)throw Error('Your account changed while lot plans were read.')
 if(revisions.some(r=>!uuid.test(r.id)||!uuid.test(r.group_id)||r.group_data?.ownerId!==ownerId||r.group_data?.groupId!==r.group_id||r.group_data?.revision!==r.revision)||events.some(e=>!uuid.test(e.id)||!['APPROVE','RELEASE','SOLD'].includes(e.kind)))throw Error('A stored lot plan has an unsupported format; preserve it for review.')
 return {ownerId,revisions:revisions as StoredGroupRevision[],events:events as StoredGroupEvent[],claims:claims as SaleClaim[]}
}
export async function prepareSaleGroupRevision(client:SupabaseClient,group:SaleGroupDraft,current:()=>boolean,eventId=crypto.randomUUID()):Promise<SaleGroupRequest>{
 const ownerId=await owner(client,current);if(ownerId!==group.ownerId||!uuid.test(eventId)||!uuid.test(group.groupId)||!Array.isArray(group.members)||!group.members.length)throw Error('Choose a valid owned group before saving.')
 const graphs:Record<string,string>={}
 for(const member of group.members){const r=await client.from('sale_group_item_context_v1').select('item_id,owner_id,graph_sha256').eq('owner_id',ownerId).eq('item_id',member.itemId).abortSignal(AbortSignal.timeout(20000)).single();checkSelected(current);if(r.error||r.data?.item_id!==member.itemId||r.data.owner_id!==ownerId||!sha.test(r.data.graph_sha256))throw Error('Current owned item/photo evidence could not be pinned.');graphs[member.itemId]=r.data.graph_sha256}
 if(await owner(client,current)!==ownerId)throw Error('Your account changed while the group was prepared.')
 return freeze(clone({kind:'REVISION',eventId,ownerId,groupId:group.groupId,table:'sale_group_revisions',rpc:'ci_save_sale_group_revision_v1',args:{p_event_id:eventId,p_group_id:group.groupId,p_expected_revision:group.revision-1,p_group:group,p_expected_graphs:graphs},expected:{owner_id:ownerId,group_id:group.groupId,client_event_id:eventId,revision:group.revision,group_data:group,member_graphs:graphs}}))
}
export async function prepareSaleGroupEvent(client:SupabaseClient,revision:StoredGroupRevision,kind:StoredGroupEvent['kind'],payload:Record<string,unknown>,current:()=>boolean,eventId=crypto.randomUUID()):Promise<SaleGroupRequest>{
 const ownerId=await owner(client,current);if(ownerId!==revision.owner_id||!uuid.test(eventId)||!uuid.test(revision.id)||!['APPROVE','RELEASE','SOLD'].includes(kind))throw Error('Choose a valid owned revision and event.')
 return freeze(clone({kind:'EVENT',eventId,ownerId,groupId:revision.group_id,table:'sale_group_events',rpc:'ci_record_sale_group_event_v1',args:{p_event_id:eventId,p_revision_id:revision.id,p_kind:kind,p_payload:payload},expected:{owner_id:ownerId,group_id:revision.group_id,revision_id:revision.id,client_event_id:eventId,kind,payload}}))
}
export async function settleSaleGroupRequest(client:SupabaseClient,request:SaleGroupRequest,current:()=>boolean,submit:boolean):Promise<StoredGroupRevision|StoredGroupEvent|null>{
 const auth=async()=>{if(await owner(client,current)!==request.ownerId)throw Error('Sign in as this group’s owner to check the held event.')};await auth()
 const inspect=async()=>{const r=await client.from(request.table).select('*',{count:'exact'}).eq('owner_id',request.ownerId).eq('client_event_id',request.eventId).limit(2).abortSignal(AbortSignal.timeout(20000));await auth();if(r.error||!r.data||r.count===null||r.count!==r.data.length||r.count>1)throw Error('Lot save outcome is unconfirmed. Keep this page open and Check before retrying.');const row=r.data[0];if(row&&Object.entries(request.expected).some(([k,v])=>stable(row[k])!==stable(v)))throw Error('This event belongs to different immutable lot facts; previous records were preserved.');return row||null}
 const existing=await inspect();if(existing||!submit)return existing
 if(!uuid.test(request.eventId)||!uuid.test(request.groupId)||!['ci_save_sale_group_revision_v1','ci_record_sale_group_event_v1'].includes(request.rpc))throw Error('Unsupported held lot event; no write attempted.')
 try{const r=await client.rpc(request.rpc,request.args).abortSignal(AbortSignal.timeout(20000));if(r.error){const saved=await inspect();if(saved)return saved;throw Error(r.error.message||'Lot operation was rejected; original records remain.')}}catch(e){const saved=await inspect();if(saved)return saved;throw e}
 return inspect()
}
