#!/usr/bin/env node
// DISPOSABLE LOCAL CI ONLY. Starts real GoTrue/PostgREST, never a hosted project.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash,createHmac,randomBytes} from 'node:crypto';
import {createServer} from 'node:http';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {assertIsolatedDatabaseConfig} from './validate-staging-target.mjs';
import {loadApprovedCanonicalContext,canonicalCallerKeys} from '../src/lib/approvedCanonicalSources.ts';

const input=process.env.CI_STAGING_DATABASE_URL;
const target=assertIsolatedDatabaseConfig(input,process.env.CI_ISOLATED_STAGING_CONFIRMED);
const {default:pg}=await import('pg');
const admin=new pg.Client({connectionString:input,connectionTimeoutMillis:5000});
const exec=promisify(execFile), containers=[], connections=[];
const AUTH='http://127.0.0.1:19999', REST='http://127.0.0.1:13000', API='http://127.0.0.1:18000';
const jwtSecret=randomBytes(32).toString('hex');
const password='Ci-disposable-fixture-4826!';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const sha=s=>createHash('sha256').update(s).digest('hex');
let passed=0, gateway;
async function check(name,fn){await fn();passed++;console.log('PASS',name);}
function databaseURL(user){const u=new URL(input);u.username=user;u.password='ci_fixture_only';return u.href;}
async function docker(args){try{return await exec('docker',args,{timeout:180000,maxBuffer:2*1024*1024});}catch{throw Error('Disposable Docker operation failed; see service diagnostics');}}
async function start(name,image,env){
  const container=`ci-continuity-${name}-${process.pid}`;containers.push(container);
  await docker(['run','--detach','--name',container,'--network','host',...Object.entries(env).flatMap(([k,v])=>['--env',`${k}=${v}`]),image]);
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
  return fetch(`${API}/rest/v1/${path}`,{...init,headers:{Authorization:`Bearer ${token}`,apikey:'disposable-key','Content-Type':'application/json',...init.headers}});
}
async function expectSourceFailure(token,code,mode='research'){
  await assert.rejects(()=>loadApprovedCanonicalContext({url:API,key:'disposable-key',token},mode),e=>e.code===code);
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
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
    $$SELECT coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),
       (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub'))::uuid$$;
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
  const original=await read('supabase/migrations/20261010_canonical_archive_photo_manifests_security.sql');
  await admin.query(original.slice(0,original.indexOf('create table if not exists public.intake_photo_sessions')));
  await admin.query('REVOKE ALL ON public.canonical_documents FROM PUBLIC,anon,authenticated; GRANT SELECT ON public.canonical_documents TO authenticated;');
  await admin.query(await read('supabase/migrations/20261020_canonical_publication_ledger_PREPRODUCTION.sql'));
  await admin.query(await read('supabase/proposals/canonical-publication-workflow.sql'));
  await admin.query("CREATE ROLE ci_http_publisher LOGIN PASSWORD 'ci_fixture_only' IN ROLE ci_canonical_publisher;");
  await start('rest','postgrest/postgrest:v14.18',{
    PGRST_DB_URI:databaseURL('authenticator'),PGRST_DB_SCHEMAS:'public',PGRST_DB_ANON_ROLE:'anon',
    PGRST_JWT_SECRET:jwtSecret,PGRST_JWT_AUD:'authenticated',
    PGRST_SERVER_HOST:'127.0.0.1',PGRST_SERVER_PORT:'13000',PGRST_DB_USE_LEGACY_GUCS:'false',
  });
  await waitFor(`${REST}/`,r=>r.status<500);
  // Prefix routing only. Actual Auth/JWT validation and database RLS are upstream.
  // This fixture is not a production API-key gateway (Kong/Envoy) acceptance test.
  gateway=createServer(async(req,res)=>{
    try{
      const base=req.url.startsWith('/auth/v1/')?AUTH:req.url.startsWith('/rest/v1/')?REST:null;
      if(!base){res.writeHead(404).end();return;}
      const chunks=[];let length=0;
      for await(const chunk of req){length+=chunk.length;if(length>65536)throw Error('Fixture body too large');chunks.push(chunk);}
      const headers={...req.headers};delete headers.host;delete headers['content-length'];delete headers.connection;
      const upstream=await fetch(base+req.url.replace(/^\/(auth|rest)\/v1/,''),{
        method:req.method,headers,body:chunks.length?Buffer.concat(chunks):undefined,redirect:'error',signal:AbortSignal.timeout(5000),
      });
      const returned=Object.fromEntries(upstream.headers);
      for(const h of ['content-length','content-encoding','connection','transfer-encoding'])delete returned[h];
      res.writeHead(upstream.status,returned);res.end(Buffer.from(await upstream.arrayBuffer()));
    }catch{res.writeHead(502).end('Disposable upstream error');}
  });
  await new Promise(resolve=>gateway.listen(18000,'127.0.0.1',resolve));
  const users=[];
  for(const label of ['a','b']){
    const email=`collector-ci-${label}@example.test`;
    const signup=await fetch(`${API}/auth/v1/signup`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
    assert.equal(signup.status,200,'Real Auth signup failed');
    const login=await fetch(`${API}/auth/v1/token?grant_type=password`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
    assert.equal(login.status,200,'Real Auth password login failed');
    const result=await login.json();assert.ok(result.access_token && result.user?.id);
    users.push({id:result.user.id,token:result.access_token});
  }
  const [A,B]=users;
  await check('two genuine Auth accounts sign in and resolve distinct principals',async()=>{
    assert.notEqual(A.id,B.id);
    for(const user of users){const response=await fetch(`${API}/auth/v1/user`,{headers:{Authorization:`Bearer ${user.token}`}});assert.equal(response.status,200);assert.equal((await response.json()).id,user.id);}
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
  await check('real Auth and PostgREST return full research keyset and genuine v4 policy pins',async()=>{
    receiptA=await loadApprovedCanonicalContext({url:API,key:'disposable-key',token:A.token},'research');
    assert.equal(receiptA.ownerId,A.id);assert.equal(receiptA.receipts.length,3);
    for(const source of receiptA.receipts)assert.equal(source.document_id,documents[A.id][source.document_key]);
  });
  await check('intake caller loads its complete four-source set over HTTP',async()=>assert.equal((await loadApprovedCanonicalContext({url:API,key:'disposable-key',token:A.token},'intake')).receipts.length,4));
  await check('owner B HTTP reader returns only B receipts',async()=>{
    const result=await loadApprovedCanonicalContext({url:API,key:'disposable-key',token:B.token},'research');
    assert.equal(result.ownerId,B.id);assert.ok(result.receipts.every(r=>r.document_id===documents[B.id][r.document_key]));
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
    const response=await fetch(`${API}/auth/v1/user`,{method:'PUT',headers:{Authorization:`Bearer ${A.token}`,'Content-Type':'application/json'},body:JSON.stringify({data:{role:'service_role',owner_id:B.id}})});
    assert.equal(response.status,200);
    const result=await loadApprovedCanonicalContext({url:API,key:'disposable-key',token:A.token},'research');assert.equal(result.ownerId,A.id);
    assert.equal((await rest(A.token,'rpc/publish_canonical',{method:'POST',body:'{}'})).status,404);
  });
  const workflowKey='03_COMPARABLE_RESEARCH.md';
  await check('newer imported workflow cannot replace approved exact version',async()=>{
    await admin.query(`insert into public.canonical_documents(owner_id,document_key,source_class,title,content,content_sha256,source_path,source_version)
      values($1,$2,'WORKFLOW_SKILL',$2,$3,'computed-by-trigger','DISPOSABLE_HTTP_FIXTURE','fixture-999')`,[A.id,workflowKey,'NEWER UNAPPROVED '+ 'z'.repeat(500)]);
    const result=await loadApprovedCanonicalContext({url:API,key:'disposable-key',token:A.token},'research');
    assert.equal(result.receipts.find(r=>r.document_key===workflowKey).document_id,documents[A.id][workflowKey]);
  });
  await check('revocation fails required research set over real HTTP',async()=>{
    events[A.id][workflowKey]=await publish(pubA,documents[A.id][workflowKey],'REVOKE',events[A.id][workflowKey]);
    await expectSourceFailure(A.token,'CANONICAL_RESULT_INCOMPLETE');
    assert.equal((await loadApprovedCanonicalContext({url:API,key:'disposable-key',token:B.token},'research')).ownerId,B.id);
  });
  await check('reviewed reapproval restores complete source set and new receipt',async()=>{
    events[A.id][workflowKey]=await publish(pubA,documents[A.id][workflowKey],'APPROVE',events[A.id][workflowKey]);
    const result=await loadApprovedCanonicalContext({url:API,key:'disposable-key',token:A.token},'research');
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
  console.log(`${passed} real Supabase Auth/PostgREST assertions passed. Disposable services only; no hosted project, API-key gateway, browser or paid AI acceptance claimed.`);
} catch(error){
  for(const name of containers){try{const log=await exec('docker',['logs','--tail','35',name]);console.error(name,log.stdout,log.stderr);}catch{}}
  throw error;
} finally {
  if(gateway){gateway.closeAllConnections();await new Promise(resolve=>gateway.close(resolve));}
  await Promise.all(connections.map(c=>c.end().catch(()=>{})));await admin.end().catch(()=>{});
  for(const name of containers)try{await docker(['rm','--force',name]);}catch{}
}
