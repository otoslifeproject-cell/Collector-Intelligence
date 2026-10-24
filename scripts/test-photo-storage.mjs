#!/usr/bin/env node
// REAL disposable Storage byte acceptance. Never accepts a hosted DB/API URL.
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm,chmod} from 'node:fs/promises';
import {createHmac,randomBytes} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createClient} from '@supabase/supabase-js';
import {assertIsolatedDatabaseConfig} from './validate-staging-target.mjs';
import {continuityKongConfig} from './continuity-kong-config.mjs';
import {installReviewedAssessmentFixtures,seedReviewedAssessmentFixture} from './test-reviewed-item-assessments.mjs';
import {exercisePhotoStorage} from './test-photo-storage-cases.mjs';

const input=process.env.CI_STAGING_DATABASE_URL;
const target=assertIsolatedDatabaseConfig(input,process.env.CI_ISOLATED_STAGING_CONFIRMED);
const {default:pg}=await import('pg');
const admin=new pg.Client({connectionString:input,connectionTimeoutMillis:5000});
const exec=promisify(execFile),containers=[];
const API='http://127.0.0.1:18000',AUTH='http://127.0.0.1:19999',REST='http://127.0.0.1:13000',STORAGE='http://127.0.0.1:15000';
const secret=randomBytes(32).toString('hex');
function token(payload){const parts=[{alg:'HS256',typ:'JWT'},payload].map(x=>Buffer.from(JSON.stringify(x)).toString('base64url'));return parts.join('.')+'.'+createHmac('sha256',secret).update(parts.join('.')).digest('base64url');}
const anonKey=token({role:'anon',aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600});
const publishableKey='sb_publishable_'+randomBytes(24).toString('base64url');
const databaseURL=user=>{const u=new URL(input);u.username=user;u.password='ci_fixture_only';return u.href;};
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
async function docker(args){try{return await exec('docker',args,{timeout:180000,maxBuffer:2*1024*1024});}catch{throw Error('Disposable Docker operation failed; see diagnostics');}}
async function start(name,image,env,extra=[]){const container=`ci-photo-${name}-${process.pid}`;containers.push(container);await docker(['run','--detach','--name',container,'--network','host',...extra,...Object.entries(env).flatMap(([k,v])=>['--env',`${k}=${v}`]),image]);}
async function ready(url,predicate=r=>r.ok){for(let i=0;i<90;i++){try{if(predicate(await fetch(url,{signal:AbortSignal.timeout(1000)})))return;}catch{}await new Promise(r=>setTimeout(r,500));}throw Error('Disposable service readiness failed on port '+new URL(url).port);}
let directory,passed=0;
const check=async(name,fn)=>{await fn();passed++;console.log('PASS',name);};
try{
 await admin.connect();
 const meta=(await admin.query("select current_database() name,current_setting('server_version_num')::int version")).rows[0];assert.equal(meta.name,target.database);assert.ok(meta.version>=170000);
 const {n}=(await admin.query("select count(*)::int n from pg_class c join pg_namespace ns on ns.oid=c.relnamespace where c.relkind in ('r','p','v','m','f','S') and ns.nspname not like 'pg_%' and ns.nspname<>'information_schema'")).rows[0];
 assert.equal(n,0,'REFUSED nonempty database; no cleanup or migrations attempted');
 console.log('Disposable real Storage PostgreSQL',meta.version);
 await admin.query(`CREATE ROLE anon NOLOGIN NOSUPERUSER NOBYPASSRLS;
  CREATE ROLE authenticated NOLOGIN NOSUPERUSER NOBYPASSRLS;
  CREATE ROLE service_role NOLOGIN NOSUPERUSER BYPASSRLS;
  CREATE ROLE authenticator LOGIN NOINHERIT PASSWORD 'ci_fixture_only';
  GRANT anon,authenticated,service_role TO authenticator;
  CREATE ROLE supabase_auth_admin LOGIN NOINHERIT PASSWORD 'ci_fixture_only';
  CREATE SCHEMA auth AUTHORIZATION supabase_auth_admin;
  CREATE SCHEMA extensions; CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
  GRANT USAGE ON SCHEMA extensions TO supabase_auth_admin,authenticated,anon;
  ALTER ROLE supabase_auth_admin SET search_path TO auth,public,extensions;
  GRANT USAGE ON SCHEMA auth TO authenticated,anon;`);
 await start('auth','supabase/gotrue:v2.197.0',{
  GOTRUE_API_HOST:'127.0.0.1',GOTRUE_API_PORT:'19999',API_EXTERNAL_URL:API+'/auth/v1',GOTRUE_DB_DRIVER:'postgres',GOTRUE_DB_DATABASE_URL:databaseURL('supabase_auth_admin'),
  GOTRUE_SITE_URL:API,GOTRUE_DISABLE_SIGNUP:'false',GOTRUE_JWT_ADMIN_ROLES:'service_role',GOTRUE_JWT_AUD:'authenticated',GOTRUE_JWT_DEFAULT_GROUP_NAME:'authenticated',
  GOTRUE_JWT_EXP:'3600',GOTRUE_JWT_SECRET:secret,GOTRUE_JWT_ISSUER:API+'/auth/v1',GOTRUE_EXTERNAL_EMAIL_ENABLED:'true',GOTRUE_MAILER_AUTOCONFIRM:'true',
  GOTRUE_EXTERNAL_PHONE_ENABLED:'false',GOTRUE_EXTERNAL_ANONYMOUS_USERS_ENABLED:'false',
 });
 await ready(AUTH+'/health');
 await admin.query(`CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$SELECT coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub'))::uuid$$;
  CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$SELECT coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)$$;
  CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$SELECT auth.jwt()->>'role'$$;
  CREATE ROLE supabase_storage_admin LOGIN NOINHERIT PASSWORD 'ci_fixture_only';
  GRANT anon,authenticated,service_role TO supabase_storage_admin;
  CREATE SCHEMA storage AUTHORIZATION supabase_storage_admin;
  GRANT USAGE ON SCHEMA auth,extensions TO supabase_storage_admin,service_role;
  GRANT CREATE ON SCHEMA extensions TO supabase_storage_admin;
  ALTER ROLE supabase_storage_admin SET storage.install_roles='false';
  ALTER ROLE supabase_storage_admin SET search_path=storage,public,extensions;
  GRANT USAGE ON SCHEMA storage TO authenticated,anon,service_role;
  ALTER DEFAULT PRIVILEGES FOR ROLE supabase_storage_admin IN SCHEMA storage GRANT ALL ON TABLES TO authenticated,anon,service_role;
  ALTER DEFAULT PRIVILEGES FOR ROLE supabase_storage_admin IN SCHEMA storage GRANT ALL ON SEQUENCES TO authenticated,anon,service_role;
  ALTER DEFAULT PRIVILEGES FOR ROLE supabase_storage_admin IN SCHEMA storage GRANT ALL ON FUNCTIONS TO authenticated,anon,service_role;`);
 // Database name was independently parsed/allowlisted before connection.
 await admin.query('GRANT CREATE ON DATABASE '+pg.escapeIdentifier(target.database)+' TO supabase_storage_admin');
 // Official self-hosted image/config checked 21 Oct 2026. The real service
 // installs its OWN storage schema/migrations. No metadata stand-in is loaded.
 // Disable upstream role installation: do not grant postgres to authenticator.
 await start('storage','supabase/storage-api:v1.81.0',{
  DATABASE_URL:databaseURL('supabase_storage_admin'),AUTH_JWT_SECRET:secret,AUTH_JWT_ALGORITHM:'HS256',ANON_KEY:anonKey,
  SERVER_HOST:'127.0.0.1',SERVER_PORT:'15000',SERVER_ADMIN_PORT:'15001',SERVER_REGION:'local',
  STORAGE_BACKEND:'file',STORAGE_FILE_BACKEND_PATH:'/var/lib/storage',STORAGE_S3_BUCKET:'ci-disposable',
  TENANT_ID:'ci-disposable',STORAGE_PUBLIC_URL:API,REQUEST_ALLOW_X_FORWARDED_PATH:'true',
  UPLOAD_FILE_SIZE_LIMIT:'52428800',ENABLE_IMAGE_TRANSFORMATION:'false',S3_PROTOCOL_ENABLED:'false',
  DATABASE_MAX_CONNECTIONS:'10',DB_ALLOW_MIGRATION_REFRESH:'false',LOG_LEVEL:'warn',
 });
 await ready(STORAGE+'/status');
 for(const path of ['001_core_schema.sql','002_rls_and_storage.sql','004_ai_intake.sql','20261017_append_only_owner_verdict_feedback.sql','20261017_owner_review_revision_cas_v1.sql',
  '20261016_atomic_photo_first_approval_v1.sql','20261017_reviewed_material_evidence_on_catalogue_v6.sql','20261016_block_partial_analysis_catalogue_approval.sql'])await admin.query(await read('supabase/migrations/'+path));
 await admin.query(await read('supabase/proposals/catalogue-approval-input-guards.sql'));
 // Empty context views are explicit fixtures, not certification of live source
 // review definitions. The actual application must be able to distinguish a
 // complete empty read from a missing relation/failed evidence request.
 await admin.query(await read('tests/fixtures/research-session-support.sql'));
 await admin.query(await read('supabase/proposals/item-research-assessments.sql'));
 await installReviewedAssessmentFixtures(admin,read);
 // Install every application RPC before PostgREST builds its schema cache.
 for(const path of ['20261017_atomic_actual_sale_capture_v1.sql','20261017_actual_sale_source_integrity_v2.sql','20261017_allow_loss_making_sales_v3.sql','20261017_sales_listing_item_owner_rls_hardening.sql'])await admin.query(await read('supabase/migrations/'+path));
 await admin.query(await read('supabase/proposals/actual-sale-input-guards.sql'));
 await admin.query('GRANT SELECT ON public.comparables TO authenticated; GRANT SELECT,INSERT,UPDATE ON public.sale_outcomes,public.listings TO authenticated');
 await admin.query(`GRANT SELECT,INSERT,UPDATE ON public.items,public.item_photos,public.item_evidence,public.attribution_history,public.research_tasks,public.ai_analysis_runs TO authenticated;
  GRANT USAGE,SELECT ON SEQUENCE public.item_code_seq TO authenticated`);
 await start('rest','postgrest/postgrest:v14.18',{
  PGRST_DB_URI:databaseURL('authenticator'),PGRST_DB_SCHEMAS:'public',PGRST_DB_ANON_ROLE:'anon',PGRST_JWT_SECRET:secret,PGRST_JWT_AUD:'authenticated',PGRST_SERVER_HOST:'127.0.0.1',PGRST_SERVER_PORT:'13000',PGRST_DB_USE_LEGACY_GUCS:'false',
 });await ready(REST+'/',r=>r.status<500);
 const config=continuityKongConfig(anonKey,publishableKey);
 // Like the official Storage route: the service validates JWT/RLS; signed
 // download capabilities must work without API keys. No privileged API key is
 // registered. Owner clients already send genuine user JWTs, passed untouched.
 config.services.push({name:'storage',url:STORAGE+'/',routes:[{name:'storage-all',strip_path:true,paths:['/storage/v1/']}],plugins:[{name:'cors',config:{...config.services[0].plugins.find(p=>p.name==='cors').config,headers:[...config.services[0].plugins.find(p=>p.name==='cors').config.headers,'x-upsert','cache-control','x-metadata']}}]});
 for(const service of config.services)service.plugins.find(plugin=>plugin.name==='cors').config.origins=['http://127.0.0.1:15173','http://127.0.0.1:15174'];
 directory=await mkdtemp(join(tmpdir(),'ci-photo-gateway-'));await chmod(directory,0o755);
 await writeFile(join(directory,'kong.json'),JSON.stringify(config),{mode:0o644});
 await start('gateway','kong/kong:3.9.3',{KONG_DATABASE:'off',KONG_DECLARATIVE_CONFIG:'/ci-fixture/kong.json',KONG_PROXY_LISTEN:'127.0.0.1:18000',KONG_ADMIN_LISTEN:'off',KONG_STATUS_LISTEN:'off',KONG_NGINX_WORKER_PROCESSES:'1',KONG_PROXY_ACCESS_LOG:'off',KONG_LOG_LEVEL:'warn'},['--mount',`type=bind,source=${directory},target=/ci-fixture,readonly`]);
 await ready(API+'/auth/v1/health',r=>r.status===401);
 const users=[];
 for(const letter of ['a','b']){
  const client=createClient(API,publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const email=`photo-ci-${letter}@example.test`,password='Ci-disposable-photo-4826!';
  const signup=await client.auth.signUp({email,password});assert.equal(signup.error,null);
  const login=await client.auth.signInWithPassword({email,password});assert.equal(login.error,null);assert.ok(login.data.user?.id&&login.data.session?.access_token);
  users.push({id:login.data.user.id,token:login.data.session.access_token,client});
 }
 const [A,B]=users,anon=createClient(API,anonKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 await exercisePhotoStorage({admin,check,A,B,anon,API});
 await seedReviewedAssessmentFixture(admin,A.id,{client:A.client});
 const browser=await exec(process.execPath,['node_modules/@playwright/test/cli.js','test','--config','tests/photo-app-browser.config.mjs','--reporter=line'],{
  env:{...process.env,CI_PHOTO_DISPOSABLE_CONFIRMED:'yes',CI_PHOTO_PUBLIC_KEY:publishableKey},timeout:900000,maxBuffer:4*1024*1024,
 }).catch(error=>{console.error(error.stdout,error.stderr);console.error('Browser process outcome',JSON.stringify({code:error.code??null,signal:error.signal??null,killed:error.killed??false,budget_ms:900000}));throw Error('Disposable photo application browser acceptance failed. See browser output and process outcome.');});
 console.log(browser.stdout,browser.stderr);
 console.log(`${passed} real Supabase Storage byte assertions passed. Disposable file backend with genuine Auth/Kong/REST/SDK; browser output covers the exercised full-application routes, not hosted S3/CDN or untested flows.`);
}catch(error){
 for(const container of containers){try{const log=await exec('docker',['logs','--tail','45',container],{maxBuffer:2*1024*1024});console.error(container,log.stdout,log.stderr);}catch{}}
 throw error;
}finally{
 await admin.end().catch(()=>{});for(const container of containers.reverse())try{await docker(['rm','--force',container]);}catch{}
 if(directory)await rm(directory,{recursive:true,force:true});
}
