import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { assertIsolatedDatabaseConfig } from './validate-staging-target.mjs';
const url=process.env.CI_STAGING_DATABASE_URL;
assertIsolatedDatabaseConfig(url,process.env.CI_ISOLATED_STAGING_CONFIRMED);
if(process.env.CI_ALLOW_STAGING_DDL!=='yes')throw new Error('CI_ALLOW_STAGING_DDL=yes required');
const {default:pg}=await import('pg');
const client=new pg.Client({connectionString:url,connectionTimeoutMillis:5000});
try {
 await client.connect();
 const identity=await client.query("select current_database() as db,inet_server_addr()::text as server_address,current_user as role");
 if(!identity.rows[0].db.startsWith('ci_staging_'))throw new Error('Refused non-staging database');
 const migration=await readFile(resolve('supabase/migrations/20261020_canonical_publication_ledger_PREPRODUCTION.sql'),'utf8');
 // The proposal has BEGIN/COMMIT. Run within a session and ALWAYS reverse by explicit rollback
 // instead of relying on a wrapper transaction whose COMMIT the script could escape.
 throw new Error('NOT READY: migration has embedded COMMIT; require reviewed disposable-schema isolation and cleanup before execution');
} finally { await client.end().catch(()=>{}) }
