export function inscriptionObjectIndex(objects:any[],refs:unknown):number|null {
 if(!Array.isArray(objects)||!Array.isArray(refs)||!refs.length||refs.some(n=>!Number.isInteger(n)||n<0))return null
 const owners=refs.map(n=>objects.flatMap((object:any,index:number)=>Array.isArray(object?.image_indices)&&object.image_indices.includes(n)?[index]:[]))
 if(owners.some(indices=>indices.length!==1)||new Set(owners.map(indices=>indices[0])).size!==1)return null
 return owners[0][0]
}
export function applyInscriptionReview(result: any, review: any) {
  if (!review?.mark_visible || !Array.isArray(result?.objects)) return result;
  const valid = new Set((review.evidence_image_indices || []).filter((x: any) => Number.isInteger(x)));
  const description = review.candidate_transcription
    ? `Second-pass candidate inscription: "${review.candidate_transcription}" (${review.transcription_confidence}% transcription confidence; NOT independently verified).`
    : "Second-pass examination detected a mark but could not transcribe it reliably.";
  const matched=result.objects.map((object:any,index:number)=>({object,index})).filter(({object}:any)=>
    Array.isArray(object.image_indices)&&object.image_indices.some((x:number)=>valid.has(x)));
  // A single transcription spanning two objects is not two independently read
  // signatures. Preserve the original review, but attach it to neither piece.
  if(matched.length!==1||inscriptionObjectIndex(result.objects,review.evidence_image_indices)!==matched[0].index){
    result.inscription_scope_audit={status:'UNASSIGNED',object_indices:matched.map((x:any)=>x.index),
      reason:'One inscription response cannot independently authenticate or transcribe multiple objects; review each physical mark separately.'};
    return result;
  }
  result.inscription_scope_audit={status:'SINGLE_OBJECT_CANDIDATE',object_indices:[matched[0].index],maker_authenticated:false};
  for (const {object} of matched) {
    if (!Array.isArray(object.image_indices) || !object.image_indices.some((x: number) => valid.has(x))) continue;
    const indices = object.image_indices.filter((x: number) => valid.has(x)).join(", ");
    const source = `Source image indices: ${indices || "not determined"}. ${review.rationale || ""}`;
    object.marks_signatures_labels = [object.marks_signatures_labels, description].filter(Boolean).join(" ");
    object.evidence = Array.isArray(object.evidence) ? object.evidence : [];
    object.evidence.push({ claim: description, provenance: "INFERENCE", certainty_class: "POSSIBLE_ATTRIBUTION", stance: "SUPPORTS", notes: source });
    if (review.candidate_maker && !object.maker) {
      object.current_attribution = [review.candidate_maker, review.candidate_design].filter(Boolean).join(" — ") + " (candidate only; research needed)";
      object.catalogue_note = `Unverified inscription-led candidate: ${object.current_attribution}. ${object.catalogue_note || ""}`;
      // Image-only maker readings are hypotheses, never confirmed identities.
      object.identification_confidence = Math.min(74, object.identification_confidence || 0); // A speculative second-pass maker must not increase object-level identification certainty.
    }
    if (review.candidate_period && !object.period_wording) object.period_wording = `Possible ${review.candidate_period}; unverified`;
    if (review.candidate_maker) {
      object.sale_readiness = "RESEARCH_FIRST";
      object.status = "RESEARCH";
      object.specialist_review = true;
    }
    // Do not request replacement photographs if the existing image already yields a candidate reading.
    if (!review.needs_new_photograph && review.candidate_transcription && Array.isArray(object.next_evidence)) {
      object.next_evidence = object.next_evidence.filter((e: any) => !/\b(?:inscription|signature|mark)\b/i.test(String(e.title || "")));
    }
  }
  return result;
}
