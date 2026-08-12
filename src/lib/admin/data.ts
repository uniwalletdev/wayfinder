import "server-only"

import { isDatabaseConfigured, query } from "@/lib/db"
import { catalogLabel } from "./catalog"
import {
  UNCONFIGURED,
  type AdminVenue,
  type AdminWaypoint,
  type AuditEntry,
  type DayPoint,
  type DemandRow,
  type Overview,
  type Result,
  type VenueActivity,
  type VenueStatus,
} from "./types"

// Every read the back office does, in one place.
//
// This is the Data Access Layer the Next.js data-security guide argues for: the
// pages themselves hold no SQL, so there is exactly one file to audit for "can
// this leak something it shouldn't". Two rules it keeps:
//
//   • edit_token is never selected. It is a venue's ownership secret, held by
//     the device that created it, and an operator reading it could impersonate
//     that owner against the public API. The portal can *rotate* it (which
//     revokes the old one) but can never display it.
//
//   • Nothing throws at the page. A database that is unreachable, or absent
//     entirely, is an ordinary state for this app — it runs device-only by
//     design — so every function returns a Result and the screens render the
//     reason. An operator's first question during an outage is "is the database
//     up?", and a portal that 500s cannot answer it.

function fail(err: unknown): Result<never> {
  const message = err instanceof Error ? err.message : String(err)
  console.warn("[admin] read failed:", message)
  return { ok: false, reason: "error", message }
}

// ── Row mappers ────────────────────────────────────────────────────────────

interface VenueRow {
  id: string
  slug: string | null
  name: string
  subtitle: string | null
  category: string
  center_lat: number
  center_lng: number
  default_zoom: number
  visibility: "public" | "unlisted" | "private"
  status: VenueStatus
  verified: boolean
  review_note: string | null
  reviewed_at: string | null
  reviewed_by: string | null
  created_at: string
  updated_at: string
  waypoint_count: string | number
  signal_count: string | number
}

// pg returns bigint (count(*)) as a string to avoid precision loss. Every count
// in this file goes through here so a template never renders "12" as "12" from
// one query and 12 from another.
function int(v: string | number | null | undefined): number {
  const n = typeof v === "string" ? parseInt(v, 10) : v ?? 0
  return Number.isFinite(n) ? Number(n) : 0
}

function toVenue(r: VenueRow): AdminVenue {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    subtitle: r.subtitle,
    category: r.category,
    centerLat: r.center_lat,
    centerLng: r.center_lng,
    defaultZoom: r.default_zoom,
    visibility: r.visibility,
    status: r.status,
    verified: r.verified,
    reviewNote: r.review_note,
    reviewedAt: r.reviewed_at,
    reviewedBy: r.reviewed_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    waypointCount: int(r.waypoint_count),
    signalCount: int(r.signal_count),
  }
}

const VENUE_SELECT = `
  v.id, v.slug, v.name, v.subtitle, v.category, v.center_lat, v.center_lng, v.default_zoom,
  v.visibility, v.status, v.verified, v.review_note, v.reviewed_at, v.reviewed_by,
  v.created_at, v.updated_at,
  (select count(*) from public.wf_waypoints w where w.venue_id = v.id) as waypoint_count,
  (select count(*) from public.nav_signals s where s.venue_key = v.id::text) as signal_count
`

// ── Overview ───────────────────────────────────────────────────────────────

const SERIES_DAYS = 30

function emptySeries(days: number): DayPoint[] {
  const out: DayPoint[] = []
  const today = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setUTCDate(d.getUTCDate() - i)
    out.push({ day: d.toISOString().slice(0, 10), signals: 0, misses: 0, venues: 0 })
  }
  return out
}

interface DayRow {
  d: string
  n: string | number
}

// Postgres hands back a date; normalise to YYYY-MM-DD so it keys the series map
// the same way regardless of the driver's date parsing.
function dayKey(d: string | Date): string {
  return (d instanceof Date ? d.toISOString() : new Date(d).toISOString()).slice(0, 10)
}

