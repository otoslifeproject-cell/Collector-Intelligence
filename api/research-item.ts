const researchSchema = {
  type: "object",
  additionalProperties: false,
  required: ["identification_update","comparables","valuation","routing","research_summary","next_evidence"],
  properties: {
    identification_update: {
      type: "object",
      additionalProperties: false,
      required: ["maker","attribution","period_wording","region_country","identification_confidence","dating_confidence","rationale","contradictions"],
      properties: {
        maker: { type: ["string","null"] },
        attribution: { type: ["string","null"] },
        period_wording: { type: ["string","null"] },
        region_country: { type: ["string","null"] },
        identification_confidence: { type: "integer", minimum: 0, maximum: 100 },
        dating_confidence: { type: "integer", minimum: 0, maximum: 100 },
        rationale: { type: "string" },
        contradictions: { type: "array", items: { type: "string" } }
      }
    },
    comparables: {
      type: "array",
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["venue","source_reference","source_url","sale_date","price_type","price","currency","description","maker_attribution","dimensions","condition_summary","comparability_grade","verification_status","notes"],
        properties: {
          venue: { type: "string" },
          source_reference: { type: "string" },
          source_url: { type: ["string","null"] },
          sale_date: { type: ["string","null"] },
          price_type: { type: "string", enum: [
            "HAMMER_REALIZED","REALIZED_INCL_BP","MARKETPLACE_SOLD","DEALER_SOLD_CONFIRMED",
            "DEALER_ARCHIVED_LAST_ASK_ACHIEVED_UNKNOWN","AUCTION_ESTIMATE","DEALER_ASKING",
            "MARKETPLACE_ASKING","INDEXED_SOLD_NOT_DIRECTLY_VERIFIED","UNVERIFIED"
          ]},
          price: { type: ["number","null"] },
          currency: { type: ["string","null"] },
          description: { type: "string" },
          maker_attribution: { type: ["string","null"] },
          dimensions: { type: ["string","null"] },
          condition_summary: { type: ["string","null"] },
          comparability_grade: { type: "string", enum: ["HIGH","MEDIUM","LOW"] },
          verification_status: { type: "string", enum: ["VERIFIED_DIRECT","INDEXED_SOLD","SECONDARY_REPORT","UNVERIFIED"] },
          notes: { type: "string" }
        }
      }
    },
    valuation: {
      type: "object",
      additionalProperties: false,
      required: ["currency","quick_sale_value","balanced_low","balanced_high","auction_low","auction_high","private_low","private_high","dealer_asking_low","dealer_asking_high","valuation_confidence","liquidity","notes"],
      properties: {
        currency: { type: "string" },
        quick_sale_value: { type: ["number","null"] },
        balanced_low: { type: ["number","null"] },
        balanced_high: { type: ["number","null"] },
        auction_low: { type: ["number","null"] },
        auction_high: { type: ["number","null"] },
        private_low: { type: ["number","null"] },
        private_high: { type: ["number","null"] },
        dealer_asking_low: { type: ["number","null"] },
        dealer_asking_high: { type: ["number","null"] },
        valuation_confidence: { type: "integer", minimum: 0, maximum: 100 },
        liquidity: { type: "string", enum: ["FAST","NORMAL","SLOW","VERY_THIN"] },
        notes: { type: "string" }
      }
    },
    routing: {
      type: "object",
      additionalProperties: false,
      required: ["sale_readiness","strategy","best_venue","backup_venue","reasons","specialist_review"],
      properties: {
        sale_readiness: { type: "string", enum: ["SELL_NOW","ONE_QUICK_CHECK_THEN_SELL","RESEARCH_FIRST","SPECIALIST_REVIEW"] },
        strategy: { type: "string", enum: ["FAST_CASH","BALANCED","MAX_VALUE"] },
        best_venue: { type: ["string","null"] },
        backup_venue: { type: ["string","null"] },
        reasons: { type: "array", items: { type: "string" } },
        specialist_review: { type: "boolean" }
      }
    },
    research_summary: { type: "string" },
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
    }
  }
};

