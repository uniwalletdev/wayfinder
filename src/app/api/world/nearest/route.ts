// The hospitals nearest a position in a country — what the app opens on for a
// visitor outside the UK, without downloading the country's whole list first.
// ?country=US&lat=39.99&lng=-83.01&limit=3

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { getNearest, parseCountry, parseLatLng, worldAvailable } from "@/lib/world-db"
import { rateLimit, LIMITS } from "@/lib/rate-limit"

export async function GET(request: Request) {
  const limited = rateLimit(request, "world", LIMITS.world.limit, LIMITS.world.windowMs)
  if (limited) return limited
  const sp = new URL(request.url).searchParams
  const country = parseCountry(sp.get("country"))
  const at = parseLatLng(sp.get("lat"), sp.get("lng"))
  if (!country || !at) return Response.json({ error: "country, lat and lng are required" }, { status: 400 })
  const limit = Math.min(10, Math.max(1, Number(sp.get("limit") ?? 3) || 3))
  if (!worldAvailable()) return Response.json({ hospitals: [] }, { status: 404 })
  const hospitals = await getNearest(country, at.lat, at.lng, limit)
  // Positions differ per visitor; a short private cache only.
  return Response.json({ country, hospitals }, { headers: { "cache-control": "private, max-age=60" } })
}