export async function getOverview(): Promise<Result<Overview>> {
  if (!isDatabaseConfigured()) return UNCONFIGURED
  try {
    const [venueCounts, waypointCount, signalCounts, demandCounts, sigSeries, missSeries, venueSeries, topDemand, recentVenues, recentAudit] =
      await Promise.all([
        query<{
          total: string
          published: string
          pending: string
          suppressed: string
          verified: string
          listed: string
          new_last7: string
          empty: string
        }>(`
          select
            count(*)                                                             as total,
            count(*) filter (where status = 'published')                         as published,
            count(*) filter (where status = 'pending')                           as pending,
            count(*) filter (where status = 'suppressed')                        as suppressed,
            count(*) filter (where verified)                                     as verified,
            count(*) filter (where status = 'published' and visibility = 'public') as listed,
            count(*) filter (where created_at >= now() - interval '7 days')      as new_last7,
            count(*) filter (where not exists (
              select 1 from public.wf_waypoints w where w.venue_id = wf_venues.id
            ))                                                                   as empty
          from public.wf_venues
        `),
        query<{ total: string }>(`select count(*) as total from public.wf_waypoints`),
        query<{ total: string; last24h: string; last7d: string; devices30d: string; venues30d: string }>(`
          select
            count(*)                                                          as total,
            count(*) filter (where created_at >= now() - interval '24 hours') as last24h,
            count(*) filter (where created_at >= now() - interval '7 days')   as last7d,
            count(distinct device_id) filter (where created_at >= now() - interval '30 days') as devices30d,
            count(distinct venue_key) filter (where created_at >= now() - interval '30 days') as venues30d
          from public.nav_signals
        `),
        query<{ total: string; open: string; last7d: string }>(`
          select
            count(*)                                                        as total,
            count(*) filter (where resolved_at is null)                     as open,
            count(*) filter (where created_at >= now() - interval '7 days') as last7d
          from public.search_misses
        `),
        query<DayRow>(`
          select date_trunc('day', created_at at time zone 'UTC')::date as d, count(*) as n
          from public.nav_signals where created_at >= now() - interval '${SERIES_DAYS} days' group by 1
        `),
        query<DayRow>(`
          select date_trunc('day', created_at at time zone 'UTC')::date as d, count(*) as n
          from public.search_misses where created_at >= now() - interval '${SERIES_DAYS} days' group by 1
        `),
        query<DayRow>(`
          select date_trunc('day', created_at at time zone 'UTC')::date as d, count(*) as n
          from public.wf_venues where created_at >= now() - interval '${SERIES_DAYS} days' group by 1
        `),
        query<DemandAggRow>(`
          select venue_key, min(query) as query, lower(query) as norm, count(*) as hits,
                 min(created_at) as first_seen, max(created_at) as last_seen,
                 bool_or(suggested) as suggested,
                 null::text as resolution, null::timestamptz as resolved_at, null::text as resolved_by
          from public.search_misses
          where resolved_at is null
          group by venue_key, lower(query)
          order by count(*) desc, max(created_at) desc
          limit 6
        `),
        query<VenueRow>(`select ${VENUE_SELECT} from public.wf_venues v order by v.created_at desc limit 6`),
        query<AuditRow>(`select id, actor, action, target_type, target_id, summary, detail, created_at
                           from public.wf_admin_audit order by created_at desc limit 6`),
      ])

    const series = emptySeries(SERIES_DAYS)
    const byDay = new Map(series.map((p) => [p.day, p]))
    for (const r of sigSeries.rows) { const p = byDay.get(dayKey(r.d)); if (p) p.signals = int(r.n) }
    for (const r of missSeries.rows) { const p = byDay.get(dayKey(r.d)); if (p) p.misses = int(r.n) }
    for (const r of venueSeries.rows) { const p = byDay.get(dayKey(r.d)); if (p) p.venues = int(r.n) }

    const v = venueCounts.rows[0]
    const s = signalCounts.rows[0]
    const d = demandCounts.rows[0]

    return {
      ok: true,
      data: {
        venues: {
          total: int(v.total),
          published: int(v.published),
          pending: int(v.pending),
          suppressed: int(v.suppressed),
          verified: int(v.verified),
          listed: int(v.listed),
          newLast7: int(v.new_last7),
          emptyOfWaypoints: int(v.empty),
        },
        waypoints: { total: int(waypointCount.rows[0].total) },
        signals: {
          total: int(s.total),
          last24h: int(s.last24h),
          last7d: int(s.last7d),
          devices30d: int(s.devices30d),
          venues30d: int(s.venues30d),
        },
        demand: { total: int(d.total), open: int(d.open), last7d: int(d.last7d) },
        series,
        topDemand: await labelDemand(topDemand.rows),
        recentVenues: recentVenues.rows.map(toVenue),
        recentAudit: recentAudit.rows.map(toAudit),
      },
    }
  } catch (err) {
    return fail(err)
  }
}

