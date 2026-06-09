// Real street/footpath routing for destinations outside the hospital's mapped
// floors (typed/geocoded places). We proxy the Mapbox Directions API so the
// access token stays server-side, and pick the profile from the chosen travel
// mode so the path and ETA reflect walking vs cycling vs driving. Failures are
// soft (the client falls back to a straight line) rather than thrown.

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAPBOX_URL = "https://api.mapbox.com/directions/v5/mapbox"
const PROFILES: Record<string, string> = {
  walking: "walking",
  cycling: "cycling",
  driving: "driving",
}

interface MapboxRoute {
  distance: number // metres
  duration: number // seconds
  geometry: { coordinates: [number, number][] } // [lng, lat][]
}

export async function GET(request: Request) {
  const token = process.env.MAPBOX_ACCESS_TOKEN
  if (!token) {
    return Response.json({ error: "not_configured" }, { status: 200 })
  }

  const params = new URL(request.url).searchParams
  const from = params.get("from") // "lat,lng"
  const to = params.get("to")
  const profile = PROFILES[params.get("mode") ?? "walking"] ?? "walking"

  const fromPt = parsePoint(from)
  const toPt = parsePoint(to)
  if (!fromPt || !toPt) {
    return Response.json({ error: "bad_request" }, { status: 200 })
  }

  // Mapbox expects coordinates as lng,lat;lng,lat
  const coords = `${fromPt.lng},${fromPt.lat};${toPt.lng},${toPt.lat}`
  const query = new URLSearchParams({
    access_token: token,
    geometries: "geojson",
    overview: "full",
  })
  const url = `${MAPBOX_URL}/${profile}/${coords}?${query}`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 6000)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) {
      return Response.json({ error: "upstream" }, { status: 200 })
    }
    const data = (await res.json()) as { routes?: MapboxRoute[] }
    const route = data.routes?.[0]
    if (!route) {
      return Response.json({ error: "no_route" }, { status: 200 })
    }
    return Response.json(
      {
        geometry: route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
        distance: Math.round(route.distance),
        duration: Math.round(route.duration),
      },
      { status: 200 }
    )
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError"
    return Response.json({ error: aborted ? "timeout" : "unreachable" }, { status: 200 })
  } finally {
    clearTimeout(timeout)
  }
}

function parsePoint(s: string | null): { lat: number; lng: number } | null {
  if (!s) return null
  const [lat, lng] = s.split(",").map(Number)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng }
}
