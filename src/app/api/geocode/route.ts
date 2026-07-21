// Free-text place search. When a typed destination isn't one of the venue's
// known waypoints, the client falls back to this route, which geocodes the query
// via the Mapbox Geocoding API and returns navigable coordinates. We proxy it
// server-side so the access token stays off the client, and keep failures soft
// (an empty list rather than a thrown error). Results are worldwide, biased
// toward the caller's location (passed as `lat`/`lng`) so nearby places rank first.

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { rateLimit, LIMITS } from "@/lib/rate-limit"

const MAPBOX_URL = "https://api.mapbox.com/geocoding/v5/mapbox.places"
const MAX_RESULTS = 6

interface GeocodeResult {
  id: string
  name: string
  description: string
  lat: number
  lng: number
}

interface MapboxFeature {
  id: string
  text: string
  place_name: string
  center: [number, number] // [lng, lat]
}

export async function GET(request: Request) {
  const limited = rateLimit(request, "geocode", LIMITS.geocode.limit, LIMITS.geocode.windowMs)
  if (limited) return limited

  const token = process.env.MAPBOX_ACCESS_TOKEN
  if (!token) {
    // Not an error from the user's perspective — the feature just isn't wired up.
    return Response.json({ results: [], error: "not_configured" }, { status: 200 })
  }

  const sp = new URL(request.url).searchParams
  const q = sp.get("q")?.trim()
  if (!q || q.length < 3) {
    return Response.json({ results: [] }, { status: 200 })
  }

  // Bias toward the caller's location (the active venue's centre or the user's
  // live position) so the nearest match ranks first — worldwide, no country lock.
  const lat = Number(sp.get("lat"))
  const lng = Number(sp.get("lng"))

  const params = new URLSearchParams({
    access_token: token,
    limit: String(MAX_RESULTS),
    autocomplete: "true",
    language: "en",
  })
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    params.set("proximity", `${lng},${lat}`)
  }
  const url = `${MAPBOX_URL}/${encodeURIComponent(q)}.json?${params}`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 6000)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) {
      return Response.json({ results: [], error: "upstream" }, { status: 200 })
    }
    const data = (await res.json()) as { features?: MapboxFeature[] }
    const features = Array.isArray(data.features) ? data.features : []
    const results: GeocodeResult[] = features
      .map((f) => {
        const [lng, lat] = f.center ?? []
        if (typeof lat !== "number" || typeof lng !== "number") return null
        return {
          id: `geo-${f.id}`,
          // `text` is the recognisable label; `place_name` is the full address.
          name: f.text || f.place_name.split(",")[0].trim(),
          description: f.place_name,
          lat,
          lng,
        }
      })
      .filter((r): r is GeocodeResult => r !== null)

    return Response.json({ results }, { status: 200 })
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError"
    return Response.json({ results: [], error: aborted ? "timeout" : "unreachable" }, { status: 200 })
  } finally {
    clearTimeout(timeout)
  }
}
