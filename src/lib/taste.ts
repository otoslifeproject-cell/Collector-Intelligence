// "My sort of stuff" (Dean, 31 Oct): the owner saves searches or notes that show
// his taste. Kept in the Knowledge Brain as OWNER_TASTE; research reads them as
// a guide to where to look first, never as evidence for an item.
export function tasteFromInput(input:string):{claim:string;url:string|null}|null{
 const text=input.trim()
 if(!text)return null
 try{
  const u=new URL(text)
  if(!/^https?:$/.test(u.protocol))return null
  const q=u.searchParams.get('q')||u.searchParams.get('_nkw')||u.searchParams.get('vintage_rewrite')||u.searchParams.get('query')
  const words=(q||decodeURIComponent(u.pathname.split('/').filter(Boolean).pop()||'')).replace(/[+_-]+/g,' ').replace(/\s+/g,' ').trim()
  return {claim:'Owner taste ('+u.hostname.replace(/^www\./,'')+' search): '+(words||'saved link').slice(0,240),url:u.toString().slice(0,1000)}
 }catch{return {claim:'Owner taste: '+text.slice(0,300),url:null}}
}
