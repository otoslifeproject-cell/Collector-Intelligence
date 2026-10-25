// Read-only verification of the exact saved owner-photo scope before ANY paid model dispatch.
// A request filename/index never authorises a client-supplied URL or changing saved notes.
export type IntakeSourcePhoto={index:number;file_name:string;storage_path:string;sha256:string;byte_count:number}
type IncomingPhoto={index:unknown;fileName:unknown;url?:unknown}
type SavedRun={id:string;owner_id:string;mode:string;status:string;input_photo_count:number;user_context:unknown;result?:{image_manifest?:unknown;analysis_stage?:unknown;objects?:unknown}}
export function bindSavedIntakePhotos(saved:SavedRun, submitted:unknown, mode:unknown, storageOrigin:string):IntakeSourcePhoto[]{
 if(!saved||saved.status!=='DRAFT'||saved.mode!==mode||!['single','batch'].includes(String(mode)))throw Error('Saved photo session unavailable or mode changed');
 if(!Array.isArray(submitted)||submitted.length<1||submitted.length>(mode==='single'?20:40)||saved.input_photo_count!==submitted.length)throw Error('Saved photo count differs from the selected images');
 const manifest=saved.result?.image_manifest;
 if(!Array.isArray(manifest)||manifest.length!==submitted.length)throw Error('Saved photo manifest missing or has wrong count');
 const seen=new Set<number>(),requests=new Set<number>();
 const prefix=saved.owner_id+'/intake/'+saved.id+'/';
 const photos:IntakeSourcePhoto[]=[];
 for(const item of manifest){
  if(!item||typeof item!=='object')throw Error('Invalid saved photograph');
  const p=item as IntakeSourcePhoto;
  if(!Number.isSafeInteger(p.index)||p.index<0||p.index>=manifest.length||seen.has(p.index))throw Error('Duplicate or missing saved photo index');
  if(typeof p.file_name!=='string'||!p.file_name.length||typeof p.storage_path!=='string'||!p.storage_path.startsWith(prefix)||p.storage_path.slice(prefix.length).includes('/')||p.storage_path===prefix)throw Error('Saved original is not inside the owner photo session');
  if(typeof p.sha256!=='string'||!/^[0-9a-f]{64}$/i.test(p.sha256)||!Number.isSafeInteger(p.byte_count)||p.byte_count<1||p.byte_count>26214400)throw Error('Saved original has no usable byte/hash identity');
  seen.add(p.index);photos.push(p);
 }
 for(const item of submitted){
  if(!item||typeof item!=='object')throw Error('Invalid requested image');
  const p=item as IncomingPhoto;
  if(!Number.isSafeInteger(p.index)||!seen.has(p.index)||requests.has(p.index))throw Error('Duplicate or missing requested photo index');
  const original=photos.find(x=>x.index===p.index);
  if(!original||p.fileName!==original.file_name)throw Error('Requested photograph does not match the saved original');
  // Reject swapped/private-link substitutions as well as offsite URLs.
  // The provider still receives only fresh server-signed links.
  try{
    if(typeof p.url!=='string')throw Error('Missing private image link');
    const submittedURL=new URL(p.url),expectedURL=new URL(storageOrigin);
    const prefix='/storage/v1/object/sign/item-images/';
    if(submittedURL.origin!==expectedURL.origin||!submittedURL.pathname.startsWith(prefix)||
       decodeURIComponent(submittedURL.pathname.slice(prefix.length))!==original.storage_path||
       !submittedURL.searchParams.has('token'))throw Error('Requested signed photo URL differs from the saved original');
  }catch{throw Error('Requested signed photo URL differs from the saved original')}
  requests.add(p.index);
 }
 if(requests.size!==seen.size||saved.result?.analysis_stage!=='UPLOADED'||Array.isArray(saved.result?.objects)&&saved.result.objects.length>0)throw Error('Saved photograph session already progressed; recover the original result instead');
 if(!saved.user_context||typeof saved.user_context!=='object'||Array.isArray(saved.user_context))throw Error('Saved owner notes missing');
 return photos.sort((a,b)=>a.index-b.index);
}

// Saved notes must remain the authoritative facts in all provider passes.
// Incoming numeric fields are normalised only because the browser converts them
// to Number/null after persisting the original form strings.
export function bindSavedIntakeContext(saved:unknown,submitted:unknown):Record<string,unknown>{
 if(!saved||typeof saved!=='object'||Array.isArray(saved)||!submitted||typeof submitted!=='object'||Array.isArray(submitted))
  throw Error('Saved owner notes unavailable');
 const actual=saved as Record<string,unknown>,incoming=submitted as Record<string,unknown>;
 for(const key of ['currency','dimensions','storage_location','user_notes']){
  if(String(actual[key]??'')!==String(incoming[key]??''))throw Error('Incoming owner notes differ from the saved intake');
 }
 for(const key of ['purchase_price','weight_g']){
  const a=actual[key],b=incoming[key];
  if((a==null||a==='')&&(b==null||b===''))continue;
  if(a==null||a===''||b==null||b===''||!Number.isFinite(Number(a))||!Number.isFinite(Number(b))||Number(a)!==Number(b))
   throw Error('Incoming owner measurements differ from the saved intake');
 }
 return {...actual};
}
