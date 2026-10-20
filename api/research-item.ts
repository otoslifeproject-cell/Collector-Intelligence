import {loadCanonicalForCaller,revalidateCanonicalBeforePaidCall,canonicalSourceAudit} from '../src/lib/canonicalRuntime.ts';
import type {CanonicalRuntimeContext} from '../src/lib/canonicalRuntime.ts';

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
 return loadCanonicalForCaller({url,key,token},'research',process.env.COLLECTOR_CANONICAL_SOURCE_MODE,
   ()=>loadLegacyPricingCanon(url,key,token));
}
async function loadLegacyPricingCanon(url: string, key: string, token: string) {
 const names = ["02_MASTER_PROJECT_BRIEF.md","03_SOURCE_AND_EVIDENCE_POLICY.md","03_COMPARABLE_RESEARCH.md"];
 const qp = new URLSearchParams({select:"document_key,content,content_sha256,ingested_at,source_version",is_current:"eq.true",document_key:"in.("+names.join(",")+")",order:"ingested_at.desc",limit:"100"});
 const response=await fetch(`${url}/rest/v1/canonical_documents?${qp}`,{headers:{apikey:key,Authorization:`Bearer ${token}`}});
 if (!response.ok) throw new Error("CANONICAL_ACCESS_"+response.status);
 const rows=await response.json();
 if (!Array.isArray(rows)) throw new Error("CANONICAL_INVALID");
 const expectedPolicyHashes: Record<string,string> = {
    "02_MASTER_PROJECT_BRIEF.md":"4237146b7142b62f9bc423fcbbb42d3205899eef67ca8135cf7dc066904292a2",
    "03_SOURCE_AND_EVIDENCE_POLICY.md":"1eeab79c9ac903ff7ca69b6dcf15f9c38a9e2a273698e910c7926dd60e74b7e4"
  };
  const selected = names.map(k => {
    const candidates = rows.filter((x:any)=>x.document_key===k && typeof x.content==="string" && x.content.length>=400 && !x.content.startsWith("No readable content"));
    if (expectedPolicyHashes[k]) {
      return candidates.find((x:any)=>x.source_version==="4.0" && x.content_sha256===expectedPolicyHashes[k]);
    }
    return candidates[0]; // Other current workflow instructions retain existing newest-first selection.
  });
 if (selected.some(x=>!x)) throw new Error("CANONICAL_MISSING");
 return {instructions:selected.map((x:any,i:number)=>"SOURCE "+names[i]+" [SHA256 "+x.content_sha256+"]\n"+x.content).join("\n\n"),
 hashes:Object.fromEntries(names.map((n,i)=>[n,selected[i].content_sha256]))};
}

// Retrieve only source-reviewed records; fail closed if trusted read cannot be completed.
async function loadTrustedResearchContext(url:string,key:string,token:string) {
 const qp=new URLSearchParams({select:"id,entity_key,claim,source_url,source_reference,last_verified,certainty_class",limit:"100"});
 const response=await fetch(`${url}/rest/v1/trusted_knowledge_v1?${qp}`,{headers:{apikey:key,Authorization:`Bearer ${token}`}});
 if(!response.ok) throw new Error("TRUSTED_KNOWLEDGE_ACCESS_"+response.status);
 const rows=await response.json();
 if(!Array.isArray(rows)) throw new Error("TRUSTED_KNOWLEDGE_INVALID");
 return rows.map((r:any)=>({id:r.id,entity_key:r.entity_key,claim:r.claim,source_url:r.source_url,source_reference:r.source_reference,last_verified:r.last_verified,certainty_class:r.certainty_class}));
}

