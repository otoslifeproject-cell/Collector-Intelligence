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
