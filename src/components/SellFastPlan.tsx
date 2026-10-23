import {useEffect, useState} from 'react'
import type {Comparable, Item} from '../types'
import {assessSaleScenario, chooseSaleScenario, emptySaleScenario, knownSaleCurrency, prepareListing, safeSourceUrl, salePlatforms, sellModes, storedPublication} from '../lib/sellFastPlan'
import type {FinalResearchDecision, ListingReview, SaleScenario, SellMode, StoredListing} from '../lib/sellFastPlan'
import type {ResearchAudit} from '../lib/researchSaleDecision'

type Props={item:Item;comparables:Comparable[];trustedComparableIds?:string[];listings?:StoredListing[];photoCount?:number;researchAudit?:ResearchAudit;finalDecision?:FinalResearchDecision}
const modeTitle=(mode:SellMode)=>mode.replaceAll('_',' ')
const amount=(n:number|null,currency:string)=>n===null?'Unknown':knownSaleCurrency(currency)?new Intl.NumberFormat('en-GB',{style:'currency',currency,minimumFractionDigits:2,maximumFractionDigits:2}).format(n):`${n.toFixed(2)} (currency unconfirmed)`
const initialReview:ListingReview={conditionReviewed:false,comparableReviewed:false,photosReviewed:false,attribution:'UNRESOLVED',makerSource:'',specialistRisk:false,shippingInstructions:''}
const numberValue=(value:string)=>value.trim()===''?null:Number(value)
const labels:[keyof SaleScenario,string][]=[['grossLow','Gross price · low'],['grossHigh','Gross price · high'],['feePercent','Seller / payment fees (%)'],['fixedFee','Fixed seller / payment fees'],['packing','Packing materials and labour'],['delivery','Delivery cost paid by seller'],['insurance','Insurance / cover cost'],['returnAllowance','Expected return / refund allowance'],['daysLow','Days to sell · low'],['daysHigh','Days to sell · high'],['workHours','Practical work (hours)']]