// Model-supplied source labels are evidence claims, not third-party verification.
// Demand multiple apparently realised comparables before reporting research-based valuation confidence.
function checkResearchEvidence(result:any) {
 const comps=Array.isArray(result?.comparables)?result.comparables:[];
 const soldClasses=new Set(["HAMMER_REALIZED","REALIZED_INCL_BP","MARKETPLACE_SOLD","DEALER_SOLD_CONFIRMED"]);
 const sold=comps.filter((c:any)=>soldClasses.has(c.price_type) && c.price!==null && c.price>=0 && c.source_url &&
   ["VERIFIED_DIRECT","INDEXED_SOLD"].includes(c.verification_status));
 // Model labels are downgraded: no external sale page was independently verified here.
 for (const c of comps) {
   if (c.verification_status === "VERIFIED_DIRECT" || c.verification_status === "INDEXED_SOLD") {
     c.notes=[c.notes||"","MODEL-SUPPLIED SOLD STATUS ONLY; original result not independently verified."].join(" ");
     c.verification_status="UNVERIFIED";
   }
 }
 const audited={model_claimed_sold_candidates:sold.length,verified_sold_results:0,all_comparables:comps.length,independent_source_verification:false,
   trusted_database_comparables:0,trusted_comparable_ids:[] as string[],
   warning:"The AI has supplied source classifications; direct source verification must be carried out separately."};
 // Even two AI-labelled sold candidates do not establish externally verified realisations.
 if(true){
   result.valuation=result.valuation||{};
   result.valuation.valuation_confidence=Math.min(Number(result.valuation.valuation_confidence)||0,30);
   result.valuation.notes=[result.valuation.notes||"","PROVISIONAL VALUE — NO INDEPENDENTLY VERIFIED SOLD COMPARABLES: these are model-supplied market leads only."].join(" ");
   result.routing=result.routing||{};
   result.routing.sale_readiness="RESEARCH_FIRST";
   result.routing.specialist_review=true;
   audited.warning+=" Original sold outcomes not independently verified; valuation confidence capped at 30%.";
 }
 return audited;
}

async function verifyUser(token: string, supabaseUrl: string, supabaseKey: string) {
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: supabaseKey }
  });
  return response.ok;
}

