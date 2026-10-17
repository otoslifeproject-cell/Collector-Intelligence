// No third-party image is accepted unless its provider documents reuse rights.
// This helper is used for the Met Museum isPublicDomain=true, CC0 record set.
export function safeMetImage(url:any):string|null{
 if(typeof url!=='string')return null
 try{
  const u=new URL(url)
  if(u.protocol!=='https:'||u.hostname!=='images.metmuseum.org'
    ||!/^\/[A-Za-z0-9_./%()!~-]+\.(jpg|jpeg|png)$/i.test(u.pathname))
   return null
  return u.toString()
 }catch{return null}
}
export function visualSearchTerm(material:string,title:string):string{
 const m=(material||'').trim()
 const rejectedMaterialWords=m.toLowerCase()==='metal'?/\b(glass|ceramic|pottery)\b/gi:m.toLowerCase()==='glass'?/\b(metal|ceramic|pottery)\b/gi:/\b___none___\b/g
 const words=(title||'').replace(rejectedMaterialWords,' ').replace(/[^\p{L}\p{N}\s-]/gu,' ')
  .replace(/\b(matched|matching|left|right|example|pair|possibly|vessel|sculptural)\b/gi,' ')
  .replace(/\s+/g,' ').trim().split(' ').filter(Boolean).slice(0,7).join(' ')
 if(m&&!words.toLowerCase().includes(m.toLowerCase()))return (m+' '+words).trim().slice(0,100)
 return words.slice(0,100)||m.slice(0,100)
}
