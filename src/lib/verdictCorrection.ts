import type {SupabaseClient} from '@supabase/supabase-js'
import {readCatalogueContext} from './catalogueApproval'
import type {CatalogueSource} from './catalogueApproval'
import type {VerdictFeedback} from './ownerCorrections'

export type CorrectionRow=VerdictFeedback&{id:string;owner_id:string;source_analysis_run_id:string}
type Facts=Pick<CorrectionRow,'source_object_index'|'feedback_type'|'corrected_material'|'owner_statement'>
export type CorrectionRequest={readonly source:CatalogueSource;readonly row:Facts&{id:string;owner_id:string;source_analysis_run_id:string}}
export class CorrectionError extends Error{}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const plain=(v:any)=>v!==null&&typeof v==='object'&&!Array.isArray(v)
const stable=(v:any):string=>JSON.stringify(v,(_key,value)=>plain(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,value[key]])):value)
const equal=(a:any,b:any)=>stable(a)===stable(b)
const freeze=<T,>(value:T):T=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value)}return value}
const original=(source:CatalogueSource)=>{const {owner_review:_review,...result}=source.result;return {id:source.id,owner:source.owner_id,mode:source.mode,count:source.input_photo_count,result,context:source.user_context}}
const fail=(message:string):never=>{throw new CorrectionError(message)}
const stop=(current:()=>boolean)=>{if(!current())fail('The previous saved report is no longer selected.')}
const types=['MATERIAL_CORRECTION','ATTRIBUTION_REJECTION','IDENTIFICATION_CORRECTION','OTHER']
const valid=(facts:Facts,total:number)=>
 (facts.source_object_index===null||(Number.isInteger(facts.source_object_index)&&facts.source_object_index>=0&&facts.source_object_index<total))&&types.includes(facts.feedback_type)&&
 typeof facts.owner_statement==='string'&&[...facts.owner_statement.trim()].length>=3&&[...facts.owner_statement].length<=2000&&
 (facts.corrected_material===null||(typeof facts.corrected_material==='string'&&[...facts.corrected_material.trim()].length>=2&&[...facts.corrected_material].length<=100))&&
 (facts.feedback_type!=='MATERIAL_CORRECTION'||facts.corrected_material!==null)

export async function readOwnerCorrections(client:SupabaseClient,source:CatalogueSource,current:()=>boolean):Promise<CorrectionRow[]>{
 stop(current)
 const read=await client.from('ai_verdict_feedback').select('id,owner_id,source_analysis_run_id,source_object_index,feedback_type,corrected_material,owner_statement,created_at',{count:'exact'})
  .eq('owner_id',source.owner_id).eq('source_analysis_run_id',source.id).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(501).abortSignal(AbortSignal.timeout(20000))
 stop(current)
 const rows=read.data as CorrectionRow[]|null
 if(read.error||!rows||read.count===null||read.count!==rows.length||read.count>500)return fail('Complete owner corrections unavailable. Keep this page open and check the same correction before further actions.')
 if(new Set(rows.map(row=>row.id)).size!==rows.length||rows.some(row=>!uuid.test(row.id)||row.owner_id!==source.owner_id||row.source_analysis_run_id!==source.id||!valid(row,source.result.objects.length)||typeof row.created_at!=='string'||!Number.isFinite(Date.parse(row.created_at))))return fail('The saved correction identities or facts could not be verified. Keep your current text before reloading.')
 return rows
}
export async function prepareCorrection(client:SupabaseClient,expected:CatalogueSource,facts:Facts,current:()=>boolean):Promise<CorrectionRequest>{
 const {source}=await readCatalogueContext(client,expected.id,current)
 if(!equal(original(source),original(expected)))return fail('The original report changed in another view. Your correction text remains here; copy it before reloading.')
 if(!valid(facts,source.result.objects.length))return fail('Choose a valid object and correction type, with 3–2,000 characters of correction details and a valid material.')
 const rows=await readOwnerCorrections(client,source,current)
 if(rows.length>=500)return fail('This report has reached the correction review limit. Copy your text and ask for support before adding another observation.')
 const row={id:crypto.randomUUID(),owner_id:source.owner_id,source_analysis_run_id:source.id,...facts}
 // Retrying reuses this exact identity and facts; never upsert or replace an observation.
 return freeze(JSON.parse(JSON.stringify({source,row})) as CorrectionRequest)
}
async function inspect(client:SupabaseClient,request:CorrectionRequest,current:()=>boolean){
 const {source}=await readCatalogueContext(client,request.source.id,current)
 if(!equal(original(source),original(request.source)))return fail('The original report changed. Your held correction remains unchanged; copy it before reloading.')
 const rows=await readOwnerCorrections(client,source,current)
 const row=rows.find(value=>value.id===request.row.id)
 if(row){
  const {created_at:_time,...facts}=row
  if(!equal(facts,request.row))return fail('The saved correction differs from the held observation. Keep your text and review the report before continuing.')
  return {row,rows}
 }
 if(rows.length>=500)return fail('The complete correction history has reached its review limit. Keep the held observation and ask for support.')
 return null
}
export async function settleCorrection(client:SupabaseClient,request:CorrectionRequest,current:()=>boolean,submit:boolean){
 const found=await inspect(client,request,current)
 if(found||!submit)return found
 stop(current)
 try{await client.from('ai_verdict_feedback').insert(request.row).abortSignal(AbortSignal.timeout(20000))}catch{/* Read back the retained identity even if its acknowledgement was lost. */}
 stop(current)
 return inspect(client,request,current)
}