async function ownerScopedResearchRun(url:string,key:string,token:string,runId:string){
 const qp=new URLSearchParams({select:'id,status,mode,input_photo_count,result,user_context',id:'eq.'+runId,limit:'1'});
 const response=await fetch(url+'/rest/v1/ai_analysis_runs?'+qp.toString(),{
  headers:{apikey:key,Authorization:'Bearer '+token}
 });
 if(!response.ok)throw Error('Owner research staging access unavailable ('+response.status+')');
 const rows=await response.json();
 if(!Array.isArray(rows)||rows.length!==1)throw Error('Staged research run not available for owner');
 return rows[0];
}
async function claimResearchRun(url:string,key:string,token:string,runId:string){
 const response=await fetch(url+'/rest/v1/rpc/ci_claim_paid_research_v1',{
  method:'POST',headers:{apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify({p_run_id:runId})
 });
 if(!response.ok){
  const error=await response.json().catch(()=>({}));
  throw Error(error.message||'Existing research already processing; no duplicate AI request made.');
 }
 return response.json();
}
async function persistResearchResult(url:string,key:string,token:string,runId:string,model:string,result:any){
 const qp=new URLSearchParams({id:'eq.'+runId,status:'eq.DRAFT',select:'id,result,model'});
 const response=await fetch(url+'/rest/v1/ai_analysis_runs?'+qp.toString(),{
  method:'PATCH',headers:{apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json',Prefer:'return=representation'},
  body:JSON.stringify({model,result})
 });
 const rows=await response.json().catch(()=>[]);
 if(!response.ok||!Array.isArray(rows)||rows.length!==1)throw Error('Paid research result not confirmed in owner private storage');
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
  let canonical:CanonicalRuntimeContext;
  try {canonical=await loadPricingCanon(supabaseUrl,supabaseKey,token);}
  catch(e){return res.status(503).json({error:"Collector Intelligence source policy unavailable; research stopped to prevent drift.",code:e instanceof Error?e.message:"CANONICAL_ERROR"});}
  let trustedKnowledge:any[];
  try { trustedKnowledge=await loadTrustedResearchContext(supabaseUrl,supabaseKey,token); }
  catch(e){return res.status(503).json({error:"Reviewed knowledge gate unavailable; research stopped to prevent untrusted reuse.",code:e instanceof Error?e.message:"TRUST_GATE_ERROR"});}

  const { item, images = [], draft_run_id, draft_index = 0, pair_source_indices = [], research_run_id, depth = 'standard' } = req.body || {};
  if(depth!=='standard' && depth!=='deep_dive')return res.status(400).json({error:'Unsupported research depth; no paid request.'});
  const draftMode=typeof draft_run_id==='string';
  const isUuid=(value:any)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value||''));
  let itemForResearch:any=item;
  let trustedComparableRows:any[]=[];
  let catalogueOrigin:any=null;
  let ownerCorrections:any[]=[];
  let visualReviews:any[]=[];
  if(draftMode){
    if(!isUuid(draft_run_id)||!Number.isInteger(draft_index)||draft_index<0)
      return res.status(400).json({error:'Invalid saved draft reference; no paid research run.'});
    try{
      const query=new URLSearchParams({select:'id,mode,status,input_photo_count,result',id:'eq.'+draft_run_id,limit:'1'});
      const response=await fetch(`${supabaseUrl}/rest/v1/ai_analysis_runs?${query}`,{
        headers:{apikey:supabaseKey,Authorization:`Bearer ${token}`}
      });
      if(!response.ok)return res.status(503).json({error:'Cannot check saved draft ownership; no paid research run.'});
      const rows=await response.json();
      if(!Array.isArray(rows)||rows.length!==1||rows[0].status!=='DRAFT'
         ||rows[0].result?.analysis_stage!=='COMPLETE'||!['single','batch'].includes(rows[0].mode))
        return res.status(403).json({error:'Only an accessible, completed saved draft can be researched.'});
      const o=rows[0].result?.objects?.[draft_index];
      if(!o)return res.status(400).json({error:'Saved draft object index is invalid.'});
      const isPair=Array.isArray(pair_source_indices)&&pair_source_indices.length===2&&
        pair_source_indices[0]===0&&pair_source_indices[1]===1&&
        rows[0].mode==='single'&&rows[0].result.objects.length===2&&draft_index===0;
      if(pair_source_indices?.length&&!isPair)return res.status(400).json({error:'Unsupported pair grouping for paid research.'});
      const companion=isPair?rows[0].result.objects[1]:null;
      itemForResearch={
        source_analysis_run_id:draft_run_id,
        source_object_index:draft_index,
        working_title:isPair?'Matched pair: '+o.working_title:o.working_title,
        material:o.material,colour:o.colour,object_type:o.object_type,
        maker:o.maker,current_attribution:o.current_attribution,period_wording:o.period_wording,
        identification_confidence:o.identification_confidence,
        condition_summary:o.condition_summary,
        marks_signatures_labels:o.marks_signatures_labels,
        original_visual_evidence:o.evidence,
        catalogue_note:o.catalogue_note,
        preliminary_value:o.preliminary_value,
        pair_physical_count:isPair?2:1,
        pair_companion:companion?{
          working_title:companion.working_title,condition_summary:companion.condition_summary,
          image_indices:companion.image_indices,evidence:companion.evidence
        }:null,
        evidence_status:'ORIGINAL AI INTAKE — UNVERIFIED; NOT YET CATALOGUED'
      };
    }catch{
      return res.status(503).json({error:'Cannot load private saved draft for research; no model invoked.'});
    }
  }else{
    if(!isUuid(item?.id))return res.status(400).json({error:'Valid catalogue item record required.'});
    const ownerQuery=new URLSearchParams({select:'id,source_analysis_run_id,source_object_index',id:'eq.'+String(item.id),limit:'1'});
    let authorisedItem:any[];
    try{
      const ownerResponse=await fetch(`${supabaseUrl}/rest/v1/items?${ownerQuery}`,{
        headers:{apikey:supabaseKey,Authorization:`Bearer ${token}`}
      });
      if(!ownerResponse.ok)return res.status(503).json({error:'Cannot check ownership before paid research.'});
      authorisedItem=await ownerResponse.json();
    }catch{return res.status(503).json({error:'Item ownership check unavailable.'});}
    if(!Array.isArray(authorisedItem)||authorisedItem.length!==1)
      return res.status(403).json({error:'Catalogue item not found or not authorised.'});
    catalogueOrigin=authorisedItem[0];
    try{
      const compQuery=new URLSearchParams({select:'id,venue,source_reference,source_url,lot_item_id,sale_date,price_type,price,currency,description,maker_attribution,dimensions,condition_summary,comparability_grade,verification_status',item_id:'eq.'+String(item.id),limit:'50'});
      const compResponse=await fetch(`${supabaseUrl}/rest/v1/trusted_comparables_v1?${compQuery}`,{
        headers:{apikey:supabaseKey,Authorization:`Bearer ${token}`}
      });
      if(!compResponse.ok)return res.status(503).json({error:'Trusted comparable evidence unavailable; no paid research.'});
      trustedComparableRows=await compResponse.json();
      if(!Array.isArray(trustedComparableRows))return res.status(503).json({error:'Trusted comparable evidence invalid.'});
    }catch{return res.status(503).json({error:'Trusted comparable gate unavailable; no model invoked.'});}
  }
  if(draftMode){
    try {
      const qp=new URLSearchParams({select:'id,source_object_index,feedback_type,corrected_material,owner_statement,created_at',
        source_analysis_run_id:'eq.'+draft_run_id,order:'created_at.desc',limit:'100'});
      const response=await fetch(supabaseUrl+'/rest/v1/ai_verdict_feedback?'+qp.toString(),{
        headers:{apikey:supabaseKey,Authorization:'Bearer '+token}
      });
      if(!response.ok)throw Error('Correction records unavailable');
      const all=await response.json();
      if(!Array.isArray(all))throw Error('Invalid correction records');
      ownerCorrections=all.filter((x:any)=>x.source_object_index==null
        || Number(x.source_object_index)===draft_index
        || (Array.isArray(pair_source_indices)&&pair_source_indices.includes(Number(x.source_object_index))));
      const material=ownerCorrections.find((x:any)=>x.feedback_type==='MATERIAL_CORRECTION'&&x.corrected_material)?.corrected_material;
      if(material){
        const modelMaterial=itemForResearch.material;
        itemForResearch={
          ...itemForResearch,material,
          previously_incorrect_model_material:modelMaterial,
          material_evidence:'OWNER OBSERVATION — controlling for this investigation; original AI material claim rejected',
          rejected_prior_market_assumption:'Do not reuse glass-specific comparables or estimate until this corrected material has been researched.'
        };
      }
    }catch{
      return res.status(503).json({error:'Cannot retrieve owner corrections before paid research. Nothing charged.'});
    }
  }
  if(draftMode){
    try{
      const qp=new URLSearchParams({
        select:'id,source_object_index,paired_lot,source_photo_index,reference_system_number,reference_url,reference_title,reference_maker,reference_material,reference_image_url,reference_provider,reference_image_license,review_decision,review_note,created_at',
        source_analysis_run_id:'eq.'+draft_run_id,
        source_object_index:'eq.'+String(draft_index),
        paired_lot:'eq.'+(pair_source_indices.length===2?'true':'false'),
        order:'created_at.desc',limit:'100'
      });
      const response=await fetch(supabaseUrl+'/rest/v1/ai_visual_reference_reviews?'+qp.toString(),{
        headers:{apikey:supabaseKey,Authorization:'Bearer '+token}
      });
      if(!response.ok)throw Error('Owner visual reference evidence cannot be loaded');
      const entries=await response.json();
      if(!Array.isArray(entries))throw Error('Invalid private visual reference evidence');
      const identifiers=new Set<string>();
      visualReviews=entries.filter((x:any)=>{
        if(!/^[1-9][0-9]{0,9}$/.test(String(x.reference_system_number||'')))return false;
        if(identifiers.has(x.reference_system_number))return false;
        identifiers.add(x.reference_system_number);
        return true;
      }).slice(0,20);
    }catch{
      return res.status(503).json({error:'Cannot retrieve owner visual-match reviews before paid research. No AI charged.'});
    }
  }
  if(!Array.isArray(images)||images.length>12||images.some((url:any)=>typeof url!=='string'||!url.startsWith(supabaseUrl+'/storage/v1/')))
    return res.status(400).json({error:'Invalid private image links for research; no paid research.'});
  if(!isUuid(research_run_id))return res.status(400).json({error:'Research must first be saved as an owner-scoped session. No paid AI run was made.'});
  let researchEnvelope:any;
  try{
    researchEnvelope=await ownerScopedResearchRun(supabaseUrl,supabaseKey,token,research_run_id);
  }catch(e:any){return res.status(503).json({error:e?.message||'Private research staging unavailable; no AI charged.'});}
  const ctx=researchEnvelope.user_context||{};
  const correctSource=draftMode?ctx.source_analysis_run_id===draft_run_id&&
     Number(ctx.source_object_index)===draft_index&&
     JSON.stringify(ctx.pair_source_indices||[])===JSON.stringify(pair_source_indices||[])
     :ctx.item_id===item.id;
  if(researchEnvelope.mode!=='research'||researchEnvelope.status!=='DRAFT'||
     researchEnvelope.input_photo_count!==images.length||!correctSource||
     (ctx.research_depth||'standard')!==depth)
    return res.status(409).json({error:'Staged research does not match the source object, pair status or original photo count. No AI charged.'});
  if(researchEnvelope.result?.analysis_stage==='COMPLETE'&&researchEnvelope.result?.research_summary)
    return res.status(200).json({
      saved_run_id:research_run_id,model:researchEnvelope.model||null,
      result:researchEnvelope.result,
      source_audit:researchEnvelope.result.source_audit||null,
      canonical_policy_hashes:researchEnvelope.result.canonical_policy_hashes||null,
      canonical_source_audit:researchEnvelope.result.canonical_source_audit||null,
      reused_saved_result:true
    });
  if(!draftMode){
    try{
      const qp=new URLSearchParams({
        select:'id,item_photo_id,reference_system_number,reference_url,reference_title,reference_maker,reference_material,reference_image_url,reference_provider,reference_image_license,review_decision,review_note,created_at',
        item_id:'eq.'+String(item.id),order:'created_at.desc',limit:'100'
      });
      const response=await fetch(supabaseUrl+'/rest/v1/ai_visual_reference_reviews?'+qp.toString(),{
        headers:{apikey:supabaseKey,Authorization:'Bearer '+token}
      });
      if(!response.ok)throw Error('Item reference reviews cannot be loaded');
      const entries=await response.json();
      if(!Array.isArray(entries))throw Error('Item reference reviews malformed');
      const known=new Set<string>();
      visualReviews=entries.filter((x:any)=>{
        if(!/^[1-9][0-9]{0,9}$/.test(String(x.reference_system_number||'')))return false;
        if(known.has(x.reference_system_number))return false;
        known.add(x.reference_system_number);return true;
      }).slice(0,20);
    }catch{
      return res.status(503).json({error:'Cannot read saved owner visual reviews; paid research was not started.'});
    }
  }
  if(!draftMode&&catalogueOrigin?.source_analysis_run_id&&Number.isInteger(catalogueOrigin.source_object_index)){
    try{
      const originId=String(catalogueOrigin.source_analysis_run_id);
      const originalIndex=Number(catalogueOrigin.source_object_index);
      const parentQuery=new URLSearchParams({select:'id,result',id:'eq.'+originId,limit:'1'});
      const parentResponse=await fetch(supabaseUrl+'/rest/v1/ai_analysis_runs?'+parentQuery.toString(),{
        headers:{apikey:supabaseKey,Authorization:'Bearer '+token}
      });
      if(!parentResponse.ok)throw Error('Original photo report not accessible');
      const parent=await parentResponse.json();
      if(!Array.isArray(parent)||parent.length!==1)throw Error('Original report was not owner accessible');
      const snapshot=parent[0].result?.owner_review?.approved_snapshot?.[String(originalIndex)];
      const parentPaired=Array.isArray(snapshot?.pair_source_indices)&&
        snapshot.pair_source_indices.length===2;
      const refQuery=new URLSearchParams({
        select:'id,source_photo_index,reference_system_number,reference_url,reference_title,reference_maker,reference_material,reference_image_url,reference_provider,reference_image_license,review_decision,review_note,created_at',
        source_analysis_run_id:'eq.'+originId,
        source_object_index:'eq.'+String(originalIndex),
        paired_lot:'eq.'+(parentPaired?'true':'false'),
        order:'created_at.desc',limit:'100'
      });
      const refs=await fetch(supabaseUrl+'/rest/v1/ai_visual_reference_reviews?'+refQuery.toString(),{
        headers:{apikey:supabaseKey,Authorization:'Bearer '+token}
      });
      if(!refs.ok)throw Error('Earlier visual comparison history unavailable');
      const oldVisual=await refs.json();
      if(!Array.isArray(oldVisual))throw Error('Earlier visual comparison history invalid');
      const correctionQuery=new URLSearchParams({
        select:'id,source_object_index,feedback_type,corrected_material,owner_statement,created_at',
        source_analysis_run_id:'eq.'+originId,order:'created_at.desc',limit:'100'
      });
      const corr=await fetch(supabaseUrl+'/rest/v1/ai_verdict_feedback?'+correctionQuery.toString(),{
        headers:{apikey:supabaseKey,Authorization:'Bearer '+token}
      });
      if(!corr.ok)throw Error('Original user corrections unavailable');
      const pastFeedback=await corr.json();
      if(!Array.isArray(pastFeedback))throw Error('Original correction record invalid');
      ownerCorrections=pastFeedback.filter((x:any)=>x.source_object_index==null||
        Number(x.source_object_index)===originalIndex||
        (parentPaired&&[0,1].includes(Number(x.source_object_index))));
      const combined=[...visualReviews,...oldVisual].sort((a:any,b:any)=>
        Date.parse(b.created_at)-Date.parse(a.created_at));
      const seen=new Set<string>();
      visualReviews=combined.filter((x:any)=>{
        if(!/^[1-9][0-9]{0,9}$/.test(String(x.reference_system_number||''))||
          seen.has(x.reference_system_number))return false;
        seen.add(x.reference_system_number);return true;
      }).slice(0,20);
      itemForResearch={
        ...itemForResearch,owner_original_photo_run:originId,
        original_pair_lot:parentPaired,
        original_owner_material_corrections:ownerCorrections.map((x:any)=>({
          feedback_type:x.feedback_type,corrected_material:x.corrected_material,
          statement:String(x.owner_statement||'').slice(0,600)
        }))
      };
    }catch{
      return res.status(503).json({
        error:'Original source photo and owner correction lineage could not be recovered. Research stopped before a paid model call.'
      });
    }
  }
  const ownerVisualGuidance=visualReviews.map((x:any)=>({
    original_photo_index:x.source_photo_index??null,item_photo_id:x.item_photo_id??null,
    museum:'The Metropolitan Museum of Art',museum_system_number:x.reference_system_number,
    source_record:x.reference_url,catalogued_reference_title:String(x.reference_title||'').slice(0,250),
    reference_maker:String(x.reference_maker||'').slice(0,160),
    reference_material:String(x.reference_material||'').slice(0,120),
    decision:x.review_decision,owner_observation:String(x.review_note||'').slice(0,600)
  }));
  const deepInstructions=depth==='deep_dive'
   ? `DEEP DIVE INVESTIGATION (not a repeat generic description):
1. FIRST challenge the earlier material and object-type classification. Treat the owner's physical material correction as decisive observational evidence; earlier AI-generated glass claims and glass auction leads are rejected for this hypothesis.
2. Independently inspect the supplied original image details—silhouette, decorative technique, rim/base construction, enamel versus paint, tooling, joins and finishes—and compare visible motifs against genuinely relevant PUBLIC REFERENCE IMAGES, illustrated catalogues, museum collections and auction photographs surfaced through live web search. Search using shape + motif + corrected material, not the old AI maker guess. Do not imply a live Google Lens reverse-image search was performed.
3. Find several specific visually plausible alternatives. In identification_update.rationale say what supports and weakens EACH candidate, how close the reference really looks, and any unresolved manufacture/period possibilities. A resemblance alone does not authenticate the item.
4. Verify every price lead class (HAMMER / buyer-premium-inclusive REALISED / dealer ASKING / marketplace ASKING). Use precise source URLs and dates; distinguish a pair lot from one physical piece, and exclude glass-only lots from metal-object valuation.
5. Produce a short actionable research_summary that answers likely type, current best attribution with honest confidence, strongest reference images/sources, realistic provisional WHOLE-LOT value, and best next physical discriminator. Provide competing hypotheses as explicit contradictions when unresolved.
6. Reuse ONLY independently approved knowledge and source-backed owner corrections; don't fabricate reviewed Knowledge Brain records.
7. Distinguish the user's original images from separately provided CC0 open-access museum reference images. Owner-marked NOT_A_MATCH is a documented negative comparator and must not be presented as a confirming maker/design match. POSSIBLE_LOOKALIKE is not authentication, even when a museum's own object is securely catalogued.`
   : '';
  const content: any[] = [{
    type: "input_text",
    text: `Research this ${draftMode?'saved provisional AI draft':'permanent catalogue record'} with live web search. Observations are not proven identifications:\n${JSON.stringify(itemForResearch, null, 2)}\nOwner correction chronology (separate from original AI): ${JSON.stringify(ownerCorrections)}. These direct material corrections OVERRIDE incompatible AI and marketplace hypotheses.\nOwner visual reference decisions (museum catalogued specimens are NOT authenticators for this object): ${JSON.stringify(ownerVisualGuidance)}. Reject explicitly rejected visual analogues; compare shape, material, technique and decoration before attribution.\nSearch existing knowledge and external evidence before asking for new photos. Show conservative values and achievable routes, flag uncertain sources and do not invent sold results.\n${itemForResearch?.pair_physical_count===2 ? 'IMPORTANT: This is a TWO-PIECE matched pair sold as ONE lot. The valuation quick_sale_value, balanced_low/high, auction_low/high, private_low/high and routing MUST all describe the WHOLE PAIR together, never one individual vase. Prefix valuation.notes with WHOLE PAIR LOT and use pair comparables preferentially; when pair valuation cannot be supported return null instead of extrapolating a single-vase quote.' : 'Price values should refer to the described physical item only.'}`
  }];
  for (const image of images.slice(0, 12)) content.push({ type:"input_image", image_url:image, detail:"original" });
  if(depth==='deep_dive'){
    const referenceImages=visualReviews.filter((x:any)=>
      x.reference_provider==='The Metropolitan Museum of Art'&&
      x.reference_image_license==='CC0_MET_OPEN_ACCESS_PUBLIC_DOMAIN'&&
      typeof x.reference_image_url==='string'&&
      /^https:\/\/images\.metmuseum\.org\/[A-Za-z0-9_./%()!~-]+\.(jpg|jpeg|png)(\?[A-Za-z0-9=&_-]+)?$/i.test(x.reference_image_url)
    ).slice(0,3);
    for (const ref of referenceImages){
      content.push({type:'input_text',text:
        'SEPARATE CC0 PUBLIC-DOMAIN MET MUSEUM REFERENCE, NOT A PHOTO OF THE OWNED OBJECT: Met object '+ref.reference_system_number+
        '. Owner review: '+ref.review_decision+'. '+String(ref.review_note||'').slice(0,320)+
        '. Do NOT transfer this museum record\'s maker/age to the user object without decisive matching evidence.'});
      content.push({type:'input_image',image_url:ref.reference_image_url,detail:'low'});
    }
  }

  const configuredModel = process.env.OPENAI_RESEARCH_MODEL || "gpt-5.6-luna";
  const model = useGateway
    ? (configuredModel.includes("/") ? configuredModel : `openai/${configuredModel}`)
    : configuredModel.replace(/^openai\//, "");

  // Finish all fallible preflight reads before claiming a paid run. In approved
  // mode, a revocation/republication stops dispatch and leaves the run STAGED.
  try{canonical=await revalidateCanonicalBeforePaidCall({url:supabaseUrl,key:supabaseKey,token},'research',canonical);}
  catch(e){return res.status(503).json({error:'Approved source set changed or became unavailable before research dispatch. No AI request made.',code:e instanceof Error?e.message:'CANONICAL_RECHECK_FAILED'});}
  try{
    const claim=await claimResearchRun(supabaseUrl,supabaseKey,token,research_run_id);
    if(claim!=='CLAIMED')return res.status(409).json({error:'Research run was not freshly claimed; reload the saved result before another paid request.'});
  }catch(e:any){return res.status(409).json({error:e?.message||'Research already running; not charged again.'});}

  const body = {
    model,
    reasoning: { effort: "high" },
    instructions: instructions+"\\n\\n"+deepInstructions+"\\n\\nMANDATORY CURRENT PROJECT SOURCE & VALUATION POLICY:\n"+canonical.instructions+"\n\nAPPROVED INTERNAL KNOWLEDGE (these are only source-backed context, not authentication of the current item):\n"+JSON.stringify(trustedKnowledge)+"\n\nOWNER-SCOPED APPROVED REALISED COMPARABLES (do not infer maker match or condition match merely because same item ID):\n"+JSON.stringify(trustedComparableRows),
    tools: [{ type: "web_search", search_context_size: depth==='deep_dive'?'high':'medium' }],
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
    source_audit.trusted_database_comparables=trustedComparableRows.length;
    source_audit.trusted_comparable_ids=trustedComparableRows.map((c:any)=>c.id);
    const savedResult={
      ...result,source_audit,canonical_policy_hashes:canonical.hashes,canonical_source_audit:canonicalSourceAudit(canonical),
      research_depth:depth,applied_visual_reference_ids:visualReviews.map((x:any)=>x.id),applied_owner_corrections:ownerCorrections.map((x:any)=>({id:x.id,feedback_type:x.feedback_type,corrected_material:x.corrected_material,owner_statement:x.owner_statement})),
      analysis_stage:'COMPLETE',response_id:payload.id||null
    };
    try{
      await persistResearchResult(supabaseUrl,supabaseKey,token,research_run_id,payload.model||body.model,savedResult);
    }catch(e:any){
      return res.status(503).json({
        code:'PAID_RESEARCH_SAVE_NOT_CONFIRMED',
        error:e?.message||'The paid research result was not confirmed in storage. Do not launch another paid run to recover it.',
        result:savedResult,source_audit
      });
    }
    return res.status(200).json({
      saved_run_id:research_run_id,model:payload.model||body.model,
      response_id:payload.id||null,result:savedResult,source_audit,
      canonical_policy_hashes:canonical.hashes,
      canonical_source_audit:canonicalSourceAudit(canonical)
    });
  } catch {
    return res.status(502).json({error:"Could not parse structured research output",raw:text.slice(0,2000)});
  }
}
