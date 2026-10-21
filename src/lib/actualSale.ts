import type {SupabaseClient} from '@supabase/supabase-js'

export type SaleItem={id:string;owner_id:string;status:string;currency:string;acquisition_currency:string|null;acquisition_price:number|null;all_in_cost:number|null}
export type SaleOutcome={id:string;owner_id:string;item_id:string;client_event_id:string|null;currency:string;venue:string|null;sale_date:string|null;gross_sale:number|null;net_sale_proceeds:number|null;net_profit:number|null;return_on_cash:number|null;provenance_basis:string|null;source_reference:string|null;platform_fees:number|null;payment_fees:number|null;shipping_subsidy:number|null;packing_cost:number|null;insurance_cost:number|null;acquisition_cost:number|null;owner_notes:string|null}
export type SaleContext={ownerId:string;item:SaleItem;outcomes:SaleOutcome[]}
export type SalePayload={owner_confirmed:true;sale_date:string;venue:string;currency:string;gross_sale:number;platform_fees:number;payment_fees:number;shipping_cost:number;packing_cost:number;insurance_cost:number;acquisition_cost?:number;source_reference:string;notes:string}

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function saleAmount(value:string,blank:number|null=null):number|null{
 const text=value.trim()
 if(!text)return blank
 if(!/^\d+(?:\.\d{1,2})?$/.test(text))return null
 const number=Number(text)
 return Number.isFinite(number)&&number<=100000000?number:null
}
export function saleMoney(value:number|null,currency:string){
 if(value===null)return 'Unknown'
 try{return new Intl.NumberFormat('en-GB',{style:'currency',currency,minimumFractionDigits:2,maximumFractionDigits:2}).format(value)}catch{return 'Unknown'}
}
const finiteOrNull=(value:unknown)=>value===null||(typeof value==='number'&&Number.isFinite(value))
export async function readSaleContext(client:SupabaseClient,itemId:string,signal:AbortSignal):Promise<SaleContext>{
 if(!uuid.test(itemId))throw Error('This collection object could not be identified.')
 const {data:identity,error:authError}=await client.auth.getUser()
 if(authError||!identity.user||!uuid.test(identity.user.id))throw Error('Sign in again to read your private sale records.')
 if(signal.aborted)throw Error('Read cancelled')
 const ownerId=identity.user.id
 const itemRead=await client.from('items').select('id,owner_id,status,currency,acquisition_currency,acquisition_price,all_in_cost')
  .eq('id',itemId).eq('owner_id',ownerId).abortSignal(signal).maybeSingle()
 if(itemRead.error||!itemRead.data)throw Error('This collection object is unavailable for the signed-in account.')
 const item=itemRead.data as SaleItem
 if(item.id!==itemId||item.owner_id!==ownerId||!finiteOrNull(item.acquisition_price)||!finiteOrNull(item.all_in_cost)||!/^[A-Z]{3}$/.test(item.currency||''))throw Error('The saved object details could not be verified.')
 const read=await client.from('sale_outcomes')
  .select('id,owner_id,item_id,client_event_id,currency,venue,sale_date,gross_sale,net_sale_proceeds,net_profit,return_on_cash,provenance_basis,source_reference,platform_fees,payment_fees,shipping_subsidy,packing_cost,insurance_cost,acquisition_cost,owner_notes',{count:'exact'})
  .eq('item_id',itemId).eq('owner_id',ownerId).order('created_at',{ascending:false}).order('id').limit(101).abortSignal(signal)
 if(read.error||!read.data||read.count===null||read.count>100||read.count!==read.data.length)throw Error('Complete sale history could not be loaded. Reload before recording a sale.')
 const outcomes=read.data as SaleOutcome[]
 if(new Set(outcomes.map(row=>row.id)).size!==outcomes.length)throw Error('The saved sale records contain duplicate identities.')
 if(outcomes.some(row=>!uuid.test(row.id)||row.item_id!==itemId||row.owner_id!==ownerId||!/^[A-Z]{3}$/.test(row.currency||'')||
  ![row.gross_sale,row.net_sale_proceeds,row.net_profit,row.return_on_cash,row.platform_fees,row.payment_fees,row.shipping_subsidy,row.packing_cost,row.insurance_cost,row.acquisition_cost].every(finiteOrNull)))throw Error('The saved sale records could not be verified. Reload before recording a sale.')
 return {ownerId,item,outcomes}
}
