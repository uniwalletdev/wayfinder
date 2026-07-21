// Add waypoints to a shared venue — the points a navigator reads via Claude or
// marks while surveying, persisted so the map is reusable. Owner-only: the
// request must carry the venue's edit token. Next 16 route params are async.

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { isDatabaseConfigured } from "@/lib/db"
import { rateLimit, readCappedJson, LIMITS, BODY_LIMITS } from "@/lib/rate-limit"
import { addWaypoints } from "@/lib/venues-db"
import type { Waypoint, WaypointType } from "@/lib/types"

const WAYPOINT_TYPES: WaypointType[] = [
  "ward", "department", "lift", "stairs", "toilet", "exit", "reception", "canteen", "pharmacy", "other",
]
const MAX_WAYPOINTS = 500
const MAX_NAME = 200

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v)
}

// Keep only well-formed points; drop the rest rather than failing the whole batch.
function sanitize(raw: unknown): Waypoint[] {
  if (!Array.isArray(raw)) return []
  const out: Waypoint[] = []
  for (const w of raw) {
    if (out.length >= MAX_WAYPOINTS) break
    const o = w as Record<string, unknown>
    const name = typeof o?.name === "string" ? o.name.trim().slice(0, MAX_NAME) : ""
    const coords = o?.coordinates as { lat?: unknown; lng?: unknown } | undefined
    const lat = coords?.lat
    const lng = coords?.lng
    if (!name || !isFiniteNumber(lat) || !isFiniteNumber(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) continue
    out.push({
      id: typeof o.id === "string" ? o.id : "",
      name,
      type: WAYPOINT_TYPES.includes(o.type as WaypointType) ? (o.type as WaypointType) : "other",
      coordinates: { lat, lng },
      floor: isFiniteNumber(o.floor) ? Math.trunc(o.floor) : 0,
      description: typeof o.description === "string" ? o.description.slice(0, 500) : undefined,
    })
  }
  return out
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(request, "venue-write", LIMITS.venueWrite.limit, LIMITS.venueWrite.windowMs)
  if (limited) return limited

  if (!isDatabaseConfigured()) return Response.json({ configured: false })
  const { id } = await params

  const read = await readCappedJson<{ editToken?: unknown; waypoints?: unknown }>(request, BODY_LIMITS.waypoints)
  if (!read.ok) {
    return Response.json(
      { configured: true, ok: false, error: read.reason === "too_large" ? "too_large" : "bad_request" },
      { status: read.reason === "too_large" ? 413 : 400 }
    )
  }
  const body = read.body
  const editToken = typeof body.editToken === "string" ? body.editToken : ""
  const waypoints = sanitize(body.waypoints)
  if (waypoints.length === 0) {
    return Response.json({ configured: true, ok: false, error: "no_waypoints" }, { status: 400 })
  }

  try {
    const { ok, saved } = await addWaypoints(id, editToken, waypoints)
    if (!ok) return Response.json({ configured: true, ok: false }, { status: 403 })
    return Response.json({ configured: true, ok: true, waypoints: saved })
  } catch (err) {
    console.warn("Could not add waypoints:", err instanceof Error ? err.message : err)
    return Response.json({ configured: true, ok: false, error: "write_failed" }, { status: 500 })
  }
}
