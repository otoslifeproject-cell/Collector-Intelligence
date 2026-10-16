// A matched pair is two distinct physical pieces, but is normally one inventory/sale lot.
// This function proposes grouping ONLY for explicit left/right matching language.
// It never authenticates maker, age, condition or independent value.
export type PairProposal = {indices:[0,1];title:string}
export function suggestSingleIntakePair(objects:any[],mode:string):PairProposal|null {
 if(mode!=='single'||!Array.isArray(objects)||objects.length!==2)return null
 const a=String(objects[0]?.working_title||'').toLowerCase()
 const b=String(objects[1]?.working_title||'').toLowerCase()
 if(!/\bmatching\b|\bmatched\b/.test(a+' '+b))return null
 const left=/\bleft\b/.test(a)&&/\bright\b/.test(b)
 const right=/\bright\b/.test(a)&&/\bleft\b/.test(b)
 if(!left&&!right)return null
 const trim=(s:string)=>s.replace(/\b(matching|matched)\b/g,'').replace(/[—–-]\s*(left|right)\s*(example|vase|piece|item)?/g,'')
  .replace(/\b(left|right)\s+(example|piece|item)\b/g,'').replace(/\s+/g,' ').trim()
 const common=trim(a),other=trim(b)
 const aw=new Set(common.split(/\W+/).filter(w=>w.length>3))
 const bw=new Set(other.split(/\W+/).filter(w=>w.length>3))
 if([...aw].filter(w=>bw.has(w)).length<2)return null
 const label=common.length<=90?common:'matching collectible objects'
 return {indices:[0,1],title:'Matched pair of '+label}
}
