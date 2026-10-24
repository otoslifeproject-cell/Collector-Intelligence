import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../../supabase/migrations/20261020_canonical_publication_ledger_PREPRODUCTION.sql',import.meta.url),'utf8');
const checks=[
 ['explicit preproduction marker',()=>assert.match(sql,/PREPRODUCTION DESIGN ONLY/)],
 ['balanced PLpgSQL dollar quotations',()=>assert.equal((sql.match(/\$\$/g)||[]).length,6)],
 ['three trigger function bodies',()=>assert.equal((sql.match(/RETURNS trigger LANGUAGE plpgsql/g)||[]).length,3)],
 ['prevents owner-key cross-links',()=>assert.match(sql,/FOREIGN KEY\(event_id,owner_id,document_key\)/)],
 ['immutable audit events',()=>assert.match(sql,/BEFORE UPDATE OR DELETE\s+ON public\.ci_canonical_publication_events/)],
 ['source hash re-computed',()=>assert.match(sql,/digest\(convert_to\(d\.content,'UTF8'\),'sha256'\)/)],
 ['governing Master pinned',()=>assert.match(sql,/4237146b7142b62f9bc423fcbbb42d3205899eef67ca8135cf7dc066904292a2/)],
 ['governing Evidence Policy pinned',()=>assert.match(sql,/1eeab79c9ac903ff7ca69b6dcf15f9c38a9e2a273698e910c7926dd60e74b7e4/)],
 ['RLS enabled on events',()=>assert.match(sql,/ALTER TABLE public\.ci_canonical_publication_events ENABLE ROW LEVEL SECURITY/)],
 ['RLS enabled on pointers',()=>assert.match(sql,/ALTER TABLE public\.ci_canonical_active_approvals ENABLE ROW LEVEL SECURITY/)],
 ['no automatic approval seed',()=>assert.doesNotMatch(sql,/INSERT\s+INTO\s+public\.ci_canonical_(publication_events|active_approvals)/i)],
 ['transaction boundaries present',()=>{assert.match(sql,/^BEGIN;/m);assert.match(sql,/COMMIT;\s*$/)}],
 ['no historical source delete',()=>assert.doesNotMatch(sql,/DELETE\s+FROM\s+public\.canonical_documents/i)],
];
let count=0;
for(const [name,check] of checks){check();count++;console.log('PASS',name)}
console.log(`${count} static migration guard assertions passed; NOT PostgreSQL execution`);
