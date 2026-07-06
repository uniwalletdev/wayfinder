// Records searches that found nothing at a venue ("search misses"), so the
// people who map the venue can see what visitors expected to find. Written by
// the client fire-and-forget: every response here is soft — a deployment
// without Supabase, or a storage hiccup, must never surface as a search error.

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { getSupabaseServerClient } from "@/lib/supabase/server"

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
  const query = typeof payload.query === "string" ? payload.query.trim().slice(0, MAX_QUERY_CHARS) : ""
  const suggested = payload.suggested === true
  if (!venueId || !query) {
    return Response.json({ ok: false }, { status: 400 })
  }

  const supabase = await getSupabaseServerClient()
  if (!supabase) {
    // Local mode — nothing to store into. Accept and drop, so the client
    // behaves identically whether or not the deployment has a backend.
    return Response.json({ ok: true, stored: false })
  }

  // venue_key is free text, not a FK: seed venues ("gosh") and device-local
  // venues ("venue-…") never exist in the venues table, yet their misses are
  // just as useful to whoever curates them.
  const { error } = await supabase.from("search_misses").insert({ venue_key: venueId, query, suggested })
  if (error) {
    console.warn("Could not store search miss:", error.message)
    return Response.json({ ok: true, stored: false })
  }
  return Response.json({ ok: true, stored: true })
}
