// Shared venue maps: list public venues, or create one. Unlike the fire-and-
// forget telemetry routes, these are user-facing CRUD — a failed create must be
// reported, not swallowed — but "no database configured" is still a soft signal
// (configured:false) so the client transparently falls back to device-local mode.

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { isDatabaseConfigured } from "@/lib/db"
import { rateLimit, readCappedJson, LIMITS, BODY_LIMITS } from "@/lib/rate-limit"
import { listPublicVenues, createVenue } from "@/lib/venues-db"
import type { NewVenueInput } from "@/lib/venues"
import type { VenueCategory, VenueVisibility } from "@/lib/types"

const CATEGORIES: VenueCategory[] = ["hospital", "mall", "airport", "station", "university", "office", "home", "other"]
const VISIBILITIES: VenueVisibility[] = ["public", "unlisted", "private"]

export async function GET() {
  if (!isDatabaseConfigured()) return Response.json({ configured: false, venues: [] })
  try {
    const venues = await listPublicVenues()
    return Response.json({ configured: true, venues })
  } catch (err) {
    console.warn("Could not list venues:", err instanceof Error ? err.message : err)
    return Response.json({ configured: true, venues: [], error: "read_failed" }, { status: 200 })
  }
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v)
}

export async function POST(request: Request) {
  // Venue creation is unauthenticated and defaults to visibility:"public"
  // below, so every venue created here is served to every user's picker.
  // Without a ceiling, one loop can deface the directory.
  const limited = rateLimit(request, "venue-create", LIMITS.venueCreate.limit, LIMITS.venueCreate.windowMs)
  if (limited) return limited

  if (!isDatabaseConfigured()) return Response.json({ configured: false })

  const read = await readCappedJson<Record<string, unknown>>(request, BODY_LIMITS.venue)
  if (!read.ok) {
    return Response.json(
      { configured: true, error: read.reason === "too_large" ? "too_large" : "bad_request" },
      { status: read.reason === "too_large" ? 413 : 400 }
    )
  }
  const body = read.body

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
