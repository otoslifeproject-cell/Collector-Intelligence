import type {Item} from '../types'
import {knownSaleCurrency} from './sellFastPlan.ts'
import {money} from './format.ts'
export function catalogueSaleLabel(item:Pick<Item,'status'|'sale_readiness'>){
 if(item.status==='SOLD')return 'Recorded sold'
 if(item.status==='ARCHIVED')return 'Archived'
 if(item.status==='SPECIALIST_REVIEW'||item.sale_readiness==='SPECIALIST_REVIEW')return 'Specialist review required'
 return 'Final research decision required'
}
export function provisionalMoney(value:number|null|undefined,currency:string|null|undefined){
 if(value==null||!Number.isFinite(Number(value)))return 'Unknown'
 return knownSaleCurrency(currency)?money(value,currency):'Currency unconfirmed'
}
export function provisionalCurrencyTotals(items:Item[]){
 const sums=new Map<string,number>();let unknown=0
 for(const item of items){
  if(['SOLD','ARCHIVED'].includes(item.status))continue
  if(!knownSaleCurrency(item.currency)||item.quick_sale_value==null||!Number.isFinite(Number(item.quick_sale_value))){unknown++;continue}
  sums.set(item.currency,(sums.get(item.currency)||0)+Number(item.quick_sale_value))
 }
 return {text:[...sums].sort(([a],[b])=>a.localeCompare(b)).map(([currency,n])=>money(n,currency)).join(' / ')||'Unknown',unknown}
}
