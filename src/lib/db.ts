import { Pool, type QueryResult, type QueryResultRow } from "pg"

// Postgres access for the shared, cross-user data the app pools from usage
// (navigation signals today; more later). This is the backend that makes "the
// map improves from being navigated" work: a single navigator's device can't
// pool evidence from everyone, a shared table can.
//
// It mirrors the rest of the backend's stance (see supabase/server.ts and
// .env.example): every dependency is OPTIONAL. With no DATABASE_URL the app runs
// in device-only mode and these helpers report "not configured" instead of
// throwing, so a deployment without a database behaves exactly as before.
//
// Unlike the (dormant) Supabase layer, this talks to a raw Postgres connection
// string — which is what Railway's Postgres plugin provides via DATABASE_URL.

const DATABASE_URL = process.env.DATABASE_URL ?? ""

export function isDatabaseConfigured(): boolean {
  return DATABASE_URL.length > 0
}

// The pooled connection, created lazily on first use so importing this module is
// always side-effect-free (route files can import it even in device-only mode).
let pool: Pool | null = null

function getPool(): Pool | null {
  if (!isDatabaseConfigured()) return null
  if (!pool) {
    pool = new Pool({
      connectionString: DATABASE_URL,
      // Railway's private URL (…​.railway.internal) needs no TLS and rejects it;
      // the public URL requires it. Enable SSL only when the connection string
      // asks for it, and don't reject Railway's self-signed certificate.
      ssl: /sslmode=(require|verify)/.test(DATABASE_URL) ? { rejectUnauthorized: false } : undefined,
      max: 5,
    })
  }
  return pool
}

// The tables this module owns, as idempotent DDL. Kept here as the runtime
// source of truth and mirrored in db/migrations/0001_nav_signals.sql for ops and
// version control — the two must stay in step. gen_random_uuid() is core in
// Postgres 13+, so no pgcrypto extension is required.
const SCHEMA_DDL = `
create table if not exists public.nav_signals (
  id          uuid primary key default gen_random_uuid(),
  venue_key   text not null,
  device_id   text not null,
  kind        text not null,
  floor       int  not null default 0,
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  constraint nav_signals_kind_chk   check (kind in ('trail','arrival','qr_fix','off_route')),
  constraint nav_signals_venue_len  check (char_length(venue_key) between 1 and 80),
  constraint nav_signals_device_len check (char_length(device_id) between 1 and 64)
);
create index if not exists nav_signals_venue_kind_idx
  on public.nav_signals (venue_key, kind, created_at desc);
`

// Run the schema once per process. Cheap, and keeps setup zero-touch: a fresh
// Railway Postgres becomes usable on the first request with no manual migration
// step. On failure the promise is cleared so a transient outage (DB briefly
// down) is retried on the next call rather than poisoning the process.
let schemaReady: Promise<void> | null = null
function ensureSchema(p: Pool): Promise<void> {
  if (!schemaReady) {
    schemaReady = p
      .query(SCHEMA_DDL)
      .then(() => undefined)
      .catch((err) => {
        schemaReady = null
        throw err
      })
  }
  return schemaReady
}

// Run a parameterised query against the shared database, ensuring the schema
// exists first. Throws if called in device-only mode — callers that must degrade
// softly should gate on isDatabaseConfigured() before calling.
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<QueryResult<T>> {
  const p = getPool()
  if (!p) throw new Error("DATABASE_URL is not configured")
  await ensureSchema(p)
  return p.query<T>(text, params)
}
