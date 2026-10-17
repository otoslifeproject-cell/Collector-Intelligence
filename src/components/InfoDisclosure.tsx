import type {ReactNode} from 'react'
import {Info} from 'lucide-react'

// Explanatory and historical context stays discoverable without crowding the task.
// Native details works by keyboard and touch as well as mouse; no hover dependency.
export default function InfoDisclosure({label='Info',children,warning=false,showLabel=false}:{label?:string;children:ReactNode;warning?:boolean;showLabel?:boolean}){
 return <details className={'ci-info-disclosure'+(warning?' ci-info-warning':'')+(showLabel?' ci-info-show-label':' ci-info-icon-only')}>
  <summary aria-label={label} title={label}><Info size={16} aria-hidden="true"/><span className={showLabel?'':'sr-only'}>{label}</span></summary>
  <div className="ci-info-disclosure-body">{children}</div>
 </details>
}
