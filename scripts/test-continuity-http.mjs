#!/usr/bin/env node
// DISPOSABLE LOCAL CI ONLY. Starts real GoTrue/PostgREST, never a hosted project.
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm,chmod} from 'node:fs/promises';
import {createHash,createHmac,randomBytes} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createClient} from '@supabase/supabase-js';
import {assertIsolatedDatabaseConfig} from './validate-staging-target.mjs';
import {continuityKongConfig} from './continuity-kong-config.mjs';
import {installResearchSessionFixtures,exerciseResearchSessions} from './test-research-sessions.mjs';
import {exerciseIntakeResponseRecovery} from './test-intake-response-recovery.mjs';
import {exerciseCatalogueApproval} from './test-catalogue-approval.mjs';
import {exerciseSaleCapture} from './test-sale-capture.mjs';
import {loadApprovedCanonicalContext,canonicalCallerKeys} from '../src/lib/approvedCanonicalSources.ts';
import {loadCanonicalForCaller,revalidateCanonicalBeforePaidCall} from '../src/lib/canonicalRuntime.ts';
import {loadCanonicalArchive,readCanonicalArchiveVersion} from '../src/lib/canonicalArchive.ts';
import intakeHandler from '../api/analyse-intake.ts';
import researchHandler from '../api/research-item.ts';

const input=process.env.CI_STAGING_DATABASE_URL;
const target=assertIsolatedDatabaseConfig(input,process.env.CI_ISOLATED_STAGING_CONFIRMED);
const {default:pg}=await import('pg');
const admin=new pg.Client({connectionString:input,connectionTimeoutMillis:5000});
const exec=promisify(execFile), containers=[], connections=[];
const AUTH='http://127.0.0.1:19999', REST='http://127.0.0.1:13000', API='http://127.0.0.1:18000';
const jwtSecret=randomBytes(32).toString('hex');
const anonKey=token({role:'anon',aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600});
const publishableKey='sb_publishable_'+randomBytes(24).toString('base64url');
const password='Ci-disposable-fixture-4826!';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const sha=s=>createHash('sha256').update(s).digest('hex');
let passed=0, gatewayDirectory;
async function check(name,fn){await fn();passed++;console.log('PASS',name);}
function databaseURL(user){const u=new URL(input);u.username=user;u.password='ci_fixture_only';return u.href;}
async function docker(args){try{return await exec('docker',args,{timeout:180000,maxBuffer:2*1024*1024});}catch{throw Error('Disposable Docker operation failed; see service diagnostics');}}
async function start(name,image,env,extra=[]){
  const container=`ci-continuity-${name}-${process.pid}`;containers.push(container);
  await docker(['run','--detach','--name',container,'--network','host',...extra,...Object.entries(env).flatMap(([k,v])=>['--env',`${k}=${v}`]),image]);
}
async function waitFor(url,ready){
  for(let i=0;i<90;i++){
    try{const r=await fetch(url,{signal:AbortSignal.timeout(1000)});if(ready(r))return;}catch{}
    await new Promise(resolve=>setTimeout(resolve,500));
  }
  throw Error('Disposable service did not become ready: '+new URL(url).port);
}
function token(payload){
  const parts=[{alg:'HS256',typ:'JWT'},payload].map(x=>Buffer.from(JSON.stringify(x)).toString('base64url'));
  return parts.join('.')+'.'+createHmac('sha256',jwtSecret).update(parts.join('.')).digest('base64url');
}
async function rest(token,path='',init={}){
  return fetch(`${API}/rest/v1/${path}`,{...init,headers:{Authorization:`Bearer ${token}`,apikey:publishableKey,'Content-Type':'application/json',...init.headers}});
}
async function expectSourceFailure(token,code,mode='research'){
  await assert.rejects(()=>loadApprovedCanonicalContext({url:API,key:publishableKey,token},mode),e=>e.code===code);
}
async function publisher(actor){
  const c=new pg.Client({connectionString:databaseURL('ci_http_publisher'),connectionTimeoutMillis:5000});
  connections.push(c);await c.connect();await c.query("select set_config('request.jwt.claim.sub',$1,false)",[actor]);return c;
}
async function publish(c,doc,kind='APPROVE',previous=null){
  return (await c.query('select ci_private.publish_canonical($1,$2,$3,$4) as id',[doc,kind,previous,'DISPOSABLE_HTTP_TEST'])).rows[0].id;
}

