import {loadCanonicalForCaller,revalidateCanonicalBeforePaidCall,canonicalSourceAudit} from '../src/lib/canonicalRuntime.ts';
import type {CanonicalRuntimeContext} from '../src/lib/canonicalRuntime.ts';
import {CanonicalSourceError} from '../src/lib/approvedCanonicalSources.ts';

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["batch_summary", "objects"],
  properties: {
    batch_summary: { type: "string" },
    objects: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "image_indices","working_title","category","object_type","material","colour",
          "maker","current_attribution","period_wording","region_country",
          "identification_confidence","dating_confidence","valuation_confidence",
          "condition_summary","marks_signatures_labels","rarity_desirability",
          "sale_readiness","status","specialist_review","evidence","next_evidence",
          "preliminary_value","catalogue_note"
        ],
        properties: {
          image_indices: { type: "array", items: { type: "integer", minimum: 0 } },
          working_title: { type: "string" },
          category: { type: "string" },
          object_type: { type: "string" },
          material: { type: "string" },
          colour: { type: "string" },
          maker: { type: ["string","null"] },
          current_attribution: { type: ["string","null"] },
          period_wording: { type: ["string","null"] },
          region_country: { type: ["string","null"] },
          identification_confidence: { type: "integer", minimum: 0, maximum: 100 },
          dating_confidence: { type: "integer", minimum: 0, maximum: 100 },
          valuation_confidence: { type: "integer", minimum: 0, maximum: 100 },
          condition_summary: { type: "string" },
          marks_signatures_labels: { type: ["string","null"] },
          rarity_desirability: { type: ["string","null"] },
          sale_readiness: {
            type: "string",
            enum: ["SELL_NOW","ONE_QUICK_CHECK_THEN_SELL","RESEARCH_FIRST","SPECIALIST_REVIEW"]
          },
          status: {
            type: "string",
            enum: ["CATALOGUED","RESEARCH","ONE_QUICK_CHECK","SPECIALIST_REVIEW","READY_TO_SELL"]
          },
          specialist_review: { type: "boolean" },
          evidence: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["claim","provenance","certainty_class","stance","notes"],
              properties: {
                claim: { type: "string" },
                provenance: { type: "string", enum: ["PHOTO","INFERENCE"] },
                certainty_class: { type: "string", enum: ["FACT","STRONG_ATTRIBUTION","POSSIBLE_ATTRIBUTION","UNKNOWN"] },
                stance: { type: "string", enum: ["SUPPORTS","WEAKENS","NEUTRAL"] },
                notes: { type: ["string","null"] }
              }
            }
          },
          next_evidence: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["title","why","information_value"],
              properties: {
                title: { type: "string" },
                why: { type: "string" },
                information_value: { type: "integer", minimum: 0, maximum: 100 }
              }
            }
          },
          preliminary_value: {
            type: "object",
            additionalProperties: false,
            required: ["currency","quick_sale","balanced_low","balanced_high","floor","basis"],
            properties: {
              currency: { type: "string" },
              quick_sale: { type: ["number","null"] },
              balanced_low: { type: ["number","null"] },
              balanced_high: { type: ["number","null"] },
              floor: { type: ["number","null"] },
              basis: { type: "string" }
            }
          },
          catalogue_note: { type: "string" }
        }
      }
    }
  }
};