// ── Venues ─────────────────────────────────────────────────────────────────

export interface VenueQuery {
  q?: string
  status?: VenueStatus | "all"
  visibility?: "public" | "unlisted" | "private" | "all"
  verified?: "yes" | "no" | "all"
  sort?: VenueSort
  page?: number
  pageSize?: number
}

export type VenueSort = "newest" | "oldest" | "updated" | "name" | "waypoints" | "activity"

// Whitelisted, because an ORDER BY clause cannot be parameterised: the sort key
// arrives in the URL and must never reach SQL as text.
const SORTS: Record<VenueSort, string> = {
  newest: "v.created_at desc",
  oldest: "v.created_at asc",
  updated: "v.updated_at desc",
  name: "lower(v.name) asc",
  waypoints: "waypoint_count desc, v.created_at desc",
  activity: "signal_count desc, v.created_at desc",
}

export async function listVenues(
  params: VenueQuery
): Promise<Result<{ rows: AdminVenue[]; total: number; page: number; pageSize: number }>> {
  if (!isDatabaseConfigured()) return UNCONFIGURED

  const where: string[] = []
  const args: unknown[] = []
  if (params.q?.trim()) {
    args.push(`%${params.q.trim()}%`)
    where.push(`(v.name ilike $${args.length} or v.subtitle ilike $${args.length} or v.slug ilike $${args.length})`)
  }
  if (params.status && params.status !== "all") {
    args.push(params.status)
    where.push(`v.status = $${args.length}`)
  }
  if (params.visibility && params.visibility !== "all") {
    args.push(params.visibility)
    where.push(`v.visibility = $${args.length}`)
  }
  if (params.verified === "yes") where.push("v.verified")
  if (params.verified === "no") where.push("not v.verified")

  const clause = where.length ? `where ${where.join(" and ")}` : ""
  const order = SORTS[params.sort ?? "newest"] ?? SORTS.newest
  const pageSize = Math.min(Math.max(params.pageSize ?? 25, 5), 100)

  try {
    const counted = await query<{ n: string }>(`select count(*) as n from public.wf_venues v ${clause}`, args)
    const total = int(counted.rows[0].n)
    const pages = Math.max(1, Math.ceil(total / pageSize))
    const page = Math.max(1, Math.min(params.page ?? 1, pages))
    const rows = await query<VenueRow>(
      `select ${VENUE_SELECT} from public.wf_venues v ${clause}
       order by ${order} limit ${pageSize} offset ${(page - 1) * pageSize}`,
      args
    )
    return { ok: true, data: { rows: rows.rows.map(toVenue), total, page, pageSize } }
  } catch (err) {
    return fail(err)
  }
}

export interface VenueDetail {
  venue: AdminVenue
  waypoints: AdminWaypoint[]
  floorCounts: { floor: number; count: number }[]
  typeCounts: { type: string; count: number }[]
  signals: { total: number; devices: number; last: string | null; series: DayPoint[] }
  demand: DemandRow[]
  audit: AuditEntry[]
}

