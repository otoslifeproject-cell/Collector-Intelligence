import InfoDisclosure from './InfoDisclosure'
import type {ReactNode} from 'react'

type Action={label:string;onClick:()=>void;disabled?:boolean;loading?:boolean}
type Props={
 eyebrow?:string;title:string;description?:string;primary:Action
 selector?:ReactNode;secondary?:ReactNode;note?:ReactNode;children?:ReactNode
}
export default function WorkspaceActionPanel({
 eyebrow,title,description,primary,selector,secondary,note,children
}:Props){
 return <section className="panel ci-workspace-action-panel" aria-label={title}>
  <div className="ci-workspace-action-copy">
   {eyebrow&&<div className="eyebrow">{eyebrow}</div>}
   <h2>{title}</h2>
   {description&&<p>{description}</p>}
  </div>
  {selector&&<div className="ci-workspace-action-select">{selector}</div>}
  <div className="ci-workspace-action-controls">
   <button type="button" className="primaryButton" disabled={primary.disabled}
    aria-busy={!!primary.loading} onClick={primary.onClick}>{primary.label}</button>
   {secondary}
  </div>
  {note&&<InfoDisclosure label="About this action">{note}</InfoDisclosure>}
  {children&&<div className="ci-workspace-action-extra">{children}</div>}
 </section>
}