const systemPrompt = `You are the image-intake engine for Collector Intelligence, an evidence-led collector/dealer catalogue.

Mission: separate photographs into physical objects, inspect them closely, and create conservative catalogue drafts. Glass and art glass are a priority, but other collectables are allowed.

Hard rules:
- Never invent a maker, signature, provenance, date, pattern name, mark, rarity claim, or auction result.
- Separate direct visual FACT from STRONG_ATTRIBUTION, POSSIBLE_ATTRIBUTION and UNKNOWN.
- Bubbles, rough pontils, weight and apparent wear are not proof of age by themselves.
- IMPORTANT MATERIAL DISCRIMINATOR: This project previously misidentified a dark gilt/floral decorated METAL pair as glass, even repeating the glass error during online research. Do not assume dark reflective, enamelled or gilded surfaces are glass. Visually test metal, ceramic, wood and mixed construction against glass FIRST using rim thickness, rim/foot edge profile, joins, surface wear revealing substrate, tooling, reflections and observed material evidence. If you cannot distinguish, label material UNKNOWN and ask ONE decisive inspection, never confidently state glass.
- If maker/date is not supported, return null or cautious wording.
- Identification confidence, dating confidence and valuation confidence are independent.
- Inspect silhouette/proportions, colour/clarity, base, pontil, polished/ground areas, mould seams, bubbles/striae/inclusions, tooling, cut decoration, rim, handle joins/applied decoration, wear, labels, marks/signatures and visible chips/cracks/bruises/repairs.
- For mixed batches, assign each image index to the object it depicts. Do not transfer evidence between objects.
- In single-object intake, multiple camera angles of one physical piece must NOT become multiple object records.
- image_indices MUST contain only the zero-based indices of actual uploaded images (the allowed list is supplied in this run). Never invent a nonexistent photo index or shift an index because descriptive notes count images from 1.
- A matched PAIR is two physical pieces but can be one catalogue and selling lot. If a genuine matching pair is visible, describe the left and right pieces separately and retain their original photo indices so the owner can group them as one lot.
- Never use shared images or similar colour alone as evidence that two objects are the same piece or a matched pair; flag ambiguity without inventing duplicates.
- The user may later research the market. This intake pass has no verified sold-comparable search. Therefore any value is VISUAL-ONLY PROVISIONAL; use null when evidence is inadequate and keep valuation confidence appropriately low.
- If an attribution could materially change value, set specialist_review true and sale_readiness SPECIALIST_REVIEW or RESEARCH_FIRST.
- Treat a visible mark or inscription as attribution-critical evidence. Examine ALL supplied detail and underside photographs, especially later indices, before describing it as unreadable or asking for another photograph.
- Distinguish inscription present, candidate reading, confirmed transcription and independently verified maker attribution. Record literal uncertainty and refer to existing source image indices in the notes; never silently resolve unclear letters into a famous maker.
- Different lighting can make clear glass look white, opalescent or dark. Distinguish confirmed intrinsic colour from background, shadow and optical refraction.
- Before describing a white/milky core, opaque layer or dark inclusion as intrinsic to glass, seek consistency across multiple angles and backdrops; otherwise write 'apparent white/dark area could be lighting/refraction/background' and mark composition UNKNOWN.
- For faint inscriptions: separate engraved grooves (which track surface under illumination) from scratches (irregular intersecting abrasions), adhesive residue/label and shadow. Give specific original source image numbers and alternative interpretations.
- Do not confuse heavily scratched polished underside with a rough pontil or proof of age. Differentiate wear, fractures and manufactured tooling; do not assert rim chips unless image evidence shows one.
- Compare form-level discriminators (lobes, rim profile, base geometry, dimensions when supplied) before maker speculation; never treat resemblance or apparent handwriting alone as authentication.
- Do not describe an unidentified form as simply Scandinavian-influenced when distinctive form + mark permit a more specific, clearly provisional candidate identification.
- next_evidence should ask only for photos, measurements or tests that would materially change identification, dating, valuation or sale route.
- catalogue_note is clean outward-facing wording but must preserve uncertainty.
- Return no prose outside the structured output.`;

// Targeted second look at already supplied evidence, without performing unsupported external research.
const inscriptionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["mark_visible","candidate_transcription","transcription_confidence","evidence_image_indices","candidate_maker","candidate_design","candidate_period","attribution_confidence","rationale","contradictions","needs_new_photograph"],
  properties: {
    mark_visible: { type: "boolean" },
    candidate_transcription: { type: ["string","null"] },
    transcription_confidence: { type: "integer", minimum: 0, maximum: 100 },
    evidence_image_indices: { type: "array", items: { type: "integer", minimum: 0 } },
    candidate_maker: { type: ["string","null"] },
    candidate_design: { type: ["string","null"] },
    candidate_period: { type: ["string","null"] },
    attribution_confidence: { type: "integer", minimum: 0, maximum: 100 },
    rationale: { type: "string" },
    contradictions: { type: "array", items: { type: "string" } },
    needs_new_photograph: { type: "boolean" }
  }
};

