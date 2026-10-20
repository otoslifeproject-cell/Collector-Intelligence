#!/usr/bin/env node
// STAGING ONLY. Refuses production Collector Intelligence database by project reference.
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const prod='bwdafrwkimjvwfoqomot';
const input=process.env.CI_STAGING_DATABASE_URL;
if(!input)throw new Error('CI_STAGING_DATABASE_URL required: no connection attempted');
let uri;try{uri=new URL(input)}catch{throw new Error('Invalid database URL')}
if(!['postgres:','postgresql:'].includes(uri.protocol))throw new Error('Expected PostgreSQL URL');
if(uri.hostname.includes(prod))throw new Error('REFUSED production Supabase project');
if(process.env.CI_ISOLATED_STAGING_CONFIRMED!=='yes')throw new Error('Explicit isolated staging confirmation required');
const {default:pg}=await import('pg');
const client=new pg.Client({connectionString:input,connectionTimeoutMillis:5000});
try {
 await client.connect();
 const db=(await client.query('select current_database() as name')).rows[0].name;
 const sql=await readFile(resolve('tests/continuity/staging-ledger-catalog-check.sql'),'utf8');
 await client.query('BEGIN READ ONLY');
 try{await client.query(sql)}finally{await client.query('ROLLBACK')}
 console.log('Catalog checks passed in isolated staging:',db);
 console.log('NOT a two-owner authenticated RLS test');
} finally{await client.end().catch(()=>{})}
