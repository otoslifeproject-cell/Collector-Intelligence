import {useState} from 'react'
import type {Comparable,Item} from '../types'
import {ebaySellerReview,formatEbaySellerHandoff} from '../lib/ebaySellerReview'

type Props={item:Item;trustedSales:Comparable[];approvedMaker:string|null;photoCount:number}
export default function EbaySellerReview({item,trustedSales,approvedMaker,photoCount}:Props){
 const [details,setDetails]=useState(false),[message,setMessage]=useState('')
 const draft=ebaySellerReview(item,trustedSales,approvedMaker,photoCount)
 const copy=async()=>{
  try{
   await navigator.clipboard.writeText(formatEbaySellerHandoff(draft))
   setMessage('eBay draft copied. Nothing was published.')
  }catch{setDetails(true);setMessage('Clipboard unavailable. Select the draft details and copy manually.')}
 }
 return <section className="panel ci-ebay-review" aria-label="eBay seller-ready draft">
   <div className="panelHeader"><h2>eBay listing draft</h2><span>Not published</span></div>
   <p><strong>{draft.title||'Check the object type and condition'}</strong></p>
   <p><strong>Suggested format:</strong> {draft.format==='FIXED_PRICE'?'Fixed price':'7-day auction'} · {draft.formatReason}</p>
   <p>{draft.verifiedSoldCount?draft.verifiedSoldCount+' source-reviewed eBay sold listings':'No verified eBay SOLD listings found'}. The final category and asking/starting price need checking.</p>
   <button className="primaryButton intakeBigButton" type="button" onClick={()=>void copy()}>Copy eBay draft</button>
   <button className="secondaryButton" type="button" aria-expanded={details} onClick={()=>setDetails(v=>!v)}>{details?'Hide listing details':'Read more detail'}</button>
   {message&&<p role="status">{message}</p>}
   {details&&<div className="ci-ebay-review-details">
    <h3>Item specifics · check every field</h3>
    <dl>{Object.entries(draft.itemSpecifics).map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
    <h3>Photographs</h3>
    <p>{photoCount} saved originals; eBay permits up to 24. Aim for 1600px photographs, with the first on a plain background and clear scale and flaws.</p>
    <h3>Description for manual copy</h3><textarea readOnly rows={9} value={draft.description} aria-label="eBay description draft"/>
    <h3>Before listing</h3><ul>{draft.checks.map(x=><li key={x}>{x}</li>)}</ul>
    <p><strong>Auction note:</strong> adding Buy It Now to an auction can stop that option after the first bid. Do not set a reserve or Buy It Now without checking the numbers.</p>
    <h3>UK private seller notes</h3>
    <p>Most UK private sales have no final-value fee within eBay's 300-free-listings allowance; optional upgrades and international sales can cost extra. Buyer Protection is already included in the displayed item price or bid. Returns for damaged or not-as-described items can apply even with “no returns”. Clearly record flaws and pack fragile objects very carefully.</p>
    <p>Platforms report to HMRC when reporting thresholds are reached (30 or more goods sales or more than about £1,700 in a calendar year). A report does not automatically mean tax is due; whether items were bought to resell matters.</p>
    <p><a href="https://www.ebay.co.uk/help/selling/listings/listing-tips/best-match?id=4166" target="_blank" rel="noreferrer">eBay listing guidance</a> · <a href="https://www.ebay.co.uk/help/selling/fees-credits-invoices/private-sellers-fees?id=4822" target="_blank" rel="noreferrer">eBay UK private seller fees</a></p>
   </div>}
 </section>
}