function markNeedsReview(result: any, context: any): boolean {
  const items = Array.isArray(result?.objects) ? result.objects : [];
  return items.some((obj: any) => {
    const mark = String(obj.marks_signatures_labels || "").trim();
    const note = String(obj.catalogue_note || "");
    const evidenceText = (obj.evidence || []).map((e:any)=>String(e.claim || "")).join(" ");
    const visibleMark = /(?:inscri|signatur|signed|engraved|etched|hand.writ|mark)/i.test(mark + " " + note + " " + evidenceText);
    const explicitlyAbsent = /^(?:none|no marks|no signatures|not visible|unmarked|unknown|n\/a)\.?$/i.test(mark);
    return visibleMark && !explicitlyAbsent;
  }) || /\b(?:signed|signature|inscription)\b/i.test(String(context?.user_notes || ""));
}

function applyInscriptionReview(result: any, review: any) {
  if (!review?.mark_visible || !Array.isArray(result?.objects)) return result;
  const valid = new Set((review.evidence_image_indices || []).filter((x: any) => Number.isInteger(x)));
  const description = review.candidate_transcription
    ? `Second-pass candidate inscription: "${review.candidate_transcription}" (${review.transcription_confidence}% transcription confidence; NOT independently verified).`
    : "Second-pass examination detected a mark but could not transcribe it reliably.";
  for (const object of result.objects) {
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

// Owner-confirmed material mistakes are reusable cautionary benchmarks, not
// independent maker identifications or permission to override new photos.
async function loadOwnerMaterialLessons(url:string,key:string,token:string){
 const qp=new URLSearchParams({select:'feedback_type,corrected_material,owner_statement,created_at',
  feedback_type:'eq.MATERIAL_CORRECTION',order:'created_at.desc',limit:'20'});
 const response=await fetch(url+'/rest/v1/ai_verdict_feedback?'+qp.toString(),{
  headers:{apikey:key,Authorization:'Bearer '+token}
 });
 if(!response.ok)throw Error('OWNER_CORRECTIONS_'+response.status);
 const rows=await response.json();
 if(!Array.isArray(rows))throw Error('OWNER_CORRECTIONS_INVALID');
 return rows.map((r:any)=>({
  kind:'USER_OBSERVED_ERROR_PATTERN_NOT_AUTHENTICATION',
  corrected_material:String(r.corrected_material||'').slice(0,100),
  observation:String(r.owner_statement||'').slice(0,320)
 }));
}

// Read-only, owner-scoped Knowledge Brain retrieval. Never promote an AI similarity match
// to verified attribution without corroborating its original source.
async function lookupKnowledge(supabaseUrl: string, supabaseKey: string, userToken: string, result: any) {
  const objects = Array.isArray(result?.objects) ? result.objects : [];
  const terms = [...new Set<string>(objects.flatMap((o: any) =>
    [o.object_type, o.maker, o.current_attribution, o.marks_signatures_labels]
      .filter((v: any) => typeof v === "string")
      .flatMap((v: string) => v.toLowerCase().match(/[a-zÀ-ÿ]{4,}/g) || [])
  ))].filter(t => !["unknown","possible","glass","clear","white","heavy","bowl","visible","unreadable","marked","signed","colour","maker"].includes(t)).slice(0, 12);
  if (!terms.length) return { status:"NO_DISCRIMINATING_TERMS", matches:[] };
  const query = new URLSearchParams({
    select:"id,knowledge_type,entity_type,entity_key,claim,certainty_class,confidence,evidence_provenance,source_reference,source_url,source_date,last_verified,freshness_requirement,verification_status,stance,tags,supersedes_id",
    limit:"300",
    order:"updated_at.desc"
  });
  const response = await fetch(`${supabaseUrl}/rest/v1/trusted_knowledge_v1?${query}`, {
    headers:{ apikey:supabaseKey, Authorization:`Bearer ${userToken}` }
  });
  if (!response.ok) return {status:"TRUST_GATE_UNAVAILABLE_" + response.status,matches:[]};
  const records = await response.json();
  if (!Array.isArray(records)) return {status:"INVALID_RESPONSE",matches:[]};
  const matches = records.filter((k:any) => {
    const text = [k.entity_key,k.entity_type,k.claim,...(Array.isArray(k.tags)?k.tags:[])].filter(Boolean).join(" ").toLowerCase();
    return terms.some(t=>text.includes(t)) && !records.some((x:any)=>x.supersedes_id===k.id);
  }).slice(0,12).map((k:any)=>({
    ...k, freshness_flag: !k.last_verified ? "UNVERIFIED_DATE" :
      (Date.now()-Date.parse(k.last_verified)>365*86400000 ? "CHECK_FRESHNESS":"RECENTLY_CHECKED")
  }));
  return {status:matches.length?"MATCHES_FOUND":"NO_MATCHES",query_terms:terms,matches};
}

// Conservatively surface relevant existing knowledge without treating keyword overlap as proof.
function reconcileKnowledge(result: any, lookup: any) {
  if (!Array.isArray(result?.objects) || !Array.isArray(lookup?.matches)) return result;
  const trusted = lookup.matches.filter((k:any) =>
    k.verification_status === "VERIFIED_DIRECT" &&
    Boolean(k.source_url || k.source_reference) &&
    k.freshness_flag !== "CHECK_FRESHNESS" &&
    ["FACT","STRONG_ATTRIBUTION"].includes(k.certainty_class)
  );
  for (const object of result.objects) {
    const idText = [object.maker,object.current_attribution,object.marks_signatures_labels].filter(Boolean).join(" ").toLowerCase();
    if (!idText || idText.length < 5) continue;
    for (const record of trusted) {
      const key = String(record.entity_key || "").trim().toLowerCase();
      // Do not use generic descriptions to establish a maker; require named key.
      if (!key || key.length < 5 || !idText.includes(key)) continue;
      object.evidence = Array.isArray(object.evidence) ? object.evidence : [];
      object.evidence.push({
        claim:"Relevant existing Knowledge Brain claim (independent verification still required for this object's attribution): " + record.claim,
        provenance:"INFERENCE",
        certainty_class:"POSSIBLE_ATTRIBUTION",
        stance:"SUPPORTS",
        notes:"Knowledge record " + record.id + "; original source " + (record.source_url || record.source_reference) + "; last verified " + (record.last_verified || "unknown")
      });
      object.sale_readiness = "RESEARCH_FIRST";
    }
  }
  return result;
}

function extractText(payload: any) {
  if (typeof payload.output_text === "string" && payload.output_text) return payload.output_text;
  for (const item of payload.output || []) {
    if (item.type === "message") {
      for (const part of item.content || []) {
        if (part.type === "output_text" && part.text) return part.text;
      }
    }
  }
  return "";
}

// Owner-scoped, versioned canonical policy retrieval before paid inference.
// Fail closed: never silently fall back to an out-of-date prompt.
async function loadCanonicalContext(url: string, key: string, token: string) {
  return loadCanonicalForCaller({url,key,token},'intake',process.env.COLLECTOR_CANONICAL_SOURCE_MODE,
    ()=>loadLegacyCanonicalContext(url,key,token));
}
async function loadLegacyCanonicalContext(url: string, key: string, token: string) {
  const keys = ["02_MASTER_PROJECT_BRIEF.md","03_SOURCE_AND_EVIDENCE_POLICY.md","01_PROJECT_INSTRUCTIONS.md","06_PHOTO_EXAMINATION.md"];
  const qp = new URLSearchParams({select:"document_key,content,content_sha256,authority_rank,ingested_at,source_version",is_current:"eq.true",document_key:"in.("+keys.join(",")+")",order:"ingested_at.desc",limit:"100"});
  const resp = await fetch(`${url}/rest/v1/canonical_documents?${qp}`,{
    headers:{apikey:key,Authorization:`Bearer ${token}`}
  });
  if (!resp.ok) throw new Error("CANONICAL_ACCESS_" + resp.status);
  const rows = await resp.json();
  if (!Array.isArray(rows)) throw new Error("CANONICAL_INVALID");
  const expectedPolicyHashes: Record<string,string> = {
    "02_MASTER_PROJECT_BRIEF.md":"4237146b7142b62f9bc423fcbbb42d3205899eef67ca8135cf7dc066904292a2",
    "03_SOURCE_AND_EVIDENCE_POLICY.md":"1eeab79c9ac903ff7ca69b6dcf15f9c38a9e2a273698e910c7926dd60e74b7e4"
  };
  const selected = keys.map(k => {
    const candidates = rows.filter((x:any)=>x.document_key===k && typeof x.content==="string" && x.content.length>=400 && !x.content.startsWith("No readable content"));
    if (expectedPolicyHashes[k]) {
      return candidates.find((x:any)=>x.source_version==="4.0" && x.content_sha256===expectedPolicyHashes[k]);
    }
    return candidates[0]; // Other current workflow instructions retain existing newest-first selection.
  });
  if (selected.some(x=>!x)) throw new Error("CANONICAL_MISSING");
  return {
    instructions: keys.map((k,i)=>"SOURCE DOCUMENT "+k+" [SHA256 "+selected[i].content_sha256+"]\n"+selected[i].content).join("\n\n"),
    hashes: Object.fromEntries(keys.map((k,i)=>[k,selected[i].content_sha256]))
  };
}

async function verifyUser(token: string, supabaseUrl: string, supabaseKey: string) {
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: supabaseKey }
  });
  return response.ok;
}

