// Fail-closed migration preflight: performs NO connections and NO writes.
// Actual DDL integration remains a separate isolated-database task.
import {readFileSync} from 'node:fs';
import {assertIsolatedDatabaseConfig} from './validate-staging-target.mjs';
const sql=readFileSync(new URL('../supabase/migrations/20261020_canonical_publication_ledger_PREPRODUCTION.sql',import.meta.url),'utf8');
export function checkMigrationSafety(text){
 if(!/PREPRODUCTION DESIGN ONLY/.test(text))throw new Error('Not marked preproduction');
 if(!/^BEGIN;\s/m.test(text)||!/COMMIT;\s*$/.test(text))throw new Error('Migration boundaries missing');
 if((text.match(/\bCOMMIT\s*;/gi)||[]).length!==1)throw new Error('Unexpected commit count');
 if(/\b(DELETE|TRUNCATE)\s+(FROM\s+)?public\.canonical_documents\b/i.test(text))throw new Error('Destructive canonical source statement');
 if(!/ci_publication_events_immutable/.test(text))throw new Error('Missing immutable event protection');
 if(!/ci_active_matching_event_fk/.test(text))throw new Error('Missing owner matching');
 return {hasEmbeddedCommit:true,readyForTransactionalWrapper:false};
}
const result=checkMigrationSafety(sql);
if(import.meta.url===new URL('file://'+process.argv[1]).href){
 const url=process.env.CI_STAGING_DATABASE_URL;
 if(url)assertIsolatedDatabaseConfig(url,process.env.CI_ISOLATED_STAGING_CONFIRMED);
 console.log('PASS: static SQL preflight; no database connection. Embedded COMMIT blocks naive rollback wrapper.',result);
}
