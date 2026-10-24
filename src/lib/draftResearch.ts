import type {SupabaseClient} from '@supabase/supabase-js'
import {readCatalogueContext} from './catalogueApproval'
import type {CatalogueSource} from './catalogueApproval'

export type DraftResearchRow={id:string;owner_id:string;mode:string;model:string|null;created_at:string;user_context:any;result:any}
export class DraftResearchError extends Error{}
const plain=(value:any)=>value!==null&&typeof value==='object'&&!Array.isArray(value)
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const stable=(value:any):string=>JSON.stringify(value,(_key,v)=>plain(v)?Object.fromEntries(Object.keys(v).sort().map(key=>[key,v[key]])):v)
const original=(source:CatalogueSource)=>{const {owner_review:_review,...result}=source.result;return {owner:source.owner_id,id:source.id,mode:source.mode,count:source.input_photo_count,result,context:source.user_context}}
const stop=(current:()=>boolean)=>{if(!current())throw new DraftResearchError('The previous saved report is no longer selected.')}
const fail=():never=>{throw new DraftResearchError('Complete saved research history could not be verified. Check saved research before starting another paid search.')}
const optionalText=(value:any)=>value==null||typeof value==='string'
const optionalNumber=(value:any)=>value==null||(typeof value==='number'&&Number.isFinite(value))
const currency=(value:any)=>value==null||(typeof value==='string'&&/^[A-Z]{3}$/.test(value))
const strings=(value:any,keys:string[])=>keys.every(key=>optionalText(value[key]))
// A persisted model response is still provisional. Malformed/legacy output stays
// inspectable as raw data instead of crashing the decision panel or being discarded.
export function hasSavedResearchResult(row:DraftResearchRow){
 const r=row.result
 if(!plain(r)||r.analysis_stage!=='COMPLETE'||typeof r.research_summary!=='string'||!r.research_summary.trim())return false
 const id=r.identification_update??{},value=r.valuation??{},route=r.routing??{},comps=r.comparables??[],next=r.next_evidence??[]
 return plain(id)&&plain(value)&&plain(route)&&strings(id,['attribution','maker','rationale','period_wording','region_country'])&&optionalNumber(id.identification_confidence)&&
  (id.contradictions==null||(Array.isArray(id.contradictions)&&id.contradictions.every((x:any)=>typeof x==='string')))&&
  currency(value.currency)&&optionalText(value.notes)&&['balanced_low','balanced_high','quick_sale_value','auction_low','auction_high','private_low','private_high','dealer_asking_low','dealer_asking_high','valuation_confidence'].every(key=>optionalNumber(value[key]))&&
  strings(route,['best_venue','backup_venue','strategy','sale_readiness'])&&(route.reasons==null||(Array.isArray(route.reasons)&&route.reasons.every((x:any)=>typeof x==='string')))&&
  Array.isArray(comps)&&comps.every((c:any)=>plain(c)&&strings(c,['source_url','venue','description','price_type','verification_status','comparability_grade'])&&currency(c.currency)&&optionalNumber(c.price))&&
  Array.isArray(next)&&next.every((x:any)=>plain(x)&&strings(x,['title','why']))
}
export function researchForScope(row:DraftResearchRow,index:number,paired:boolean){return row.user_context.source_object_index===index&&(row.user_context.pair_source_indices?.length===2)===paired}
export async function readDraftResearch(client:SupabaseClient,expected:CatalogueSource,current:()=>boolean):Promise<DraftResearchRow[]>{
 stop(current)
 const {source}=await readCatalogueContext(client,expected.id,current)
 if(stable(original(source))!==stable(original(expected)))throw new DraftResearchError('The original report changed. Copy current edits before reloading; no new research was requested.')
 const rows:DraftResearchRow[]=[];let total:number|undefined
 do{
  const read=await client.from('ai_analysis_runs').select('id,owner_id,mode,model,result,created_at,user_context',{count:'exact'})
   .eq('owner_id',source.owner_id).eq('mode','research').eq('user_context->>source_analysis_run_id',source.id)
   .order('created_at',{ascending:false}).order('id',{ascending:false}).range(rows.length,rows.length+99).abortSignal(AbortSignal.timeout(20000))
  stop(current)
  if(read.error||!read.data||read.count===null||read.count>500||(total!==undefined&&read.count!==total))return fail()
  total=read.count
  if(read.data.length!==Math.min(100,total-rows.length))return fail()
  rows.push(...read.data as DraftResearchRow[])
 }while(rows.length<total)
 if(new Set(rows.map(row=>row.id)).size!==rows.length||rows.some(row=>{
  const ctx=row.user_context,pair=ctx?.pair_source_indices??[]
  return !uuid.test(row.id)||row.owner_id!==source.owner_id||row.mode!=='research'||typeof row.created_at!=='string'||!Number.isFinite(Date.parse(row.created_at))||!plain(row.result)||!plain(ctx)||ctx.source_analysis_run_id!==source.id||!Number.isInteger(ctx.source_object_index)||ctx.source_object_index<0||ctx.source_object_index>=source.result.objects.length||!Array.isArray(pair)||
   !(pair.length===0||(stable(pair)==='[0,1]'&&source.mode==='single'&&source.result.objects.length===2&&ctx.source_object_index===0))||
   (ctx.research_depth!==undefined&&!['standard','deep_dive'].includes(ctx.research_depth))
 }))return fail()
 return rows
}
