import {useMemo,useState} from 'react'
import {formatProvisionalDraftHandoff} from '../lib/provisionalDraftHandoff'
import type {ProvisionalObject} from '../lib/provisionalDraftHandoff'

type Props={
  runId:string
  index:number
  object:ProvisionalObject
  photoIndices:number[]
  reviewedCondition?:string
}
export default function ProvisionalDraftHandoff({runId,index,object,photoIndices,reviewedCondition}:Props){
  const [status,setStatus]=useState('')
  const pack=useMemo(()=>{
    try{return formatProvisionalDraftHandoff({runId,index,object,photoIndices,reviewedCondition})}
    catch{return null}
  },[runId,index,object,photoIndices.join(','),reviewedCondition])
  const copy=async()=>{
    if(!pack)return
    try{
      if(typeof navigator.clipboard?.writeText!=='function')throw Error('Unavailable')
      await navigator.clipboard.writeText(pack.text)
      setStatus('Provisional seller text copied. Review and edit before any listing; nothing published.')
    }catch{setStatus('Clipboard unavailable. Select the text below to copy, or download the file. Nothing published.')}
  }
  const download=()=>{
    if(!pack)return
    const data=new Blob([pack.text+'\n'],{type:'text/plain;charset=utf-8'})
    const url=URL.createObjectURL(data)
    const link=document.createElement('a')
    link.href=url
    link.download='saved-report-'+runId.slice(0,8)+'-object-'+(index+1)+'-seller-review.txt'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    setStatus('Provisional seller review downloaded. Original photos were not exported. Nothing published.')
  }
  return <details className="panel ci-provisional-handoff">
    <summary>Prepare provisional seller copy · no charge</summary>
    <p className="ci-page-meta">Uses this saved report and its original photo mapping. Does not rerun AI, claim a verified maker or sold price, save a catalogue item, or post a listing. Physical checks and owner approval remain necessary.</p>
    {!pack?<p role="alert">Original photograph mapping is incomplete. Confirm it before preparing seller copy.</p>:<>
      <p><strong>Draft title:</strong> {pack.title}</p>
      <p><strong>Price:</strong> No verified sold comps found · asking price not established.</p>
      <div className="ci-page-actions">
        <button type="button" className="secondaryButton" onClick={()=>void copy()}>Copy review draft</button>
        <button type="button" className="secondaryButton" onClick={download}>Download review draft</button>
      </div>
      {status&&<p role="status">{status}</p>}
      <label>Copyable draft text
        <textarea readOnly value={pack.text} rows={12} onFocus={e=>e.currentTarget.select()}/>
      </label>
    </>}
  </details>
}
