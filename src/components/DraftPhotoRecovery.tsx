import {useState} from 'react'
import {supabase} from '../lib/supabase'

export default function DraftPhotoRecovery({run}:{run:any}) {
  const [message,setMessage]=useState('')
  const [images,setImages]=useState<string[]>([])
  const [busy,setBusy]=useState(false)
  const search=async()=>{
    setBusy(true);setImages([]);setMessage('')
    try{
      const {data:{user}}=await supabase.auth.getUser()
      if(!user)throw Error('Sign in required')
      const bucket=supabase.storage.from('item-images')
      const {data:folders,error}=await bucket.list(user.id+'/intake',{limit:100})
      if(error)throw error
      const matches:string[][]=[]
      for(const folder of (folders||[]).filter(f=>!f.id)){
        const root=user.id+'/intake/'+folder.name
        const {data:files}=await bucket.list(root,{limit:100})
        const found=(files||[]).filter(f=>!!f.id && /^\d+-/.test(f.name))
        if(found.length!==run.input_photo_count)continue
        const signed=await Promise.all(found.slice(0,4).map(async f=>(await bucket.createSignedUrl(root+'/'+f.name,600)).data?.signedUrl||''))
        matches.push(signed.filter(Boolean))
      }
      setImages(matches.flat())
      setMessage(matches.length+' possible upload sessions match the photograph count. This does not establish which one belongs to the report. No files have been linked or changed.')
    }catch(e:any){setMessage(e?.message||'Photo lookup unavailable')}
    finally{setBusy(false)}
  }
  return <details style={{marginTop:12}}><summary style={{cursor:'pointer'}}>Locate older photos (preview only)</summary>
    <p style={{fontSize:12}}>Owner-only lookup. Never attaches photos based solely on counts.</p>
    <button className="secondaryButton" disabled={busy} onClick={search}>{busy?'Checking…':'Find possible photos'}</button>
    <p role="status">{message}</p>
    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{images.map((url,i)=><img key={i} src={url} alt={'Possible upload photograph '+(i+1)} style={{width:96,height:96,objectFit:'contain'}}/>)}</div>
  </details>
}
