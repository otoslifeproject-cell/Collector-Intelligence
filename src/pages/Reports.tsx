import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Reports() {
  const [message,setMessage]=useState('')
  const exportCatalogue = async () => {
    const {data,error} = await supabase.from('external_catalogue').select('*').order('item_code')
    if (error) return setMessage(error.message)
    const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href=url; a.download='collector-intelligence-catalogue.json'; a.click()
    URL.revokeObjectURL(url); setMessage('Catalogue export created.')
  }
  return <div><div className="pageHeader"><div className="eyebrow">OUTPUTS</div><h1>Reports & exports</h1><p>Create clean external outputs without exposing internal research notes.</p></div>
    <div className="reportGrid">
      <div className="panel"><h2>External catalogue</h2><p>Clean object-level catalogue data suitable for later PDF/auctioneer/dealer output.</p><button className="primaryButton inlineButton" onClick={exportCatalogue}>Export catalogue JSON</button></div>
      <div className="panel"><h2>Insurance schedule</h2><p>Next build: selected photographs, dimensions, attribution and current value range.</p><button className="secondaryButton" disabled>Coming next</button></div>
      <div className="panel"><h2>Sale-out report</h2><p>Next build: asking, achieved, fees, net, profit and days-to-sell.</p><button className="secondaryButton" disabled>Coming next</button></div>
    </div>{message&&<div className="saveToast">{message}</div>}</div>
}
