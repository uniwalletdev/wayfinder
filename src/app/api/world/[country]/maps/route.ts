// The site maps and indoor maps built for one country, richest first, without
// the venues themselves: a name, a place, counts and the plan to show as a
// thumbnail. What the /coverage page lists; opening one loads the full venue
// from /api/world/venues/<id>.

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { listMaps, OSM_ATTRIBUTION, parseCountry, worldAvailable } from "@/lib/world-db"
import { rateLimit, LIMITS } from "@/lib/rate-limit"

const CACHE = "public, max-age=600, s-maxage=3600, stale-while-revalidate=86400"

export async function GET(request: Request, { params }: { params: Promise<{ country: string }> }) {
  const limited = rateLimit(request, "world", LIMITS.world.limit, LIMITS.world.windowMs)
  if (limited) return limited
  const country = parseCountry((await params).country)
  if (!country) return Response.json({ error: "Not a country code" }, { status: 400 })
  if (!worldAvailable()) return Response.json({ maps: [] }, { status: 404 })
  const maps = await listMaps(country)
  return Response.json({ country, maps, attribution: OSM_ATTRIBUTION }, { headers: { "cache-control": CACHE } })
}
