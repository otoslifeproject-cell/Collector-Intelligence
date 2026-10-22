// Project learning: do not equate model certainty with owner-observed material facts.
// Original model output remains immutable. Correction feedback stays chronological.
export type VerdictFeedback={
 id?:string
 source_object_index:number|null
 feedback_type:string
 corrected_material?:string|null
 owner_statement:string
 created_at:string
}
export function feedbackForObject(rows:VerdictFeedback[],index:number,paired=false){
 return rows.filter(x=>x.source_object_index==null||
   Number(x.source_object_index)===index||
   (paired&&(x.source_object_index===0||x.source_object_index===1)))
}
export function currentOwnerMaterial(rows:VerdictFeedback[]){
 return [...rows].filter(x=>x.feedback_type==='MATERIAL_CORRECTION'&&x.corrected_material)
  .sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at))[0]?.corrected_material||null
}
export function researchPredatesCorrection(researchCreatedAt:string|undefined,feedback:VerdictFeedback[]){
 if(!researchCreatedAt)return false
 const when=Date.parse(researchCreatedAt)
 return feedback.some(x=>Date.parse(x.created_at)>when)
}
const materialClasses=new Map<string,RegExp>([
 ['metal',/\bmetal\b/],['glass',/\bglass\b/],['ceramic',/\b(ceramic|pottery|porcelain|earthenware|stoneware)\b/],
 ['wood',/\bwood(en)?\b/],['stone',/\bstone\b/],['textile',/\b(textile|fabric)\b/]
])
export function materialContradictsVisualGuess(ownerMaterial:string|null,modelDescription:string){
 if(!ownerMaterial)return false
 const material=ownerMaterial.trim().toLowerCase()
 const raw=(modelDescription||'').toLowerCase()
 const observed=materialClasses.get(material)
 // Unknown/mixed observations and unclassified descriptions remain uncertain.
 // A model explicitly listing the owner's class is compatible, even when mixed.
 return !!observed&&!observed.test(raw)&&[...materialClasses.values()].some(pattern=>pattern.test(raw))
}
