// Free-text place search. When a typed destination isn't one of the known GOSH
// waypoints, the client falls back to this route, which geocodes the query via
// the Mapbox Geocoding API and returns navigable coordinates. We proxy it
// server-side so the access token stays off the client, and keep failures soft
// (an empty list rather than a thrown error). Results are biased to the UK and
// toward the hospital so nearby, relevant places rank first.

import { GOSH_CENTER } from "@/lib/gosh-data"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

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
  const token = process.env.MAPBOX_ACCESS_TOKEN
  if (!token) {
    // Not an error from the user's perspective — the feature just isn't wired up.
    return Response.json({ results: [], error: "not_configured" }, { status: 200 })
  }

  const q = new URL(request.url).searchParams.get("q")?.trim()
  if (!q || q.length < 3) {
    return Response.json({ results: [] }, { status: 200 })
  }

  const params = new URLSearchParams({
    access_token: token,
    limit: String(MAX_RESULTS),
    autocomplete: "true",
    country: "gb",
    // Bias toward places near the hospital so the closest match ranks first.
    proximity: `${GOSH_CENTER.lng},${GOSH_CENTER.lat}`,
    language: "en",
  })
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