export async function getVenueDetail(id: string): Promise<Result<VenueDetail | null>> {
  if (!isDatabaseConfigured()) return UNCONFIGURED
  // The id comes straight from a URL and is cast to uuid in every query below;
  // a malformed one makes Postgres raise rather than return empty, so check the
  // shape first and answer "not found" the way a wrong-but-valid uuid would.
  if (!isUuid(id)) return { ok: true, data: null }

  try {
    const venue = await query<VenueRow>(`select ${VENUE_SELECT} from public.wf_venues v where v.id = $1`, [id])
    if (venue.rows.length === 0) return { ok: true, data: null }

    const [waypoints, signalStats, signalSeries, demand, audit] = await Promise.all([
      query<WaypointRow>(
        `select id, venue_id, name, type, lat, lng, floor, description, created_at
           from public.wf_waypoints where venue_id = $1 order by floor asc, lower(name) asc`,
        [id]
      ),
      query<{ total: string; devices: string; last: string | null }>(
        `select count(*) as total, count(distinct device_id) as devices, max(created_at) as last
           from public.nav_signals where venue_key = $1`,
        [id]
      ),
      query<DayRow>(
        `select date_trunc('day', created_at at time zone 'UTC')::date as d, count(*) as n
           from public.nav_signals
          where venue_key = $1 and created_at >= now() - interval '${SERIES_DAYS} days'
          group by 1`,
        [id]
      ),
      query<DemandAggRow>(
        `select venue_key, min(query) as query, lower(query) as norm, count(*) as hits,
                min(created_at) as first_seen, max(created_at) as last_seen,
                bool_or(suggested) as suggested,
                max(resolution) as resolution, max(resolved_at) as resolved_at, max(resolved_by) as resolved_by
           from public.search_misses where venue_key = $1
          group by venue_key, lower(query)
          order by count(*) desc limit 25`,
        [id]
      ),
      query<AuditRow>(
        `select id, actor, action, target_type, target_id, summary, detail, created_at
           from public.wf_admin_audit
          where target_id = $1 or detail->>'venueId' = $1
          order by created_at desc limit 40`,
        [id]
      ),
    ])

    const series = emptySeries(SERIES_DAYS)
    const byDay = new Map(series.map((p) => [p.day, p]))
    for (const r of signalSeries.rows) { const p = byDay.get(dayKey(r.d)); if (p) p.signals = int(r.n) }

    const floors = new Map<number, number>()
    const types = new Map<string, number>()
    for (const w of waypoints.rows) {
      floors.set(w.floor, (floors.get(w.floor) ?? 0) + 1)
      types.set(w.type, (types.get(w.type) ?? 0) + 1)
    }

    const st = signalStats.rows[0]
    return {
      ok: true,
      data: {
        venue: toVenue(venue.rows[0]),
        waypoints: waypoints.rows.map(toWaypoint),
        floorCounts: [...floors.entries()].map(([floor, count]) => ({ floor, count })).sort((a, b) => a.floor - b.floor),
        typeCounts: [...types.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
        signals: { total: int(st.total), devices: int(st.devices), last: st.last, series },
        demand: await labelDemand(demand.rows),
        audit: audit.rows.map(toAudit),
      },
    }
  } catch (err) {
    return fail(err)
  }
}

interface WaypointRow {
  id: string
  venue_id: string
  name: string
  type: string
  lat: number
  lng: number
  floor: number
  description: string | null
  created_at: string
}

function toWaypoint(r: WaypointRow): AdminWaypoint {
  return {
    id: r.id,
    venueId: r.venue_id,
    name: r.name,
    type: r.type,
    lat: r.lat,
    lng: r.lng,
    floor: r.floor,
    description: r.description,
    createdAt: r.created_at,
  }
}

export function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
}

// ── Demand (search misses) ─────────────────────────────────────────────────

interface DemandAggRow {
  venue_key: string
  query: string
  norm: string
  hits: string
  first_seen: string
  last_seen: string
  suggested: boolean
  resolution: string | null
  resolved_at: string | null
  resolved_by: string | null
}

/**
 * Put a human name against a venue_key.
 *
 * The column is deliberately free text (see /api/search-misses): a key can be a
 * shared venue's uuid, the id of a venue that ships with the build ("gosh"), or
 * a device-local id that exists on one phone and nowhere else. All three are
 * worth counting, and only the first two can be named — so the third is labelled
 * as what it is rather than dropped.
 */
async function labelForKeys(keys: string[]): Promise<Map<string, { label: string; source: VenueActivity["source"] }>> {
  const out = new Map<string, { label: string; source: VenueActivity["source"] }>()
  const uuids: string[] = []
  for (const k of keys) {
    const shipped = catalogLabel(k)
    if (shipped) out.set(k, { label: shipped, source: "catalog" })
    else if (isUuid(k)) uuids.push(k)
    else if (k.startsWith("venue-")) out.set(k, { label: "A place mapped on one device", source: "device" })
    else out.set(k, { label: k, source: "unknown" })
  }
  if (uuids.length > 0) {
    try {
      const { rows } = await query<{ id: string; name: string }>(
        `select id, name from public.wf_venues where id = any($1::uuid[])`,
        [uuids]
      )
      for (const r of rows) out.set(r.id, { label: r.name, source: "shared" })
    } catch {
      // Labelling is decoration; a failure here must not lose the counts.
    }
    for (const id of uuids) if (!out.has(id)) out.set(id, { label: "Deleted venue", source: "unknown" })
  }
  return out
}

