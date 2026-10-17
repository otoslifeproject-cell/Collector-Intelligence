import type {ReactNode} from 'react'
import {Info} from 'lucide-react'

// Explanatory and historical context stays discoverable without crowding the task.
// Native details works by keyboard and touch as well as mouse; no hover dependency.
export default function InfoDisclosure({label='Info',children,warning=false}:{label?:string;children:ReactNode;warning?:boolean}){
 return <details className={'ci-info-disclosure'+(warning?' ci-info-warning':'')}>
  <summary><Info size={15} aria-hidden="true"/><span>{label}</span></summary>
  <div className="ci-info-disclosure-body">{children}</div>
 </details>
}
