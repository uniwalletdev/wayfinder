// Ingests navigation signals — the passive evidence a navigator emits just by
// using the app (see db/migrations/0001_nav_signals.sql). Written by the client
// fire-and-forget, so like /api/search-misses every response here is soft: a
// deployment without a database, or a storage hiccup, must never surface to a
// navigator as an error. They are navigating; the map improving is a byproduct.
//
// First slice handles kind='trail' — the path walked while being routed. Other
// kinds are reserved in the schema but rejected here until their client emitters
// exist, so we never store a shape we haven't validated.
//
// Data protection (docs/location-data-and-gdpr.md): a trail ending at a ward
// is a health inference about the device that walked it. So what is stored is
// the corridor, not the visit: the final approach to the destination is cut
// off before storage, coordinates are rounded to about a metre, rows expire
// after SIGNAL_RETENTION_DAYS, and a device can delete its own rows (DELETE
// below, reachable from the privacy page).

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { isDatabaseConfigured, query } from "@/lib/db"
import { rateLimit, readCappedJson, LIMITS, BODY_LIMITS } from "@/lib/rate-limit"
import { sweepExpiredData } from "@/lib/retention"
import { distanceMeters } from "@/lib/routing"
import type { Coordinates } from "@/lib/types"

const MAX_VENUE_KEY_CHARS = 80
const MAX_DEVICE_ID_CHARS = 64
const MAX_TRAIL_POINTS = 400
// The last stretch of every trail is not stored. 25 m covers the corridor
// outside a ward's door without recording the door.
const DESTINATION_BLUR_M = 25
// Five decimal places is about a metre: plenty for a corridor centre-line,
// and no more precise than the positioning was anyway.
const COORD_DECIMALS = 5

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v)
}

const round = (n: number) => Number(n.toFixed(COORD_DECIMALS))

// Keep only well-formed, in-range points, drop the rest, and cap the length so a
// single POST can't push an unbounded blob into jsonb. Returns null when nothing
// usable survives (too few points to be a path).
function sanitizeTrailPoints(raw: unknown): Coordinates[] | null {
  if (!Array.isArray(raw)) return null
  const points: Coordinates[] = []
  for (const p of raw) {
    if (points.length >= MAX_TRAIL_POINTS) break
    const lat = (p as { lat?: unknown })?.lat
    const lng = (p as { lng?: unknown })?.lng
    if (isFiniteNumber(lat) && isFiniteNumber(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      points.push({ lat, lng })
    }
  }
  return points.length >= 2 ? points : null
}

// Cut the final approach: every point within DESTINATION_BLUR_M of where the
// trail ended goes, then what is left is rounded. Exported for the test.
export function blurDestination(points: Coordinates[]): Coordinates[] {
  const end = points[points.length - 1]
  const kept = points.filter((p) => distanceMeters(p, end) > DESTINATION_BLUR_M)
  return kept.map((p) => ({ lat: round(p.lat), lng: round(p.lng) }))
}

export async function POST(request: Request) {
  const limited = rateLimit(request, "signals", LIMITS.signals.limit, LIMITS.signals.windowMs)
  if (limited) return limited

  const read = await readCappedJson<{ venueId?: unknown; deviceId?: unknown; kind?: unknown; floor?: unknown; points?: unknown }>(
    request,
    BODY_LIMITS.signals
  )
  if (!read.ok) return Response.json({ ok: false }, { status: read.reason === "too_large" ? 413 : 400 })
  const payload = read.body

  const venueId = typeof payload.venueId === "string" ? payload.venueId.trim().slice(0, MAX_VENUE_KEY_CHARS) : ""
  const deviceId = typeof payload.deviceId === "string" ? payload.deviceId.trim().slice(0, MAX_DEVICE_ID_CHARS) : ""
  const kind = typeof payload.kind === "string" ? payload.kind : ""
  const floor = isFiniteNumber(payload.floor) ? Math.trunc(payload.floor) : 0
  if (!venueId || !deviceId) {
    return Response.json({ ok: false }, { status: 400 })
  }

  // Only 'trail' is emitted yet; reject the reserved kinds rather than storing an
  // unvalidated payload shape.
  if (kind !== "trail") {
    return Response.json({ ok: false, error: "unsupported kind" }, { status: 400 })
  }
  const raw = sanitizeTrailPoints(payload.points)
  if (!raw) {
    return Response.json({ ok: false, error: "invalid trail" }, { status: 400 })
  }
  const points = blurDestination(raw)
  // A walk that was all final approach has nothing to pool.
  if (points.length < 2) {
    return Response.json({ ok: true, stored: false })
  }

  if (!isDatabaseConfigured()) {
    // Device-only mode — nothing to pool into. Accept and drop so the client
    // behaves identically whether or not the deployment has a database.
    return Response.json({ ok: true, stored: false })
  }

  sweepExpiredData()
  try {
    await query(
      `insert into public.nav_signals (venue_key, device_id, kind, floor, payload)
       values ($1, $2, $3, $4, $5::jsonb)`,
      [venueId, deviceId, kind, floor, JSON.stringify({ points })]
    )
  } catch (err) {
    console.warn("Could not store navigation signal:", err instanceof Error ? err.message : err)
    return Response.json({ ok: true, stored: false })
  }
  return Response.json({ ok: true, stored: true })
}

// Erase everything this device has contributed. The device id is the only
// key there is — it is minted on the phone and never tied to a person — so
// presenting it is what proves the rows are yours to delete.
export async function DELETE(request: Request) {
  const limited = rateLimit(request, "signals", LIMITS.signals.limit, LIMITS.signals.windowMs)
  if (limited) return limited

  const read = await readCappedJson<{ deviceId?: unknown }>(request, BODY_LIMITS.searchMiss)
  const deviceId = read.ok && typeof read.body.deviceId === "string" ? read.body.deviceId.trim().slice(0, MAX_DEVICE_ID_CHARS) : ""
  if (!deviceId) return Response.json({ ok: false }, { status: 400 })

  if (!isDatabaseConfigured()) return Response.json({ ok: true, deleted: 0 })
  try {
    const { rowCount } = await query(`delete from public.nav_signals where device_id = $1`, [deviceId])
    return Response.json({ ok: true, deleted: rowCount ?? 0 })
  } catch (err) {
    console.warn("Could not delete navigation signals:", err instanceof Error ? err.message : err)
    return Response.json({ ok: false, error: "delete_failed" }, { status: 500 })
  }
}