export default function SellFastPlan(props:Props){
  // An owner/item switch discards local draft state rather than transferring it to another collection object.
  return <SellFastPlanRecord key={`${props.item.owner_id}:${props.item.id}:${props.item.currency||'UNCONFIRMED'}`} {...props}/>
}
function SellFastPlanRecord({item,comparables,trustedComparableIds=[],listings=[],photoCount,researchAudit,finalDecision}:Props){
  const currency=knownSaleCurrency(item.currency)?item.currency:''
  const [scenarios,setScenarios]=useState(()=>sellModes.map(mode=>emptySaleScenario(mode,currency)))
  const [review,setReview]=useState<ListingReview>(initialReview)
  const [objective,setObjective]=useState<SellMode>('FAST_CASH')
  const [draftMode,setDraftMode]=useState<SellMode>('FAST_CASH')
  const [showDraft,setShowDraft]=useState(false)
  const [exported,setExported]=useState(false)
  const facts=JSON.stringify([item.maker,item.condition_summary,item.material,item.colour,item.object_type,item.marks_signatures_labels,item.dimensions,item.weight_g,item.status,(item as Item&{acquisition_intent?:string}).acquisition_intent])
  useEffect(()=>{setReview(initialReview);setShowDraft(false);setExported(false)},[facts])
  const today=new Date().toLocaleDateString('en-CA',{timeZone:'Europe/London'})
  const assessments=scenarios.map(s=>assessSaleScenario(s,item,comparables,review,today,trustedComparableIds,{audit:researchAudit,finalDecision}))
  const decision=chooseSaleScenario(assessments,objective)
  const selected=assessments.find(x=>x.scenario.mode===draftMode)!
  const draft=prepareListing(item,selected,{...review,photosReviewed:review.photosReviewed&&(photoCount===undefined||photoCount>0)},comparables)
  const ownListings=listings.filter(row=>row.item_id===item.id&&row.owner_id===item.owner_id)
  const updateScenario=(mode:SellMode,key:keyof SaleScenario,value:SaleScenario[keyof SaleScenario])=>{
    setScenarios(rows=>rows.map(row=>{
      if(row.mode!==mode)return row
      const next={...row,[key]:value}
      if(key==='platform'||key==='sellerStatus')Object.assign(next,{feeSource:'',eligibilitySource:'',checkedAt:'',eligibilityConfirmed:false,feePercent:null,fixedFee:null})
      if(['deliveryMethod','packing','delivery','insurance'].includes(key))next.shippingReviewed=false
      if(['feeSource','eligibilitySource','checkedAt'].includes(key))next.eligibilityConfirmed=false
      return next
    }));setExported(false)
    if(['comparableId','grossLow','grossHigh','grossBasis','priceAdjustment','premiumAdjustmentSource'].includes(key))setReview(r=>({...r,comparableReviewed:false}))
  }
  const updateReview=<K extends keyof ListingReview>(key:K,value:ListingReview[K])=>{setReview(r=>({...r,[key]:value}));setExported(false)}
  const download=()=>{
    const blob=new Blob([JSON.stringify({format:'collector-intelligence-sale-plan-v1',itemId:item.id,itemCode:item.item_code,
      capturedAt:new Date().toISOString(),objective,scenarios,review,researchAudit,finalDecision,recommendation:decision.recommendation?.scenario.mode||null,
      reason:decision.reason,listing:draft},null,2)],{type:'application/json'})
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${item.item_code.replace(/[^a-zA-Z0-9_-]/g,'_')}-sale-plan.json`;a.click()
    setTimeout(()=>URL.revokeObjectURL(url),1000);setExported(true)
  }
  return <section className="panel ci-sale-economics" aria-label="Sell Fast plan and listing preparation">
    <div className="panelHeader"><h2>Sell Fast plan</h2><span>{currency||'Currency unconfirmed'} · owner-entered scenarios</span></div>
    <p className="ci-page-meta">Compare routes using reviewed achieved sales and complete selling costs. No platform fees, sale prices or sale times are filled in automatically. Your edits stay on this page until exported; refreshing loses them.</p>
    <p><strong>{finalDecision?.status==='SPECIALIST_REVIEW'?'DO NOT LIST YET — SPECIALIST REVIEW':decision.recommendation?'Research-complete item decision supplied':'DO NOT LIST YET — research / final assessment incomplete'}</strong></p>
    <p className="ci-page-meta">Sale readiness requires the stored research audit and an approved final item assessment documenting every available relevant identification and valuation check. Scenario inputs and generic wording cannot override that requirement.</p>
    <label style={{display:'grid',gap:6,maxWidth:300}}>Selling priority
      <select value={objective} onChange={e=>{setObjective(e.target.value as SellMode);setExported(false)}}>{sellModes.map(mode=><option key={mode} value={mode}>{modeTitle(mode)}</option>)}</select>
    </label>
    <p role="status"><strong>{decision.recommendation?`Recommended route: ${decision.recommendation.scenario.platform}`:'Research / review required'}</strong> · {decision.reason}</p>
    <p className="ci-page-meta">FAST CASH targets roughly 7–14 days; BALANCED roughly 30–60 days; MAX VALUE tolerates longer. Enter item-specific expectations below. These are planning targets, never sale guarantees.</p>
    <div className="tableWrap"><table><caption style={{textAlign:'left',padding:'10px 0'}}>Three selling strategies · all values are assumptions</caption><thead><tr><th>Strategy / venue</th><th>Gross range</th><th>Fees</th><th>Packing / delivery / insurance / returns</th><th>Net proceeds</th><th>Time / work</th><th>Readiness</th></tr></thead><tbody>
      {assessments.map(a=><tr key={a.scenario.mode}>
        <td><strong>{modeTitle(a.scenario.mode)}</strong><div>{a.scenario.platform}</div></td>
        <td>{amount(a.scenario.grossLow,currency)} – {amount(a.scenario.grossHigh,currency)}</td>
        <td>{amount(a.feesLow,currency)} – {amount(a.feesHigh,currency)}</td>
        <td>{[a.scenario.packing,a.scenario.delivery,a.scenario.insurance,a.scenario.returnAllowance].map(n=>amount(n,currency)).join(' / ')}</td>
        <td>{amount(a.netLow,currency)} – {amount(a.netHigh,currency)}</td>
        <td>{a.scenario.daysLow??'?'}–{a.scenario.daysHigh??'?'} days<div>{a.scenario.workHours??'?'} hours</div></td>
        <td>{a.ready?'Reviewed scenario':`${a.blockers.length} checks open`}</td>
      </tr>)}
    </tbody></table></div>
    <details style={{marginTop:16}}><summary>Review evidence, condition and shipping</summary>
      <div className="ci-review-fields ci-economics-fields" style={{marginTop:12}}>
        <label>Attribution basis<select value={review.attribution} onChange={e=>updateReview('attribution',e.target.value as ListingReview['attribution'])}>
          <option value="UNRESOLVED">Unresolved · research first</option><option value="GENERIC">Generic description and generic comparables</option><option value="DOCUMENTED_MAKER">Owner-reviewed documentary maker support</option>
        </select></label>
        {review.attribution==='DOCUMENTED_MAKER'&&<label>Documentary maker source URL<input type="url" value={review.makerSource} onChange={e=>updateReview('makerSource',e.target.value)} placeholder="https://…"/></label>}
        <label style={{display:'flex',gap:8,alignItems:'start'}}><input style={{width:'auto'}} type="checkbox" checked={review.conditionReviewed} onChange={e=>updateReview('conditionReviewed',e.target.checked)}/>I inspected the item and reviewed its written condition report.</label>
        <label style={{display:'flex',gap:8,alignItems:'start'}}><input style={{width:'auto'}} type="checkbox" checked={review.comparableReviewed} onChange={e=>updateReview('comparableReviewed',e.target.checked)}/>I reviewed selected sources, physical comparability and price adjustments for every route entered.</label>
        <label style={{display:'flex',gap:8,alignItems:'start'}}><input style={{width:'auto'}} type="checkbox" disabled={photoCount===0} checked={review.photosReviewed&&photoCount!==0} onChange={e=>updateReview('photosReviewed',e.target.checked)}/>I checked complete original photos, readable marks, measurements and all condition issues{photoCount===undefined?'':` (${photoCount} stored photos)`}.</label>
        <label style={{display:'flex',gap:8,alignItems:'start'}}><input style={{width:'auto'}} type="checkbox" checked={review.specialistRisk} onChange={e=>updateReview('specialistRisk',e.target.checked)}/>An unresolved attribution could materially increase value: specialist review required.</label>
        <label style={{gridColumn:'1 / -1'}}>Packing / collection instructions<textarea value={review.shippingInstructions} onChange={e=>updateReview('shippingInstructions',e.target.value)} placeholder="Collection arrangements, or packing standard, packed size/weight, destination, carrier, tracking, valid loss/breakage cover and exclusions…"/></label>
      </div>
      <p className="ci-page-meta">A confident signature reading does not authenticate the maker. For fragile glass or ceramics verify breakage cover explicitly; standard carrier compensation may exclude it. Preserve packing photographs and receipts. International delivery needs its own eligibility, cost and cover checks.</p>
    </details>
    {assessments.map(a=><details key={a.scenario.mode} style={{marginTop:12}}><summary>Edit {modeTitle(a.scenario.mode)} assumptions · {a.ready?'reviewed':`${a.blockers.length} checks open`}</summary>
      <div className="ci-review-fields ci-economics-fields" style={{marginTop:12}}>
        <label>Venue<select value={a.scenario.platform} onChange={e=>updateScenario(a.scenario.mode,'platform',e.target.value)}>{salePlatforms.map(p=><option key={p}>{p}</option>)}</select></label>
        <label>Achieved-sale comparable<select value={a.scenario.comparableId} onChange={e=>updateScenario(a.scenario.mode,'comparableId',e.target.value)}><option value="">Choose a reviewed source</option>{comparables.filter(c=>c.item_id===item.id).map(c=><option key={c.id} value={c.id}>{c.venue} · {c.price_type} · {c.price??'?'} {c.currency} {trustedComparableIds.includes(c.id)?'· source-reviewed':'· review required'}</option>)}</select></label>
        <label>Gross-price basis<select value={a.scenario.grossBasis} onChange={e=>updateScenario(a.scenario.mode,'grossBasis',e.target.value)}><option value="UNKNOWN">Needs confirmation</option><option value="SELLER_GROSS">Seller gross · excludes buyer premium/taxes</option><option value="BUYER_TOTAL">Buyer total · cannot calculate seller proceeds</option></select></label>
        <label>Comparable-to-item price adjustment<textarea value={a.scenario.priceAdjustment} onChange={e=>updateScenario(a.scenario.mode,'priceAdjustment',e.target.value)} placeholder="Explain form/size/condition differences, achieved-price basis and adjustment to this item’s gross range…"/></label>
        {comparables.some(c=>c.id===a.scenario.comparableId&&c.price_type==='REALIZED_INCL_BP')&&<label>Premium-to-hammer conversion source URL<input type="url" value={a.scenario.premiumAdjustmentSource} onChange={e=>updateScenario(a.scenario.mode,'premiumAdjustmentSource',e.target.value)} placeholder="https://…"/></label>}
        {labels.map(([key,label])=><label key={key}>{label}{!['feePercent','daysLow','daysHigh','workHours'].includes(key)?` (${currency||'currency unconfirmed'})`:''}<input type="number" min="0" max={key==='feePercent'?100:undefined} step={key==='daysLow'||key==='daysHigh'?'1':'0.01'} value={String(a.scenario[key]??'')} onChange={e=>updateScenario(a.scenario.mode,key,numberValue(e.target.value))} placeholder="Required · enter 0 if none"/></label>)}
        <label>Fee schedule URL<input type="url" value={a.scenario.feeSource} onChange={e=>updateScenario(a.scenario.mode,'feeSource',e.target.value)} placeholder="https://…"/></label>
        <label>Account / category eligibility URL<input type="url" value={a.scenario.eligibilitySource} onChange={e=>updateScenario(a.scenario.mode,'eligibilitySource',e.target.value)} placeholder="https://…"/></label>
        <label>Fee / eligibility date checked<input type="date" max={today} value={a.scenario.checkedAt} onChange={e=>updateScenario(a.scenario.mode,'checkedAt',e.target.value)}/></label>
        <label>Seller status<select value={a.scenario.sellerStatus} onChange={e=>updateScenario(a.scenario.mode,'sellerStatus',e.target.value)}><option value="UNKNOWN">Needs confirmation</option><option value="PRIVATE">Private collection disposal</option><option value="BUSINESS">Business / acquired for resale</option></select></label>
        <label>Fulfilment<select value={a.scenario.deliveryMethod} onChange={e=>updateScenario(a.scenario.mode,'deliveryMethod',e.target.value)}><option value="COLLECTION">Collection</option><option value="DELIVERY">Delivery</option></select></label>
        <label style={{display:'flex',gap:8,alignItems:'start'}}><input style={{width:'auto'}} type="checkbox" checked={a.scenario.eligibilityConfirmed} onChange={e=>updateScenario(a.scenario.mode,'eligibilityConfirmed',e.target.checked)}/>I checked current venue/category eligibility for this seller status.</label>
        <label style={{display:'flex',gap:8,alignItems:'start'}}><input style={{width:'auto'}} type="checkbox" checked={a.scenario.shippingReviewed} onChange={e=>updateScenario(a.scenario.mode,'shippingReviewed',e.target.checked)}/>I confirmed collection arrangements or delivery costs, packing and actual cover/exclusions.</label>
      </div>
      {a.blockers.length>0&&<ul>{a.blockers.map(blocker=><li key={blocker}>{blocker}</li>)}</ul>}
    </details>)}
    <div style={{marginTop:18,display:'flex',gap:10,flexWrap:'wrap',alignItems:'end'}}>
      <label style={{display:'grid',gap:6}}>Listing strategy<select value={draftMode} onChange={e=>{setDraftMode(e.target.value as SellMode);setExported(false)}}>{sellModes.map(mode=><option key={mode} value={mode}>{modeTitle(mode)}</option>)}</select></label>
      <button className="primaryButton inlineButton" onClick={()=>setShowDraft(true)}>{selected.ready?'Prepare listing draft':'Prepare review draft'}</button>
      <button className="secondaryButton inlineButton" onClick={download}>Export sale plan</button>
    </div>
    {exported&&<p role="status">Sale-plan download prepared. Keep the downloaded file to preserve these assumptions. No database listing was created or published.</p>}
    {showDraft&&<div style={{marginTop:16}} role="region" aria-label="Listing review draft">
      <h3>{draft.platform} · {draft.status==='PREPARED'?'Prepared for final owner approval':'Draft needs review'}</h3>
      <p><strong>Not published.</strong> {draft.recommendedPrice===null?'Price recommendation blocked until review is complete.':`Proposed target: ${amount(draft.recommendedPrice,currency)}. Confirm final price, offers/reserve and shipping before publishing.`}</p>
      <div className="ci-review-fields">
        <label>Draft title<input readOnly value={draft.title}/></label>
        <label>Draft description<textarea rows={9} readOnly value={draft.description}/></label>
      </div>
      <details style={{marginTop:12}}><summary>Required photographs and platform handoff</summary><ul>{draft.photographsNeeded.map(text=><li key={text}>{text}</li>)}</ul>
        <p>{draft.platform==='eBay'?'Review category, item specifics, Buy It Now price, offers, SKU and shipping settings.':draft.platform==='Vinted'?'Confirm eligible category/account, condition, parcel size/weight and selected photos.':draft.platform==='Etsy'?'Confirm current category/vintage eligibility, period evidence, tags and shipping profile.':draft.platform==='Auction / specialist'?'Send the catalogue description, dimensions, condition, mark photographs and documentary evidence for consignment review.':'Confirm the agreed price, exact lot, payment and collection/delivery arrangements.'}</p>
        <p className="ci-page-meta">Known fields: {Object.entries(draft.itemSpecifics).map(([k,v])=>`${k}: ${v}`).join(' · ')}. Keywords: {draft.keywords.join(', ')||'None confirmed'}.</p>
      </details>
      {draft.outstandingChecks.length>0&&<details style={{marginTop:12}} open><summary>Checks before this draft can be sale-ready</summary><ul>{draft.outstandingChecks.map(text=><li key={text}>{text}</li>)}</ul></details>}
    </div>}
    <details style={{marginTop:16}}><summary>Stored marketplace listing records · {ownListings.length}</summary>
      {ownListings.length===0?<p>No stored listing records found for this item.</p>:<ul>{ownListings.map(row=><li key={row.id}>{row.platform} · {storedPublication(row,item.id,item.owner_id).replaceAll('_',' ').toLowerCase()}{safeSourceUrl(row.listing_url)&&<> · <a href={row.listing_url} target="_blank" rel="noopener noreferrer">Recorded listing ↗</a></>}</li>)}</ul>}
      <p className="ci-page-meta">Published means the stored record includes a published status, timestamp and listing URL. Marketplace availability has not been independently checked here. Prepared/exported copy is never proof of publication.</p>
    </details>
  </section>
}
