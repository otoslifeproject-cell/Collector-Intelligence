// Official V&A IIIF images are reference illustrations, never authentication.
export function vamImageFromRecord(record:any):string|null{
 const id=record?._primaryImageId
 if(typeof id==='string'&&/^[A-Za-z0-9_-]{5,60}$/.test(id))
  return 'https://framemark.vam.ac.uk/collections/'+id+'/full/!480,480/0/default.jpg'
 const thumbnail=record?._images?._primary_thumbnail
 if(typeof thumbnail!=='string')return null
 try{
  const u=new URL(thumbnail)
  if(u.protocol!=='https:'||u.hostname!=='framemark.vam.ac.uk'
    ||!/^\/collections\/[A-Za-z0-9_-]+\/full\/![0-9]+,[0-9]+\/0\/default\.jpg$/.test(u.pathname))
   return null
  return u.toString()
 }catch{return null}
}
export function visualSearchTerm(material:string,title:string):string{
 const m=(material||'').trim()
 const rejectedMaterialWords=m.toLowerCase()==='metal'?/\b(glass|ceramic|pottery)\b/gi:m.toLowerCase()==='glass'?/\b(metal|ceramic|pottery)\b/gi:/\b___none___\b/g
 const words=(title||'').replace(rejectedMaterialWords,' ').replace(/[^\p{L}\p{N}\s-]/gu,' ').replace(/\b(matched|matching|left|right|example|pair|possibly|vessel|sculptural)\b/gi,' ')
  .replace(/\s+/g,' ').trim().split(' ').filter(Boolean).slice(0,7).join(' ')
 if(m&&!words.toLowerCase().includes(m.toLowerCase()))return (m+' '+words).trim().slice(0,100)
 return words.slice(0,100)||m.slice(0,100)
}
