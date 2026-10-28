// A Supabase run identifier is five UUID groups: 8-4-4-4-12.
// This single validator is shared by private stop auditing and the paid gate.
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function validIntakeRunId(value:unknown):value is string {
 return typeof value==='string' && uuid.test(value)
}
