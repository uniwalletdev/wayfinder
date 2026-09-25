// Find a ward, clinic or department at ANY mapped hospital. The app's own
// search is scoped to the open venue and the client no longer carries the
// other venues' interiors, so this answers "where is Kangaroo Ward?" from the
// server's full registry. Read-only, built from shipped data, so it can be
// cached briefly at the edge.

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { SEED_VENUES } from "@/lib/venues"
import { buildCrossVenueIndex, searchAcrossVenues, type CrossVenueIndex } from "@/lib/cross-venue-search"
import { rateLimit, LIMITS } from "@/lib/rate-limit"

const MAX_QUERY_CHARS = 80
const MAX_RESULTS = 8

let index: CrossVenueIndex | null = null

export async function GET(request: Request) {
  const limited = rateLimit(request, "search", LIMITS.search.limit, LIMITS.search.windowMs)
  if (limited) return limited

  const sp = new URL(request.url).searchParams
  const q = (sp.get("q") ?? "").trim().slice(0, MAX_QUERY_CHARS)
  const exclude = sp.get("exclude")?.trim() || undefined
  if (q.length < 2) return Response.json({ results: [] })

  if (!index) index = buildCrossVenueIndex(SEED_VENUES)
  const results = searchAcrossVenues(index, q, { exclude, limit: MAX_RESULTS })
  return Response.json({ results }, { headers: { "cache-control": "public, max-age=300, stale-while-revalidate=3600" } })
}
