#!/usr/bin/env node
// Destructive SYNTHETIC setup in a confirmed EMPTY local database only.
// No production secrets, HTTP Auth, hosted Supabase or model calls are used.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {assertIsolatedDatabaseConfig} from './validate-staging-target.mjs';

const url=process.env.CI_STAGING_DATABASE_URL;
const target=assertIsolatedDatabaseConfig(url,process.env.CI_ISOLATED_STAGING_CONFIRMED);
const {default:pg}=await import('pg');
const admin=new pg.Client({connectionString:url,connectionTimeoutMillis:5000});
const clients=[];
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const hash=s=>createHash('sha256').update(s).digest('hex');
const A='00000000-0000-4000-8000-000000000001';
const B='00000000-0000-4000-8000-000000000002';
let passed=0;
async function check(name,fn){await fn();passed++;console.log('PASS',name);}
async function denied(client,sql,params,code){
 await assert.rejects(()=>client.query(sql,params),e=>e.code===code);
}
async function session(role,actor){
 // Separate actual PostgreSQL login; JWT subject is a synthetic DB claim fixture.
 const u=new URL(url);u.username=role;u.password='ci_fixture_only';
 const c=new pg.Client({connectionString:u.href,connectionTimeoutMillis:5000});
 clients.push(c);await c.connect();
 await c.query("select set_config('request.jwt.claim.sub',$1,false)",[actor??'']);
 return c;
}
async function publish(c,doc,kind='APPROVE',previous=null,review='synthetic-review'){
 return (await c.query('select ci_private.publish_canonical($1,$2,$3,$4) as id',[doc,kind,previous,review])).rows[0].id;
}
const view='select * from public.ci_canonical_approved_v1 order by document_key';

