// eBay BATCH (Dean, 31 Oct): finish items in CI, sign each off, then download
// one file for Seller Hub (Reports → Uploads → Upload template) that puts them
// in the eBay Drafts folder. Drafts are never published by CI.
// Columns follow eBay's published "Create new drafts" template
// (pages.ebay.com/sh/reports/help/uploadable-file-feeds): Action = Draft,
// Category ID required, photos pipe-separated (max 24), Condition NEW/USED,
// simple HTML in the description, Format Auction or FixedPrice.
export type EbayBatchRow={
 sku:string;categoryId:string;title:string;price:number|null;photoUrls:string[];
 condition:'USED'|'NEW';description:string;format:'FixedPrice'|'Auction'
}
const safe=(v:string)=>/^[=+@\-\t\r]/.test(v)?"'"+v:v
const quote=(v:string)=>'"'+safe(v).replaceAll('"','""')+'"'
const esc=(v:string)=>v.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
export function descriptionHtml(text:string):string{
 return text.split(/\n{2,}/).map(p=>'<p>'+p.split('\n').map(esc).join('<br>')+'</p>').join('')
}
export const EBAY_DRAFT_INFO='#INFO,Version=0.0.2,Template= eBay-draft-listings-template_GB,,,,,,,,'
export const EBAY_DRAFT_HEADER=['Action(SiteID=UK|Country=GB|Currency=GBP|Version=1193|CC=UTF-8)','Custom label (SKU)','Category ID','Title','UPC','Price','Quantity','Item photo URL','Condition ID','Description','Format']
export function ebayBatchProblems(r:EbayBatchRow):string[]{
 const p:string[]=[]
 if(!/^[0-9]{1,10}$/.test(r.categoryId))p.push('eBay category number missing')
 if(!r.title.trim())p.push('title missing')
 if(r.title.length>80)p.push('title over 80 characters')
 if(r.price===null||!Number.isFinite(r.price)||r.price<=0)p.push('price missing')
 if(!r.photoUrls.length)p.push('no photos')
 return p
}
export function ebayBatchCsv(rows:EbayBatchRow[]):string{
 if(!rows.length)throw Error('Choose at least one signed-off item.')
 const skus=new Set<string>()
 const lines=[EBAY_DRAFT_INFO,EBAY_DRAFT_HEADER.map(quote).join(',')]
 for(const r of rows){
  const problems=ebayBatchProblems(r)
  if(problems.length)throw Error(r.sku+': '+problems.join(', '))
  if(skus.has(r.sku))throw Error(r.sku+' is in the batch twice')
  skus.add(r.sku)
  const photos=r.photoUrls.slice(0,24).map(u=>u.replaceAll(' ','%20')).join('|')
  lines.push([quote('Draft'),quote(r.sku),quote(r.categoryId),quote(r.title.trim()),quote(''),quote((r.price as number).toFixed(2)),quote('1'),quote(photos),quote(r.condition),quote(descriptionHtml(r.description)),quote(r.format)].join(','))
 }
 return lines.join('\r\n')+'\r\n'
}
