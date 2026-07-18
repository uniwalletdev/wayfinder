import { randomUUID } from "crypto"
import { query } from "./db"
import { Venue, Waypoint } from "./types"
import { NewVenueInput } from "./venues"

// Server-side data access for shared venue maps (see db/migrations/0003_venues.sql).
// Reads are open; writes are gated by a per-venue edit_token minted at creation —
// this app has no accounts, so the token *is* the ownership proof. Every function
// here runs only in Route Handlers (it imports the pg pool via ./db).

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
  created_at: string
  updated_at: string
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
}

// Columns returned to clients — never selects edit_token, so the owner secret
// can't leak through a read.
const VENUE_COLS = "id, slug, name, subtitle, category, center_lat, center_lng, default_zoom, visibility, created_at, updated_at"

function slugify(name: string): string {
  const base = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
  return `${base || "place"}-${Math.random().toString(36).slice(2, 7)}`
}

function rowToWaypoint(r: WaypointRow): Waypoint {
  return {
    id: r.id,
    name: r.name,
    type: r.type as Waypoint["type"],
    coordinates: { lat: r.lat, lng: r.lng },
    floor: r.floor,
    description: r.description ?? undefined,
  }
}

function rowToVenue(r: VenueRow, waypoints: Waypoint[]): Venue {
  return {
    id: r.id,
    slug: r.slug ?? r.id,
    name: r.name,
    subtitle: r.subtitle ?? undefined,
    category: r.category as Venue["category"],
    center: { lat: r.center_lat, lng: r.center_lng },
    defaultZoom: r.default_zoom,
    floorPlans: [],
    waypoints,
    visibility: r.visibility,
    verified: false,
    quickAccess: [],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

// Attach each venue's waypoints in one extra query, avoiding an N+1 per venue.
async function withWaypoints(rows: VenueRow[]): Promise<Venue[]> {
  if (rows.length === 0) return []
  const ids = rows.map((r) => r.id)
  const { rows: wpRows } = await query<WaypointRow>(
    `select id, venue_id, name, type, lat, lng, floor, description
       from public.wf_waypoints where venue_id = any($1::uuid[])`,
    [ids]
  )
  const byVenue = new Map<string, Waypoint[]>()
  for (const w of wpRows) {
    const list = byVenue.get(w.venue_id) ?? []
    list.push(rowToWaypoint(w))
    byVenue.set(w.venue_id, list)
  }
  return rows.map((r) => rowToVenue(r, byVenue.get(r.id) ?? []))
}

// Public venues, listed for discovery. Unlisted/private are reachable by id only.
export async function listPublicVenues(): Promise<Venue[]> {
  const { rows } = await query<VenueRow>(
    `select ${VENUE_COLS} from public.wf_venues where visibility = 'public' order by created_at asc`
  )
  return withWaypoints(rows)
}

export async function getVenue(id: string): Promise<Venue | null> {
  const { rows } = await query<VenueRow>(`select ${VENUE_COLS} from public.wf_venues where id = $1`, [id])
  if (rows.length === 0) return null
  return (await withWaypoints(rows))[0]
}

// Create a venue and mint its edit_token. The token is returned exactly once,
// here — it is never selected by any read path.
export async function createVenue(input: NewVenueInput): Promise<{ venue: Venue; editToken: string }> {
  const editToken = randomUUID()
  const { rows } = await query<VenueRow>(
    `insert into public.wf_venues (slug, name, subtitle, category, center_lat, center_lng, default_zoom, visibility, edit_token)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     returning ${VENUE_COLS}`,
    [
      slugify(input.name),
      input.name.trim(),
      input.subtitle?.trim() || null,
      input.category,
      input.center.lat,
      input.center.lng,
      input.defaultZoom ?? 18,
      input.visibility,
      editToken,
    ]
  )
  return { venue: rowToVenue(rows[0], []), editToken }
}

// True when the token matches the venue's owner secret. A missing venue or a
// wrong token both return false — callers turn that into a 403.
async function ownsVenue(id: string, editToken: string): Promise<boolean> {
  if (!editToken) return false
  const { rows } = await query<{ ok: boolean }>(
    `select (edit_token = $2) as ok from public.wf_venues where id = $1`,
    [id, editToken]
  )
  return rows.length > 0 && rows[0].ok === true
}

export async function addWaypoints(
  venueId: string,
  editToken: string,
  waypoints: Waypoint[]
): Promise<{ ok: boolean; saved: Waypoint[] }> {
  if (!(await ownsVenue(venueId, editToken))) return { ok: false, saved: [] }
  if (waypoints.length === 0) return { ok: true, saved: [] }
  const saved: Waypoint[] = []
  for (const w of waypoints) {
    const { rows } = await query<WaypointRow>(
      `insert into public.wf_waypoints (venue_id, name, type, lat, lng, floor, description)
       values ($1,$2,$3,$4,$5,$6,$7)
       returning id, venue_id, name, type, lat, lng, floor, description`,
      [venueId, w.name, w.type, w.coordinates.lat, w.coordinates.lng, w.floor, w.description ?? null]
    )
    saved.push(rowToWaypoint(rows[0]))
  }
  await query(`update public.wf_venues set updated_at = now() where id = $1`, [venueId])
  return { ok: true, saved }
}

export async function deleteVenue(venueId: string, editToken: string): Promise<boolean> {
  if (!(await ownsVenue(venueId, editToken))) return false
  await query(`delete from public.wf_venues where id = $1`, [venueId])
  return true
}
