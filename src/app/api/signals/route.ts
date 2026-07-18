// Ingests navigation signals — the passive evidence a navigator emits just by
// using the app (see db/migrations/0001_nav_signals.sql). Written by the client
// fire-and-forget, so like /api/search-misses every response here is soft: a
// deployment without a database, or a storage hiccup, must never surface to a
// navigator as an error. They are navigating; the map improving is a byproduct.
//
// First slice handles kind='trail' — the path walked while being routed. Other
// kinds are reserved in the schema but rejected here until their client emitters
// exist, so we never store a shape we haven't validated.

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { isDatabaseConfigured, query } from "@/lib/db"
import type { Coordinates } from "@/lib/types"

const MAX_BODY_BYTES = 64 * 1024
const MAX_VENUE_KEY_CHARS = 80
const MAX_DEVICE_ID_CHARS = 64
const MAX_TRAIL_POINTS = 400

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v)
}

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

export async function POST(request: Request) {
  // Cap the body before parsing so an oversized payload is rejected cheaply.
  const bodyText = await request.text()
  if (bodyText.length > MAX_BODY_BYTES) {
    return Response.json({ ok: false }, { status: 413 })
  }

  let payload: { venueId?: unknown; deviceId?: unknown; kind?: unknown; floor?: unknown; points?: unknown }
  try {
    payload = JSON.parse(bodyText)
  } catch {
    return Response.json({ ok: false }, { status: 400 })
  }

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
  const points = sanitizeTrailPoints(payload.points)
  if (!points) {
    return Response.json({ ok: false, error: "invalid trail" }, { status: 400 })
  }

  if (!isDatabaseConfigured()) {
    // Device-only mode — nothing to pool into. Accept and drop so the client
    // behaves identically whether or not the deployment has a database.
    return Response.json({ ok: true, stored: false })
  }

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
