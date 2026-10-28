export type ProvisionalObject = {
  working_title?: unknown
  object_type?: unknown
  colour?: unknown
  material?: unknown
  maker?: unknown
  designer?: unknown
  condition_summary?: unknown
  marks_signatures_labels?: unknown
}
export type DraftHandoffInput = {
  runId: string
  index: number
  object: ProvisionalObject
  photoIndices: number[]
  reviewedCondition?: string
  isPair?: boolean
}
const safeText=(value:unknown,max=1500):string=>
  typeof value==='string'?value.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max):''
const firstClause=(value:unknown,max=70):string=>
  safeText(value,500).split(/[;,]|\b(?:with|including|based on|exact|unconfirmed|not independently)\b/i)[0].trim().slice(0,max)
const shortTitle=(obj:ProvisionalObject):string=>{
  // Use only generic colour/form, never maker, model, estimated date or attribution.
  const form=firstClause(obj.object_type,68)||'Collectable object'
  const colour=firstClause(obj.colour,32).replace(/^intrinsic(?:-looking)?\s+/i,'')
  let title=[colour,form].filter(Boolean).join(' ').replace(/\s+/g,' ').trim()
  if(title.length>80)title=form
  if(title.length>80)title=title.slice(0,80).replace(/\s+\S*$/,'')
  return title||'Collectable object'
}
export function formatProvisionalDraftHandoff(input:DraftHandoffInput):{title:string;text:string}{
  if(!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(input.runId)||
    !Number.isSafeInteger(input.index)||input.index<0||
    !Array.isArray(input.photoIndices)||!input.photoIndices.length||
    input.photoIndices.some(n=>!Number.isSafeInteger(n)||n<0)||
    new Set(input.photoIndices).size!==input.photoIndices.length)
    throw Error('A saved report and unambiguous original photo assignment are required.')
  const obj=input.object
  if(!obj||typeof obj!=='object')throw Error('Saved object unavailable.')
  const title=shortTitle(obj)
  const condition=safeText(input.reviewedCondition??obj.condition_summary,1750)
  const form=safeText(obj.object_type,350)
  const colour=safeText(obj.colour,300)
  const material=safeText(obj.material,350)
  const marks=safeText(obj.marks_signatures_labels,500)
  const sourceTitle=safeText(obj.working_title,180)
  const indexes=[...input.photoIndices].sort((a,b)=>a-b).map(n=>String(n+1)).join(', ')
  const electrical=/\b(lamp|light fitting|electrical|wiring|socket)\b/i.test([form,sourceTitle].join(' '))
  const fluorescence=/\b(uranium|ultraviolet|fluorescen|UV)\b/i.test([material,sourceTitle].join(' '))
  const lines=[
    'COLLECTOR INTELLIGENCE — PROVISIONAL SELLER COPY',
    'REVIEW REQUIRED · NOT PUBLISHED · NO AUTOMATIC MARKETPLACE UPLOAD',
    '',
    'SOURCE',
    'Saved report: '+input.runId+' · object '+(input.index+1)+(input.isPair?' · proposed combined pair':''),
    'Original AI working title (not authenticated): '+(sourceTitle||'Not recorded'),
    'Original photo positions (1-based): '+indexes,
    'Photographs remain in the private report. Inspect and select them before listing; no temporary photo links are exported.',
    '',
    'SUGGESTED GENERIC TITLE — CHECK AGAINST THE OBJECT',
    title,
    '',
    'DRAFT DESCRIPTION — REVIEW EVERY CLAIM',
    'Unattributed collectable object. The photographs suggest the form: '+(form||'not independently identified')+'.',
    'Apparent colour: '+(colour||'not established')+'.',
    'Reported possible material: '+(material||'not established')+'. Composition has not been independently verified.',
    'Photographic condition observations only (not a substitute for physical inspection): '+(condition||'No condition observation recorded. Inspect before advertising')+'.',
    'Marks/labels: '+(marks||'No independently verified maker mark or label')+'. No attribution is authenticated by the photographs.',
    'Maker, designer, place and date: UNCONFIRMED. Do not use an unsupported maker or period as a selling claim.',
    'Dimensions and weight: TO MEASURE AND CONFIRM.',
    ...(electrical?['Electrical safety and working status: UNKNOWN. Do not advertise as working or safe without appropriate checks.']:[]),
    ...(fluorescence?['UV fluorescence does not by itself establish uranium content, period or maker. Do not claim uranium glass without separate evidence.']:[]),
    '',
    'PRICING AND SELLING',
    'No verified sold comps found.',
    'Asking price: NOT ESTABLISHED. Earlier AI estimates are not verified achieved sale prices.',
    'Venue, category, fees, packing, insurance and shipping: TO CONFIRM.',
    'Seller net proceeds: NOT ESTABLISHED.',
    '',
    'BEFORE ANY PUBLIC LISTING',
    '1. Confirm the correct original photographs and that these depict this exact object.',
    '2. Examine condition, marks, dimensions and any material or electrical concerns.',
    '3. Verify source-backed identity and actual sold comparables, or retain generic wording.',
    '4. Choose an owner-approved asking price and selling route with real costs.',
    '5. Save the item to the permanent catalogue and verify it can be re-opened.',
    '6. Edit and approve the listing yourself. This draft has not been published.',
  ]
  return {title,text:lines.join('\n')}
}