try {
  await admin.connect();
  const meta=(await admin.query("select current_database() as name,current_setting('server_version_num')::int as version")).rows[0];
  assert.equal(meta.name,target.database);assert.ok(meta.version>=170000);
  const {n}=(await admin.query("select count(*)::int as n from pg_class c join pg_namespace ns on ns.oid=c.relnamespace where c.relkind in ('r','p','v','m','f','S') and ns.nspname not like 'pg_%' and ns.nspname<>'information_schema'")).rows[0];
  assert.equal(n,0,'REFUSED nonempty database; no destructive cleanup is attempted');
  console.log('Disposable Auth/PostgREST PostgreSQL',meta.version);
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
  // Versions verified from the official self-hosted compose on 20 Oct 2026.
  await start('auth','supabase/gotrue:v2.197.0',{
    GOTRUE_API_HOST:'127.0.0.1',GOTRUE_API_PORT:'19999',API_EXTERNAL_URL:`${API}/auth/v1`,
    GOTRUE_DB_DRIVER:'postgres',GOTRUE_DB_DATABASE_URL:databaseURL('supabase_auth_admin'),
    GOTRUE_SITE_URL:API,GOTRUE_DISABLE_SIGNUP:'false',GOTRUE_JWT_ADMIN_ROLES:'service_role',
    GOTRUE_JWT_AUD:'authenticated',GOTRUE_JWT_DEFAULT_GROUP_NAME:'authenticated',
    GOTRUE_JWT_EXP:'3600',GOTRUE_JWT_SECRET:jwtSecret,GOTRUE_JWT_ISSUER:`${API}/auth/v1`,
    GOTRUE_EXTERNAL_EMAIL_ENABLED:'true',GOTRUE_MAILER_AUTOCONFIRM:'true',
    GOTRUE_EXTERNAL_PHONE_ENABLED:'false',GOTRUE_EXTERNAL_ANONYMOUS_USERS_ENABLED:'false',
  });
  await waitFor(`${AUTH}/health`,r=>r.ok);
  // GoTrue owns/creates its historical auth helper during its own migrations.
  // Only after startup, install the platform-compatible PostgREST claims helper.
  await admin.query(`CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
    $$SELECT coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),
      (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub'))::uuid$$;`);
  const original=await read('supabase/migrations/20261010_canonical_archive_photo_manifests_security.sql');
  await admin.query(original.slice(0,original.indexOf('create table if not exists public.intake_photo_sessions')));
  await admin.query('REVOKE ALL ON public.canonical_documents FROM PUBLIC,anon,authenticated; GRANT SELECT ON public.canonical_documents TO authenticated;');
  await admin.query(await read('supabase/migrations/20261020_canonical_publication_ledger_PREPRODUCTION.sql'));
  await admin.query(await read('supabase/proposals/canonical-publication-workflow.sql'));
  await admin.query("CREATE ROLE ci_http_publisher LOGIN PASSWORD 'ci_fixture_only' IN ROLE ci_canonical_publisher;");
  await installResearchSessionFixtures(admin,read);
  await start('rest','postgrest/postgrest:v14.18',{
    PGRST_DB_URI:databaseURL('authenticator'),PGRST_DB_SCHEMAS:'public',PGRST_DB_ANON_ROLE:'anon',
    PGRST_JWT_SECRET:jwtSecret,PGRST_JWT_AUD:'authenticated',
    PGRST_SERVER_HOST:'127.0.0.1',PGRST_SERVER_PORT:'13000',PGRST_DB_USE_LEGACY_GUCS:'false',
  });
  await waitFor(`${REST}/`,r=>r.status<500);
  // Real key-auth/ACL gateway, using Supabase's supported Kong image. Only
  // Auth/REST are configured; hosted Envoy, TLS, OAuth and browser are separate.
  gatewayDirectory=await mkdtemp(join(tmpdir(),'ci-continuity-kong-'));
  await chmod(gatewayDirectory,0o755);
  await writeFile(join(gatewayDirectory,'kong.json'),JSON.stringify(continuityKongConfig(anonKey,publishableKey)),{mode:0o644});
  await start('gateway','kong/kong:3.9.3',{
    KONG_DATABASE:'off',KONG_DECLARATIVE_CONFIG:'/ci-fixture/kong.json',
    KONG_PROXY_LISTEN:'127.0.0.1:18000',KONG_ADMIN_LISTEN:'off',KONG_STATUS_LISTEN:'off',
    KONG_NGINX_WORKER_PROCESSES:'1',KONG_PROXY_ACCESS_LOG:'off',KONG_LOG_LEVEL:'warn',
  },['--mount',`type=bind,source=${gatewayDirectory},target=/ci-fixture,readonly`]);
  await waitFor(`${API}/auth/v1/health`,r=>r.status===401);
  await check('gateway denies missing and invalid API keys before Auth/REST',async()=>{
    for(const path of ['/auth/v1/user','/rest/v1/ci_canonical_approved_v1']){
      assert.equal((await fetch(API+path)).status,401);
      assert.equal((await fetch(API+path,{headers:{apikey:'invalid-fixture-key'}})).status,401);
    }
  });
  const users=[];
  for(const label of ['a','b']){
    const email=`collector-ci-${label}@example.test`;
    const signup=await fetch(`${API}/auth/v1/signup`,{method:'POST',headers:{apikey:publishableKey,'Content-Type':'application/json'},body:JSON.stringify({email,password})});
    assert.equal(signup.status,200,'Real Auth signup failed');
    const login=await fetch(`${API}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:publishableKey,'Content-Type':'application/json'},body:JSON.stringify({email,password})});
    assert.equal(login.status,200,'Real Auth password login failed');
    const result=await login.json();assert.ok(result.access_token && result.user?.id);
    users.push({id:result.user.id,token:result.access_token});
  }
  const [A,B]=users;
  await check('valid user JWT cannot bypass a missing or invalid gateway key',async()=>{
    for(const path of ['/auth/v1/user','/rest/v1/ci_canonical_approved_v1']){
      for(const headers of [{Authorization:'Bearer '+A.token},{Authorization:'Bearer '+A.token,apikey:'invalid-fixture-key'}])assert.equal((await fetch(API+path,{headers})).status,401);
    }
  });
  await check('two genuine Auth accounts sign in and resolve distinct principals',async()=>{
    assert.notEqual(A.id,B.id);
    for(const user of users){const response=await fetch(`${API}/auth/v1/user`,{headers:{apikey:publishableKey,Authorization:`Bearer ${user.token}`}});assert.equal(response.status,200);assert.equal((await response.json()).id,user.id);}
  });
  const keys=[...new Set([...canonicalCallerKeys.intake,...canonicalCallerKeys.research])];
  const documents={},events={};
  for(const user of users){
    documents[user.id]={};events[user.id]={};
    for(const key of keys){
      const governing=key==='02_MASTER_PROJECT_BRIEF.md'||key==='03_SOURCE_AND_EVIDENCE_POLICY.md';
      const content=governing?await read(`tests/fixtures/governing-v4/${key}`):`SYNTHETIC WORKFLOW ${key} OWNER ${user.id}\n`+'x'.repeat(500);
      const source=(await admin.query(`insert into public.canonical_documents
        (owner_id,document_key,source_class,title,content,content_sha256,source_path,source_version)
        values($1,$2,'WORKFLOW_SKILL',$2,$3,$4,'DISPOSABLE_HTTP_FIXTURE',$5) returning id`,[user.id,key,content,sha(content),governing?'4.0':'fixture-1'])).rows[0];
      documents[user.id][key]=source.id;
    }
  }
  const pubA=await publisher(A.id),pubB=await publisher(B.id);
  await check('unpublished keyset stops reader before inference',()=>expectSourceFailure(A.token,'CANONICAL_RESULT_INCOMPLETE'));
  for(const [user,pub] of [[A,pubA],[B,pubB]])for(const key of keys)events[user.id][key]=await publish(pub,documents[user.id][key]);
  let receiptA;
  let runtimeA;
  await check('real Auth and PostgREST return full research keyset and genuine v4 policy pins',async()=>{
    receiptA=await loadApprovedCanonicalContext({url:API,key:publishableKey,token:A.token},'research');
    runtimeA=await loadCanonicalForCaller({url:API,key:publishableKey,token:A.token},'research','approved-v1',()=>{throw Error('Legacy fallback forbidden');});
    assert.equal(receiptA.ownerId,A.id);assert.equal(receiptA.receipts.length,3);
    for(const source of receiptA.receipts)assert.equal(source.document_id,documents[A.id][source.document_key]);
  });
  await check('intake caller loads its complete four-source set over HTTP',async()=>assert.equal((await loadApprovedCanonicalContext({url:API,key:publishableKey,token:A.token},'intake')).receipts.length,4));
  await check('owner B HTTP reader returns only B receipts',async()=>{
    const result=await loadApprovedCanonicalContext({url:API,key:publishableKey,token:B.token},'research');
    assert.equal(result.ownerId,B.id);assert.ok(result.receipts.every(r=>r.document_id===documents[B.id][r.document_key]));
  });
  await check('legacy signed anon API key retains genuine owner JWT and source receipts',async()=>{
    const result=await loadApprovedCanonicalContext({url:API,key:anonKey,token:A.token},'research');
    assert.equal(result.ownerId,A.id);assert.deepEqual(result.receipts,receiptA.receipts);
  });
  await check('Supabase SDK signs in through both key formats and enforces owner RLS',async()=>{
    for(const [key,user,label] of [[anonKey,A,'a'],[publishableKey,B,'b']]){
      const sdk=createClient(API,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
      const login=await sdk.auth.signInWithPassword({email:`collector-ci-${label}@example.test`,password});
      assert.ok(!login.error,login.error?.message);assert.equal(login.data.user?.id,user.id);
      const principal=await sdk.auth.getUser();assert.ok(!principal.error,principal.error?.message);assert.equal(principal.data.user?.id,user.id);
      const result=await sdk.from('ci_canonical_approved_v1').select('owner_id,document_key',{count:'exact'}).in('document_key',canonicalCallerKeys.research);
      assert.ok(!result.error,result.error?.message);assert.equal(result.count,3);assert.ok(result.data.every(row=>row.owner_id===user.id));
      const other=await sdk.from('ci_canonical_approved_v1').select('id').eq('owner_id',user.id===A.id?B.id:A.id);
      assert.ok(!other.error,other.error?.message);assert.deepEqual(other.data,[]);
      const refreshed=await sdk.auth.refreshSession();assert.ok(!refreshed.error,refreshed.error?.message);
      const sources=await loadApprovedCanonicalContext({url:API,key,token:refreshed.data.session.access_token},'research');assert.equal(sources.ownerId,user.id);
    }
  });
  await check('opaque publishable key without a user session remains anonymous',async()=>{
    const sdk=createClient(API,publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
    const result=await sdk.from('ci_canonical_approved_v1').select('id');
    assert.equal(result.status,401);assert.equal(result.error?.code,'42501');assert.equal(result.data,null);
    await expectSourceFailure(publishableKey,'CANONICAL_ACCESS_DENIED');
  });
  await check('explicit other-owner filter cannot bypass RLS',async()=>{
    const response=await rest(A.token,`ci_canonical_approved_v1?owner_id=eq.${B.id}`);assert.equal(response.status,200);assert.deepEqual(await response.json(),[]);
  });
  await check('other-owner publication history is hidden over HTTP',async()=>{
    const response=await rest(A.token,`ci_canonical_publication_events?owner_id=eq.${B.id}`);assert.equal(response.status,200);assert.deepEqual(await response.json(),[]);
  });
  const anon=token({role:'anon',aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600});
  await check('anonymous REST cannot read approved view',async()=>assert.ok([401,403].includes((await rest(anon,'ci_canonical_approved_v1')).status)));
  await check('anonymous Auth cannot pass source gate',()=>expectSourceFailure(anon,'CANONICAL_ACCESS_DENIED'));
  const parts=A.token.split('.'),claims=JSON.parse(Buffer.from(parts[1],'base64url'));claims.sub=B.id;claims.role='service_role';
  const forged=[parts[0],Buffer.from(JSON.stringify(claims)).toString('base64url'),parts[2]].join('.');
  await check('modified owner/role JWT fails actual Auth signature check',()=>expectSourceFailure(forged,'CANONICAL_ACCESS_DENIED'));
  await check('modified JWT fails PostgREST signature check',async()=>assert.equal((await rest(forged,'ci_canonical_approved_v1')).status,401));
  const expired=token({...claims,sub:A.id,role:'authenticated',exp:Math.floor(Date.now()/1000)-3600});
  await check('expired token fails source gate',()=>expectSourceFailure(expired,'CANONICAL_ACCESS_DENIED'));
  await check('ordinary owner cannot insert publication events over REST',async()=>assert.equal((await rest(A.token,'ci_canonical_publication_events',{method:'POST',body:JSON.stringify({owner_id:A.id})})).status,403));
  await check('ordinary owner cannot update approval pointer over REST',async()=>assert.equal((await rest(A.token,'ci_canonical_active_approvals?owner_id=eq.'+A.id,{method:'PATCH',body:JSON.stringify({event_id:events[B.id][keys[0]]})})).status,403));
  await check('private publisher function is absent from public RPC',async()=>assert.equal((await rest(A.token,'rpc/publish_canonical',{method:'POST',body:'{}'})).status,404));
  await check('private schema cannot be selected via HTTP profile',async()=>assert.equal((await rest(A.token,'ci_canonical_active_approvals',{headers:{'Accept-Profile':'ci_private'}})).status,406));
  await check('user-editable metadata cannot change owner or publication access',async()=>{
    const response=await fetch(`${API}/auth/v1/user`,{method:'PUT',headers:{apikey:publishableKey,Authorization:`Bearer ${A.token}`,'Content-Type':'application/json'},body:JSON.stringify({data:{role:'service_role',owner_id:B.id}})});
    assert.equal(response.status,200);
    const result=await loadApprovedCanonicalContext({url:API,key:publishableKey,token:A.token},'research');assert.equal(result.ownerId,A.id);
    assert.equal((await rest(A.token,'rpc/publish_canonical',{method:'POST',body:'{}'})).status,404);
  });
  const workflowKey='03_COMPARABLE_RESEARCH.md';
  await check('newer imported workflow cannot replace approved exact version',async()=>{
    await admin.query(`insert into public.canonical_documents(owner_id,document_key,source_class,title,content,content_sha256,source_path,source_version)
      values($1,$2,'WORKFLOW_SKILL',$2,$3,'computed-by-trigger','DISPOSABLE_HTTP_FIXTURE','4.0-aligned-draft-20261020')`,[A.id,workflowKey,await read('docs/source-reconciliation/proposed/03_COMPARABLE_RESEARCH.md')]);
    const result=await loadApprovedCanonicalContext({url:API,key:publishableKey,token:A.token},'research');
    assert.equal(result.receipts.find(r=>r.document_key===workflowKey).document_id,documents[A.id][workflowKey]);
  });
  // More than the platform's old 100-row UI cap, all explicitly unapproved.
  // Ordinary reads must preserve these without promoting the latest import.
  await admin.query(`insert into public.canonical_documents(owner_id,document_key,source_class,title,content,content_sha256,source_path,source_version,ingested_at)
    select $1,$2,'WORKFLOW_SKILL',$2,'ARCHIVE PAGE FIXTURE '||n||repeat('x',500),'computed-by-trigger','DISPOSABLE_HTTP_FIXTURE','archive-page-'||n,
      '2026-01-01'::timestamptz+n*interval '1 second' from generate_series(1,103) n`,[A.id,workflowKey]);
  await admin.query(`insert into public.canonical_documents(owner_id,document_key,source_class,title,content,content_sha256,source_path,source_version)
    values($1,'06_PHOTO_EXAMINATION.md','WORKFLOW_SKILL','Preserved placeholder','No readable content was returned for this fixture source','computed-by-trigger','DISPOSABLE_HTTP_FIXTURE','placeholder-fixture')`,[A.id]);
  const archiveSDK=createClient(API,publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  assert.ok(!(await archiveSDK.auth.signInWithPassword({email:'collector-ci-a@example.test',password})).error);
  let archiveRows;
  await check('actual SDK archive reader paginates all 110 owner versions without changing approved selection',async()=>{
    archiveRows=await loadCanonicalArchive(archiveSDK);assert.equal(archiveRows.length,110);assert.ok(archiveRows.every(row=>row.owner_id===A.id));
    assert.equal(archiveRows.filter(row=>row.document_key===workflowKey).length,105);
    const approved=await loadApprovedCanonicalContext({url:API,key:publishableKey,token:A.token},'research');
    assert.equal(approved.receipts.find(row=>row.document_key===workflowKey).document_id,documents[A.id][workflowKey]);
  });
  await check('actual SDK exact-version reads verify source bytes and retain unusable placeholders',async()=>{
    const policy=archiveRows.find(row=>row.document_key==='03_SOURCE_AND_EVIDENCE_POLICY.md');
    const result=await readCanonicalArchiveVersion(archiveSDK,policy);assert.equal(result.integrity,'MATCH');assert.equal(result.content,await read('tests/fixtures/governing-v4/03_SOURCE_AND_EVIDENCE_POLICY.md'));
    const placeholder=await readCanonicalArchiveVersion(archiveSDK,archiveRows.find(row=>row.source_version==='placeholder-fixture'));
    assert.equal(placeholder.integrity,'MATCH');assert.equal(placeholder.contentWarning,'placeholder');
  });
  await check('actual SDK archive content cannot cross owner boundaries through forged selection metadata',async()=>{
    const foreign={...archiveRows[0],owner_id:B.id,id:documents[B.id][keys[0]]};
    await assert.rejects(readCanonicalArchiveVersion(archiveSDK,foreign),/not available for your account/);
    await assert.rejects(readCanonicalArchiveVersion(archiveSDK,{...foreign,owner_id:A.id}),/could not be read/);
  });
  await exerciseResearchSessions({admin,rest,check,A,B,anon,API,key:publishableKey});
  await exerciseIntakeResponseRecovery({admin,rest,check,A,B,API,key:publishableKey});
  await exerciseCatalogueApproval({admin,rest,check,A,B,anon,read});
  await exerciseSaleCapture({admin,rest,check,A,B,anon,read});
  // Runs the actual React component and SDK against these real disposable
  // services in Chromium; never loads the production application or account.
  const browser=await exec(process.execPath,['node_modules/@playwright/test/cli.js','test','--config','tests/archive-browser.config.mjs','--reporter=line'],{
    env:{...process.env,CI_ARCHIVE_DISPOSABLE_CONFIRMED:'yes',CI_ARCHIVE_PUBLIC_KEY:publishableKey},timeout:300000,maxBuffer:4*1024*1024,
  }).catch(error=>{console.error(error.stdout,error.stderr);throw Error('Disposable authenticated browser acceptance failed. See browser output.');});
  console.log(browser.stdout,browser.stderr);
  await check('revocation fails required research set over real HTTP',async()=>{
    events[A.id][workflowKey]=await publish(pubA,documents[A.id][workflowKey],'REVOKE',events[A.id][workflowKey]);
    await expectSourceFailure(A.token,'CANONICAL_RESULT_INCOMPLETE');
    let paid=0;
    await assert.rejects(async()=>{await revalidateCanonicalBeforePaidCall({url:API,key:publishableKey,token:A.token},'research',runtimeA);paid++;},e=>e.code==='CANONICAL_RESULT_INCOMPLETE');
    assert.equal(paid,0);
    assert.equal((await loadApprovedCanonicalContext({url:API,key:publishableKey,token:B.token},'research')).ownerId,B.id);
  });
  await check('reviewed reapproval restores complete source set and new receipt',async()=>{
    events[A.id][workflowKey]=await publish(pubA,documents[A.id][workflowKey],'APPROVE',events[A.id][workflowKey]);
    const result=await loadApprovedCanonicalContext({url:API,key:publishableKey,token:A.token},'research');
    assert.equal(result.receipts.find(r=>r.document_key===workflowKey).approval_event_id,events[A.id][workflowKey]);
  });
  await check('real missing base-table grant blocks HTTP loader',async()=>{
    await admin.query('REVOKE SELECT ON public.canonical_documents FROM authenticated');
    try{await expectSourceFailure(A.token,'CANONICAL_APPROVED_ACCESS_FAILED');}finally{await admin.query('GRANT SELECT ON public.canonical_documents TO authenticated');}
  });
  await check('safety disable blocks HTTP access while preserving source and event history',async()=>{
    const before=(await admin.query('select count(*)::int as n from public.ci_canonical_publication_events')).rows[0].n;
    await admin.query(await read('supabase/proposals/canonical-publication-disable.sql'));
    await expectSourceFailure(A.token,'CANONICAL_APPROVED_ACCESS_FAILED');
    assert.equal((await admin.query('select count(*)::int as n from public.ci_canonical_publication_events')).rows[0].n,before);
  });
  await check('both real server handlers stop before provider dispatch with real Auth and disabled REST grants',async()=>{
    const env={NEXT_PUBLIC_SUPABASE_URL:API,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:publishableKey,
      COLLECTOR_CANONICAL_SOURCE_MODE:'approved-v1',OPENAI_API_KEY:'disposable-no-provider',AI_GATEWAY_API_KEY:'',VERCEL_OIDC_TOKEN:''};
    const before=Object.fromEntries(Object.keys(env).map(k=>[k,process.env[k]])),transport=globalThis.fetch;
    let external=0;Object.assign(process.env,env);
    globalThis.fetch=(url,init)=>{if(new URL(url).origin!==API){external++;throw Error('External call blocked by disposable test');}return transport(url,init);};
    try{
      for(const handler of [intakeHandler,researchHandler]){
        const res={code:0,body:null,status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
        await handler({method:'POST',headers:{authorization:'Bearer '+A.token},body:{}},res);
        assert.equal(res.code,503);assert.equal(res.body.code,'CANONICAL_APPROVED_ACCESS_FAILED');
      }
      assert.equal(external,0);
    }finally{globalThis.fetch=transport;for(const [key,value] of Object.entries(before)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
  });
  console.log(`${passed} real Supabase Auth/PostgREST assertions passed. Disposable services and authenticated component browser tests only; hosted deployment and paid AI acceptance not claimed.`);
} catch(error){
  for(const name of containers){try{const log=await exec('docker',['logs','--tail','35',name]);console.error(name,log.stdout,log.stderr);}catch{}}
  throw error;
} finally {
  await Promise.all(connections.map(c=>c.end().catch(()=>{})));await admin.end().catch(()=>{});
  for(const name of containers.reverse())try{await docker(['rm','--force',name]);}catch{}
  if(gatewayDirectory)await rm(gatewayDirectory,{recursive:true,force:true});
}
