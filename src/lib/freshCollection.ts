// Launch-boundary view filter. Preserves all existing rows and evidence unchanged.
// Pre-launch records remain available from Archive; fresh rows are never hidden.
export const FRESH_START_AT='2026-10-28T14:25:00.000Z'
export function isLegacyCreatedAt(date:string|null|undefined):boolean{
 const time=Date.parse(String(date||''))
 // Unreadable creation times are never silently treated as a brand-new object.
 return !Number.isFinite(time)||time<Date.parse(FRESH_START_AT)
}
export function isActiveCollectionItem(row:{created_at?:string|null;status?:string|null}):boolean{
 return !isLegacyCreatedAt(row.created_at)&&row.status!=='ARCHIVED'
}
