// KNOWLEDGE BRAIN WRITE-BACK (plan 18, step 9; Dean, 31 Oct). When the owner saves
// an item, what its research established goes into knowledge_records:
//  - OWNER_CONFIRMED_FINDING: each CONFIRMED standard element and each owner answer
//  - LEARNED_TELL: reusable clues for other items (de-duplicated)
// All rows are UNVERIFIED leads. Promotion to trusted still needs the owner's
// evidence review (the existing gate); nothing here can mark anything verified.
export type WriteBackRow={knowledge_type:'OWNER_CONFIRMED_FINDING'|'LEARNED_TELL';entity_type:string;entity_key:string;claim:string;
 certainty_class:'STRONG_ATTRIBUTION'|'POSSIBLE_ATTRIBUTION';evidence_provenance:string;freshness_requirement:'STABLE';verification_status:'UNVERIFIED';
 stance:'SUPPORTS';tags:string[];related_item_id:string|null;notes:string}
const clip=(s:unknown,n:number)=>String(s??'').replace(/\s+/g,' ').trim().slice(0,n)
const key=(s:unknown)=>clip(s,80).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'item'

export function knowledgeRows(research:any,itemId:string|null,title:string):WriteBackRow[]{
 const rows:WriteBackRow[]=[]
 const type=(Array.isArray(research?.specifics)?research.specifics:[]).find((s:any)=>s?.name==='Type')?.value||title
 const base={entity_type:'object',freshness_requirement:'STABLE' as const,verification_status:'UNVERIFIED' as const,stance:'SUPPORTS' as const,related_item_id:itemId}
 for(const s of Array.isArray(research?.specifics)?research.specifics:[]){
  if(s?.status!=='CONFIRMED'||!s?.value)continue
  rows.push({...base,knowledge_type:'OWNER_CONFIRMED_FINDING',entity_key:key(type),
   claim:clip(title,80)+': '+clip(s.name,40)+' = '+clip(s.value,160)+(s.evidence?' ('+clip(s.evidence,120)+')':''),
   certainty_class:'STRONG_ATTRIBUTION',evidence_provenance:'CI_RESEARCH_SAVED_BY_OWNER',tags:['standard-element',key(s.name)],
   notes:'Written when the owner saved this item. Unverified lead until reviewed.'})
 }
 for(const a of Array.isArray(research?.owner_answers)?research.owner_answers:[]){
  if(!a?.question||!['YES','NO'].includes(a.answer)&&!a.owner_saw)continue
  rows.push({...base,knowledge_type:'OWNER_CONFIRMED_FINDING',entity_key:key(type),
   claim:clip(title,80)+': '+clip(a.question,200)+' → '+(a.answer==='YES'?'Yes':a.answer==='NO'?'No':'Not sure')+(a.owner_saw?' · owner saw: '+clip(a.owner_saw,200):''),
   certainty_class:'STRONG_ATTRIBUTION',evidence_provenance:'OWNER_ANSWER',tags:['owner-answer'],notes:'The owner answered this while holding the object.'})
 }
 // The owner's own corrections (Disagree) are decisions that improve CI: keep them.
 for(const c of Array.isArray(research?.applied_owner_corrections)?research.applied_owner_corrections:[]){
  const said=clip(c?.owner_statement,400)
  if(!said||/^OWNER GOOGLE LENS RESULT/i.test(said))continue
  rows.push({...base,knowledge_type:'OWNER_CONFIRMED_FINDING',entity_key:key(type),claim:clip(title,80)+': owner correction · '+said,
   certainty_class:'STRONG_ATTRIBUTION',evidence_provenance:'OWNER_CORRECTION',tags:['owner-correction'],notes:'The owner corrected the research on this item.'})
 }
 for(const tell of Array.isArray(research?.learned_tells)?research.learned_tells:[]){
  const claim=clip(tell,280);if(!claim)continue
  rows.push({...base,knowledge_type:'LEARNED_TELL',entity_type:'clue',entity_key:key(type),claim,certainty_class:'POSSIBLE_ATTRIBUTION',
   evidence_provenance:'CI_RESEARCH_SAVED_BY_OWNER',tags:['learned-tell'],related_item_id:itemId,notes:'Reusable clue from a saved item. Unverified lead until reviewed.'})
 }
 return rows.slice(0,30)
}

