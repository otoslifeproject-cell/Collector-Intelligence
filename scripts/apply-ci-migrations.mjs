import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import pg from 'pg'

const { Client } = pg
const PROJECT_REF = 'bwdafrwkimjvwfoqomot'
const dbUrl =
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  ''

if (!dbUrl) {
  console.log('[CI migrations] No database URL in this build environment; skipping database migration step.')
  process.exit(0)
}

if (!dbUrl.includes(PROJECT_REF)) {
  console.error('[CI migrations] SAFETY STOP: database URL is not the canonical Collector Intelligence project.')
  console.error(`[CI migrations] Expected project ref: ${PROJECT_REF}`)
  process.exit(3)
}

const migrationsDir = path.resolve('supabase/migrations')
const files = fs.readdirSync(migrationsDir)
  .filter(name => /^\d+.*\.sql$/.test(name))
  .sort()

const client = new Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
})

const sha256 = text => crypto.createHash('sha256').update(text).digest('hex')

async function scalar(text, values=[]) {
  const r = await client.query(text, values)
  if (!r.rows.length) return ''
  const first = r.rows[0]
  return String(first[Object.keys(first)[0]] ?? '')
}

async function alreadyExists(filename) {
  switch (filename) {
    case '001_core_schema.sql':
      return (await scalar(`
        select (
          to_regclass('public.items') is not null
          and to_regclass('public.item_evidence') is not null
          and to_regclass('public.comparables') is not null
        )::text
      `)) === 'true'
    case '002_rls_and_storage.sql':
      return (await scalar(`
        select (
          coalesce((select relrowsecurity from pg_class where oid='public.items'::regclass), false)
          and exists(select 1 from storage.buckets where id='item-images')
        )::text
      `)) === 'true'
    case '003_catalogue_views.sql':
      return (await scalar("select (to_regclass('public.external_catalogue') is not null)::text")) === 'true'
    case '004_ai_intake.sql':
      return (await scalar(`
        select (
          to_regclass('public.ai_analysis_runs') is not null
          and exists(
            select 1 from information_schema.columns
            where table_schema='public'
              and table_name='items'
              and column_name='source_analysis_run_id'
          )
        )::text
      `)) === 'true'
    default:
      return false
  }
}

async function record(filename, checksum, source) {
  await client.query(
    `insert into public.ci_migration_history(filename, sha256, source)
     values ($1,$2,$3)
     on conflict (filename) do nothing`,
    [filename, checksum, source]
  )
}

try {
  await client.connect()
  console.log(`[CI migrations] Connected to canonical Collector Intelligence project ${PROJECT_REF}.`)

  await client.query(`
    create table if not exists public.ci_migration_history (
      filename text primary key,
      sha256 text not null,
      applied_at timestamptz not null default now(),
      source text not null check (source in ('pipeline','adopted_existing'))
    )
  `)

  for (const filename of files) {
    const fullPath = path.join(migrationsDir, filename)
    const sqlText = fs.readFileSync(fullPath, 'utf8')
    const checksum = sha256(sqlText)

    const existing = await client.query(
      'select sha256 from public.ci_migration_history where filename=$1',
      [filename]
    )

    if (existing.rows.length) {
      if (existing.rows[0].sha256 !== checksum) {
        throw new Error(
          `Applied migration ${filename} has been edited. Create a new migration file instead.`
        )
      }
      console.log(`[CI migrations] Already applied: ${filename}`)
      continue
    }

    if (await alreadyExists(filename)) {
      console.log(`[CI migrations] Adopting existing migration into ledger: ${filename}`)
      await record(filename, checksum, 'adopted_existing')
      continue
    }

    console.log(`[CI migrations] Applying: ${filename}`)
    await client.query('begin')
    try {
      await client.query(sqlText)
      await client.query(
        `insert into public.ci_migration_history(filename, sha256, source)
         values ($1,$2,'pipeline')`,
        [filename, checksum]
      )
      await client.query('commit')
      console.log(`[CI migrations] Applied successfully: ${filename}`)
    } catch (error) {
      await client.query('rollback')
      throw error
    }
  }

  console.log('[CI migrations] Database is up to date.')
} catch (error) {
  console.error('[CI migrations] Migration failed:', error?.message || error)
  process.exitCode = 1
} finally {
  await client.end().catch(()=>{})
}
