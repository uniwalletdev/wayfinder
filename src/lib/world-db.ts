import { isDatabaseConfigured, query } from "./db"
import type { Venue } from "./types"

// Server-side access to the worldwide hospital data (scripts/world/), kept in
// the shared Postgres rather than in the repository: the per-country lists,
// the indoor and site-map venues and their floor plans run to hundreds of
// megabytes across the world and are refreshed monthly, which is no size for
// git or for a deploy. The World hospital data workflow publishes into these
// tables (scripts/world/publish.mjs) and /api/world/* serves them, cached at
// the edge, to the website and the apps alike.
//
// Like everything else in the backend the database is optional: without
// DATABASE_URL the routes answer "not found" and the app shows a country as
// having no hospitals listed yet.

export const OSM_ATTRIBUTION = "© OpenStreetMap contributors (ODbL)"

// Mirrored in db/migrations/0005_world.sql; the two must stay in step.
const WORLD_DDL = `
create table if not exists public.world_countries (
  country      char(2) primary key,
  name         text,
  hospitals    int not null default 0,
  mapped       int not null default 0,
  generated_at timestamptz,
  updated_at   timestamptz not null default now()
);
create table if not exists public.world_hospitals (
  country    char(2) not null,
  id         text not null,
  name       text not null,
  lat        double precision not null,
  lng        double precision not null,
  city       text,
  street     text,
  postcode   text,
  operator   text,
  emergency  boolean not null default false,
  mapped     boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (country, id)
);
create index if not exists world_hospitals_pos_idx on public.world_hospitals (country, lat, lng);
create table if not exists public.world_venues (
  id         text primary key,
  country    char(2) not null,
  kind       text not null,
  venue      jsonb not null,
  updated_at timestamptz not null default now(),
  constraint world_venues_kind_chk check (kind in ('indoor', 'campus'))
);
create index if not exists world_venues_country_idx on public.world_venues (country);
create table if not exists public.world_plans (
  venue_id text not null references public.world_venues (id) on delete cascade,
  plan_id  text not null,
  svg      text not null,
  primary key (venue_id, plan_id)
);
`

let ready: Promise<void> | null = null
async function ensureWorldSchema(): Promise<void> {
  if (!ready) {
    ready = query(WORLD_DDL)
      .then(() => undefined)
      .catch((err) => {
        ready = null
        throw err
      })
  }
  return ready
}

export const worldAvailable = isDatabaseConfigured

// ---- validation, shared with the routes and unit-tested on its own -------

export function parseCountry(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim().toUpperCase()
  return /^[A-Z]{2}$/.test(v) ? v : null
}

// App ids are osm-<cc>-<n|w|r><digits>; the database keys hospitals by country
// and the OSM part, venues by the whole id.
export function parseWorldId(raw: string | null | undefined): { id: string; country: string; rowId: string } | null {
  const v = (raw ?? "").trim().toLowerCase()
  const m = v.match(/^osm-([a-z]{2})-([nwr]\d{1,12})$/)
  return m ? { id: v, country: m[1].toUpperCase(), rowId: `osm-${m[2]}` } : null
}

export function parseLatLng(lat: string | null | undefined, lng: string | null | undefined): { lat: number; lng: number } | null {
  if (!lat?.trim() || !lng?.trim()) return null
  const a = Number(lat)
  const b = Number(lng)
  if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a) > 90 || Math.abs(b) > 180) return null
  return { lat: a, lng: b }
}

export function parsePlanId(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim()
  const m = v.match(/^([a-z0-9-]{1,32})(?:\.svg)?$/i)
  return m ? m[1] : null
}

// ---- reads -------------------------------------------------------------

export interface WorldHospitalRow {
  id: string
  name: string
  lat: number
  lng: number
  city?: string
  street?: string
  postcode?: string
  operator?: string
  emergency?: boolean
  mapped?: boolean
}

interface HospitalRecord {
  id: string
  name: string
  lat: number
  lng: number
  city: string | null
  street: string | null
  postcode: string | null
  operator: string | null
  emergency: boolean
  mapped: boolean
}

