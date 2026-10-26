// Provider execution metadata, captured by the server from the actual response.
// It proves what was returned, not that a source is true or a maker authenticated.
export function researchExecutionReceipt(payload:any,runId:string,startedAt:string,finishedAt:string){
 const output=Array.isArray(payload?.output)?payload.output:[]
 const calls=output.filter((x:any)=>x?.type==='web_search_call').map((x:any)=>({
  id:typeof x.id==='string'?x.id:null,status:typeof x.status==='string'?x.status:'unknown',
  action:typeof x.action?.type==='string'?x.action.type:null,
  queries:Array.isArray(x.action?.queries)?x.action.queries.filter((q:any)=>typeof q==='string'):[]
 }))
 const links:string[]=[]
 for(const message of output)for(const part of Array.isArray(message?.content)?message.content:[])
  for(const annotation of Array.isArray(part?.annotations)?part.annotations:[])
   if(annotation?.type==='url_citation'&&typeof annotation.url==='string')links.push(annotation.url)
 return {version:1,run_id:runId,started_at:startedAt,finished_at:finishedAt,
  provider_response_id:typeof payload?.id==='string'?payload.id:null,
  web_search_calls:calls,citation_urls:[...new Set(links)],independent_source_verification:false,
  outcome:'MODEL_RESULT_RETURNED',category_receipts_available:false}
}
