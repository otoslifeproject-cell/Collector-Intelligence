import type {Comparable} from '../types'
import {money} from '../lib/format'
const sold=new Set(['AUCTION_REALIZED','AUCTION_REALISED','MARKETPLACE_SOLD','SOLD'])
const confirmed=new Set(['VERIFIED','SOURCE_VERIFIED','CONFIRMED'])
export function classifyComparables(rows:Comparable[]){
 return rows.map(row=>{
  const basis=String(row.price_type||'').trim().toUpperCase()
  const status=String(row.verification_status||'').trim().toUpperCase()
  const isSold=sold.has(basis)
  const exact=Number.isFinite(row.price)&&row.price!==null&&row.price>=0
  const source=typeof row.source_url==='string'&&/^https:\/\/[^\s]+$/i.test(row.source_url)
  const verified=isSold&&confirmed.has(status)&&exact&&source&&!!row.sale_date&&!!row.currency
  return {row,verified,reason:verified?'Verified sale basis recorded':!isSold?'Not a recognised achieved-sale classification':!confirmed.has(status)?'Sale verification not confirmed':!source?'Missing traceable source URL':!row.sale_date?'Missing sale date':!row.currency?'Missing currency':'Missing numeric achieved price'}
 })
}
export default function ComparableEvidence({rows}:{rows:Comparable[]}){
 const results=classifyComparables(rows),verified=results.filter(x=>x.verified)
 return <section className="panel" aria-label="Comparable evidence quality">
  <div className="panelHeader"><h2>Comparable sale evidence</h2><span>{verified.length} / {results.length} sale records verified</span></div>
  <p className="ci-page-meta">Existing catalogue comparable records only. A verified row requires achieved-sale classification, confirmed verification status, sale date, currency, price and a traceable source URL. This does not independently authenticate source contents or the object's maker.</p>
  {results.length===0?<p>No comparable records yet. Market value and venue cannot be validated from asking prices alone.</p>:
  <div className="tableWrap"><table><thead><tr><th>Source</th><th>Sale basis</th><th>Price</th><th>Evidence assessment</th></tr></thead><tbody>
   {results.map(({row,verified,reason})=><tr key={row.id}><td>{row.source_url?.startsWith('https://')?<a href={row.source_url} target="_blank" rel="noopener noreferrer">{row.venue||'Source'} ↗</a>:row.venue||'Unspecified'}<div className="ci-page-meta">{row.description||'No description'}</div></td><td>{row.price_type||'Unspecified'}<div>{row.sale_date||'Undated'}</div></td><td>{row.price===null?'Unknown':money(row.price,row.currency||'GBP')}</td><td>{verified?'Recorded as verified achieved sale':reason}</td></tr>)}
  </tbody></table></div>}
  <p className="ci-page-meta">A sale-route recommendation also needs a current fee schedule, condition check, comparable adjustment and shipping economics. No marketplace listing is submitted by this panel.</p>
 </section>
}
