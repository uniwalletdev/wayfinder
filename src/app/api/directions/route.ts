// Real street/footpath routing for destinations outside the venue's mapped
// floors (typed/geocoded places). We prefer the Mapbox Directions API when a
// token is configured — it picks the profile from the travel mode, so the path
// and ETA reflect walking vs cycling vs driving — and proxy it so the token
// stays server-side. With no token we fall back to the keyless OSRM demo server
// so the line still follows real roads (like Apple/Google Maps) out of the box,
// rather than collapsing to a straight line. Failures are soft (the client then
// draws a straight line) rather than thrown.

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAPBOX_URL = "https://api.mapbox.com/directions/v5/mapbox"
const OSRM_URL = "https://router.project-osrm.org/route/v1"
const PROFILES: Record<string, string> = {
  walking: "walking",
  cycling: "cycling",
  driving: "driving",
}

interface Point { lat: number; lng: number }
interface RouteResult { geometry: Point[]; distance: number; duration?: number }
interface OsrmLike {
  routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[]
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const fromPt = parsePoint(params.get("from"))
  const toPt = parsePoint(params.get("to"))
  if (!fromPt || !toPt) {
    return Response.json({ error: "bad_request" }, { status: 200 })
  }
  const profile = PROFILES[params.get("mode") ?? "walking"] ?? "walking"
  const token = process.env.MAPBOX_ACCESS_TOKEN

  // Prefer Mapbox (per-mode profile + accurate ETA) when configured.
  if (token) {
    const mb = await mapboxRoute(fromPt, toPt, profile, token)
    if (mb) return Response.json(mb, { status: 200 })
    // Any Mapbox failure falls through to the keyless fallback below.
  }

  // Keyless fallback. The public OSRM demo only serves a driving profile, but
  // the road geometry is what we draw; we omit duration so the client estimates
  // the ETA from distance per travel mode instead of using a car time.
  const osrm = await osrmRoute(fromPt, toPt)
  if (osrm) return Response.json(osrm, { status: 200 })

  return Response.json({ error: token ? "no_route" : "not_configured" }, { status: 200 })
}

async function mapboxRoute(from: Point, to: Point, profile: string, token: string): Promise<RouteResult | null> {
  // Mapbox expects coordinates as lng,lat;lng,lat
  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`
  const query = new URLSearchParams({ access_token: token, geometries: "geojson", overview: "full" })
  const data = await fetchJson<OsrmLike>(`${MAPBOX_URL}/${profile}/${coords}?${query}`)
  const route = data?.routes?.[0]
  if (!route) return null
  return {
    geometry: route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
    distance: Math.round(route.distance),
    duration: Math.round(route.duration),
  }
}

async function osrmRoute(from: Point, to: Point): Promise<RouteResult | null> {
  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`
  const query = new URLSearchParams({ geometries: "geojson", overview: "full" })
  const data = await fetchJson<OsrmLike>(`${OSRM_URL}/driving/${coords}?${query}`)
  const route = data?.routes?.[0]
  if (!route || !route.geometry?.coordinates?.length) return null
  return {
    geometry: route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
    distance: Math.round(route.distance),
  }
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 6000)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

function parsePoint(s: string | null): Point | null {
  if (!s) return null
  const [lat, lng] = s.split(",").map(Number)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng }
}
