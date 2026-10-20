import assert from 'node:assert/strict';
import {assertIsolatedDatabaseConfig as check} from '../../scripts/validate-staging-target.mjs';
const yes='yes';let passed=0;
function rejects(name,url,flag=yes){assert.throws(()=>check(url,flag));console.log('PASS',name);passed++}
function accepts(name,url){const x=check(url,yes);assert.match(x.database,/^ci_staging_/);console.log('PASS',name);passed++}
rejects('missing URL',undefined);
rejects('invalid URL','bad');
rejects('non Postgres protocol','https://localhost/ci_staging_a');
rejects('production Supabase host','postgresql://u:p@db.bwdafrwkimjvwfoqomot.supabase.co/ci_staging_a');
rejects('production proxy alias','postgresql://u:p@bwdafrwkimjvwfoqomot.pooler.local/ci_staging_a');
rejects('remote host','postgresql://u:p@remote.example.com/ci_staging_a');
rejects('remote localhost suffix','postgresql://u:p@localhost.attacker.test/ci_staging_a');
rejects('unconfirmed isolated database','postgresql://u:p@localhost/ci_staging_a','no');
rejects('default postgres database','postgresql://u:p@localhost/postgres');
rejects('lookalike database name','postgresql://u:p@localhost/ci_staging');
rejects('path traversal name','postgresql://u:p@localhost/ci_staging_a%2Fb');
accepts('localhost isolated','postgresql://u:p@localhost/ci_staging_a');
accepts('loopback isolated','postgresql://u:p@127.0.0.1/ci_staging_test');
console.log(`${passed} staging-target assertions passed; no connections opened`);
