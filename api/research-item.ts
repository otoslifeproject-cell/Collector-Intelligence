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

async function loadPricingCanon(url: string, key: string, token: string) {
 const names = ["02_MASTER_PROJECT_BRIEF.md","03_SOURCE_AND_EVIDENCE_POLICY.md","03_COMPARABLE_RESEARCH.md"];
 const qp = new URLSearchParams({select:"document_key,content,content_sha256,ingested_at",is_current:"eq.true",order:"ingested_at.desc",limit:"100"});
 const response=await fetch(`${url}/rest/v1/canonical_documents?${qp}`,{headers:{apikey:key,Authorization:`Bearer ${token}`}});
 if (!response.ok) throw new Error("CANONICAL_ACCESS_"+response.status);
 const rows=await response.json();
 if (!Array.isArray(rows)) throw new Error("CANONICAL_INVALID");
 const selected=names.map(name=>rows.find((x:any)=>x.document_key===name));
 if (selected.some(x=>!x)) throw new Error("CANONICAL_MISSING");
 return {instructions:selected.map((x:any,i:number)=>"SOURCE "+names[i]+" [SHA256 "+x.content_sha256+"]\n"+x.content).join("\n\n"),
 hashes:Object.fromEntries(names.map((n,i)=>[n,selected[i].content_sha256]))};
}

// Model-supplied source labels are evidence claims, not third-party verification.
// Demand multiple apparently realised comparables before reporting research-based valuation confidence.
function checkResearchEvidence(result:any) {
 const comps=Array.isArray(result?.comparables)?result.comparables:[];
 const soldClasses=new Set(["HAMMER_REALIZED","REALIZED_INCL_BP","MARKETPLACE_SOLD","DEALER_SOLD_CONFIRMED"]);
 const sold=comps.filter((c:any)=>soldClasses.has(c.price_type) && c.price!==null && c.price>=0 && c.source_url &&
   ["VERIFIED_DIRECT","INDEXED_SOLD"].includes(c.verification_status));
 const audited={sold_candidates:sold.length,all_comparables:comps.length,independent_source_verification:false,
   warning:"The AI has supplied source classifications; direct source verification must be carried out separately."};
 if(sold.length<2){
   result.valuation=result.valuation||{};
   result.valuation.valuation_confidence=Math.min(Number(result.valuation.valuation_confidence)||0,30);
   result.valuation.notes=[result.valuation.notes||"","PROVISIONAL VALUE — SOLD EVIDENCE INADEQUATE: fewer than two cited sold candidates."].join(" ");
   result.routing=result.routing||{};
   result.routing.sale_readiness="RESEARCH_FIRST";
   result.routing.specialist_review=true;
   audited.warning+=" Insufficient cited sold candidates; valuation confidence capped at 30%.";
 }
 return audited;
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
  let canonical:{instructions:string,hashes:Record<string,string>};
  try {canonical=await loadPricingCanon(supabaseUrl,supabaseKey,token);}
  catch(e){return res.status(503).json({error:"Collector Intelligence source policy unavailable; research stopped to prevent drift.",code:e instanceof Error?e.message:"CANONICAL_ERROR"});}


  const { item, images = [] } = req.body || {};
  if (!item?.id) return res.status(400).json({ error: "Item record required" });

  const content: any[] = [{
    type: "input_text",
    text: `Research this permanent Collector Intelligence record. Current record is working evidence, not guaranteed fact:\n${JSON.stringify(item, null, 2)}\nUse live web search for attribution and market evidence. Preserve uncertainty.`
  }];
  for (const image of images.slice(0, 12)) content.push({ type:"input_image", image_url:image, detail:"original" });

  const configuredModel = process.env.OPENAI_RESEARCH_MODEL || "gpt-5.6-luna";
  const model = useGateway
    ? (configuredModel.includes("/") ? configuredModel : `openai/${configuredModel}`)
    : configuredModel.replace(/^openai\//, "");

  const body = {
    model,
    reasoning: { effort: "high" },
    instructions: instructions+"\n\nMANDATORY CURRENT PROJECT SOURCE & VALUATION POLICY:\n"+canonical.instructions,
    tools: [{ type: "web_search", search_context_size: "medium" }],
    input: [{ role: "user", content }],
    text: { format: { type:"json_schema", name:"collector_intelligence_research", strict:true, schema:researchSchema } },
    max_output_tokens: 16000
  };

  const response = await fetch(
    useGateway ? "https://ai-gateway.vercel.sh/v1/responses" : "https://api.openai.com/v1/responses",
    {
    method:"POST",
    headers:{ "Content-Type":"application/json", Authorization:`Bearer ${apiKey}` },
      body:JSON.stringify(body)
    }
  );
  const payload = await response.json();
  if (!response.ok) return res.status(response.status).json({error:payload?.error?.message || "Research failed",details:payload?.error || null});
  const text = extractText(payload);
  try {
    const result=JSON.parse(text);
    const source_audit=checkResearchEvidence(result);
    return res.status(200).json({model:payload.model || body.model,response_id:payload.id || null,result,source_audit,canonical_policy_hashes:canonical.hashes});
  } catch {
    return res.status(502).json({error:"Could not parse structured research output",raw:text.slice(0,2000)});
  }
}
