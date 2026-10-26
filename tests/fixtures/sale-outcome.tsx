// Test entry only: real component, SDK and disposable services. No app route.
import React,{useState} from 'react'
import {createRoot} from 'react-dom/client'
import {createClient} from '@supabase/supabase-js'
import RecordSaleOutcome from '../../src/components/RecordSaleOutcome'
import {applyConfirmedSaleStatus} from '../../src/lib/actualSale'
import '../../src/styles.css'

declare global {interface Window {
 __CI_SALE_FIXTURE__:{key:string;item?:Record<string,unknown>}
 __CI_SALE_CLIENT__:ReturnType<typeof createClient>
 __CI_SALE_ITEM__:string
 __CI_SALE_SELECT__:(id:string)=>void
}}
async function boot(){
 const config=window.__CI_SALE_FIXTURE__
 if(!config)throw Error('Disposable fixture configuration required')
 const client=createClient('http://127.0.0.1:18000',config.key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})
 const login=await client.auth.signInWithPassword({email:'collector-ci-a@example.test',password:'Ci-disposable-fixture-4826!'})
 if(login.error||!login.data.user)throw Error('Disposable sign-in failed')
 const result=await client.from('items').insert({owner_id:login.data.user.id,title:'Synthetic sale acceptance',status:'CATALOGUED',currency:'GBP',acquisition_currency:'GBP',acquisition_price:20.50,...config.item}).select('id,owner_id,status').single()
 if(result.error)throw Error(result.error.message)
 window.__CI_SALE_CLIENT__=client;window.__CI_SALE_ITEM__=result.data.id
 function Fixture(){
  const [id,select]=useState(result.data.id)
  const [editor,setEditor]=useState({...result.data,title:'Unsaved private edit'})
  window.__CI_SALE_SELECT__=select
  return <><p data-testid="collection-status">Editor status: {editor.status} · {editor.title}</p><RecordSaleOutcome client={client} itemId={id} onSold={(itemId,ownerId)=>setEditor(current=>applyConfirmedSaleStatus(current,itemId,ownerId)!)}/></>
 }
 createRoot(document.getElementById('sale-fixture')!).render(<Fixture/>)
}
void boot().catch(error=>{document.getElementById('sale-fixture')!.textContent=`Disposable fixture failed: ${error.message}`})
