// A country's hospital directory, from the shared database (src/lib/world-db.ts).
// Public open data, so it is cached at the edge for a day and served stale for
// a week while it refreshes; a data run is monthly.

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { getCountry, parseCountry, worldAvailable } from "@/lib/world-db"
import { rateLimit, LIMITS } from "@/lib/rate-limit"

const CACHE = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800"

export async function GET(request: Request, { params }: { params: Promise<{ country: string }> }) {
  const limited = rateLimit(request, "world", LIMITS.world.limit, LIMITS.world.windowMs)
  if (limited) return limited
  const country = parseCountry((await params).country)
  if (!country) return Response.json({ error: "Not a country code" }, { status: 400 })
  if (!worldAvailable()) return Response.json({ error: "No world data on this deployment" }, { status: 404 })
  const data = await getCountry(country)
  if (!data) return Response.json({ error: "No data for this country yet" }, { status: 404, headers: { "cache-control": "public, max-age=600" } })
  return Response.json(data, { headers: { "cache-control": CACHE } })
}
