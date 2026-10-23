import type {Comparable} from '../types'
import {money} from '../lib/format'
import {classifyComparables,evidenceUrl} from '../lib/comparableEvidence'
export default function ComparableEvidence({rows,trustedIds=[],error}:{rows:Comparable[];trustedIds?:string[];error?:string}){
 const results=classifyComparables(rows),verified=results.filter(x=>x.verified&&trustedIds.includes(x.row.id))
 return <section className="panel" aria-label="Comparable evidence quality">
  <div className="panelHeader"><h2>Comparable sale evidence</h2><span>{verified.length} / {results.length} sale records verified</span></div>
  <p className="ci-page-meta">Complete source reviews require a matching owner review and independently archived source check. Recorded labels alone do not qualify. Hammer, premium-inclusive totals, confirmed sales, estimates and asking prices stay separate. Maker and physical comparability still require review.</p>
  {error?<p role="alert">Comparable history could not be verified. Reload saved research history.</p>:results.length===0?<p>No comparable records yet. Market value and venue cannot be validated from asking prices alone.</p>:
  <div className="tableWrap"><table><thead><tr><th>Source</th><th>Sale basis</th><th>Price</th><th>Evidence assessment</th></tr></thead><tbody>
   {results.map(({row,verified,reason})=><tr key={row.id}><td>{evidenceUrl(row.source_url)?<a href={row.source_url} target="_blank" rel="noopener noreferrer">{row.venue||'Source'} ↗</a>:row.venue||'Unspecified'}<div className="ci-page-meta">{row.description||'No description'}</div><details><summary>Lot and source details</summary><p>{row.source_reference||'Reference not recorded'} · lot {row.lot_item_id||'not recorded'} · checked {row.date_checked||'not recorded'}</p><p>{row.maker_attribution||'Maker unconfirmed'} · {row.dimensions||'Dimensions missing'} · {row.condition_summary||'Condition missing'}</p><p>{row.notes}</p></details></td><td>{row.price_type||'Unspecified'}<div>{row.sale_date||'Undated'}</div></td><td>{row.price===null?'Unknown':row.currency?money(row.price,row.currency):`${row.price} (currency unknown)`}</td><td>{verified&&trustedIds.includes(row.id)?'Source-reviewed achieved sale':verified?'Recorded direct status — independent review receipt unavailable':reason}</td></tr>)}
  </tbody></table></div>}
  <p className="ci-page-meta">A sale-route recommendation also needs a current fee schedule, condition check, comparable adjustment and shipping economics. No marketplace listing is submitted by this panel.</p>
 </section>
}