const instructions = `You are the external research and valuation engine for Collector Intelligence.

Research the supplied collectible object using live web search. Apply evidence-led dealer/collector standards.

Non-negotiable rules:
- Never invent a maker, pattern, signature, provenance, sale, price, lot number, date or source.
- Prefer verified auction-house REALIZED/SOLD results, recognised auction databases/aggregators, genuine marketplace sold/completed evidence and specialist dealer archives.
- Active dealer/1stDibs/marketplace asks are secondary context only.
- Distinguish HAMMER_REALIZED, REALIZED_INCL_BP, MARKETPLACE_SOLD, DEALER_SOLD_CONFIRMED, DEALER_ARCHIVED_LAST_ASK_ACHIEVED_UNKNOWN, AUCTION_ESTIMATE, DEALER_ASKING, MARKETPLACE_ASKING, INDEXED_SOLD_NOT_DIRECTLY_VERIFIED and UNVERIFIED.
- A search snippet saying "sold" is not automatically a directly verified realized result. Use verification_status honestly.
- Capture a source URL/reference for every comparable whenever available.
- Use multiple comparable records where practical. Do not value from one exceptional outlier.
- Adjust for size, condition, colour, maker certainty, signed/labelled status, rarity, age and market.
- If sold evidence is inadequate, valuation ranges may be null and notes must say PROVISIONAL VALUE — SOLD EVIDENCE INADEQUATE.
- Do not upgrade a visual attribution merely because similar marketplace listings use that maker name.
- Identification confidence, dating confidence and valuation confidence are independent.
- Specialist route is not the same as an actual matched buyer.
- If attribution uncertainty could change value materially, route to RESEARCH_FIRST or SPECIALIST_REVIEW.
- Return no prose outside the required structured output.`;

function extractText(payload: any) {
  if (typeof payload.output_text === "string" && payload.output_text) return payload.output_text;
  for (const item of payload.output || []) {
    if (item.type === "message") for (const part of item.content || []) if (part.type === "output_text" && part.text) return part.text;
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
  const apiKey = process.env.OPENAI_API_KEY || "";
  if (!token) return res.status(401).json({ error: "Not signed in" });
  if (!(await verifyUser(token, supabaseUrl, supabaseKey))) return res.status(401).json({ error: "Invalid session" });
  if (!apiKey) return res.status(503).json({ error: "OPENAI_API_KEY is not configured in Vercel" });

  const { item, images = [] } = req.body || {};
  if (!item?.id) return res.status(400).json({ error: "Item record required" });

  const content: any[] = [{
    type: "input_text",
    text: `Research this permanent Collector Intelligence record. Current record is working evidence, not guaranteed fact:\n${JSON.stringify(item, null, 2)}\nUse live web search for attribution and market evidence. Preserve uncertainty.`
  }];
  for (const image of images.slice(0, 12)) content.push({ type:"input_image", image_url:image, detail:"original" });

  const body = {
    model: process.env.OPENAI_RESEARCH_MODEL || "gpt-6-luna",
    reasoning: { effort: "high" },
    instructions,
    tools: [{ type: "web_search", search_context_size: "medium" }],
    input: [{ role: "user", content }],
    text: { format: { type:"json_schema", name:"collector_intelligence_research", strict:true, schema:researchSchema } },
    max_output_tokens: 16000
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method:"POST",
    headers:{ "Content-Type":"application/json", Authorization:`Bearer ${apiKey}` },
    body:JSON.stringify(body)
  });
  const payload = await response.json();
  if (!response.ok) return res.status(response.status).json({error:payload?.error?.message || "Research failed",details:payload?.error || null});
  const text = extractText(payload);
  try {
    return res.status(200).json({model:payload.model || body.model,response_id:payload.id || null,result:JSON.parse(text)});
  } catch {
    return res.status(502).json({error:"Could not parse structured research output",raw:text.slice(0,2000)});
  }
}
