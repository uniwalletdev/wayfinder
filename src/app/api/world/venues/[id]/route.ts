// A hospital's built venue — an indoor map or a site map from OpenStreetMap —
// as the app's Venue JSON, its plans pointed at /api/world/plans.

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { getVenue, parseWorldId, worldAvailable } from "@/lib/world-db"
import { rateLimit, LIMITS } from "@/lib/rate-limit"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(request, "world", LIMITS.world.limit, LIMITS.world.windowMs)
  if (limited) return limited
  const parsed = parseWorldId((await params).id)
  if (!parsed) return Response.json({ error: "Not a world venue id" }, { status: 400 })
  if (!worldAvailable()) return Response.json({ error: "No world data on this deployment" }, { status: 404 })
  const venue = await getVenue(parsed.id)
  if (!venue) return Response.json({ error: "No map for this hospital" }, { status: 404, headers: { "cache-control": "public, max-age=600" } })
  return Response.json(venue, { headers: { "cache-control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" } })
}