async function readStagedRun(url:string,key:string,token:string,runId:string) {
  const query=new URLSearchParams({select:'id,mode,status,input_photo_count,result',id:'eq.'+runId,limit:'1'});
  const response=await fetch(url+'/rest/v1/ai_analysis_runs?'+query.toString(),{
    headers:{apikey:key,Authorization:'Bearer '+token}
  });
  if(!response.ok)throw Error('Cannot read the owner-scoped saved photo session ('+response.status+')');
  const rows=await response.json();
  if(!Array.isArray(rows)||rows.length!==1)throw Error('Saved photo session not found or access denied');
  return rows[0];
}
async function saveStagedAnalysis(url:string,key:string,token:string,runId:string,model:string,result:any) {
  const query=new URLSearchParams({id:'eq.'+runId,status:'eq.DRAFT',select:'id,result'});
  const response=await fetch(url+'/rest/v1/ai_analysis_runs?'+query.toString(),{
    method:'PATCH',
    headers:{apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json',Prefer:'return=representation'},
    body:JSON.stringify({model,result})
  });
  const rows=await response.json();
  if(!response.ok||!Array.isArray(rows)||rows.length!==1)
    throw Error('Completed AI analysis could not be written into the saved report ('+response.status+')');
  return rows[0];
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = String(req.headers.authorization || "");
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
  const runtimeOidcToken = String(req.headers["x-vercel-oidc-token"] || "");
  const gatewayToken = process.env.AI_GATEWAY_API_KEY || runtimeOidcToken || process.env.VERCEL_OIDC_TOKEN || "";
  const directOpenAIKey = process.env.OPENAI_API_KEY || "";
  const useGateway = Boolean(gatewayToken);
  const apiKey = gatewayToken || directOpenAIKey;

  if (!token) return res.status(401).json({ error: "Not signed in" });
  if (!supabaseUrl || !supabaseKey) return res.status(500).json({ error: "Supabase server environment is missing" });
  if (!(await verifyUser(token, supabaseUrl, supabaseKey))) return res.status(401).json({ error: "Invalid session" });
  if (!apiKey) return res.status(503).json({ error: "AI authentication is not available in Vercel" });
  let canonical: CanonicalRuntimeContext;
  try { canonical = await loadCanonicalContext(supabaseUrl,supabaseKey,token); }
  catch (e) { return res.status(503).json({error:"Required Collector Intelligence policy cannot be loaded; AI analysis stopped to prevent policy drift.",code:e instanceof Error?e.message:"CANONICAL_ERROR"}); }

  // Trust gate preflight BEFORE any paid AI request. No unreviewed fallback.
  try {
    const gate = await fetch(`${supabaseUrl}/rest/v1/trusted_knowledge_v1?select=id&limit=1`,{
      headers:{apikey:supabaseKey,Authorization:`Bearer ${token}`}
    });
    if (!gate.ok) return res.status(503).json({error:"Trusted Knowledge Brain unavailable; intake stopped before paid analysis.",code:"TRUSTED_KNOWLEDGE_"+gate.status});
    const rows = await gate.json();
    if (!Array.isArray(rows)) return res.status(503).json({error:"Invalid trusted knowledge response; intake stopped before paid analysis.",code:"TRUSTED_KNOWLEDGE_INVALID"});
  } catch {
    return res.status(503).json({error:"Trusted Knowledge Brain inaccessible; intake stopped before paid analysis.",code:"TRUSTED_KNOWLEDGE_NETWORK"});
  }

  let ownerMaterialLessons:any[];
  try{ownerMaterialLessons=await loadOwnerMaterialLessons(supabaseUrl,supabaseKey,token);}
  catch(e:any){return res.status(503).json({error:'Owner correction retrieval unavailable. Stopped before paid AI to prevent repeating known material errors.',code:e?.message||'OWNER_CORRECTIONS_UNAVAILABLE'});}
  const { mode = "single", images = [], context = {}, run_id } = req.body || {};
  if (!Array.isArray(images) || images.length < 1) return res.status(400).json({ error: "At least one image is required" });
  if (images.length > 40) return res.status(400).json({ error: "Maximum 40 images per intake run" });
  if(typeof run_id!=='string'||!(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i).test(run_id))
    return res.status(400).json({error:'Save the source photograph session before starting paid AI analysis.'});
  let staged:any;
  try {
    staged=await readStagedRun(supabaseUrl,supabaseKey,token,run_id);
    const manifest=staged.result?.image_manifest;
    if(staged.status!=='DRAFT'||staged.mode!==mode||staged.input_photo_count!==images.length||
       !Array.isArray(manifest)||manifest.length!==images.length||
       !images.every((img:any)=>manifest.some((m:any)=>m.index===img.index&&m.file_name===img.fileName&&
           typeof m.storage_path==='string')))
      return res.status(409).json({error:'Source photo manifest does not match the owner-saved draft; no paid AI request made.'});
    if(Array.isArray(staged.result?.objects)&&staged.result.objects.length)
      return res.status(409).json({error:'This analysis is already saved. Open the original saved report; do not pay again.'});
  }catch(e:any){
    return res.status(503).json({error:e?.message||'Cannot verify saved intake manifest before AI request.'});
  }

  const contextText = [
    `Intake mode: ${mode}. ${mode === "single" ? "Treat these as one object unless the photographs clearly prove otherwise." : "This may contain up to five physical objects; separate them by visual evidence."}`,
    context.purchase_price ? `User-supplied purchase price: ${context.purchase_price} ${context.currency || "GBP"}.` : "",
    context.weight_g ? `User-supplied weight: ${context.weight_g} g.` : "",
    context.dimensions ? `User-supplied dimensions: ${context.dimensions}.` : "",
    context.storage_location ? `Storage location: ${context.storage_location}.` : "",
    context.user_notes ? `User notes/hypotheses (not facts unless independently visible): ${context.user_notes}` : "",
    "Image indices and filenames follow. Use the indices in image_indices."
  ].filter(Boolean).join("\n");

  const content: any[] = [{ type: "input_text", text: contextText }];
  for (const image of images) {
    content.push({ type: "input_text", text: `IMAGE_INDEX=${image.index}; FILE=${image.fileName || "unnamed"}` });
    content.push({ type: "input_image", image_url: image.url, detail: "original" });
  }

  const configuredModel = process.env.OPENAI_INTAKE_MODEL || "gpt-5.6-luna";
  const model = useGateway
    ? (configuredModel.includes("/") ? configuredModel : `openai/${configuredModel}`)
    : configuredModel.replace(/^openai\//, "");

  // A publication change during photo/knowledge preflight must stop this dispatch.
  try { canonical=await revalidateCanonicalBeforePaidCall({url:supabaseUrl,key:supabaseKey,token},'intake',canonical); }
  catch(e){return res.status(503).json({error:'Approved source set changed or became unavailable before AI dispatch. No AI request made.',code:e instanceof Error?e.message:'CANONICAL_RECHECK_FAILED'});}

  const body = {
    model,
    reasoning: { effort: "medium" },
    instructions: systemPrompt + "\n\nMANDATORY CURRENT PROJECT SPECIFICATIONS (Master Brief governs):\n" + canonical.instructions
       + "\n\nOWNER MATERIAL-CLASSIFICATION ERROR LESSONS — CAUTION ONLY, DO NOT TRANSFER ATTRIBUTIONS TO THIS OBJECT:\n"
       + JSON.stringify(ownerMaterialLessons),
    input: [{ role: "user", content }],
    text: {
      format: {
        type: "json_schema",
        name: "collector_intelligence_intake",
        strict: true,
        schema
      }
    },
    max_output_tokens: 12000
  };

  const response = await fetch(
    useGateway ? "https://ai-gateway.vercel.sh/v1/responses" : "https://api.openai.com/v1/responses",
    {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
      body: JSON.stringify(body)
    }
  );

  const payload = await response.json();
  if (!response.ok) {
    return res.status(response.status).json({ error: payload?.error?.message || "AI analysis failed", details: payload?.error || null });
  }

  const text = extractText(payload);
  if (!text) return res.status(502).json({ error: "Analysis returned no structured output" });

  try {
    let result = JSON.parse(text);
    // Immutable JSON snapshot of the initial AI interpretation before any further review.
    const initialAiResult = JSON.parse(JSON.stringify(result));
    // Save the first paid model answer BEFORE enrichment, second-pass AI or client response.
    // If any later step fails, the user still has the original provisional report.
    const originalManifest=staged.result.image_manifest;
    const validPhotoIndices=new Set(originalManifest.map((p:any)=>p.index));
    const invalidPhotoReferences=(result.objects||[]).flatMap((o:any,objectIndex:number)=>
      (Array.isArray(o.image_indices)?o.image_indices:[])
       .filter((i:any)=>!Number.isInteger(i)||!validPhotoIndices.has(i))
       .map((i:any)=>({object_index:objectIndex,model_photo_index:i}))
    );
    const photoIndexAudit={
      status:invalidPhotoReferences.length?'OWNER_REVIEW_REQUIRED':'VALID_REFERENCES',
      uploaded_photo_count:originalManifest.length,
      invalid_photo_references:invalidPhotoReferences
    };
    // Keep raw first-pass source untouched; add an explicit audit rather than
    // silently inventing a mapping or shifting photo numbers.
    result={...result,photo_index_audit:photoIndexAudit};
    try {
      await saveStagedAnalysis(supabaseUrl,supabaseKey,token,run_id,payload.model||body.model,{
        ...staged.result,...result,image_manifest:originalManifest,
        initial_ai_result:initialAiResult,initial_response_id:payload.id||null,
        image_manifest_version:1,analysis_stage:'FIRST_PASS_SAVED',
        canonical_policy_hashes:canonical.hashes,
        canonical_source_audit:canonicalSourceAudit(canonical),
        knowledge_lookup:{status:'PENDING',matches:[]},
        material_correction_lessons_consulted:ownerMaterialLessons.length
      });
    }catch(e:any){
      return res.status(503).json({error:e?.message||'Paid analysis was returned but could not be persisted.',code:'FIRST_PASS_SAVE_FAILED',run_id});
    }
    let knowledge_lookup: any = {status:'NOT_ATTEMPTED',matches:[]};
    try { knowledge_lookup = await lookupKnowledge(supabaseUrl,supabaseKey,token,result); }
    catch { return res.status(503).json({error:'Trusted knowledge retrieval failed after model analysis; result not approved.',code:'LOOKUP_ERROR'}); }
    if (String(knowledge_lookup.status).startsWith('TRUST_GATE_UNAVAILABLE_') || knowledge_lookup.status === 'INVALID_RESPONSE') {
      return res.status(503).json({error:'Trusted knowledge retrieval failed after model analysis; result not approved.',code:knowledge_lookup.status});
    }
    let inscription_review = null;
    let inscription_review_status = 'NOT_TRIGGERED';
    if (markNeedsReview(result, context)) {
      inscription_review_status = 'ATTEMPTED';
      // Only examine already uploaded images. Prefer recent close-ups while retaining overall views.
      const selected = images.length <= 12 ? images : [images[0], images[1], ...images.slice(-10)];
      const detailContent: any[] = [{
        type: "input_text",
        text: "Independently re-examine the ORIGINAL photographs for inscriptions and distinctive form. Images in this request are indexed using their original indices. The first-pass draft below is unverified and may have missed a legible inscription: " + JSON.stringify(result.objects.map((o: any) => ({image_indices:o.image_indices,marks:o.marks_signatures_labels,object_type:o.object_type,current_attribution:o.current_attribution}))) + ". Transcribe only letters/numbers actually visible, expressing uncertain characters with ?. Do not use internet research, assert an exact pattern without evidence, or pretend a maker attribution is confirmed. Indices must correspond to the source image containing the mark. If not readable leave null. Return a candidate maker/design only where form and mark jointly support it. New photographs are needed only if the supplied images do not already resolve the relevant detail."
      }];
      for (const image of selected) {
        detailContent.push({type:"input_text",text:`IMAGE_INDEX=${image.index}; FILE=${image.fileName || "unnamed"}`});
        detailContent.push({type:"input_image",image_url:image.url,detail:"original"});
      }
      try {
        // The first answer is already saved. A revoked/changed source blocks
        // this additional paid pass while preserving that original answer.
        canonical=await revalidateCanonicalBeforePaidCall({url:supabaseUrl,key:supabaseKey,token},'intake',canonical);
        const markResponse = await fetch(
          useGateway ? "https://ai-gateway.vercel.sh/v1/responses" : "https://api.openai.com/v1/responses",
          {
            method:"POST",
            headers:{"Content-Type":"application/json", Authorization:`Bearer ${apiKey}`},
            body:JSON.stringify({
              model,
              reasoning:{effort:"high"},
              instructions:"You are a cautious specialist examining faint lettering on glass. Compare each proposed character against repeated strokes in the ORIGINAL source images. Separate engraved characters from crossing scratches, label residue, optical refraction and shadows. Compare base geometry and rim silhouette; do not infer opaque white glass from bright reflections. Where uncertain, provide a literal partial reading with ? marks, alternatives and contradictions. If illegible, return null rather than guess. Never turn a candidate transcription into a verified maker or provenance. Always refer to original image indices.",
              input:[{role:"user",content:detailContent}],
              text:{format:{type:"json_schema",name:"collector_inscription_review",strict:true,schema:inscriptionSchema}},
              max_output_tokens:1700
            })
          }
        );
        if (markResponse.ok) {
          const markPayload = await markResponse.json();
          const markText = extractText(markPayload);
          if (markText) {
            inscription_review = JSON.parse(markText);
            inscription_review_status = inscription_review.mark_visible ? 'COMPLETED_MARK_VISIBLE' : 'COMPLETED_NO_MARK';
            // Exclude invented indices before attaching review to physical-object evidence.
            const uploadedIndices = new Set(images.map((image: any) => image.index));
            inscription_review.evidence_image_indices = (inscription_review.evidence_image_indices || []).filter((i: number) => uploadedIndices.has(i));
            result = applyInscriptionReview(result, inscription_review);
          } else {
            inscription_review_status = 'EMPTY_RESPONSE';
          }
        } else {
          inscription_review_status = 'GATEWAY_ERROR_' + markResponse.status;
          // A failed second look must not discard the already completed draft.
          console.warn("Inscription review unavailable", markResponse.status);
        }
      } catch (err) {
        inscription_review_status = err instanceof CanonicalSourceError?'SOURCE_GATE_'+err.code:'REVIEW_ERROR';
        console.warn("Inscription review unavailable", err instanceof Error ? err.message : "unknown error");
      }
    }
    result = reconcileKnowledge(result, knowledge_lookup);
    const savedResult={
      ...staged.result,...result,image_manifest:originalManifest,
      initial_ai_result:initialAiResult,initial_response_id:payload.id||null,
      image_manifest_version:1,analysis_stage:'COMPLETE',
      inscription_review,inscription_review_status,knowledge_lookup,
      canonical_policy_hashes:canonical.hashes,
      canonical_source_audit:canonicalSourceAudit(canonical)
    };
    try{
      await saveStagedAnalysis(supabaseUrl,supabaseKey,token,run_id,payload.model||body.model,savedResult);
    }catch(e:any){
      return res.status(503).json({error:'First AI report saved, but final enrichment could not be saved. Open your original saved report.',code:'FINAL_SAVE_FAILED',run_id});
    }
    return res.status(200).json({
      saved_run_id:run_id,
      model: payload.model || body.model,
      response_id: payload.id || null,
      result,
      inscription_review,
      inscription_review_status,
      knowledge_lookup,
      canonical_policy_hashes:canonical.hashes,
      canonical_source_audit:canonicalSourceAudit(canonical)
    });
  } catch {
    return res.status(502).json({ error: "Could not parse structured analysis", raw: text.slice(0, 2000) });
  }
}
