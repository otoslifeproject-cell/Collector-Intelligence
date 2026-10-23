import type {Comparable} from '../types'
// These names come from Evidence Policy v4, rather than model/legacy aliases.
export const achievedPriceTypes=new Set(['HAMMER_REALIZED','REALIZED_INCL_BP','MARKETPLACE_SOLD','DEALER_SOLD_CONFIRMED'])
export function evidenceDate(value:unknown):value is string {
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false
 const stamp=Date.parse(value+'T00:00:00Z')
 return Number.isFinite(stamp)&&new Date(stamp).toISOString().slice(0,10)===value
}
export function evidenceUrl(value:unknown):value is string {
 if(typeof value!=='string'||value.trim()!==value||/\s/.test(value))return false
 try{const u=new URL(value);return u.protocol==='https:'&&!!u.hostname&&!u.username&&!u.password}catch{return false}
}
export function classifyComparables(rows:Comparable[],today=new Date().toLocaleDateString('en-CA',{timeZone:'Europe/London'})){
 return rows.map(row=>{
  const basis=String(row.price_type||'').trim().toUpperCase()
  const status=String(row.verification_status||'').trim().toUpperCase()
  const isSold=achievedPriceTypes.has(basis)
  const exact=typeof row.price==='number'&&Number.isFinite(row.price)&&row.price>=0
  const source=evidenceUrl(row.source_url)
  const dated=evidenceDate(today)&&evidenceDate(row.sale_date)&&row.sale_date<=today,currency=typeof row.currency==='string'&&/^[A-Z]{3}$/.test(row.currency)
  const verified=isSold&&status==='VERIFIED_DIRECT'&&exact&&source&&dated&&currency
  return {row,verified,reason:verified?'Recorded as directly verified achieved sale':!isSold?'Not a canonical achieved-sale classification':status!=='VERIFIED_DIRECT'?'Direct source verification not recorded':!source?'Missing valid HTTPS source URL':!dated?'Missing valid past sale date':!currency?'Missing valid currency':'Missing numeric achieved price'}
 })
}