try {
 await admin.connect();
 const meta=(await admin.query("select current_database() as name,current_setting('server_version_num')::int as version")).rows[0];
 assert.equal(meta.name,target.database);
 assert.ok(meta.version>=170000,'PostgreSQL 17+ required');
 const count=(await admin.query("select count(*)::int as n from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in ('r','p','v','m','f','S') and n.nspname not like 'pg_%' and n.nspname<>'information_schema'")).rows[0].n;
 assert.equal(count,0,'REFUSED: database must be empty; no cleanup/drop is attempted');
 console.log('Isolated PostgreSQL version',meta.version,'database',meta.name);
 await admin.query(`
   CREATE ROLE anon NOLOGIN NOSUPERUSER NOBYPASSRLS;
   CREATE ROLE authenticated NOLOGIN NOSUPERUSER NOBYPASSRLS;
   CREATE ROLE ci_test_client LOGIN PASSWORD 'ci_fixture_only' IN ROLE authenticated;
   CREATE ROLE ci_test_anon LOGIN PASSWORD 'ci_fixture_only' IN ROLE anon;
   CREATE ROLE ci_test_publisher LOGIN PASSWORD 'ci_fixture_only';
   CREATE SCHEMA auth; CREATE SCHEMA extensions;
   CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
   CREATE TABLE auth.users(id uuid PRIMARY KEY);
   CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
     $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   GRANT USAGE ON SCHEMA auth,extensions TO authenticated,anon;
   GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,anon;
 `);
 // Reuse the checked-in canonical schema/triggers, not a looser invented table.
 const original=await read('supabase/migrations/20261010_canonical_archive_photo_manifests_security.sql');
 await admin.query(original.slice(0,original.indexOf('create table if not exists public.intake_photo_sessions')));
 await admin.query(`REVOKE ALL ON public.canonical_documents FROM PUBLIC,anon,authenticated;
   GRANT SELECT ON public.canonical_documents TO authenticated;`);
 await admin.query('insert into auth.users(id) values($1),($2)',[A,B]);
 const docs=[];
 for(const [owner,key,version,text] of [
   [A,'workflow.md','1','First source. '],
   [A,'workflow.md','2','Second source. '],
   [B,'workflow.md','1','Other owner. '],
   [A,'02_MASTER_PROJECT_BRIEF.md','4.0','Synthetic policy, never approved. '],
   [A,'placeholder.md','1','No readable content'],
   [A,'03_SOURCE_AND_EVIDENCE_POLICY.md','4.0','Synthetic evidence policy. '],
 ]){
   const content=text+'x'.repeat(500);
   const result=await admin.query(`insert into public.canonical_documents
     (owner_id,document_key,source_class,title,content,content_sha256,source_path,source_version)
     values($1,$2,'WORKFLOW_SKILL',$2,$3,$4,'SYNTHETIC_ONLY',$5) returning id`,[owner,key,content,hash(content),version]);
   docs.push(result.rows[0].id);
 }
 const before=(await admin.query('select * from public.canonical_documents order by id')).rows;
 const migration=await read('supabase/migrations/20261020_canonical_publication_ledger_PREPRODUCTION.sql');
 const workflow=await read('supabase/proposals/canonical-publication-workflow.sql');
 await check('original PREPRODUCTION DDL executes with its own transaction',()=>admin.query(migration));
 await check('original catalog assertions pass',async()=>{await admin.query('BEGIN READ ONLY');try{await admin.query(await read('tests/continuity/staging-ledger-catalog-check.sql'));}finally{await admin.query('ROLLBACK');}});
 await check('original DDL can replay before workflow extension',()=>admin.query(migration));
 await check('workflow extension executes',()=>admin.query(workflow));
 await admin.query('GRANT ci_canonical_publisher TO ci_test_publisher; GRANT USAGE ON SCHEMA auth TO ci_canonical_publisher;');
 const ownerA=await session('ci_test_client',A);
 const ownerB=await session('ci_test_client',B);
 const anonymous=await session('ci_test_anon',null);
 const pubA=await session('ci_test_publisher',A);
 const pubB=await session('ci_test_publisher',B);
 const noSubject=await session('ci_test_publisher',null);
 await check('non-superuser owner role really exercises RLS',async()=>{
   const m=(await ownerA.query('select r.rolsuper,r.rolbypassrls from pg_roles r where rolname=current_user')).rows[0];
   assert.deepEqual(m,{rolsuper:false,rolbypassrls:false});
   assert.equal((await ownerA.query('select * from public.canonical_documents')).rows.length,5);
   assert.equal((await ownerB.query('select * from public.canonical_documents')).rows.length,1);
 });
 await check('no initial approvals or recency fallback',async()=>assert.equal((await ownerA.query(view)).rows.length,0));
 await check('anonymous reader denied',()=>denied(anonymous,view,[],'42501'));
 await check('ordinary owner cannot invoke privileged publisher',()=>denied(ownerA,'select ci_private.publish_canonical($1,\'APPROVE\',null,\'forged\')',[docs[0]],'42501'));
 await check('publisher without authenticated subject denied',async()=>assert.rejects(()=>publish(noSubject,docs[0]),e=>e.code==='42501'));
 await check('publisher cannot approve other owner document',async()=>assert.rejects(()=>publish(pubA,docs[2]),e=>e.code==='42501'));
 await check('publisher has no direct event DML',()=>denied(pubA,'delete from public.ci_canonical_publication_events',[],'42501'));
 await check('blank review rejected',async()=>assert.rejects(()=>publish(pubA,docs[0],'APPROVE',null,'  '),e=>e.code==='22023'));
 await check('invalid event kind rejected',async()=>assert.rejects(()=>publish(pubA,docs[0],'TYPO'),e=>e.code==='22023'));
 await check('governing Master pin rejects synthetic substitute',async()=>assert.rejects(()=>publish(pubA,docs[3]),/Unapproved Master/));
 await check('governing Evidence pin rejects synthetic substitute',async()=>assert.rejects(()=>publish(pubA,docs[5]),/Unapproved Evidence/));
 await check('placeholder rejected',async()=>assert.rejects(()=>publish(pubA,docs[4]),/source mismatch/));
 const first=await publish(pubA,docs[0]);
 await publish(pubB,docs[2]);
 await check('owner A sees only exact approved older version',async()=>{
   const rows=(await ownerA.query(view)).rows;assert.equal(rows.length,1);assert.equal(rows[0].id,docs[0]);
 });
 await check('owner B sees own approval only',async()=>assert.deepEqual((await ownerB.query(view)).rows.map(x=>x.id),[docs[2]]));
 await check('owner cannot read other owner ledger',async()=>assert.equal((await ownerA.query('select * from public.ci_canonical_publication_events where owner_id=$1',[B])).rows.length,0));
 await check('owner cannot insert event',()=>denied(ownerA,"insert into public.ci_canonical_publication_events default values",[],'42501'));
 await check('owner cannot update pointer',()=>denied(ownerA,'update public.ci_canonical_active_approvals set event_id=event_id',[],'42501'));
 await check('owner cannot delete pointer',()=>denied(ownerA,'delete from public.ci_canonical_active_approvals',[],'42501'));
 await check('stale publication loses compare-and-swap',async()=>assert.rejects(()=>publish(pubA,docs[1]),e=>e.code==='40001'));
 const second=await publish(pubA,docs[1],'APPROVE',first);
 await check('new version links predecessor and replaces pointer atomically',async()=>{
   assert.equal((await ownerA.query(view)).rows[0].id,docs[1]);
   assert.equal((await ownerA.query('select supersedes_event_id from public.ci_canonical_publication_events where id=$1',[second])).rows[0].supersedes_event_id,first);
 });
 await check('privileged event UPDATE rejected by immutable trigger',()=>denied(admin,'update public.ci_canonical_publication_events set review_reference=\'rewrite\' where id=$1',[first],'P0001'));
 await check('privileged event DELETE rejected by immutable trigger',()=>denied(admin,'delete from public.ci_canonical_publication_events where id=$1',[first],'P0001'));
 await check('owner/key mismatched pointer rejected',()=>denied(admin,'insert into public.ci_canonical_active_approvals values($1,\'other.md\',$2)',[A,second],'P0001'));
 await check('source mutation disappears from approved reader',async()=>{
   await admin.query('BEGIN');
   try{await admin.query('update public.canonical_documents set content=repeat(\'tampered\',90) where id=$1',[docs[1]]);assert.equal((await admin.query("select set_config('request.jwt.claim.sub',$1,true)",[A])).rowCount,1);assert.equal((await admin.query(view)).rows.length,0);}finally{await admin.query('ROLLBACK');}
 });
 await check('failed publication rolls event and pointer back together',async()=>{
   await pubA.query('BEGIN');
   try{await publish(pubA,docs[0],'APPROVE',second);assert.equal((await ownerA.query(view)).rows[0].approval_event_id,second);}finally{await pubA.query('ROLLBACK');}
   assert.equal((await ownerA.query(view)).rows[0].approval_event_id,second);
 });
 const revoked=await publish(pubA,docs[1],'REVOKE',second);
 await check('revocation removes pointer and retains audit',async()=>{
   assert.equal((await ownerA.query(view)).rows.length,0);
   assert.equal((await ownerA.query('select count(*)::int as n from public.ci_canonical_publication_events')).rows[0].n,3);
 });
 await check('revoked approval cannot be reactivated',()=>denied(admin,'insert into public.ci_canonical_active_approvals values($1,\'workflow.md\',$2)',[A,second],'P0001'));
 await check('repeated revoke rejected',async()=>assert.rejects(()=>publish(pubA,docs[1],'REVOKE',revoked),e=>e.code==='22023'));
 const third=await publish(pubA,docs[0],'APPROVE',revoked);
 const competitor=await session('ci_test_publisher',A);
 await check('two concurrent publishers yield one winner and one stale conflict',async()=>{
   const results=await Promise.allSettled([publish(pubA,docs[1],'APPROVE',third),publish(competitor,docs[1],'APPROVE',third)]);
   assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
   const rejected=results.find(x=>x.status==='rejected');assert.equal(rejected.reason.code,'40001');
   assert.equal((await ownerA.query(view)).rows.length,1);
 });
 const eventsBefore=(await admin.query('select * from public.ci_canonical_publication_events order by publication_sequence')).rows;
 const pointersBefore=(await admin.query('select * from public.ci_canonical_active_approvals order by owner_id,document_key')).rows;
 await check('safety disable removes reader and publisher access',async()=>{
   await admin.query(await read('supabase/proposals/canonical-publication-disable.sql'));
   await denied(ownerA,view,[],'42501');
   await assert.rejects(()=>publish(pubA,docs[0]),e=>e.code==='42501');
 });
 await check('safety disable preserves all sources, events and pointers',async()=>{
   assert.deepEqual((await admin.query('select * from public.canonical_documents order by id')).rows,before);
   assert.deepEqual((await admin.query('select * from public.ci_canonical_publication_events order by publication_sequence')).rows,eventsBefore);
   assert.deepEqual((await admin.query('select * from public.ci_canonical_active_approvals order by owner_id,document_key')).rows,pointersBefore);
 });
 await check('workflow replay restores access without reseeding evidence',async()=>{
   await admin.query(workflow);
   assert.equal((await ownerA.query(view)).rows.length,1);
   assert.deepEqual((await admin.query('select * from public.ci_canonical_publication_events order by publication_sequence')).rows,eventsBefore);
 });
 console.log(`${passed} PostgreSQL integration assertions passed. Synthetic DB claims; NOT Supabase Auth/HTTP or production acceptance.`);
} finally {
 await Promise.all(clients.map(c=>c.end().catch(()=>{})));
 await admin.end().catch(()=>{});
}
