import type {Item} from '../types'

export type EbayDraftRow={item:Item; categoryId:string}
const safe=(value:string)=>/^[=+@\-\t\r]/.test(value)?"'"+value:value
const quote=(value:string)=>'"'+safe(value).replaceAll('"','""')+'"'
const decimal=(n:number|null)=>n===null||!Number.isFinite(n)?'':n.toFixed(2)

/**
 * A non-publishing Seller Hub "Create drafts" feed.
 * No fabricated category or condition and no unverifiable provenance claims.
 * Seller MUST confirm the category ID in their freshly downloaded UK draft template.
 */
export function ebayDraftCsv(rows:EbayDraftRow[]):string{
 if(!rows.length)throw Error('Select at least one catalogue item.')
 const seen=new Set<string>()
 const output=['Action,Custom label (SKU),Category ID,Title,Description,Start price']
 for(const {item,categoryId} of rows){
  if(seen.has(item.id))throw Error('Duplicate catalogue object in batch.')
  seen.add(item.id)
  if(!/^[0-9]{1,10}$/.test(categoryId))throw Error('Each object requires an eBay category ID from the current Seller Hub draft template.')
  if(!item.item_code||!item.title&&!item.object_type)throw Error('Save an object title and ID before eBay export.')
  if(item.status==='SOLD'||item.status==='ARCHIVED')throw Error('Sold or archived objects cannot be exported as new draft listings.')
  const title=(item.title||item.object_type||'').trim().slice(0,80)
  const facts=[item.item_code,item.material,item.colour,item.dimensions?JSON.stringify(item.dimensions):'',item.condition_summary].filter(Boolean).join(' | ')
  const description=[title,facts,'Attribution not independently authenticated unless separately documented. Please review all condition and period statements before publication.'].join('\\n\\n')
  output.push([quote('Draft'),quote(item.item_code),quote(categoryId),quote(title),quote(description),quote(decimal(item.balanced_value_low))].join(','))
 }
 return output.join('\\r\\n')+'\\r\\n'
}
