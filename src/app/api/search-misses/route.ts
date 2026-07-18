// Records searches that found nothing at a venue ("search misses"), so the
// people who map the venue can see what visitors expected to find. Written by
// the client fire-and-forget: every response here is soft — a deployment without
// a database, or a storage hiccup, must never surface as a search error.

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { isDatabaseConfigured, query } from "@/lib/db"

const MAX_QUERY_CHARS = 160
const MAX_VENUE_KEY_CHARS = 80

export async function POST(request: Request) {
  let payload: { venueId?: unknown; query?: unknown; suggested?: unknown }
  try {
    payload = await request.json()
  } catch {
    return Response.json({ ok: false }, { status: 400 })
  }

  const venueId = typeof payload.venueId === "string" ? payload.venueId.trim().slice(0, MAX_VENUE_KEY_CHARS) : ""
  const q = typeof payload.query === "string" ? payload.query.trim().slice(0, MAX_QUERY_CHARS) : ""
  const suggested = payload.suggested === true
  if (!venueId || !q) {
    return Response.json({ ok: false }, { status: 400 })
  }

  if (!isDatabaseConfigured()) {
    // Device-only mode — nothing to store into. Accept and drop, so the client
    // behaves identically whether or not the deployment has a database.
    return Response.json({ ok: true, stored: false })
  }

  // venue_key is free text, not a FK: seed venues ("gosh") and device-local
  // venues ("venue-…") are just as useful to whoever curates them.
  try {
    await query(
      `insert into public.search_misses (venue_key, query, suggested) values ($1, $2, $3)`,
      [venueId, q, suggested]
    )
  } catch (err) {
    console.warn("Could not store search miss:", err instanceof Error ? err.message : err)
    return Response.json({ ok: true, stored: false })
  }
  return Response.json({ ok: true, stored: true })
}
