import type {Comparable} from '../types'
const sold=new Set(['AUCTION_REALIZED','AUCTION_REALISED','MARKETPLACE_SOLD'])
const confirmed=new Set(['VERIFIED','SOURCE_VERIFIED','CONFIRMED'])
export function classifyComparables(rows:Comparable[]){
 return rows.map(row=>{
  const basis=String(row.price_type||'').trim().toUpperCase()
  const status=String(row.verification_status||'').trim().toUpperCase()
  const isSold=sold.has(basis)
  const exact=typeof row.price==='number'&&Number.isFinite(row.price)&&row.price>=0
  const source=typeof row.source_url==='string'&&/^https:\/\/[^\s]+$/i.test(row.source_url)
  const verified=isSold&&confirmed.has(status)&&exact&&source&&!!row.sale_date&&!!row.currency
  return {row,verified,reason:verified?'Recorded as verified achieved sale':!isSold?'Not a recognised achieved-sale classification':!confirmed.has(status)?'Sale verification not confirmed':!source?'Missing traceable source URL':!row.sale_date?'Missing sale date':!row.currency?'Missing currency':'Missing numeric achieved price'}
 })
}
