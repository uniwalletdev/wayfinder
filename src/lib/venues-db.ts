import { randomUUID } from "crypto"
import { query } from "./db"
import { Venue, VenueVisibility, Waypoint } from "./types"
import { NewVenueInput, slugify as slugifyName } from "./venues/core"

// Server-side data access for shared venue maps (see db/migrations/0003_venues.sql
// and 0004_venue_owner.sql). Reads are open; writes are gated by a per-venue
// edit_token minted at creation OR by the account that owns the venue. Every
// function here runs only in Route Handlers (it imports the pg pool via ./db).
//
// `viewerId` is the signed-in user making the request, or null. It decides two
// things: whether a venue's `ownerId` is revealed (only to its owner — another
// user's account id is nobody else's business) and whether their own
// unlisted/private venues are listed for them.

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
  owner_id: string | null
  verified: boolean | null
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

// Columns returned to clients — never selects edit_token or publisher_key, so
// the owner secret and the publisher's device key can't leak through a read.
const VENUE_COLS = "id, slug, name, subtitle, category, center_lat, center_lng, default_zoom, visibility, owner_id, verified, created_at, updated_at"

// Slugs on the server carry a random suffix: several people can create
// venues with the same name, and each must stay independently addressable.
function slugify(name: string): string {
  return `${slugifyName(name)}-${Math.random().toString(36).slice(2, 7)}`
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

function rowToVenue(r: VenueRow, waypoints: Waypoint[], viewerId: string | null): Venue {
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
    // Set by staff in the back office (/admin/venues).
    verified: !!r.verified,
    // Revealed to the owner only: it is how their client knows the venue is
    // theirs on a device that never held the edit token.
    ownerId: r.owner_id && viewerId && r.owner_id === viewerId ? r.owner_id : undefined,
    quickAccess: [],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

// Attach each venue's waypoints in one extra query, avoiding an N+1 per venue.
async function withWaypoints(rows: VenueRow[], viewerId: string | null): Promise<Venue[]> {
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
  return rows.map((r) => rowToVenue(r, byVenue.get(r.id) ?? [], viewerId))
}

// Public venues, listed for discovery, plus the viewer's own venues of any
// visibility — an account is what carries an unlisted venue between devices.
export async function listPublicVenues(viewerId: string | null = null): Promise<Venue[]> {
  const { rows } = await query<VenueRow>(
    `select ${VENUE_COLS} from public.wf_venues
      where visibility = 'public' or ($1::text is not null and owner_id = $1)
      order by created_at asc`,
    [viewerId]
  )
  return withWaypoints(rows, viewerId)
}

export async function getVenue(id: string, viewerId: string | null = null): Promise<Venue | null> {
  const { rows } = await query<VenueRow>(`select ${VENUE_COLS} from public.wf_venues where id = $1`, [id])
  if (rows.length === 0) return null
  return (await withWaypoints(rows, viewerId))[0]
}

// Create a venue and mint its edit_token. The token is returned exactly once,
// here — it is never selected by any read path. A signed-in creator also owns
// it by account from the start.
// publisherKey is the hashed device key (src/lib/publishers.ts) that lets
// staff block an abusive publisher; it is never returned to clients.
export async function createVenue(
  input: NewVenueInput,
  ownerId: string | null = null,
  publisherKey: string | null = null
): Promise<{ venue: Venue; editToken: string }> {
  const editToken = randomUUID()
  const { rows } = await query<VenueRow>(
    `insert into public.wf_venues (slug, name, subtitle, category, center_lat, center_lng, default_zoom, visibility, edit_token, owner_id, publisher_key)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
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
      ownerId,
      publisherKey,
    ]
  )
  return { venue: rowToVenue(rows[0], [], ownerId), editToken }
}

// True when the token matches the venue's owner secret, or the request comes
// from the account that owns it. A missing venue, a wrong token and a stranger
// all return false — callers turn that into a 403 without saying which.
async function ownsVenue(id: string, editToken: string, userId: string | null): Promise<boolean> {
  if (!editToken && !userId) return false
  const { rows } = await query<{ ok: boolean }>(
    `select (($2::text <> '' and edit_token = $2) or ($3::text is not null and owner_id = $3)) as ok
       from public.wf_venues where id = $1`,
    [id, editToken, userId]
  )
  return rows.length > 0 && rows[0].ok === true
}

// Attach a venue created anonymously to the account presenting its token, so
// it follows the person rather than the phone. Idempotent for the same
// account; refuses to move a venue between accounts.
export async function claimVenue(id: string, editToken: string, userId: string): Promise<boolean> {
  if (!editToken || !userId) return false
  const { rows } = await query<{ id: string }>(
    `update public.wf_venues set owner_id = $3, updated_at = now()
      where id = $1 and edit_token = $2 and (owner_id is null or owner_id = $3)
      returning id`,
    [id, editToken, userId]
  )
  return rows.length > 0
}

// Who can see a venue, or null when there is no such venue.
export async function venueVisibility(id: string): Promise<VenueVisibility | null> {
  const { rows } = await query<{ visibility: VenueVisibility }>("select visibility from public.wf_venues where id::text = $1", [id])
  return rows[0]?.visibility ?? null
}

export async function addWaypoints(
  venueId: string,
  editToken: string,
  waypoints: Waypoint[],
  userId: string | null = null
): Promise<{ ok: boolean; saved: Waypoint[] }> {
  if (!(await ownsVenue(venueId, editToken, userId))) return { ok: false, saved: [] }
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
  // What staff verified has changed: the badge waits for them to look again.
  await query(`update public.wf_venues set updated_at = now(), verified = false, verified_at = null, verified_by = null where id = $1`, [venueId])
  return { ok: true, saved }
}

export async function deleteVenue(venueId: string, editToken: string, userId: string | null = null): Promise<boolean> {
  if (!(await ownsVenue(venueId, editToken, userId))) return false
  await query(`delete from public.wf_venues where id = $1`, [venueId])
  return true
}
