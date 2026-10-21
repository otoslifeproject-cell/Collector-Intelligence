import type {SupabaseClient} from '@supabase/supabase-js'
import {readCatalogueContext} from './catalogueApproval'
import type {CatalogueSource} from './catalogueApproval'

type Changes=Record<string,{working_title?:string;condition_summary?:string}>
export type OwnerReviewRequest={readonly source:CatalogueSource;readonly changes:Changes}
export class OwnerReviewError extends Error{}
const plain=(value:any)=>value!==null&&typeof value==='object'&&!Array.isArray(value)
const stable=(value:any):string=>JSON.stringify(value,(_key,v)=>plain(v)?Object.fromEntries(Object.keys(v).sort().map(key=>[key,v[key]])):v)
const equal=(a:any,b:any)=>stable(a)===stable(b)
const original=(source:CatalogueSource)=>{const {owner_review:_review,...result}=source.result;return {id:source.id,owner:source.owner_id,mode:source.mode,count:source.input_photo_count,result,context:source.user_context}}
const fail=(message:string):never=>{throw new OwnerReviewError(message)}
const stop=(current:()=>boolean)=>{if(!current())fail('The previous saved report is no longer selected.')}
const freeze=<T,>(value:T):T=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value)}return value}
const conflict='Another view changed this saved report or review. Your current text remains here. Copy your edits before reloading; no newer review was overwritten.'

export async function prepareOwnerReview(client:SupabaseClient,expected:CatalogueSource,changes:Changes,current:()=>boolean):Promise<OwnerReviewRequest>{
 const {source,items}=await readCatalogueContext(client,expected.id,current)
 if(!equal(original(source),original(expected))||source.owner_review_revision!==expected.owner_review_revision||!equal(source.result.owner_review??null,expected.result.owner_review??null))return fail(conflict)
 if(source.status!=='DRAFT'||items.length)return fail('This report already has catalogue activity. Copy your review text before reloading its saved records.')
 if(source.owner_review_revision>=2147483647)return fail('The review revision limit needs support before another save.')
 if(!plain(changes)||!Object.keys(changes).length||Object.entries(changes).some(([index,fields])=>!/^(0|[1-9][0-9]*)$/.test(index)||Number(index)>=source.result.objects.length||!plain(fields)||!Object.keys(fields).length||Object.entries(fields).some(([key,value])=>!['working_title','condition_summary'].includes(key)||typeof value!=='string'||[...value].length>2000||(key==='working_title'&&value.trim().length<2))))return fail('Each object needs a title of at least two characters; review fields must be text no longer than 2,000 characters.')
 const review=source.result.owner_review
 if(review!=null&&(!plain(review)||(!plain(review.objects??{})||Object.values(review.objects??{}).some(value=>!plain(value)))))return fail('The saved review snapshot needs support before another save. Your current text remains here.')
 return freeze(JSON.parse(JSON.stringify({source,changes})))
}

async function inspect(client:SupabaseClient,request:OwnerReviewRequest,current:()=>boolean){
 const {source,items}=await readCatalogueContext(client,request.source.id,current)
 if(!equal(original(source),original(request.source)))return fail(conflict)
 const target=request.source.owner_review_revision+1
 const history=await client.from('ai_owner_review_revisions').select('id,owner_id,source_analysis_run_id,revision,object_changes,created_at',{count:'exact'})
  .eq('owner_id',request.source.owner_id).eq('source_analysis_run_id',request.source.id).eq('revision',target).order('id').limit(2).abortSignal(AbortSignal.timeout(20000))
 stop(current)
 if(history.error||!history.data||history.count===null||history.count!==history.data.length||history.count>1)return fail('Complete review revision evidence could not be read. Keep this page open and check the same save.')
 const row=history.data[0]
 if(row){
  if(row.owner_id!==request.source.owner_id||row.source_analysis_run_id!==source.id||row.revision!==target||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.id)||!equal(row.object_changes,request.changes))return fail(conflict)
  if(source.owner_review_revision>target)return fail('Your held changes exist in revision '+target+', but a newer review is now saved. Copy your current text before reloading; no newer review was overwritten.')
  const previous=request.source.result.owner_review??{},objects={...previous.objects}
  for(const [index,fields] of Object.entries(request.changes))objects[index]={...objects[index],...fields}
  const review=source.result.owner_review
  if(source.owner_review_revision!==target||!plain(review)||review.revision!==target)return fail('The revision evidence and saved report do not yet agree. Keep this page open and check the same save.')
  const {edited_at,revision:_revision,...facts}=review
  const {edited_at:_oldTime,revision:_oldRevision,...prior}=previous
  if(typeof edited_at!=='string'||!Number.isFinite(Date.parse(edited_at))||Date.parse(edited_at)!==Date.parse(row.created_at)||!equal(facts,{...prior,objects}))return fail('The saved review facts differ from the held changes. Copy your text before reloading; no newer review was overwritten.')
  if(source.status!=='DRAFT'||items.length)return fail('The review was saved and this report now has catalogue activity. Copy your text before reloading its saved records.')
  return source
 }
 if(source.owner_review_revision!==request.source.owner_review_revision||source.status!=='DRAFT'||items.length||!equal(source.result.owner_review??null,request.source.result.owner_review??null))return fail(conflict)
 return null
}

export async function settleOwnerReview(client:SupabaseClient,request:OwnerReviewRequest,current:()=>boolean,submit:boolean):Promise<CatalogueSource|null>{
 const saved=await inspect(client,request,current)
 if(saved||!submit)return saved
 stop(current)
 // The acknowledgement is not evidence. A lost reply or rejected duplicate is settled by GET.
 try{await client.rpc('ci_save_owner_review_v1',{p_run_id:request.source.id,p_expected_revision:request.source.owner_review_revision,p_object_changes:request.changes}).abortSignal(AbortSignal.timeout(20000))}catch{/* Preserve the held request for independent readback. */}
 stop(current)
 return inspect(client,request,current)
}
