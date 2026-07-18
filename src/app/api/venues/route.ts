// Shared venue maps: list public venues, or create one. Unlike the fire-and-
// forget telemetry routes, these are user-facing CRUD — a failed create must be
// reported, not swallowed — but "no database configured" is still a soft signal
// (configured:false) so the client transparently falls back to device-local mode.

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { isDatabaseConfigured } from "@/lib/db"
import { listPublicVenues, createVenue } from "@/lib/venues-db"
import type { NewVenueInput } from "@/lib/venues"
import type { VenueCategory, VenueVisibility } from "@/lib/types"

const CATEGORIES: VenueCategory[] = ["hospital", "mall", "airport", "station", "university", "office", "home", "other"]
const VISIBILITIES: VenueVisibility[] = ["public", "unlisted", "private"]

export async function GET(request: Request) {
  if (!isDatabaseConfigured()) return Response.json({ configured: false, venues: [] })
  try {
    const venues = await listPublicVenues()
    return Response.json({ configured: true, venues })
  } catch (err) {
    console.warn("Could not list venues:", err instanceof Error ? err.message : err)
    // Opt-in diagnostic: /api/venues?debug=1 surfaces the underlying error so a
    // failing connection can be diagnosed without digging through host logs.
    const debug = new URL(request.url).searchParams.get("debug") === "1"
    const detail = debug ? (err instanceof Error ? err.message : String(err)) : undefined
    return Response.json({ configured: true, venues: [], error: "read_failed", detail }, { status: 200 })
  }
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v)
}

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) return Response.json({ configured: false })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return Response.json({ configured: true, error: "bad_request" }, { status: 400 })
  }

  const name = typeof body.name === "string" ? body.name.trim() : ""
  const category = CATEGORIES.includes(body.category as VenueCategory) ? (body.category as VenueCategory) : "other"
  const visibility = VISIBILITIES.includes(body.visibility as VenueVisibility) ? (body.visibility as VenueVisibility) : "public"
  const center = body.center as { lat?: unknown; lng?: unknown } | undefined
  const lat = center?.lat
  const lng = center?.lng
  if (!name || name.length > 120 || !isFiniteNumber(lat) || !isFiniteNumber(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return Response.json({ configured: true, error: "bad_request" }, { status: 400 })
  }

  const input: NewVenueInput = {
    name,
    category,
    visibility,
    center: { lat, lng },
    subtitle: typeof body.subtitle === "string" ? body.subtitle : undefined,
    defaultZoom: isFiniteNumber(body.defaultZoom) ? body.defaultZoom : undefined,
  }
  try {
    const { venue, editToken } = await createVenue(input)
    // editToken is returned exactly once — the client stores it as the venue's
    // owner key and it's never readable again.
    return Response.json({ configured: true, venue, editToken })
  } catch (err) {
    console.warn("Could not create venue:", err instanceof Error ? err.message : err)
    return Response.json({ configured: true, error: "create_failed" }, { status: 500 })
  }
}