async function labelDemand(rows: DemandAggRow[]): Promise<DemandRow[]> {
  const labels = await labelForKeys(rows.map((r) => r.venue_key))
  return rows.map((r) => ({
    venueKey: r.venue_key,
    venueLabel: labels.get(r.venue_key)?.label ?? r.venue_key,
    query: r.query,
    hits: int(r.hits),
    firstSeen: r.first_seen,
    lastSeen: r.last_seen,
    suggested: r.suggested,
    resolution: (r.resolution as DemandRow["resolution"]) ?? null,
    resolvedAt: r.resolved_at,
    resolvedBy: r.resolved_by,
  }))
}

export interface DemandQuery {
  q?: string
  state?: "open" | "resolved" | "all"
  venueKey?: string
  sort?: "hits" | "recent"
  page?: number
  pageSize?: number
}

export async function listDemand(
  params: DemandQuery
): Promise<Result<{ rows: DemandRow[]; total: number; page: number; pageSize: number }>> {
  if (!isDatabaseConfigured()) return UNCONFIGURED

  const where: string[] = []
  const args: unknown[] = []
  if (params.q?.trim()) {
    args.push(`%${params.q.trim()}%`)
    where.push(`query ilike $${args.length}`)
  }
  if (params.venueKey) {
    args.push(params.venueKey)
    where.push(`venue_key = $${args.length}`)
  }
  if (params.state === "open") where.push("resolved_at is null")
  if (params.state === "resolved") where.push("resolved_at is not null")
  const clause = where.length ? `where ${where.join(" and ")}` : ""
  const order = params.sort === "recent" ? "max(created_at) desc" : "count(*) desc, max(created_at) desc"
  const pageSize = Math.min(Math.max(params.pageSize ?? 40, 10), 200)

  try {
    const counted = await query<{ n: string }>(
      `select count(*) as n from (
         select 1 from public.search_misses ${clause} group by venue_key, lower(query)
       ) g`,
      args
    )
    const total = int(counted.rows[0].n)
    const pages = Math.max(1, Math.ceil(total / pageSize))
    const page = Math.max(1, Math.min(params.page ?? 1, pages))
    const rows = await query<DemandAggRow>(
      `select venue_key, min(query) as query, lower(query) as norm, count(*) as hits,
              min(created_at) as first_seen, max(created_at) as last_seen,
              bool_or(suggested) as suggested,
              max(resolution) as resolution, max(resolved_at) as resolved_at, max(resolved_by) as resolved_by
         from public.search_misses ${clause}
        group by venue_key, lower(query)
        order by ${order}
        limit ${pageSize} offset ${(page - 1) * pageSize}`,
      args
    )
    return { ok: true, data: { rows: await labelDemand(rows.rows), total, page, pageSize } }
  } catch (err) {
    return fail(err)
  }
}

// ── Activity (navigation signals) ──────────────────────────────────────────

export interface Activity {
  series: DayPoint[]
  totals: { trails: number; devices: number; venues: number; last: string | null }
  venues: VenueActivity[]
  recent: { id: string; venueKey: string; venueLabel: string; deviceId: string; floor: number; points: number; createdAt: string }[]
}

export async function getActivity(days = 30): Promise<Result<Activity>> {
  if (!isDatabaseConfigured()) return UNCONFIGURED
  const window = Math.min(Math.max(days, 7), 180)
  try {
    const [series, totals, byVenue, recent] = await Promise.all([
      query<DayRow>(
        `select date_trunc('day', created_at at time zone 'UTC')::date as d, count(*) as n
           from public.nav_signals where created_at >= now() - interval '${window} days' group by 1`
      ),
      query<{ trails: string; devices: string; venues: string; last: string | null }>(
        `select count(*) as trails, count(distinct device_id) as devices,
                count(distinct venue_key) as venues, max(created_at) as last
           from public.nav_signals`
      ),
      query<{ venue_key: string; trails: string; devices: string; last_seen: string }>(
        `select venue_key, count(*) as trails, count(distinct device_id) as devices, max(created_at) as last_seen
           from public.nav_signals group by venue_key order by count(*) desc limit 40`
      ),
      query<{ id: string; venue_key: string; device_id: string; floor: number; points: string; created_at: string }>(
        `select id, venue_key, device_id, floor,
                coalesce(jsonb_array_length(payload->'points'), 0) as points, created_at
           from public.nav_signals order by created_at desc limit 30`
      ),
    ])
    const labels = await labelForKeys([
      ...byVenue.rows.map((r) => r.venue_key),
      ...recent.rows.map((r) => r.venue_key),
    ])

    const points = emptySeries(window)
    const byDay = new Map(points.map((p) => [p.day, p]))
    for (const r of series.rows) { const p = byDay.get(dayKey(r.d)); if (p) p.signals = int(r.n) }

    const t = totals.rows[0]
    return {
      ok: true,
      data: {
        series: points,
        totals: { trails: int(t.trails), devices: int(t.devices), venues: int(t.venues), last: t.last },
        venues: byVenue.rows.map((r) => ({
          venueKey: r.venue_key,
          venueLabel: labels.get(r.venue_key)?.label ?? r.venue_key,
          source: labels.get(r.venue_key)?.source ?? "unknown",
          trails: int(r.trails),
          devices: int(r.devices),
          lastSeen: r.last_seen,
        })),
        recent: recent.rows.map((r) => ({
          id: r.id,
          venueKey: r.venue_key,
          venueLabel: labels.get(r.venue_key)?.label ?? r.venue_key,
          // Truncated on purpose: the whole identifier is not needed to tell two
          // walks apart on screen, and this page is read over shoulders.
          deviceId: `${r.device_id.slice(0, 8)}…`,
          floor: r.floor,
          points: int(r.points),
          createdAt: r.created_at,
        })),
      },
    }
  } catch (err) {
    return fail(err)
  }
}

