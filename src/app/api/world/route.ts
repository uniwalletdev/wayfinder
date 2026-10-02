// Every country the World hospital data workflow has published, with how many
// hospitals, site maps and indoor maps each has — the index the /coverage page
// reads. Cached at the edge like the rest of /api/world: a data run is monthly.

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { listCountries, OSM_ATTRIBUTION, worldAvailable } from "@/lib/world-db"
import { rateLimit, LIMITS } from "@/lib/rate-limit"

const CACHE = "public, max-age=600, s-maxage=3600, stale-while-revalidate=86400"

export async function GET(request: Request) {
  const limited = rateLimit(request, "world", LIMITS.world.limit, LIMITS.world.windowMs)
  if (limited) return limited
  if (!worldAvailable()) return Response.json({ error: "No world data on this deployment", countries: [], attribution: OSM_ATTRIBUTION }, { status: 404 })
  const countries = await listCountries()
  return Response.json({ countries, attribution: OSM_ATTRIBUTION }, { headers: { "cache-control": CACHE } })
}
