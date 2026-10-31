import {loadCanonicalForCaller,revalidateCanonicalBeforePaidCall,canonicalSourceAudit} from '../src/lib/canonicalRuntime.ts';
import type {CanonicalRuntimeContext} from '../src/lib/canonicalRuntime.ts';
import {researchExecutionReceipt} from '../src/lib/researchExecution.ts';
import {runGoogleFirstLook,googleLeadsForResearch,googleNotRun,googleChecksThisMonth,GOOGLE_MONTHLY_LIMIT} from '../src/lib/googleFirstLook.ts';
import type {GoogleFirstLook} from '../src/lib/googleFirstLook.ts';

const researchSchema = {
  type: "object",
  additionalProperties: false,
  required: ["identification_update","comparables","valuation","routing","research_summary","next_evidence","triage","listing","questions","specifics","learned_tells"],
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
    // The end article for the owner: marketplace titles and a price.
    listing: {
      type: "object",
      additionalProperties: false,
      required: ["ebay_title","etsy_title","etsy_reason","price","currency","sale_format","auction_start","title_checks","seen_in_photos","description","price_change_reason","ebay_category"],
      properties: {
        ebay_title: { type: "string" },
        etsy_title: { type: ["string","null"] },
        etsy_reason: { type: "string" },
        price: { type: ["number","null"] },
        currency: { type: "string" },
        sale_format: { type: "string", enum: ["AUCTION","FIXED_PRICE"] },
        auction_start: { type: ["number","null"] },
        title_checks: { type: "array", items: { type: "string" } },
        seen_in_photos: { type: "array", items: { type: "string" } },
        price_change_reason: { type: "string" },
        ebay_category: { type: "string" },
        description: { type: "string" }
      }
    },
    // Questions for the owner BEFORE deep research (Dean, 31 Oct): at most 3,
    // each about one photo, answered Yes / No / Not sure, with what each answer
    // means for the price. Only the quick check asks; deep research returns [].
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["question","photo","why","if_yes","if_no","price_if_yes","price_if_no"],
        properties: {
          question: { type: "string" },
          photo: { type: ["integer","null"] },
          why: { type: "string" },
          if_yes: { type: "string" },
          if_no: { type: "string" },
          price_if_yes: { type: ["number","null"] },
          price_if_no: { type: ["number","null"] }
        }
      }
    },
    // STANDARD ELEMENTS (Dean, 31 Oct): the fixed facts research always works out
    // first and prefills, like eBay item specifics; only the gaps become questions.
    specifics: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name","value","status","evidence"],
        properties: {
          name: { type: "string" },
          value: { type: ["string","null"] },
          status: { type: "string", enum: ["CONFIRMED","LIKELY","UNKNOWN"] },
          evidence: { type: "string" }
        }
      }
    },
    // Reusable clues for future items (write-back to the Knowledge Brain on save).
    learned_tells: { type: "array", items: { type: "string" } },
    // Bulk triage: is full paid web research worth it for this item?
    triage: {
      type: "object",
      additionalProperties: false,
      required: ["decision","reason"],
      properties: {
        decision: { type: "string", enum: ["FULL_RESEARCH_WORTH_IT","LOW_VALUE","UNCLEAR"] },
        reason: { type: "string" }
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
- Before any maker-specific or price research, perform a functional-object-type challenge. A green glass vessel with a flared or rolled bulb-supporting collar, narrower neck and rounded water reservoir must prompt the rival "hyacinth forcing vase / bulb vase"; verify with documented period and form references before searching maker comparables. Compare competing functional forms and reject generic "art glass" anchoring where appropriate.
- A GOOGLE FIRST LOOK block (Google Cloud Vision Web Detection run by the app on the main photograph) may be supplied. Start your research from it: check the pages it found and the names it suggests, then look for SOLD evidence. Its leads are not facts, prices or authentication; report where your sources agree or disagree with them.
- Owner-supplied Google Lens or similar visual-search results are EXTERNAL SEARCH LEADS, not verified source facts. Research the named object type and each traceable result against original museum, catalogue, collector specialist or auction sources, and explicitly report agreement/disagreement. Do not claim access to unseen Google Lens results. Do not treat the Lens AI Overview as an authoritative source for maker, Victorian date or sale price.
- Adjust for size, condition, colour, maker certainty, signed/labelled status, rarity, age and market.
- When the object's colour, owner notes or linked photographs suggest uranium/vaseline glass, explicitly investigate that hypothesis and its non-uranium alternatives. Distinguish documented UV fluorescence from a merely presumed reaction; request paired daylight and UV photographs of the same object if absent. Bright green fluorescence is suggestive, not sole chemical authentication. Never suppress uranium glass as a candidate just because maker and period are unknown, and never inflate valuation from an unverified composition claim.
- If sold evidence is inadequate, valuation ranges may be null and notes must say PROVISIONAL VALUE — SOLD EVIDENCE INADEQUATE.
- Do not upgrade an attribution merely because a seller uses a maker name. BUT when a Google Lens match shows the same design (same shape, cut or decoration pattern and colour) and names a specific maker and model or pattern, treat it as the LEADING HYPOTHESIS: search that exact maker and model name, compare its documented features with the photographs point by point, and if they agree, name it in identification_update.attribution as the likely identification (maker + model/pattern) with the matching features in the rationale. Keep authentication (signature, label, physical check) separate and list it in next_evidence. Only call the object unattributed after checking every specific maker/model named in the Lens matches and stating in contradictions why each one fails.
- Identification confidence, dating confidence and valuation confidence are independent.
- Specialist route is not the same as an actual matched buyer.
- If attribution uncertainty could change value materially, route to RESEARCH_FIRST or SPECIALIST_REVIEW.
- MARKS IN THE PHOTOGRAPHS: read every legible backstamp, signature, label, pattern name or number in every photograph and state it as SEEN (with the photo number) in identification_update and in listing.description "Markings:". Use a legible mark in the title. Never add a title_check asking the owner to verify a mark that is legible in a photograph; title_checks are only for things the photographs do not show.
- LISTING (the owner's end article). listing.ebay_title: up to 80 characters, most important words first because phones cut the end; for collectables use this order: maker, item type, pattern or model, colour, size, era, material, condition word (Used, Vintage, Boxed); use the words buyers search with, taken from SOLD listings of similar items; no filler (amazing, L@@K, bargain, stunning, rare unless proven), no ALL CAPS words except maker initials such as VSL, no repeated words, no unsearched abbreviations. The owner wants to list now: when identification_update names a likely maker, model or pattern (for example a well-known design that Google Lens matches show again and again), PUT IT IN THE TITLE; leave it out only when it is a weak guess. listing.seen_in_photos: one short line (under 70 characters) for each mark, signature, label, pattern name or number you READ in the photographs, with the photo number (for example "Mark: Copeland Spode, Spode's Peacock (photo 4)"); these are confirmed facts, not checks. listing.title_checks: at most 3 short lines (under 90 characters) ONLY for something the photographs cannot prove AND whose answer would change the price, the title or the description; write each as "<what to check> → <what it changes>" (for example "Signature on base → if signed VSL, price about £180 not £60"); never add general care checks (inspect in good light, look for chips, measure) unless the answer changes the price or the identification; the owner skips anything else, so leave it out. Also: never repeat anything in seen_in_photos; never ask the owner to confirm that a part, piece, lid, stand or set item shown in the photographs is included; an empty list is correct when the photographs prove the title. listing.etsy_title: up to 140 characters, natural buyer phrase, only when the item is likely at least 20 years old (Etsy vintage rule); otherwise null, with the reason in etsy_reason. listing.price: ALWAYS give a suggested listing price in GBP for this one item (never null): use sold evidence first; if there is none, use the asking prices of the same or closely matching items, set a little below the typical ask so it sells; for low-value items give a realistic quick-sale price. This is a listing suggestion, separate from the verified valuation; sale_format AUCTION for rare or hard-to-value items, FIXED_PRICE for common items with a known price; auction_start: a starting bid in GBP or null. currency: "GBP". listing.description: the ready-to-post item description, plain text, short, in this shape: one opening sentence saying what it is (maker, pattern or model, designer and date when likely; "attributed to" or "in the style of" when only a lead); a line "Key features:" followed by 3 short lines starting with "- " describing what the photographs show (form, decoration, base, rim, colour); "Era: ..."; "Markings: ..." (what is visible, or none visible); "Condition: please see photographs; ask any questions before buying." Never invent measurements, marks, damage or provenance.
- EBAY CATEGORY: listing.ebay_category is the eBay UK (ebay.co.uk) category path that best fits, with the category names exactly as eBay UK shows them, from the top level down (for example "Antiques > Decorative Arts > Glass"); never invent a category number.
- STANDARD ELEMENTS: always fill specifics with exactly these names, in this order: "Type", "Maker or brand", "Designer", "Pattern or model", "Material", "Colour", "Era", "Antique or reproduction", "Country of origin", "Construction", "Marks", "Size", "Condition". status CONFIRMED only when a photograph (give its number), an owner answer or a cited source proves it; LIKELY when evidence points to it; UNKNOWN with value null otherwise. evidence: one short phrase (for example "photo 4: stamped HOLMEGAARD 1959", "owner answer", "Lens matches + catalogue"). Use the words eBay sellers use for these fields.
- ANTIQUE OR REPRODUCTION: decide "Era" and "Antique or reproduction" from HOW IT IS MADE, never from style alone: materials (plastic, nylon, polyester, acrylic, aluminium, chrome plating), fixings (Phillips or machine screws, staples, modern rivets, hot glue), machine stitching, moulded seams, modern marks (Made in China, ®, postcodes, barcodes, P.C. and similar plastic stamps), wear consistent with age. A period style made with modern materials or fixings is a later reproduction. Google Lens and its AI summary show what an object LOOKS LIKE; never take an era, an antique status or a price from Lens or from seller listings. If construction cannot be seen, status UNKNOWN and ask.
- LEARNED TELLS: learned_tells lists up to 3 short, reusable general clues this research established that would help date or identify OTHER items (for example "A plastic runner stamped P.C. means a post-1950 umbrella frame"); only clues supported by evidence; empty when none.
- Return no prose outside the required structured output.`;

function extractText(payload: any) {
  if (typeof payload?.output_text === "string" && payload.output_text) return payload.output_text;
  for (const item of Array.isArray(payload?.output) ? payload.output : []) {
    if (item?.type === "message") for (const part of Array.isArray(item.content) ? item.content : []) if (part?.type === "output_text" && part.text) return part.text;
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
 const qp=new URLSearchParams({select:'id,status,mode,model,input_photo_count,result,user_context',id:'eq.'+runId,limit:'1'});
 const response=await fetch(url+'/rest/v1/ai_analysis_runs?'+qp.toString(),{
  headers:{apikey:key,Authorization:'Bearer '+token}
 });
 if(!response.ok)throw Error('Owner research staging access unavailable ('+response.status+')');
 const rows=await response.json();
 if(!Array.isArray(rows)||rows.length!==1)throw Error('Staged research run not available for owner');
 return rows[0];
}
async function claimResearchRun(url:string,key:string,token:string,runId:string){
 const call=(fn:string)=>fetch(url+'/rest/v1/rpc/'+fn,{
  method:'POST',headers:{apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify({p_run_id:runId})
 });
 let response=await call('ci_claim_scoped_paid_research_v1');
 if(response.status===404){
  // The scoped claim exists only as a proposal (supabase/proposals). Fall back to the
  // applied migration 20261017_paid_research_claim_gate_v1: it still moves this one
  // staged run to PROCESSING atomically, so the same run can never be charged twice.
  const missing=await response.json().catch(()=>({}));
  if(missing?.code==='PGRST202')response=await call('ci_claim_paid_research_v1');
  else throw Error('Research claim unavailable; no AI request made.');
 }
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

// Finish a research run from the provider's completed response. Used by the
// first request and by later "collect" requests (OpenAI background mode), so a
// deep run longer than the 300 s function limit is never lost.
async function finishResearch(res:any,o:{payload:any;url:string;key:string;token:string;runId:string;model:string;ctx:any}){
  const text = extractText(o.payload);
  let result:any;
  try{result=JSON.parse(text);}catch{
    return res.status(502).json({code:'PAID_RESEARCH_OUTPUT_INVALID',research_run_id:o.runId,
      error:'Could not parse structured research output. The saved run remains claimed; do not repeat paid research to recover it.',raw:text.slice(0,2000)});
  }
  if(result?.listing){
    const fit=(s:any,n:number)=>{const v=String(s||'').replace(/\s+/g,' ').trim();if(v.length<=n)return v;const cut=v.slice(0,n);const at=cut.lastIndexOf(' ');return (at>n*0.6?cut.slice(0,at):cut).trim();};
    result.listing.ebay_title=fit(result.listing.ebay_title,80);
    if(result.listing.etsy_title)result.listing.etsy_title=fit(result.listing.etsy_title,140);
  }
  if(o.ctx.research_depth!=='quick')result.questions=[];
  const source_audit=checkResearchEvidence(result);
  source_audit.trusted_database_comparables=o.ctx.trusted_database_comparables||0;
  source_audit.trusted_comparable_ids=o.ctx.trusted_comparable_ids||[];
  const savedResult={
    ...result,source_audit,canonical_policy_hashes:o.ctx.canonical_policy_hashes,canonical_source_audit:o.ctx.canonical_source_audit,
    research_depth:o.ctx.research_depth,google_first_look:o.ctx.google_first_look,applied_visual_reference_ids:o.ctx.applied_visual_reference_ids||[],
    applied_owner_corrections:o.ctx.applied_owner_corrections||[],owner_answers:o.ctx.owner_answers||[],owner_note:o.ctx.owner_note||null,previous_price:o.ctx.previous_price||null,
    analysis_stage:'COMPLETE',response_id:o.payload.id||null,
    research_execution_v1:researchExecutionReceipt(o.payload,o.runId,o.ctx.dispatched_at,new Date().toISOString())
  };
  try{
    await persistResearchResult(o.url,o.key,o.token,o.runId,o.payload.model||o.model,savedResult);
  }catch(e:any){
    return res.status(503).json({code:'PAID_RESEARCH_SAVE_NOT_CONFIRMED',research_run_id:o.runId,
      error:e?.message||'The paid research result was not confirmed in storage. Do not launch another paid run to recover it.',result:savedResult,source_audit});
  }
  return res.status(200).json({saved_run_id:o.runId,model:o.payload.model||o.model,response_id:o.payload.id||null,result:savedResult,source_audit,
    canonical_policy_hashes:o.ctx.canonical_policy_hashes,canonical_source_audit:o.ctx.canonical_source_audit});
}
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function readProviderResponse(apiKey:string,id:string){
  const r=await fetch('https://api.openai.com/v1/responses/'+encodeURIComponent(id),{headers:{Authorization:'Bearer '+apiKey}});
  const j=await r.json().catch(()=>null);
  if(!r.ok||!j)throw Error('Provider status unavailable ('+r.status+')');
  return j;
}
// Wait for a background response while this function still has time.
async function waitForProvider(apiKey:string,id:string,untilMs:number){
  while(Date.now()<untilMs){
    await sleep(5000);
    let j:any;try{j=await readProviderResponse(apiKey,id);}catch{continue;}
    if(j.status&&!['queued','in_progress'].includes(j.status))return j;
  }
  return null;
}
async function markResearchFailed(url:string,key:string,token:string,runId:string,current:any,reason:string){
  try{await persistResearchResult(url,key,token,runId,'FAILED',{...(current||{}),analysis_stage:'FAILED',failure_reason:String(reason).slice(0,300)});}catch{}
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = String(req.headers.authorization || "");
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
  // Owner-funded OpenAI account only: research calls api.openai.com directly.
  const apiKey = process.env.OPENAI_API_KEY || "";
  if (!token) return res.status(401).json({ error: "Not signed in" });
  if (!supabaseUrl || !supabaseKey) return res.status(500).json({ error: "Supabase server environment is missing" });
  if (!(await verifyUser(token, supabaseUrl, supabaseKey))) return res.status(401).json({ error: "Invalid session" });
  if (!apiKey) return res.status(503).json({ error: "AI authentication is not available in Vercel" });
  // COLLECT: read a deep run that is still working at the provider. Free: it
  // only reads the provider's status and saves the finished result.
  if(req.body?.collect===true){
    const runId=String(req.body?.research_run_id||'');
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(runId))return res.status(400).json({error:'Invalid research run.'});
    let env:any;
    try{env=await ownerScopedResearchRun(supabaseUrl,supabaseKey,token,runId);}catch(e:any){return res.status(503).json({error:e?.message||'Research run unavailable.'});}
    if(env.result?.analysis_stage==='COMPLETE')return res.status(200).json({saved_run_id:runId,result:env.result,reused_saved_result:true});
    const rid=env.result?.openai_response_id,ctx=env.result?.pending_context;
    if(typeof rid!=='string'||!ctx)return res.status(409).json({code:'NOT_COLLECTABLE',error:'This research run has no provider job to collect.'});
    let j:any;try{j=await readProviderResponse(apiKey,rid);}catch(e:any){return res.status(503).json({error:e?.message||'Provider status unavailable.'});}
    if(['queued','in_progress'].includes(j.status))return res.status(202).json({code:'RESEARCH_STILL_RUNNING',research_run_id:runId,provider_status:j.status,dispatched_at:ctx.dispatched_at||null});
    if(j.status!=='completed'){
      await markResearchFailed(supabaseUrl,supabaseKey,token,runId,env.result,'Provider ended the research: '+j.status+(j.incomplete_details?.reason?' ('+j.incomplete_details.reason+')':'')+(j.error?.message?' — '+j.error.message:''));
      return res.status(502).json({code:'PAID_RESEARCH_PROVIDER_ERROR',research_run_id:runId,error:'The research provider ended this run ('+j.status+'). It is marked as failed; you can start research again.'});
    }
    return finishResearch(res,{payload:j,url:supabaseUrl,key:supabaseKey,token,runId,model:ctx.model||env.model,ctx});
  }
  let canonical:CanonicalRuntimeContext;
  try {canonical=await loadPricingCanon(supabaseUrl,supabaseKey,token);}
  catch(e){return res.status(503).json({error:"Collector Intelligence source policy unavailable; research stopped to prevent drift.",code:e instanceof Error?e.message:"CANONICAL_ERROR"});}
  let trustedKnowledge:any[];
  // The owner's own confirmed findings and learned tells from earlier items (Knowledge
  // Brain write-back). Strong leads, never authentication; unavailable = research goes on.
  let ownerKnowledge:any[]=[];
  try{
    const qp=new URLSearchParams({select:'knowledge_type,entity_key,claim',knowledge_type:'in.(OWNER_CONFIRMED_FINDING,LEARNED_TELL)',order:'created_at.desc',limit:'150'});
    const r=await fetch(`${supabaseUrl}/rest/v1/knowledge_records?${qp}`,{headers:{apikey:supabaseKey,Authorization:`Bearer ${token}`}});
    const rows=r.ok?await r.json():[];
    if(Array.isArray(rows))ownerKnowledge=rows.map((x:any)=>({type:x.knowledge_type,key:x.entity_key,claim:String(x.claim||'').slice(0,300)}));
  }catch{ownerKnowledge=[];}
  try { trustedKnowledge=await loadTrustedResearchContext(supabaseUrl,supabaseKey,token); }
  catch(e){return res.status(503).json({error:"Reviewed knowledge gate unavailable; research stopped to prevent untrusted reuse.",code:e instanceof Error?e.message:"TRUST_GATE_ERROR"});}

  const { item, images = [], draft_run_id, draft_index = 0, pair_source_indices = [], research_run_id, depth = 'standard', owner_answers = [], previous_price = null, rerun_lens = false } = req.body || {};
  // Owner answers to the quick check's questions (Yes / No / Not sure), and the
  // previous suggested price so a rerun explains any change.
  const answers=(Array.isArray(owner_answers)?owner_answers:[]).slice(0,5)
    .filter((a:any)=>a&&typeof a.question==='string'&&['YES','NO','NOT_SURE'].includes(a.answer))
    .map((a:any)=>({question:String(a.question).slice(0,300),answer:a.answer,...(typeof a.note==='string'&&a.note.trim()?{owner_saw:a.note.trim().slice(0,400)}:{})}));
  const ownerNote=typeof req.body?.owner_note==='string'?req.body.owner_note.trim().slice(0,800):'';
  const prevPrice=previous_price&&Number.isFinite(previous_price.price)&&previous_price.price>=0
    ?{price:Number(previous_price.price),currency:'GBP',basis:String(previous_price.basis||'').slice(0,160)}:null;
  if(depth!=='standard' && depth!=='deep_dive' && depth!=='quick')return res.status(400).json({error:'Unsupported research depth; no paid request.'});
  const draftMode=typeof draft_run_id==='string';
  const isUuid=(value:any)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value||''));
  let itemForResearch:any=item;
  let trustedComparableRows:any[]=[];
  let catalogueOrigin:any=null;
  let intakeLook:any=null;
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
      if(!Array.isArray(rows)||rows.length!==1||!['DRAFT','APPROVED'].includes(rows[0].status)
         ||rows[0].result?.analysis_stage!=='COMPLETE'||!['single','batch'].includes(rows[0].mode))
        return res.status(403).json({error:'Only an accessible, completed saved draft can be researched.'});
      const o=rows[0].result?.objects?.[draft_index];
      intakeLook=rows[0].result?.google_first_look||null;
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
      response_id:researchEnvelope.result.response_id||null,
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
1. FIRST challenge the earlier material and object-type classification. If the owner has recorded a physical material correction, treat it as decisive observational evidence and reject earlier AI claims and auction leads for the old material.
2. Independently inspect the supplied original image details—silhouette, decorative technique, rim/base construction, enamel versus paint, tooling, joins and finishes—and compare visible motifs against genuinely relevant PUBLIC REFERENCE IMAGES, illustrated catalogues, museum collections and auction photographs surfaced through live web search. Search using shape + motif + corrected material, not the old AI maker guess. Do not imply a live Google Lens reverse-image search was performed.
3. Find several specific visually plausible alternatives. In identification_update.rationale say what supports and weakens EACH candidate, how close the reference really looks, and any unresolved manufacture/period possibilities. A resemblance alone does not authenticate the item.
4. Verify every price lead class (HAMMER / buyer-premium-inclusive REALISED / dealer ASKING / marketplace ASKING). Use precise source URLs and dates; distinguish a pair lot from one physical piece, and exclude glass-only lots from metal-object valuation.
5. Produce a short actionable research_summary that answers likely type, current best attribution with honest confidence, strongest reference images/sources, realistic provisional WHOLE-LOT value, and best next physical discriminator. Provide competing hypotheses as explicit contradictions when unresolved.
6. Reuse ONLY independently approved knowledge and source-backed owner corrections; don't fabricate reviewed Knowledge Brain records.
7. Distinguish the user's original images from separately provided CC0 open-access museum reference images. Owner-marked NOT_A_MATCH is a documented negative comparator and must not be presented as a confirming maker/design match. POSSIBLE_LOOKALIKE is not authentication, even when a museum's own object is securely catalogued.`
   : depth==='quick'
   ? `QUICK CHECK (bulk triage; NO web search in this run):
1. Use only the saved photo description, the owner notes, the small photographs and the GOOGLE LENS matches supplied. Do not claim any source you were not given.
2. identification_update: name the likely identity from Lens matches whose pictures and titles agree with the photographs (maker + model/pattern when matches name one; say "lead" in the rationale). Otherwise describe the object type plainly.
3. comparables: list up to 6 Lens matches that show a page price, as MARKETPLACE_ASKING or DEALER_ASKING with verification_status UNVERIFIED. Never mark a quick-check price as sold.
4. valuation: leave ranges null unless the asking prices clearly cluster; notes must say QUICK CHECK — ASKING PRICES ONLY, NO SOLD EVIDENCE.
5. triage.decision: FULL_RESEARCH_WORTH_IT when the matches name a specific maker, designer, model or pattern consistent with the photographs, or page prices for close matches are about £40 or more; LOW_VALUE when the matches are generic, mass-produced or priced under about £15; otherwise UNCLEAR. triage.reason: one plain sentence for the owner.
6. routing.sale_readiness: RESEARCH_FIRST unless LOW_VALUE, then SELL_NOW with a fast-sale route.
7. specifics: fill every standard element from the photographs, the owner notes and the Lens matches; most will be LIKELY or UNKNOWN in a quick check.
questions: 0 to 3 questions for the owner, who is holding the object, about the standard elements still LIKELY or UNKNOWN that matter most for identity, era, antique-or-reproduction or price (look first at construction: materials, fixings, fabric, runner, base, joins), that the photographs CANNOT answer and whose answer would change the identification or the price (for example a chip you can half-see, a mark hidden in shadow, whether a part is original, the size when size separates two models). Never ask about anything legible in a photograph, never general care checks. Each: question (plain, under 90 characters, answerable Yes or No); photo (the 1-based number of the photograph it is about, or null); why (one short sentence); if_yes and if_no (what each answer means, under 70 characters, e.g. "chipped: disclose, price about £40"); price_if_yes and price_if_no (GBP or null). An empty list is right when the photographs answer everything.
8. listing.title_checks: return an empty list (questions replace checks).`
   : '';
  const content: any[] = [{
    type: "input_text",
    text: `Research this ${draftMode?'saved provisional AI draft':'permanent catalogue record'}${depth==='quick'?' as a QUICK CHECK without web search':' with live web search'}. Observations are not proven identifications:\n${JSON.stringify(itemForResearch, null, 2)}\nOwner correction chronology (separate from original AI): ${JSON.stringify(ownerCorrections)}. These direct material corrections OVERRIDE incompatible AI and marketplace hypotheses.\nOwner visual reference decisions (museum catalogued specimens are NOT authenticators for this object): ${JSON.stringify(ownerVisualGuidance)}. Reject explicitly rejected visual analogues; compare shape, material, technique and decoration before attribution.\n${answers.length?'OWNER ANSWERS (from the owner holding the object; treat YES/NO and owner_saw as facts, NOT_SURE as unknown): '+JSON.stringify(answers)+'. Use them for the standard elements, identification, condition, title, description and price.\n':''}${ownerNote?'OWNER NOTE (what the owner saw on the object; a fact about the object, not a source): '+JSON.stringify(ownerNote)+'\n':''}${prevPrice&&depth!=='quick'?'PREVIOUS SUGGESTED PRICE: £'+prevPrice.price+(prevPrice.basis?' ('+prevPrice.basis+')':'')+'. Start from it. Change listing.price only for a stated reason (new evidence or an owner answer) and put that reason in listing.price_change_reason (one short sentence); keep the same price and leave price_change_reason empty when nothing material changed. An owner answer that removes a doubt (for example NO chip, signature present) must never lower the price.\n':'listing.price_change_reason: empty.\n'}${depth!=='quick'?'questions: return an empty list. listing.title_checks: return an empty list.\n':''}Search existing knowledge and external evidence before asking for new photos. Show conservative values and achievable routes, flag uncertain sources and do not invent sold results.\n${itemForResearch?.pair_physical_count===2 ? 'IMPORTANT: This is a TWO-PIECE matched pair sold as ONE lot. The valuation quick_sale_value, balanced_low/high, auction_low/high, private_low/high and routing MUST all describe the WHOLE PAIR together, never one individual vase. Prefix valuation.notes with WHOLE PAIR LOT and use pair comparables preferentially; when pair valuation cannot be supported return null instead of extrapolating a single-vase quote.' : 'Price values should refer to the described physical item only.'}`
  }];
  // Standard research reads up to 12 photos at high detail so backstamps and
  // signatures in later photos are seen; a deep dive reads them at full detail.
  // Quick check reads every photo (it writes the owner's questions); deep reads full detail.
  for (const image of images.slice(0, 12)) content.push({ type:"input_image", image_url:image, detail:depth==='deep_dive'?"original":"high" });
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

  const model = (process.env.OPENAI_RESEARCH_MODEL || process.env.OPENAI_INTAKE_MODEL || "gpt-6-luna").replace(/^openai\//, "");

  // Finish all fallible preflight reads before claiming a paid run. In approved
  // mode, a revocation/republication stops dispatch and leaves the run STAGED.
  try{canonical=await revalidateCanonicalBeforePaidCall({url:supabaseUrl,key:supabaseKey,token},'research',canonical);}
  catch(e){return res.status(503).json({error:'Approved source set changed or became unavailable before research dispatch. No AI request made.',code:e instanceof Error?e.message:'CANONICAL_RECHECK_FAILED'});}
  try{
    const claim=await claimResearchRun(supabaseUrl,supabaseKey,token,research_run_id);
    if(claim!=='CLAIMED')return res.status(409).json({error:'Research run was not freshly claimed; reload the saved result before another paid request.'});
  }catch(e:any){return res.status(409).json({error:e?.message||'Research already running; not charged again.'});}

  // GOOGLE FIRST: one Web Detection call on the main photograph, once per claimed
  // research run. Missing key, limit reached or any Google failure => "not run";
  // research continues from the photographs. Leads are never facts or prices.
  let googleLook:GoogleFirstLook;
  // Google Lens already ran first, during the photo analysis: reuse it.
  // Deep research runs Lens again on the owner's photo order (photo 1 first)
  // when the order changed or the earlier look has no Google AI summary.
  const lensAgain=depth!=='quick'&&(rerun_lens===true||intakeLook?.lens?.overview===undefined);
  if(intakeLook?.status==='CALLED'&&!lensAgain)googleLook=intakeLook;
  else try{
    googleLook=await runGoogleFirstLook({
      apiKey:process.env.GOOGLE_CLOUD_VISION_API_KEY,
      serpKey:process.env.SERPAPI_API_KEY,
      imageUrl:images[0],
      lensImageUrls:images.slice(0,3),
      usedThisMonth:await googleChecksThisMonth(supabaseUrl,supabaseKey,token),
      limit:GOOGLE_MONTHLY_LIMIT
    });
  }catch{googleLook=googleNotRun('Google check failed');}
  content.splice(1,0,{type:'input_text',text:googleLeadsForResearch(googleLook)});

  const body:any = {
    model,
    reasoning: { effort: depth==='deep_dive' ? "high" : depth==='quick' ? "low" : "medium" },
    instructions: instructions+"\n\n"+deepInstructions+"\n\nMANDATORY CURRENT PROJECT SOURCE & VALUATION POLICY:\n"+canonical.instructions+"\n\nAPPROVED INTERNAL KNOWLEDGE (these are only source-backed context, not authentication of the current item):\n"+JSON.stringify(trustedKnowledge)+"\n\nOWNER-CONFIRMED KNOWLEDGE FROM EARLIER ITEMS (the owner's own Knowledge Brain: LEARNED_TELL = reusable dating/identification clue; OWNER_CONFIRMED_FINDING = a fact the owner confirmed on another item. Strong leads for this item where relevant; not authentication):\n"+JSON.stringify(ownerKnowledge)+"\n\nOWNER-SCOPED APPROVED REALISED COMPARABLES (do not infer maker match or condition match merely because same item ID):\n"+JSON.stringify(trustedComparableRows),
    ...(depth==='quick'?{}:{tools: [{ type: "web_search", search_context_size: depth==='deep_dive'?'high':'medium' }]}),
    input: [{ role: "user", content }],
    text: { format: { type:"json_schema", name:"collector_intelligence_research", strict:true, schema:researchSchema } },
    // Reasoning tokens count toward this cap: a deep run that hits it ends
    // 'incomplete' with no answer, so deep gets plenty of room (only used tokens are paid).
    max_output_tokens: depth==='quick' ? 12000 : 64000
  };
  const startedMs=Date.now();
  const dispatchedAt=new Date().toISOString();
  const pendingCtx={research_depth:depth,google_first_look:googleLook,applied_visual_reference_ids:visualReviews.map((x:any)=>x.id),
    applied_owner_corrections:ownerCorrections.map((x:any)=>({id:x.id,feedback_type:x.feedback_type,corrected_material:x.corrected_material,owner_statement:x.owner_statement})),
    canonical_policy_hashes:canonical.hashes,canonical_source_audit:canonicalSourceAudit(canonical),
    trusted_database_comparables:trustedComparableRows.length,trusted_comparable_ids:trustedComparableRows.map((c:any)=>c.id),
    owner_answers:answers,owner_note:ownerNote||null,previous_price:prevPrice,dispatched_at:dispatchedAt,model};
  // Deep research runs in OpenAI BACKGROUND mode: the job keeps running at the
  // provider even if this function reaches its time limit; the app collects it.
  const post=async(b:any)=>{
    const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${apiKey}`},body:JSON.stringify(b)});
    return {r,j:await r.json()};
  };
  let response:Response;
  let payload:any;
  try {
    ({r:response,j:payload}=await post(depth==='quick'?body:{...body,background:true,store:true}));
    // An account or model without background mode refuses before any work: send once normally.
    if(!response.ok&&response.status===400&&/background/i.test(String(payload?.error?.message||'')))({r:response,j:payload}=await post(body));
  } catch {
    return res.status(503).json({
      code:'PAID_RESEARCH_OUTCOME_UNCONFIRMED',research_run_id,
      error:'The research provider response could not be confirmed. The saved run remains claimed; do not repeat paid research to recover it.'
    });
  }
  if (!response.ok){
    // The provider refused the request: record why, so the owner sees it and can retry.
    const why='OpenAI refused the request ('+response.status+'): '+String(payload?.error?.message||'no message');
    const cur=await ownerScopedResearchRun(supabaseUrl,supabaseKey,token,research_run_id).catch(()=>null);
    await markResearchFailed(supabaseUrl,supabaseKey,token,research_run_id,cur?.result,why);
    return res.status(response.status).json({code:'PAID_RESEARCH_PROVIDER_ERROR',research_run_id,error:why+'. You can run it again.'});
  }
  if(['queued','in_progress'].includes(payload?.status)&&typeof payload?.id==='string'){
    // Save the provider job id so any later visit can collect the result.
    try{
      const claimed=await ownerScopedResearchRun(supabaseUrl,supabaseKey,token,research_run_id);
      await persistResearchResult(supabaseUrl,supabaseKey,token,research_run_id,'PENDING',{...(claimed.result||{}),analysis_stage:'PROCESSING',openai_response_id:payload.id,pending_context:pendingCtx});
    }catch{/* The wait below still collects it in this request. */}
    // Bulk catch-up starts many runs: hand back at once; the app collects them.
    if(req.body?.no_wait===true)return res.status(202).json({code:'RESEARCH_STILL_RUNNING',research_run_id,provider_response_id:payload.id});
    const done=await waitForProvider(apiKey,payload.id,startedMs+200000);
    if(!done)return res.status(202).json({code:'RESEARCH_STILL_RUNNING',research_run_id,provider_response_id:payload.id});
    if(done.status!=='completed'){
      const cur=await ownerScopedResearchRun(supabaseUrl,supabaseKey,token,research_run_id).catch(()=>null);
      await markResearchFailed(supabaseUrl,supabaseKey,token,research_run_id,cur?.result,'Provider ended the research: '+done.status);
      return res.status(502).json({code:'PAID_RESEARCH_PROVIDER_ERROR',research_run_id,error:'The research provider ended this run ('+done.status+'). It is marked as failed; you can start research again.'});
    }
    payload=done;
  }
  return finishResearch(res,{payload,url:supabaseUrl,key:supabaseKey,token,runId:research_run_id,model:body.model,ctx:pendingCtx});
}
