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
- If maker/date is not supported, return null or cautious wording.
- Identification confidence, dating confidence and valuation confidence are independent.
- Inspect silhouette/proportions, colour/clarity, base, pontil, polished/ground areas, mould seams, bubbles/striae/inclusions, tooling, cut decoration, rim, handle joins/applied decoration, wear, labels, marks/signatures and visible chips/cracks/bruises/repairs.
- For mixed batches, assign each image index to the object it depicts. Do not transfer evidence between objects.
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

// Read-only, owner-scoped Knowledge Brain retrieval. Never promote an AI similarity match
// to verified attribution without corroborating its original source.
async function lookupKnowledge(supabaseUrl: string, supabaseKey: string, userToken: string, result: any) {
  const objects = Array.isArray(result?.objects) ? result.objects : [];
  const terms = [...new Set(objects.flatMap((o: any) =>
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
  const response = await fetch(`${supabaseUrl}/rest/v1/knowledge_records?${query}`, {
    headers:{ apikey:supabaseKey, Authorization:`Bearer ${userToken}` }
  });
  if (!response.ok) return {status:"QUERY_ERROR_" + response.status,matches:[]};
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
  const keys = ["02_MASTER_PROJECT_BRIEF.md","03_SOURCE_AND_EVIDENCE_POLICY.md","01_PROJECT_INSTRUCTIONS.md","06_PHOTO_EXAMINATION.md"];
  const qp = new URLSearchParams({select:"document_key,content,content_sha256,authority_rank",is_current:"eq.true",limit:"40"});
  const resp = await fetch(`${url}/rest/v1/canonical_documents?${qp}`,{
    headers:{apikey:key,Authorization:`Bearer ${token}`}
  });
  if (!resp.ok) throw new Error("CANONICAL_ACCESS_" + resp.status);
  const rows = await resp.json();
  if (!Array.isArray(rows)) throw new Error("CANONICAL_INVALID");
  const selected = keys.map(k=>rows.find((x:any)=>x.document_key===k));
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
  let canonical: {instructions:string,hashes:Record<string,string>};
  try { canonical = await loadCanonicalContext(supabaseUrl,supabaseKey,token); }
  catch (e) { return res.status(503).json({error:"Required Collector Intelligence policy cannot be loaded; AI analysis stopped to prevent policy drift.",code:e instanceof Error?e.message:"CANONICAL_ERROR"}); }

  const { mode = "single", images = [], context = {} } = req.body || {};
  if (!Array.isArray(images) || images.length < 1) return res.status(400).json({ error: "At least one image is required" });
  if (images.length > 40) return res.status(400).json({ error: "Maximum 40 images per intake run" });

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

  const body = {
    model,
    reasoning: { effort: "medium" },
    instructions: systemPrompt + "\n\nMANDATORY CURRENT PROJECT SPECIFICATIONS (Master Brief governs):\n" + canonical.instructions,
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
    let knowledge_lookup: any = {status:'NOT_ATTEMPTED',matches:[]};
    try { knowledge_lookup = await lookupKnowledge(supabaseUrl,supabaseKey,token,result); }
    catch { knowledge_lookup = {status:'LOOKUP_ERROR',matches:[]}; }
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
        inscription_review_status = 'REVIEW_ERROR';
        console.warn("Inscription review unavailable", err instanceof Error ? err.message : "unknown error");
      }
    }
    result = reconcileKnowledge(result, knowledge_lookup);
    return res.status(200).json({
      model: payload.model || body.model,
      response_id: payload.id || null,
      result,
      inscription_review,
      inscription_review_status,
      knowledge_lookup,
      canonical_policy_hashes:canonical.hashes
    });
  } catch {
    return res.status(502).json({ error: "Could not parse structured analysis", raw: text.slice(0, 2000) });
  }
}