// ── Retention / data protection ────────────────────────────────────────────

export interface RetentionStats {
  signals: { total: number; olderThan30: number; olderThan90: number; olderThan365: number; oldest: string | null }
  misses: { total: number; olderThan90: number; oldest: string | null }
  devices: { total: number; active30: number }
}

export async function getRetentionStats(): Promise<Result<RetentionStats>> {
  if (!isDatabaseConfigured()) return UNCONFIGURED
  try {
    const [signals, misses, devices] = await Promise.all([
      query<{ total: string; d30: string; d90: string; d365: string; oldest: string | null }>(`
        select count(*) as total,
               count(*) filter (where created_at < now() - interval '30 days')  as d30,
               count(*) filter (where created_at < now() - interval '90 days')  as d90,
               count(*) filter (where created_at < now() - interval '365 days') as d365,
               min(created_at) as oldest
          from public.nav_signals
      `),
      query<{ total: string; d90: string; oldest: string | null }>(`
        select count(*) as total,
               count(*) filter (where created_at < now() - interval '90 days') as d90,
               min(created_at) as oldest
          from public.search_misses
      `),
      query<{ total: string; active30: string }>(`
        select count(distinct device_id) as total,
               count(distinct device_id) filter (where created_at >= now() - interval '30 days') as active30
          from public.nav_signals
      `),
    ])
    const s = signals.rows[0]
    const m = misses.rows[0]
    const d = devices.rows[0]
    return {
      ok: true,
      data: {
        signals: {
          total: int(s.total),
          olderThan30: int(s.d30),
          olderThan90: int(s.d90),
          olderThan365: int(s.d365),
          oldest: s.oldest,
        },
        misses: { total: int(m.total), olderThan90: int(m.d90), oldest: m.oldest },
        devices: { total: int(d.total), active30: int(d.active30) },
      },
    }
  } catch (err) {
    return fail(err)
  }
}

/**
 * Everything held about one device identifier — the answer to a subject access
 * request, and what a deletion request would remove. Search misses carry no
 * device id (the route never stores one), so this is trails only, and the page
 * says so rather than implying the answer is complete.
 */
export interface DeviceRecord {
  deviceId: string
  trails: number
  venues: { venueKey: string; venueLabel: string; trails: number; lastSeen: string }[]
  first: string | null
  last: string | null
}

export async function getDeviceRecord(deviceId: string): Promise<Result<DeviceRecord | null>> {
  if (!isDatabaseConfigured()) return UNCONFIGURED
  const id = deviceId.trim()
  if (!id) return { ok: true, data: null }
  try {
    const [totals, byVenue] = await Promise.all([
      query<{ trails: string; first: string | null; last: string | null }>(
        `select count(*) as trails, min(created_at) as first, max(created_at) as last
           from public.nav_signals where device_id = $1`,
        [id]
      ),
      query<{ venue_key: string; trails: string; last_seen: string }>(
        `select venue_key, count(*) as trails, max(created_at) as last_seen
           from public.nav_signals where device_id = $1 group by venue_key order by count(*) desc`,
        [id]
      ),
    ])
    const t = totals.rows[0]
    if (int(t.trails) === 0) return { ok: true, data: null }
    const labels = await labelForKeys(byVenue.rows.map((r) => r.venue_key))
    return {
      ok: true,
      data: {
        deviceId: id,
        trails: int(t.trails),
        first: t.first,
        last: t.last,
        venues: byVenue.rows.map((r) => ({
          venueKey: r.venue_key,
          venueLabel: labels.get(r.venue_key)?.label ?? r.venue_key,
          trails: int(r.trails),
          lastSeen: r.last_seen,
        })),
      },
    }
  } catch (err) {
    return fail(err)
  }
}

