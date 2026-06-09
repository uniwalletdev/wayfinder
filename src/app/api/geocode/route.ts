// Free-text place search. When a typed destination isn't one of the known GOSH
// waypoints, the client falls back to this route, which geocodes the query via
// OpenStreetMap's Nominatim service and returns navigable coordinates. We proxy
// it server-side so we can send the User-Agent Nominatim's usage policy requires
// and keep failures soft (an empty list rather than a thrown error).

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
const MAX_RESULTS = 6

interface GeocodeResult {
  id: string
  name: string
  description: string
  lat: number
  lng: number
}

interface NominatimItem {
  place_id: number
  lat: string
  lon: string
  display_name: string
  name?: string
}

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim()
  if (!q || q.length < 3) {
    return Response.json({ results: [] }, { status: 200 })
  }

  const url = `${NOMINATIM_URL}?format=jsonv2&addressdetails=0&limit=${MAX_RESULTS}&q=${encodeURIComponent(q)}`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 6000)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        // Nominatim requires an identifying User-Agent.
        "User-Agent": "GOSH-Wayfinder/1.0 (hospital wayfinding app)",
        "Accept-Language": "en-GB,en",
      },
    })
    if (!res.ok) {
      return Response.json({ results: [], error: "upstream" }, { status: 200 })
    }
    const items = (await res.json()) as NominatimItem[]
    const results: GeocodeResult[] = (Array.isArray(items) ? items : [])
      .map((it) => {
        const lat = parseFloat(it.lat)
        const lng = parseFloat(it.lon)
        if (Number.isNaN(lat) || Number.isNaN(lng)) return null
        // Nominatim's display_name is "Primary, area, city, …"; the first
        // segment is the most recognisable label for a list row.
        const primary = it.name?.trim() || it.display_name.split(",")[0].trim()
        return {
          id: `geo-${it.place_id}`,
          name: primary,
          description: it.display_name,
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
