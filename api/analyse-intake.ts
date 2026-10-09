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
- next_evidence should ask only for photos, measurements or tests that would materially change identification, dating, valuation or sale route.
- catalogue_note is clean outward-facing wording but must preserve uncertainty.
- Return no prose outside the structured output.`;

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
    instructions: systemPrompt,
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
    const result = JSON.parse(text);
    return res.status(200).json({
      model: payload.model || body.model,
      response_id: payload.id || null,
      result
    });
  } catch {
    return res.status(502).json({ error: "Could not parse structured analysis", raw: text.slice(0, 2000) });
  }
}