// ── Audit log ──────────────────────────────────────────────────────────────

interface AuditRow {
  id: string
  actor: string
  action: string
  target_type: string | null
  target_id: string | null
  summary: string
  detail: Record<string, unknown> | null
  created_at: string
}

function toAudit(r: AuditRow): AuditEntry {
  return {
    id: r.id,
    actor: r.actor,
    action: r.action,
    targetType: r.target_type,
    targetId: r.target_id,
    summary: r.summary,
    detail: r.detail ?? {},
    createdAt: r.created_at,
  }
}

export async function listAudit(params: {
  q?: string
  action?: string
  page?: number
  pageSize?: number
}): Promise<Result<{ rows: AuditEntry[]; total: number; page: number; pageSize: number; actions: string[] }>> {
  if (!isDatabaseConfigured()) return UNCONFIGURED

  const where: string[] = []
  const args: unknown[] = []
  if (params.q?.trim()) {
    args.push(`%${params.q.trim()}%`)
    where.push(`(summary ilike $${args.length} or actor ilike $${args.length} or target_id ilike $${args.length})`)
  }
  if (params.action && params.action !== "all") {
    args.push(params.action)
    where.push(`action = $${args.length}`)
  }
  const clause = where.length ? `where ${where.join(" and ")}` : ""
  const pageSize = Math.min(Math.max(params.pageSize ?? 50, 10), 200)

  try {
    const [counted, actions] = await Promise.all([
      query<{ n: string }>(`select count(*) as n from public.wf_admin_audit ${clause}`, args),
      query<{ action: string }>(`select distinct action from public.wf_admin_audit order by action asc`),
    ])
    const total = int(counted.rows[0].n)
    const pages = Math.max(1, Math.ceil(total / pageSize))
    const page = Math.max(1, Math.min(params.page ?? 1, pages))
    const rows = await query<AuditRow>(
      `select id, actor, action, target_type, target_id, summary, detail, created_at
         from public.wf_admin_audit ${clause}
        order by created_at desc limit ${pageSize} offset ${(page - 1) * pageSize}`,
      args
    )
    return {
      ok: true,
      data: {
        rows: rows.rows.map(toAudit),
        total,
        page,
        pageSize,
        actions: actions.rows.map((r) => r.action),
      },
    }
  } catch (err) {
    return fail(err)
  }
}

// ── Health ─────────────────────────────────────────────────────────────────

export interface DbHealth {
  configured: boolean
  reachable: boolean
  latencyMs: number | null
  version: string | null
  error: string | null
  tables: { table: string; rows: number; present: boolean }[]
}

const TABLES = ["wf_venues", "wf_waypoints", "nav_signals", "search_misses", "wf_admin_audit"] as const

export async function getDbHealth(): Promise<DbHealth> {
  if (!isDatabaseConfigured()) {
    return { configured: false, reachable: false, latencyMs: null, version: null, error: null, tables: [] }
  }
  const started = Date.now()
  try {
    const { rows } = await query<{ version: string }>(`select version() as version`)
    const latencyMs = Date.now() - started
    const tables: DbHealth["tables"] = []
    for (const t of TABLES) {
      try {
        const c = await query<{ n: string }>(`select count(*) as n from public.${t}`)
        tables.push({ table: t, rows: int(c.rows[0].n), present: true })
      } catch {
        tables.push({ table: t, rows: 0, present: false })
      }
    }
    return {
      configured: true,
      reachable: true,
      latencyMs,
      version: rows[0]?.version?.split(",")[0] ?? null,
      error: null,
      tables,
    }
  } catch (err) {
    return {
      configured: true,
      reachable: false,
      latencyMs: null,
      version: null,
      error: err instanceof Error ? err.message : String(err),
      tables: [],
    }
  }
}
