import type { IncomingMessage, ServerResponse } from 'node:http'
import crypto from 'node:crypto'
import pg from 'pg'

const { Client } = pg

const PROJECT_REF = 'bwdafrwkimjvwfoqomot'
const REPO = 'otoslifeproject-cell/Collector-Intelligence'

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(body))
}

function getToken(req: IncomingMessage) {
  const url = new URL(req.url || '/', 'https://collector-intelligence.invalid')
  return url.searchParams.get('token') || ''
}

function sha256(text: string) {
  return crypto.createHash('sha256').update(text).digest('hex')
}

async function connectDatabase() {
  const publicUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    ''

  if (!publicUrl.includes(PROJECT_REF)) {
    throw new Error('Safety stop: this deployment is not connected to the canonical Collector Intelligence Supabase project.')
  }

  const candidates = [
    ['POSTGRES_URL', process.env.POSTGRES_URL],
    ['POSTGRES_PRISMA_URL', process.env.POSTGRES_PRISMA_URL],
    ['POSTGRES_URL_NON_POOLING', process.env.POSTGRES_URL_NON_POOLING],
    ['DATABASE_URL', process.env.DATABASE_URL]
  ].filter((entry): entry is [string, string] => Boolean(entry[1]))

  let lastError: unknown = null

  for (const [source, connectionString] of candidates) {
    const client = new Client({
      connectionString,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 8000
    })
    try {
      await client.connect()
      return { client, source }
    } catch (error) {
      lastError = error
      await client.end().catch(() => {})
    }
  }

  throw lastError || new Error('No Collector Intelligence database connection succeeded.')
}

async function scalar(client: pg.Client, sql: string) {
  const result = await client.query(sql)
  if (!result.rows.length) return ''
  const first = result.rows[0]
  return String(first[Object.keys(first)[0]] ?? '')
}

async function alreadyExists(client: pg.Client, filename: string) {
  switch (filename) {
    case '001_core_schema.sql':
      return (await scalar(client, `
        select (
          to_regclass('public.items') is not null
          and to_regclass('public.item_evidence') is not null
          and to_regclass('public.comparables') is not null
        )::text
      `)) === 'true'
    case '002_rls_and_storage.sql':
      return (await scalar(client, `
        select (
          coalesce((select relrowsecurity from pg_class where oid='public.items'::regclass), false)
          and exists(select 1 from storage.buckets where id='item-images')
        )::text
      `)) === 'true'
    case '003_catalogue_views.sql':
      return (await scalar(client, "select (to_regclass('public.external_catalogue') is not null)::text")) === 'true'
    case '004_ai_intake.sql':
      return (await scalar(client, `
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

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'GET') {
    return send(res, 405, { ok: false, error: 'GET only' })
  }

  const expectedToken = process.env.CI_MIGRATION_TOKEN || ''
  const providedToken = getToken(req)

  if (!expectedToken || providedToken !== expectedToken) {
    return send(res, 401, { ok: false, error: 'Unauthorized' })
  }

  let client: pg.Client | null = null

  try {
    const connected = await connectDatabase()
    client = connected.client

    await client.query(`
      create table if not exists public.ci_migration_history (
        filename text primary key,
        sha256 text not null,
        applied_at timestamptz not null default now(),
        source text not null check (source in ('pipeline','adopted_existing'))
      )
    `)

    const sha = process.env.VERCEL_GIT_COMMIT_SHA || 'main'
    const listUrl = `https://api.github.com/repos/${REPO}/contents/supabase/migrations?ref=${encodeURIComponent(sha)}`
    const listResponse = await fetch(listUrl, {
      headers: { 'user-agent': 'collector-intelligence-migrator' }
    })
    if (!listResponse.ok) {
      throw new Error(`Could not load migration manifest from GitHub (${listResponse.status}).`)
    }

    const entries = await listResponse.json() as Array<{ name: string; type: string }>
    const files = entries
      .filter(entry => entry.type === 'file' && /^\d+.*\.sql$/.test(entry.name))
      .map(entry => entry.name)
      .sort()

    const applied: string[] = []
    const adopted: string[] = []
    const skipped: string[] = []

    for (const filename of files) {
      const rawUrl = `https://raw.githubusercontent.com/${REPO}/${encodeURIComponent(sha)}/supabase/migrations/${encodeURIComponent(filename)}`
      const rawResponse = await fetch(rawUrl, {
        headers: { 'user-agent': 'collector-intelligence-migrator' }
      })
      if (!rawResponse.ok) {
        throw new Error(`Could not load ${filename} from GitHub (${rawResponse.status}).`)
      }

      const sqlText = await rawResponse.text()
      const checksum = sha256(sqlText)
      const existing = await client.query(
        'select sha256 from public.ci_migration_history where filename=$1',
        [filename]
      )

      if (existing.rows.length) {
        if (existing.rows[0].sha256 !== checksum) {
          throw new Error(`Applied migration ${filename} was edited. Create a new migration file instead.`)
        }
        skipped.push(filename)
        continue
      }

      if (await alreadyExists(client, filename)) {
        await client.query(
          `insert into public.ci_migration_history(filename, sha256, source)
           values ($1,$2,'adopted_existing')`,
          [filename, checksum]
        )
        adopted.push(filename)
        continue
      }

      await client.query('begin')
      try {
        await client.query(sqlText)
        await client.query(
          `insert into public.ci_migration_history(filename, sha256, source)
           values ($1,$2,'pipeline')`,
          [filename, checksum]
        )
        await client.query('commit')
        applied.push(filename)
      } catch (error) {
        await client.query('rollback')
        throw error
      }
    }

    const aiReady = (await scalar(client, `
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

    return send(res, 200, {
      ok: true,
      project_ref: PROJECT_REF,
      connection: connected.source,
      commit: sha,
      adopted,
      applied,
      skipped,
      ai_intake_schema_ready: aiReady
    })
  } catch (error: any) {
    return send(res, 500, {
      ok: false,
      error: error?.message || String(error)
    })
  } finally {
    if (client) await client.end().catch(() => {})
  }
}