function rowOf(r: HospitalRecord): WorldHospitalRow {
  const row: WorldHospitalRow = { id: r.id, name: r.name, lat: r.lat, lng: r.lng }
  if (r.city) row.city = r.city
  if (r.street) row.street = r.street
  if (r.postcode) row.postcode = r.postcode
  if (r.operator) row.operator = r.operator
  if (r.emergency) row.emergency = true
  if (r.mapped) row.mapped = true
  return row
}

const HOSPITAL_COLUMNS = "id, name, lat, lng, city, street, postcode, operator, emergency, mapped"

export interface WorldCountry {
  country: string
  name?: string
  generatedAt?: string
  attribution: string
  hospitals: WorldHospitalRow[]
}

// A country's whole directory, in the shape the app reads. null when the
// country has never been published.
export async function getCountry(country: string): Promise<WorldCountry | null> {
  await ensureWorldSchema()
  const meta = await query<{ name: string | null; generated_at: Date | null }>(
    "select name, generated_at from public.world_countries where country = $1",
    [country]
  )
  if (meta.rowCount === 0) return null
  const rows = await query<HospitalRecord>(
    `select ${HOSPITAL_COLUMNS} from public.world_hospitals where country = $1 order by name`,
    [country]
  )
  const m = meta.rows[0]
  return {
    country,
    ...(m.name ? { name: m.name } : {}),
    ...(m.generated_at ? { generatedAt: m.generated_at.toISOString() } : {}),
    attribution: OSM_ATTRIBUTION,
    hospitals: rows.rows.map(rowOf),
  }
}

export async function getHospital(country: string, rowId: string): Promise<WorldHospitalRow | null> {
  await ensureWorldSchema()
  const res = await query<HospitalRecord>(
    `select ${HOSPITAL_COLUMNS} from public.world_hospitals where country = $1 and id = $2`,
    [country, rowId]
  )
  return res.rowCount ? rowOf(res.rows[0]) : null
}

// The hospitals nearest a point in a country, nearest first, with the distance
// in metres. Plain arithmetic rather than PostGIS: within a country a
// flat-earth distance scaled by the cosine of the latitude is accurate to a
// fraction of a percent, which is all "which hospital am I at" needs. A box
// of ±2° keeps the index useful; a country with nothing that close is
// searched whole.
export async function getNearest(country: string, lat: number, lng: number, limit = 3): Promise<(WorldHospitalRow & { distanceM: number })[]> {
  await ensureWorldSchema()
  const k = Math.max(0.1, Math.cos((lat * Math.PI) / 180))
  const dist = `sqrt(power((lat - $2) * 111320, 2) + power((lng - $3) * 111320 * ${k.toFixed(6)}, 2))`
  const boxed = await query<HospitalRecord & { distance_m: number }>(
    `select ${HOSPITAL_COLUMNS}, ${dist} as distance_m from public.world_hospitals
     where country = $1 and lat between $2 - 2 and $2 + 2 and lng between $3 - ${(2 / k).toFixed(4)} and $3 + ${(2 / k).toFixed(4)}
     order by distance_m limit $4`,
    [country, lat, lng, limit]
  )
  const res = boxed.rowCount
    ? boxed
    : await query<HospitalRecord & { distance_m: number }>(
        `select ${HOSPITAL_COLUMNS}, ${dist} as distance_m from public.world_hospitals where country = $1 order by distance_m limit $4`,
        [country, lat, lng, limit]
      )
  return res.rows.map((r) => ({ ...rowOf(r), distanceM: Math.round(r.distance_m) }))
}

// A built venue, its plans pointed at the plan route.
export async function getVenue(id: string): Promise<Venue | null> {
  await ensureWorldSchema()
  const res = await query<{ venue: Venue }>("select venue from public.world_venues where id = $1", [id])
  if (!res.rowCount) return null
  const v = res.rows[0].venue
  return {
    ...v,
    floorPlans: (v.floorPlans ?? []).map((p) => ({ ...p, imageUrl: `/api/world/plans/${id}/${p.id}.svg` })),
  }
}

export async function getPlan(venueId: string, planId: string): Promise<string | null> {
  await ensureWorldSchema()
  const res = await query<{ svg: string }>("select svg from public.world_plans where venue_id = $1 and plan_id = $2", [venueId, planId])
  return res.rowCount ? res.rows[0].svg : null
}
