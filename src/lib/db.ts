import { Pool, type QueryResult, type QueryResultRow } from "pg"

// Postgres access for the shared, cross-user data the app pools from usage
// (navigation signals today; more later). This is the backend that makes "the
// map improves from being navigated" work: a single navigator's device can't
// pool evidence from everyone, a shared table can.
//
// It mirrors the rest of the backend's stance (see .env.example): every
// dependency is OPTIONAL. With no DATABASE_URL the app runs in device-only mode
// and these helpers report "not configured" instead of throwing, so a
// deployment without a database behaves exactly as before.
//
// It talks to a raw Postgres connection string — what Railway's Postgres plugin
// provides via DATABASE_URL.

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

create table if not exists public.search_misses (
  id         uuid primary key default gen_random_uuid(),
  venue_key  text not null,
  query      text not null,
  suggested  boolean not null default false,
  created_at timestamptz not null default now(),
  constraint search_misses_query_len check (char_length(query) between 1 and 160),
  constraint search_misses_venue_len check (char_length(venue_key) between 1 and 80)
);
create index if not exists search_misses_venue_idx
  on public.search_misses (venue_key, created_at desc);

-- Shared venue maps: the authored map (Claude-read or surveyed points, and the
-- places themselves) lifted off a single device so it persists and can be reused
-- across devices/users. There are no accounts, so a venue carries an edit_token
-- minted to its creator: reads are open, writes require the token. visibility is
-- metadata (public venues are listed; unlisted/private are reachable by id only).
create table if not exists public.venues (
  id           uuid primary key default gen_random_uuid(),
  slug         text,
  name         text not null,
  subtitle     text,
  category     text not null default 'other',
  center_lat   double precision not null,
  center_lng   double precision not null,
  default_zoom int not null default 18,
  visibility   text not null default 'public' check (visibility in ('public','unlisted','private')),
  edit_token   text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint venues_name_len check (char_length(name) between 1 and 120)
);
create index if not exists venues_visibility_idx on public.venues (visibility, created_at desc);

create table if not exists public.waypoints (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid not null references public.venues (id) on delete cascade,
  name        text not null,
  type        text not null default 'other',
  lat         double precision not null,
  lng         double precision not null,
  floor       int not null default 0,
  description text,
  created_at  timestamptz not null default now(),
  constraint waypoints_name_len check (char_length(name) between 1 and 200)
);
create index if not exists waypoints_venue_idx on public.waypoints (venue_id);
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