export async function writeBackKnowledge(client:any,ownerId:string,research:any,itemId:string|null,title:string):Promise<{written:number;error:string|null}>{
 const rows=knowledgeRows(research,itemId,title)
 if(!rows.length)return {written:0,error:null}
 // Skip clues already in the brain (same wording).
 const tells=rows.filter(r=>r.knowledge_type==='LEARNED_TELL').map(r=>r.claim)
 let known=new Set<string>()
 if(tells.length){
  const {data,error}=await client.from('knowledge_records').select('claim').eq('knowledge_type','LEARNED_TELL').in('claim',tells)
  if(error)return {written:0,error:'Knowledge Brain not updated: '+String(error.message||'read failed')}
  known=new Set((data||[]).map((x:any)=>x.claim))
 }
 const fresh=rows.filter(r=>r.knowledge_type!=='LEARNED_TELL'||!known.has(r.claim)).map(r=>({...r,owner_id:ownerId}))
 if(!fresh.length)return {written:0,error:null}
 const {error}=await client.from('knowledge_records').insert(fresh)
 return error?{written:0,error:'Knowledge Brain not updated: '+String(error.message||'save failed')}:{written:fresh.length,error:null}
}

// Server write-back (runs when deep research finishes): REST with the owner's
// token; owner_id defaults to the signed-in owner. Rows already in the brain
// (same type and wording) are skipped, so reruns do not duplicate.
export async function writeBackViaRest(url:string,key:string,token:string,research:any,itemId:string|null,title:string):Promise<{written:number;error:string|null}>{
 try{
  const rows=knowledgeRows(research,itemId,title)
  if(!rows.length)return {written:0,error:null}
  const h={apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json'}
  const qp=new URLSearchParams({select:'knowledge_type,claim',knowledge_type:'in.(OWNER_CONFIRMED_FINDING,LEARNED_TELL)',order:'created_at.desc',limit:'2000'})
  const seen=await fetch(url+'/rest/v1/knowledge_records?'+qp.toString(),{headers:h})
  if(!seen.ok)return {written:0,error:'Knowledge Brain could not be read ('+seen.status+')'}
  const have=new Set((await seen.json()).map((r:any)=>r.knowledge_type+'|'+r.claim))
  const fresh=rows.filter(r=>!have.has(r.knowledge_type+'|'+r.claim))
  if(!fresh.length)return {written:0,error:null}
  const ins=await fetch(url+'/rest/v1/knowledge_records',{method:'POST',headers:{...h,Prefer:'return=minimal'},body:JSON.stringify(fresh)})
  return ins.ok?{written:fresh.length,error:null}:{written:0,error:'Knowledge Brain not updated ('+ins.status+')'}
 }catch{return {written:0,error:'Knowledge Brain not updated: connection failed'}}
}

// The owner's taste (Dean, 31 Oct): what his collection is mostly made of, from
// the standard elements of his researched items. A guide to where to look first;
// never evidence for any one item.
export function collectionProfile(specLists:any[][]):Record<string,{value:string;count:number}[]>{
 const names=['Type','Material','Maker or brand','Pattern or model','Era','Country of origin','Antique or reproduction']
 const out:Record<string,{value:string;count:number}[]>={}
 for(const n of names){
  const counts=new Map<string,number>()
  for(const list of specLists)for(const s of Array.isArray(list)?list:[]){
   if(s?.name!==n||!s?.value||!['CONFIRMED','LIKELY'].includes(s.status))continue
   const v=clip(s.value,60);counts.set(v,(counts.get(v)||0)+1)
  }
  const top=[...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8).map(([value,count])=>({value,count}))
  if(top.length)out[n]=top
 }
 return out
}
