import "server-only"
import { isDatabaseConfigured, query } from "../db"
import { MAPPED_VENUE_SUMMARIES } from "../venues/catalog-data"
import type { Role, RoleOrNone } from "./roles"

// The back office's reads and writes against the shared Postgres. Every caller
// is an /api/admin route that has already checked the staff member's role
// (src/lib/backoffice/staff.ts, requireStaff); nothing here checks it again,
// and nothing here is reachable from the public API.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isUuid = (s: string) => UUID.test(s)

// For ILIKE: the user's text as a literal, never as a pattern.
const like = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`

async function tableExists(name: string): Promise<boolean> {
  const { rows } = await query<{ ok: boolean }>("select to_regclass($1) is not null as ok", [`public.${name}`])
  return !!rows[0]?.ok
}

// ---- names for venue keys --------------------------------------------------
// Signals and search misses carry the venue's id as the app knows it: a
// bundled hospital ("gosh"), a shared venue (a uuid) or an OpenStreetMap
// hospital ("osm-ng-w123"). Name them where we can; the key stands in where not.
export async function venueNames(keys: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  const unique = [...new Set(keys)]
  for (const v of MAPPED_VENUE_SUMMARIES) if (unique.includes(v.id)) out[v.id] = v.name
  const uuids = unique.filter((k) => !out[k] && isUuid(k))
  if (uuids.length) {
    const { rows } = await query<{ id: string; name: string }>("select id::text, name from public.wf_venues where id = any($1::uuid[])", [uuids])
    for (const r of rows) out[r.id] = r.name
  }
  const world = unique.filter((k) => !out[k] && /^osm-[a-z]{2}-[nwr]\d+$/.test(k))
  if (world.length && (await tableExists("world_hospitals"))) {
    const { rows } = await query<{ key: string; name: string }>(
      `select 'osm-' || lower(country) || '-' || substr(id, 5) as key, name
         from public.world_hospitals
        where 'osm-' || lower(country) || '-' || substr(id, 5) = any($1::text[])`,
      [world]
    )
    for (const r of rows) out[r.key] = r.name
  }
  return out
}

// ---- overview ----------------------------------------------------------------
export interface Overview {
  database: boolean
  venues: { total: number; public: number; unlisted: number; private: number; verified: number; newThisWeek: number }
  searches: { openGroups: number; lastWeek: number }
  inbox: { reports: number; messages: number }
  signals: { lastWeek: number; lastMonth: number; devicesLastMonth: number }
  staff: number
  world: { countries: number; hospitals: number; siteMaps: number; indoorMaps: number; lastPublished: string | null } | null
  recentVenues: { id: string; name: string; visibility: string; createdAt: string }[]
  topSearches: { venueKey: string; venue: string; query: string; count: number }[]
}

export async function overview(): Promise<Overview> {
  const [v, s, n, m, recent, top, inbox] = await Promise.all([
    query<{ total: number; public: number; unlisted: number; private: number; verified: number; new_week: number }>(
      `select count(*)::int as total,
              count(*) filter (where visibility = 'public')::int as public,
              count(*) filter (where visibility = 'unlisted')::int as unlisted,
              count(*) filter (where visibility = 'private')::int as private,
              count(*) filter (where verified)::int as verified,
              count(*) filter (where created_at > now() - interval '7 days')::int as new_week
         from public.wf_venues`
    ),
    query<{ open_groups: number; last_week: number }>(
      `select (select count(*) from (select 1 from public.search_misses
                                      where resolved_at is null and created_at > now() - interval '30 days'
                                      group by venue_key, lower(query)) g)::int as open_groups,
              (select count(*) from public.search_misses where created_at > now() - interval '7 days')::int as last_week`
    ),
    query<{ week: number; month: number; devices: number }>(
      `select count(*) filter (where created_at > now() - interval '7 days')::int as week,
              count(*)::int as month,
              count(distinct device_id)::int as devices
         from public.nav_signals where created_at > now() - interval '30 days'`
    ),
    query<{ n: number }>("select count(*)::int as n from public.backoffice_members"),
    query<{ id: string; name: string; visibility: string; created_at: string }>(
      "select id::text, name, visibility, created_at from public.wf_venues order by created_at desc limit 5"
    ),
    query<{ venue_key: string; query: string; count: number }>(
      `select venue_key, min(query) as query, count(*)::int count from public.search_misses
        where resolved_at is null and created_at > now() - interval '30 days'
        group by venue_key, lower(query) order by count desc, max(created_at) desc limit 5`
    ),
    query<{ reports: number; messages: number }>(
      `select count(*) filter (where kind = 'report')::int as reports, count(*) filter (where kind = 'support')::int as messages
         from public.feedback where resolved_at is null`
    ),
  ])
  let world: Overview["world"] = null
  if (await tableExists("world_countries")) {
    const { rows } = await query<{ countries: number; hospitals: number; site_maps: number; indoor: number; last: string | null }>(
      `select (select count(*) from public.world_countries)::int as countries,
              (select coalesce(sum(hospitals), 0) from public.world_countries)::int as hospitals,
              (select count(*) from public.world_venues where kind = 'campus')::int as site_maps,
              (select count(*) from public.world_venues where kind = 'indoor')::int as indoor,
              (select max(generated_at) from public.world_countries)::text as last`
    )
    const w = rows[0]
    world = { countries: w.countries, hospitals: w.hospitals, siteMaps: w.site_maps, indoorMaps: w.indoor, lastPublished: w.last }
  }
  const names = await venueNames(top.rows.map((r) => r.venue_key))
  const vr = v.rows[0]
  return {
    database: true,
    venues: { total: vr.total, public: vr.public, unlisted: vr.unlisted, private: vr.private, verified: vr.verified, newThisWeek: vr.new_week },
    searches: { openGroups: s.rows[0].open_groups, lastWeek: s.rows[0].last_week },
    inbox: inbox.rows[0] ?? { reports: 0, messages: 0 },
    signals: { lastWeek: n.rows[0].week, lastMonth: n.rows[0].month, devicesLastMonth: n.rows[0].devices },
    staff: m.rows[0].n,
    world,
    recentVenues: recent.rows.map((r) => ({ id: r.id, name: r.name, visibility: r.visibility, createdAt: r.created_at })),
    topSearches: top.rows.map((r) => ({ venueKey: r.venue_key, venue: names[r.venue_key] ?? r.venue_key, query: r.query, count: r.count })),
  }
}

// ---- shared venues -------------------------------------------------------------
export interface AdminVenue {
  id: string
  name: string
  subtitle: string | null
  category: string
  visibility: "public" | "unlisted" | "private"
  ownerId: string | null
  verified: boolean
  verifiedAt: string | null
  waypoints: number
  createdAt: string
  updatedAt: string
}

export async function listVenues(opts: { q?: string; visibility?: string; verified?: boolean | null; limit: number; offset: number }): Promise<{ venues: AdminVenue[]; total: number }> {
  const { rows } = await query<{
    id: string; name: string; subtitle: string | null; category: string; visibility: AdminVenue["visibility"]; owner_id: string | null
    verified: boolean; verified_at: string | null; waypoints: number; created_at: string; updated_at: string; total: number
  }>(
    `select v.id::text, v.name, v.subtitle, v.category, v.visibility, v.owner_id, v.verified, v.verified_at, v.created_at, v.updated_at,
            (select count(*) from public.wf_waypoints w where w.venue_id = v.id)::int as waypoints,
            count(*) over ()::int as total
       from public.wf_venues v
      where ($1::text is null or v.name ilike $1 or coalesce(v.subtitle, '') ilike $1)
        and ($2::text is null or v.visibility = $2)
        and ($3::boolean is null or v.verified = $3)
      order by v.created_at desc
      limit $4 offset $5`,
    [opts.q ? like(opts.q) : null, opts.visibility ?? null, opts.verified ?? null, opts.limit, opts.offset]
  )
  return {
    total: rows[0]?.total ?? 0,
    venues: rows.map((r) => ({
      id: r.id, name: r.name, subtitle: r.subtitle, category: r.category, visibility: r.visibility, ownerId: r.owner_id,
      verified: r.verified, verifiedAt: r.verified_at, waypoints: r.waypoints, createdAt: r.created_at, updatedAt: r.updated_at,
    })),
  }
}

export async function updateVenue(id: string, patch: { visibility?: AdminVenue["visibility"]; verified?: boolean }, actorId: string): Promise<{ name: string } | null> {
  if (!isUuid(id)) return null
  const { rows } = await query<{ name: string }>(
    `update public.wf_venues
        set visibility  = coalesce($2::text, visibility),
            verified    = coalesce($3::boolean, verified),
            verified_at = case when $3::boolean is null then verified_at when $3 then now() else null end,
            verified_by = case when $3::boolean is null then verified_by when $3 then $4 else null end,
            updated_at  = now()
      where id = $1::uuid
      returning name`,
    [id, patch.visibility ?? null, patch.verified ?? null, actorId]
  )
  return rows[0] ?? null
}

export async function removeVenue(id: string): Promise<{ name: string; waypoints: number } | null> {
  if (!isUuid(id)) return null
  const { rows } = await query<{ name: string; waypoints: number }>(
    `with gone as (delete from public.wf_venues where id = $1::uuid returning id, name)
     select name, (select count(*) from public.wf_waypoints w where w.venue_id = gone.id)::int as waypoints from gone`,
    [id]
  )
  return rows[0] ?? null
}

// ---- search misses -------------------------------------------------------------
export interface MissGroup {
  venueKey: string
  venue: string
  query: string
  count: number
  suggested: number
  firstSeen: string
  lastSeen: string
  resolvedAt: string | null
}

export async function listMisses(opts: { status: "open" | "resolved"; days: number; q?: string; limit: number }): Promise<MissGroup[]> {
  const { rows } = await query<{ venue_key: string; query: string; count: number; suggested: number; first_seen: string; last_seen: string; resolved_at: string | null }>(
    `select venue_key, min(query) as query, count(*)::int as count, count(*) filter (where suggested)::int as suggested,
            min(created_at) as first_seen, max(created_at) as last_seen, max(resolved_at) as resolved_at
       from public.search_misses
      where created_at > now() - make_interval(days => $1)
        and (case when $2 = 'open' then resolved_at is null else resolved_at is not null end)
        and ($3::text is null or query ilike $3)
      group by venue_key, lower(query)
      order by count desc, max(created_at) desc
      limit $4`,
    [opts.days, opts.status, opts.q ? like(opts.q) : null, opts.limit]
  )
  const names = await venueNames(rows.map((r) => r.venue_key))
  return rows.map((r) => ({
    venueKey: r.venue_key, venue: names[r.venue_key] ?? r.venue_key, query: r.query, count: r.count, suggested: r.suggested,
    firstSeen: r.first_seen, lastSeen: r.last_seen, resolvedAt: r.resolved_at,
  }))
}

export async function setMissesResolved(venueKey: string, q: string, resolved: boolean, actorId: string): Promise<number> {
  const { rowCount } = await query(
    `update public.search_misses
        set resolved_at = case when $3 then now() else null end,
            resolved_by = case when $3 then $4 else null end
      where venue_key = $1 and lower(query) = lower($2) and (resolved_at is null) = $3`,
    [venueKey, q, resolved, actorId]
  )
  return rowCount ?? 0
}

// ---- inbox: reports about places, and support messages ------------------------------
// Written by /api/feedback. A report names the place it is about by the id the
// app knows it by; when that is a shared venue that still exists, its current
// state comes along so the moderator can act on it from the Inbox.
export interface InboxPlace {
  visibility: string
  verified: boolean
  ownerId: string | null
  // Staff can block whoever published it: the place carries a device key or
  // belongs to an account.
  blockable: boolean
  blocked: boolean
  openReports: number
}

export interface InboxItem {
  id: string
  kind: "report" | "support"
  topic: string
  venueId: string | null
  venueName: string | null
  message: string
  contactEmail: string | null
  source: string
  createdAt: string
  resolvedAt: string | null
  resolution: string | null
  // A shared venue that still exists; null for a bundled or world hospital, a
  // removed place, or a support message.
  place: InboxPlace | null
}

export async function listInbox(opts: {
  status: "open" | "resolved"
  kind?: "report" | "support"
  q?: string
  limit: number
  offset: number
}): Promise<{ items: InboxItem[]; total: number; open: { report: number; support: number } }> {
  const [list, open] = await Promise.all([
    query<{
      id: string; kind: InboxItem["kind"]; topic: string; venue_id: string | null; venue_name: string | null; message: string
      contact_email: string | null; source: string; created_at: string; resolved_at: string | null; resolution: string | null
      place_exists: boolean; visibility: string | null; verified: boolean | null; owner_id: string | null; publisher_key: string | null
      blocked: boolean; open_reports: number; total: number
    }>(
      `select f.id::text, f.kind, f.topic, f.venue_id, f.venue_name, f.message, f.contact_email, f.source, f.created_at, f.resolved_at, f.resolution,
              v.id is not null as place_exists, v.visibility, v.verified, v.owner_id, v.publisher_key,
              exists (select 1 from public.blocked_publishers b
                       where b.publisher_key = v.publisher_key or b.publisher_key = 'a:' || v.owner_id) as blocked,
              (select count(*) from public.feedback o
                where o.kind = 'report' and o.resolved_at is null and o.venue_id = f.venue_id)::int as open_reports,
              count(*) over ()::int as total
         from public.feedback f
         left join public.wf_venues v on f.kind = 'report' and v.id::text = lower(f.venue_id)
        where (case when $1 = 'open' then f.resolved_at is null else f.resolved_at is not null end)
          and ($2::text is null or f.kind = $2)
          and ($3::text is null or f.message ilike $3 or coalesce(f.venue_name, '') ilike $3 or coalesce(f.contact_email, '') ilike $3)
        order by coalesce(f.resolved_at, f.created_at) desc
        limit $4 offset $5`,
      [opts.status, opts.kind ?? null, opts.q ? like(opts.q) : null, opts.limit, opts.offset]
    ),
    query<{ report: number; support: number }>(
      `select count(*) filter (where kind = 'report')::int as report, count(*) filter (where kind = 'support')::int as support
         from public.feedback where resolved_at is null`
    ),
  ])
  return {
    total: list.rows[0]?.total ?? 0,
    open: open.rows[0] ?? { report: 0, support: 0 },
    items: list.rows.map((r) => ({
      id: r.id, kind: r.kind, topic: r.topic, venueId: r.venue_id, venueName: r.venue_name, message: r.message,
      contactEmail: r.contact_email, source: r.source, createdAt: r.created_at, resolvedAt: r.resolved_at, resolution: r.resolution,
      place: r.place_exists
        ? {
            visibility: r.visibility ?? "public", verified: !!r.verified, ownerId: r.owner_id,
            blockable: !!r.publisher_key || !!r.owner_id, blocked: r.blocked, openReports: r.open_reports,
          }
        : null,
    })),
  }
}

export async function getInboxItem(id: string): Promise<{ kind: InboxItem["kind"]; venueId: string | null; venueName: string | null; resolvedAt: string | null } | null> {
  if (!/^\d{1,18}$/.test(id)) return null
  const { rows } = await query<{ kind: InboxItem["kind"]; venue_id: string | null; venue_name: string | null; resolved_at: string | null }>(
    "select kind, venue_id, venue_name, resolved_at from public.feedback where id = $1::bigint",
    [id]
  )
  const r = rows[0]
  return r ? { kind: r.kind, venueId: r.venue_id, venueName: r.venue_name, resolvedAt: r.resolved_at } : null
}

// Mark one item dealt with (resolution says how), or open it again.
export async function setInboxResolved(id: string, resolution: string | null, actorId: string): Promise<boolean> {
  const { rowCount } = await query(
    `update public.feedback
        set resolved_at = case when $2::text is null then null else now() end,
            resolved_by = case when $2::text is null then null else $3 end,
            resolution  = $2
      where id = $1::bigint`,
    [id, resolution, actorId]
  )
  return (rowCount ?? 0) > 0
}

// Every open report about one place, closed together once the place is dealt with.
export async function resolveReportsFor(venueId: string, resolution: string, actorId: string): Promise<number> {
  const { rowCount } = await query(
    `update public.feedback set resolved_at = now(), resolved_by = $3, resolution = $2
      where kind = 'report' and resolved_at is null and venue_id = $1`,
    [venueId, resolution, actorId]
  )
  return rowCount ?? 0
}

// Stop whoever published a shared venue from publishing again: its device key,
// and its account when a signed-in person published it. Must run before the
// venue is removed, which takes the keys with it. Returns how many keys were
// newly blocked, or null when the venue is gone or carries no key.
export async function blockPublisherOf(venueId: string, reason: string, actorId: string): Promise<{ name: string; blocked: number } | null> {
  if (!isUuid(venueId)) return null
  const { rows } = await query<{ name: string; publisher_key: string | null; owner_id: string | null }>(
    "select name, publisher_key, owner_id from public.wf_venues where id = $1::uuid",
    [venueId]
  )
  const v = rows[0]
  if (!v) return null
  const keys = [v.publisher_key, v.owner_id ? `a:${v.owner_id}` : null].filter((k): k is string => !!k)
  if (keys.length === 0) return null
  const { rowCount } = await query(
    `insert into public.blocked_publishers (publisher_key, venue_id, venue_name, reason, blocked_by)
     select k, $2, $3, $4, $5 from unnest($1::text[]) as k
     on conflict (publisher_key) do nothing`,
    [keys, venueId, v.name, reason.slice(0, 200), actorId]
  )
  return { name: v.name, blocked: rowCount ?? 0 }
}

export interface BlockedPublisher {
  key: string
  kind: "device" | "account"
  // The account id for an account key; a short fingerprint for a device.
  label: string
  venueName: string | null
  reason: string | null
  blockedBy: string
  createdAt: string
}

export async function listBlocked(): Promise<BlockedPublisher[]> {
  const { rows } = await query<{ publisher_key: string; venue_name: string | null; reason: string | null; blocked_by: string; created_at: string }>(
    "select publisher_key, venue_name, reason, blocked_by, created_at from public.blocked_publishers order by created_at desc limit 500"
  )
  return rows.map((r) => {
    const account = r.publisher_key.startsWith("a:")
    return {
      key: r.publisher_key,
      kind: account ? "account" : "device",
      label: account ? r.publisher_key.slice(2) : `Device ${r.publisher_key.slice(2, 10)}`,
      venueName: r.venue_name,
      reason: r.reason,
      blockedBy: r.blocked_by,
      createdAt: r.created_at,
    }
  })
}

export async function unblockPublisher(key: string): Promise<{ venueName: string | null } | null> {
  const { rows } = await query<{ venue_name: string | null }>(
    "delete from public.blocked_publishers where publisher_key = $1 returning venue_name",
    [key]
  )
  return rows[0] ? { venueName: rows[0].venue_name } : null
}

// ---- navigation activity ---------------------------------------------------------
export const RETENTION_DAYS = 30

export interface Activity {
  days: number
  total: number
  devices: number
  daily: { day: string; kind: string; count: number }[]
  venues: { venueKey: string; venue: string; count: number; devices: number }[]
  retention: { days: number; older: number; oldest: string | null }
}

// The last `days` whole days in UTC, today included — the days the chart draws.
const SINCE_UTC_MIDNIGHT = "(date_trunc('day', now() at time zone 'UTC') - make_interval(days => $1 - 1)) at time zone 'UTC'"

export async function activity(days: number): Promise<Activity> {
  const [totals, daily, venues, retention] = await Promise.all([
    query<{ total: number; devices: number }>(
      `select count(*)::int as total, count(distinct device_id)::int as devices from public.nav_signals where created_at >= ${SINCE_UTC_MIDNIGHT}`,
      [days]
    ),
    query<{ day: string; kind: string; count: number }>(
      `select to_char(created_at at time zone 'UTC', 'YYYY-MM-DD') as day, kind, count(*)::int as count
         from public.nav_signals where created_at >= ${SINCE_UTC_MIDNIGHT}
        group by 1, 2 order by 1`,
      [days]
    ),
    query<{ venue_key: string; count: number; devices: number }>(
      `select venue_key, count(*)::int as count, count(distinct device_id)::int as devices
         from public.nav_signals where created_at >= ${SINCE_UTC_MIDNIGHT}
        group by venue_key order by count desc limit 12`,
      [days]
    ),
    query<{ older: number; oldest: string | null }>(
      "select count(*) filter (where created_at < now() - make_interval(days => $1))::int as older, min(created_at)::text as oldest from public.nav_signals",
      [RETENTION_DAYS]
    ),
  ])
  const names = await venueNames(venues.rows.map((r) => r.venue_key))
  return {
    days,
    total: totals.rows[0].total,
    devices: totals.rows[0].devices,
    daily: daily.rows,
    venues: venues.rows.map((r) => ({ venueKey: r.venue_key, venue: names[r.venue_key] ?? r.venue_key, count: r.count, devices: r.devices })),
    retention: { days: RETENTION_DAYS, older: retention.rows[0].older, oldest: retention.rows[0].oldest },
  }
}

export async function purgeSignals(olderThanDays: number): Promise<number> {
  const { rowCount } = await query("delete from public.nav_signals where created_at < now() - make_interval(days => $1)", [olderThanDays])
  return rowCount ?? 0
}

// ---- audit log -----------------------------------------------------------------------
export interface AuditEntry {
  id: string
  actorId: string
  actorEmail: string | null
  action: string
  target: string | null
  detail: Record<string, unknown>
  createdAt: string
}

export async function listAudit(opts: { action?: string; q?: string; limit: number; offset: number }): Promise<{ entries: AuditEntry[]; total: number }> {
  const { rows } = await query<{ id: string; actor_id: string; actor_email: string | null; action: string; target: string | null; detail: Record<string, unknown>; created_at: string; total: number }>(
    `select id::text, actor_id, actor_email, action, target, detail, created_at, count(*) over ()::int as total
       from public.backoffice_audit
      where ($1::text is null or action like $1 || '%')
        and ($2::text is null or coalesce(actor_email, '') ilike $2 or coalesce(target, '') ilike $2 or detail::text ilike $2)
      order by created_at desc
      limit $3 offset $4`,
    [opts.action ?? null, opts.q ? like(opts.q) : null, opts.limit, opts.offset]
  )
  return {
    total: rows[0]?.total ?? 0,
    entries: rows.map((r) => ({ id: r.id, actorId: r.actor_id, actorEmail: r.actor_email, action: r.action, target: r.target, detail: r.detail, createdAt: r.created_at })),
  }
}

// ---- staff roles -----------------------------------------------------------------------
export interface Member {
  userId: string
  role: Role
  email: string | null
  addedBy: string | null
  updatedAt: string
}

export async function listMembers(): Promise<Member[]> {
  const { rows } = await query<{ user_id: string; role: Role; email: string | null; added_by: string | null; updated_at: string }>(
    `select user_id, role, email, added_by, updated_at from public.backoffice_members
      order by array_position(array['owner','admin','editor','viewer'], role), email nulls last`
  )
  return rows.map((r) => ({ userId: r.user_id, role: r.role, email: r.email, addedBy: r.added_by, updatedAt: r.updated_at }))
}

export async function storedRoles(userIds: string[]): Promise<Record<string, Role>> {
  if (!userIds.length) return {}
  const { rows } = await query<{ user_id: string; role: Role }>("select user_id, role from public.backoffice_members where user_id = any($1::text[])", [userIds])
  return Object.fromEntries(rows.map((r) => [r.user_id, r.role]))
}

export async function setMemberRole(userId: string, role: RoleOrNone, email: string | null, actorId: string): Promise<void> {
  if (role === "none") {
    await query("delete from public.backoffice_members where user_id = $1", [userId])
    return
  }
  await query(
    `insert into public.backoffice_members (user_id, role, email, added_by) values ($1, $2, $3, $4)
     on conflict (user_id) do update set role = excluded.role, email = coalesce(excluded.email, backoffice_members.email), updated_at = now()`,
    [userId, role, email, actorId]
  )
}

export async function venuesOwnedBy(userIds: string[]): Promise<Record<string, number>> {
  if (!userIds.length) return {}
  const { rows } = await query<{ owner_id: string; n: number }>(
    "select owner_id, count(*)::int as n from public.wf_venues where owner_id = any($1::text[]) group by owner_id",
    [userIds]
  )
  return Object.fromEntries(rows.map((r) => [r.owner_id, r.n]))
}

// Before an account is deleted: its venues stay (others may rely on them) but
// no longer belong to anyone, and its staff role goes.
export async function releaseAccount(userId: string): Promise<number> {
  await query("delete from public.backoffice_members where user_id = $1", [userId])
  const { rowCount } = await query("update public.wf_venues set owner_id = null, updated_at = now() where owner_id = $1", [userId])
  return rowCount ?? 0
}

// ---- system ------------------------------------------------------------------------------
export async function databaseHealth(): Promise<{ ok: boolean; latencyMs: number | null; tables: { name: string; rows: number }[]; error?: string }> {
  if (!isDatabaseConfigured()) return { ok: false, latencyMs: null, tables: [], error: "not_configured" }
  const t0 = Date.now()
  try {
    await query("select 1")
    const latencyMs = Date.now() - t0
    const names = ["wf_venues", "wf_waypoints", "nav_signals", "search_misses", "backoffice_members", "backoffice_audit", "world_countries", "world_hospitals", "world_venues", "world_plans"]
    const tables: { name: string; rows: number }[] = []
    for (const name of names) {
      if (!(await tableExists(name))) continue
      const { rows } = await query<{ n: number }>(`select count(*)::int n from public.${name}`)
      tables.push({ name, rows: rows[0].n })
    }
    return { ok: true, latencyMs, tables }
  } catch (err) {
    // The message can name the host or the user; it goes to the log, not the page.
    console.warn("Back office: database health check failed:", err instanceof Error ? err.message : err)
    return { ok: false, latencyMs: null, tables: [], error: "unreachable" }
  }
}
