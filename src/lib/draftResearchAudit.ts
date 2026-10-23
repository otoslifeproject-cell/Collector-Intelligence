import type {CatalogueSource} from './catalogueApproval'
import type {DraftResearchRow} from './draftResearch'
import {itemResearchAudit} from './itemResearch.ts'
import type {ItemResearchHistory,ItemResearchRun} from './itemResearch'
import {auditResearch} from './researchSaleDecision.ts'
import type {ResearchReceipt} from './researchSaleDecision'

export type DraftSignatureAssessment={
 assigned:boolean;candidate:string|null;confidence:number|null;photoIndices:number[];detail:string
}
export type DraftResearchDashboard={
 audit:ReturnType<typeof auditResearch>;history:ItemResearchHistory;signature:DraftSignatureAssessment
 confidence?:{identification?:number|null;dating?:number|null;valuation?:number|null}
}
const plain=(v:any)=>v!==null&&typeof v==='object'&&!Array.isArray(v)
const text=(v:unknown)=>typeof v==='string'&&v.trim()?v.trim():null
const score=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=100?v:null
const indices=(v:unknown):number[]=>Array.isArray(v)&&v.length>0&&v.every(n=>Number.isInteger(n)&&n>=0)?[...new Set(v)]:[]

// A global second look can mention several photographs/objects. It is assigned
// to one physical piece only when every cited photo belongs exclusively to it.
// In particular a photograph of both bases cannot authenticate either mark.
export function draftSignatureAssessment(source:CatalogueSource,index:number,paired=false):DraftSignatureAssessment{
 const objects=Array.isArray(source.result?.objects)?source.result.objects:[]
 const review=source.result?.inscription_review,object=objects[index]
 const empty={assigned:false,candidate:null,confidence:null,photoIndices:[]} as const
 if(paired)return {...empty,photoIndices:[],detail:'This is a two-piece lot. Read each physical mark separately below; lot-level research does not authenticate either maker signature.'}
 if(!object)return {...empty,photoIndices:[],detail:'The original physical object could not be assigned.'}
 if(!plain(review))return {...empty,photoIndices:[],detail:text(object.marks_signatures_labels)
  ?'Original object notes mention a mark. No separate image-scoped transcription receipt is stored; preserve those notes as unverified.'
  :'No separately scoped inscription receipt is stored for this physical object.'}
 const refs=indices(review.evidence_image_indices),own=new Set(indices(object.image_indices))
 const unique=refs.length>0&&refs.every(n=>own.has(n)&&objects.every((other:any,i:number)=>i===index||!indices(other.image_indices).includes(n)))
 if(!unique)return {...empty,photoIndices:[],detail:'A saved report-wide inscription review exists, but its photographs touch multiple objects, are shared or are unassigned. Its reading and confidence have not been copied to this piece.'}
 const candidate=text(review.candidate_transcription)
 return {assigned:true,candidate,confidence:candidate?score(review.transcription_confidence):null,photoIndices:refs,
  detail:candidate?'Stored image-scoped candidate reading: '+candidate+'. This is provisional transcription, not maker authentication.':review.mark_visible===false
   ?'A stored image-scoped examination reported no readable mark. That is an unverified observation, not proof the piece is unsigned.'
   :'A stored image-scoped examination found a mark but did not retain a reliable reading.'}
}

// All source/history inputs have already been read through the existing owner-
// checked reader. Repeat the scope predicate here as a boundary check: a sibling
// or pair-lot run must never become the physical piece's research by accident.
export function draftResearchDashboard(source:CatalogueSource,rows:DraftResearchRow[],index:number,paired=false,error='',now=Date.now()):DraftResearchDashboard{
 const objects=Array.isArray(source.result?.objects)?source.result.objects:[]
 const valid=Number.isInteger(index)&&index>=0&&index<objects.length&&(!paired||(index===0&&source.mode==='single'&&objects.length===2))
 const foreign=rows.some(row=>row.owner_id!==source.owner_id||row.mode!=='research'||row.user_context?.source_analysis_run_id!==source.id)
 const runs=rows.filter(row=>row.owner_id===source.owner_id&&row.mode==='research'&&row.user_context?.source_analysis_run_id===source.id&&
  row.user_context?.source_object_index===index&&JSON.stringify(row.user_context?.pair_source_indices??[])===(paired?'[0,1]':'[]'))
  .map(row=>({...row,status:(row as any).status||'DRAFT',input_photo_count:(row as any).input_photo_count??0}) as ItemResearchRun)
  .sort((a,b)=>b.created_at.localeCompare(a.created_at)||b.id.localeCompare(a.id))
 const signature=draftSignatureAssessment(source,index,paired)
 const result={...source.result}
 // Never expose a report-wide mark as an object-level execution to the generic audit.
 delete result.inscription_review;delete result.inscription_review_status
 if(signature.assigned)result.inscription_review=source.result.inscription_review
 const original:ItemResearchRun={...source,model:(source as any).model??null,result}
 const history:ItemResearchHistory={runs,original,paired,lineageUnresolved:!valid}
 const base=itemResearchAudit(history,[],now)
 let receipts=base.receipts.map(receipt=>({...receipt}))
 if(valid){
  const at=receipts.findIndex(receipt=>receipt.type==='SIGNATURE_READING')
  const hasGlobal=plain(source.result?.inscription_review)||!!source.result?.inscription_review_status&&source.result.inscription_review_status!=='NOT_TRIGGERED'
  const status=signature.assigned?'INCONCLUSIVE':hasGlobal?'RECEIPT_MISSING':source.result?.inscription_review_status==='NOT_TRIGGERED'&&!runs.length?'NOT_RUN':receipts[at].status
  receipts[at]={type:'SIGNATURE_READING',status,runId:source.id,checkedAt:source.created_at,
   detail:signature.detail,confidence:signature.confidence,
   sourceRefs:signature.photoIndices.map(n=>`Original report ${source.id}, photograph ${n+1}`)} as ResearchReceipt
 }
 if(error||foreign||!valid)receipts=receipts.map(receipt=>({...receipt,status:'BLOCKED',detail:error||(!valid
  ?'This original object/pair scope is invalid. Earlier research cannot be safely assigned.'
  :'Research history included another owner or report. Reload the complete original history before using it.')}))
 const object=objects[index]
 const confidence=paired||!object?undefined:{identification:score(object.identification_confidence),dating:score(object.dating_confidence),valuation:score(object.valuation_confidence)}
 return {audit:auditResearch(receipts),history,signature,confidence}
}
