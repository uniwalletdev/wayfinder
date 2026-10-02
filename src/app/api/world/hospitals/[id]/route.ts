// One hospital by app id (osm-us-w123), for opening a directory pin without
// loading its country's whole list.

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { getHospital, parseWorldId, worldAvailable } from "@/lib/world-db"
import { rateLimit, LIMITS } from "@/lib/rate-limit"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(request, "world", LIMITS.world.limit, LIMITS.world.windowMs)
  if (limited) return limited
  const parsed = parseWorldId((await params).id)
  if (!parsed) return Response.json({ error: "Not a world hospital id" }, { status: 400 })
  if (!worldAvailable()) return Response.json({ error: "No world data on this deployment" }, { status: 404 })
  const row = await getHospital(parsed.country, parsed.rowId)
  if (!row) return Response.json({ error: "Unknown hospital" }, { status: 404, headers: { "cache-control": "public, max-age=600" } })
  return Response.json({ country: parsed.country, hospital: row }, { headers: { "cache-control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" } })
}
