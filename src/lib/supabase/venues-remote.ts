import { Venue, Waypoint, AccessibilityInfo, FloorPlan } from "../types"
import { NewVenueInput } from "../venues"
import { getSupabaseBrowserClient } from "./client"

// Data access for venues stored in Supabase. Every call goes through the browser
// client, so Postgres Row-Level Security (see supabase/migrations) decides what
// the signed-in user can read or write — these functions don't re-implement the
// access rules, they rely on the database to enforce them.

interface VenueRow {
  id: string
  owner_id: string
  slug: string | null
  name: string
  subtitle: string | null
  category: string
  center_lat: number
  center_lng: number
  default_zoom: number
  visibility: "public" | "unlisted" | "private"
  verified: boolean
  accessibility: AccessibilityInfo | null
  floor_plans: FloorPlan[] | null
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

function client() {
  const sb = getSupabaseBrowserClient()
  if (!sb) throw new Error("Supabase is not configured")
  return sb
}

function rowToVenue(row: VenueRow, waypoints: Waypoint[]): Venue {
  return {
    id: row.id,
    slug: row.slug ?? row.id,
    name: row.name,
    subtitle: row.subtitle ?? undefined,
    category: row.category as Venue["category"],
    center: { lat: row.center_lat, lng: row.center_lng },
    defaultZoom: row.default_zoom,
    floorPlans: Array.isArray(row.floor_plans) ? row.floor_plans : [],
    waypoints,
    visibility: row.visibility,
    verified: row.verified,
    ownerId: row.owner_id,
    accessibility: row.accessibility ?? undefined,
    quickAccess: [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function rowToWaypoint(row: WaypointRow): Waypoint {
  return {
    id: row.id,
    name: row.name,
    type: row.type as Waypoint["type"],
    coordinates: { lat: row.lat, lng: row.lng },
    floor: row.floor,
    description: row.description ?? undefined,
  }
}

function slugify(name: string): string {
  const base = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
  return `${base || "place"}-${Math.random().toString(36).slice(2, 7)}`
}

// All venues the signed-in user is allowed to see (public + unlisted + owned +
// shared), each with its waypoints. RLS does the filtering.
export async function fetchAccessibleVenues(): Promise<Venue[]> {
  const sb = client()
  const { data: venueRows, error } = await sb
    .from("venues")
    .select("*")
    .order("created_at", { ascending: true })
  if (error) throw error
  const rows = (venueRows ?? []) as VenueRow[]
  if (rows.length === 0) return []

  const ids = rows.map((r) => r.id)
  const { data: wpRows, error: wpErr } = await sb.from("waypoints").select("*").in("venue_id", ids)
  if (wpErr) throw wpErr

  const byVenue = new Map<string, Waypoint[]>()
  for (const w of (wpRows ?? []) as WaypointRow[]) {
    const list = byVenue.get(w.venue_id) ?? []
    list.push(rowToWaypoint(w))
    byVenue.set(w.venue_id, list)
  }
  return rows.map((r) => rowToVenue(r, byVenue.get(r.id) ?? []))
}

// Create a venue owned by the current user. `verified` is forced false by a DB
// trigger regardless of input, so a public venue can't self-verify.
export async function createRemoteVenue(input: NewVenueInput): Promise<Venue> {
  const sb = client()
  const { data, error } = await sb
    .from("venues")
    .insert({
      slug: slugify(input.name),
      name: input.name.trim(),
      subtitle: input.subtitle?.trim() || null,
      category: input.category,
      center_lat: input.center.lat,
      center_lng: input.center.lng,
      default_zoom: input.defaultZoom ?? 18,
      visibility: input.visibility,
      accessibility: input.accessibility ?? null,
      floor_plans: [],
    })
    .select("*")
    .single()
  if (error) throw error
  return rowToVenue(data as VenueRow, [])
}

// Persist points mapped via Survey Mode. Returns the rows as Waypoints (with
// their server-assigned ids) so the caller can reconcile local state.
export async function addRemoteWaypoints(venueId: string, waypoints: Waypoint[]): Promise<Waypoint[]> {
  if (waypoints.length === 0) return []
  const sb = client()
  const { data, error } = await sb
    .from("waypoints")
    .insert(
      waypoints.map((w) => ({
        venue_id: venueId,
        name: w.name,
        type: w.type,
        lat: w.coordinates.lat,
        lng: w.coordinates.lng,
        floor: w.floor,
        description: w.description ?? null,
      }))
    )
    .select("*")
  if (error) throw error
  return ((data ?? []) as WaypointRow[]).map(rowToWaypoint)
}

// Persist an uploaded plan image onto the venue's floor_plans column. Like the
// rest of the venue row (see venues_update policy), only the owner can write
// this — an editor's upload still shows on their own device via local state,
// it just won't sync back to the venue for others until the owner re-saves it.
// Read-then-write, not atomic: two uploads to the same venue landing at the
// same moment can race and one can clobber the other's entry. Acceptable for
// how rarely a venue gets two plans uploaded within the same instant; a
// Postgres function doing the append server-side would close this properly.
export async function addRemoteFloorPlan(venueId: string, floorPlan: FloorPlan): Promise<void> {
  const sb = client()
  const { data, error: fetchErr } = await sb.from("venues").select("floor_plans").eq("id", venueId).single()
  if (fetchErr) throw fetchErr
  const current: FloorPlan[] = Array.isArray((data as { floor_plans: FloorPlan[] | null })?.floor_plans)
    ? (data as { floor_plans: FloorPlan[] }).floor_plans
    : []
  const { error } = await sb
    .from("venues")
    .update({ floor_plans: [...current, floorPlan] })
    .eq("id", venueId)
  if (error) throw error
}

export async function deleteRemoteVenue(venueId: string): Promise<void> {
  const sb = client()
  const { error } = await sb.from("venues").delete().eq("id", venueId)
  if (error) throw error
}
