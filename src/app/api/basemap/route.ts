// Which street map the map should draw (src/lib/basemap.ts): Mapbox's when
// this deployment has a Mapbox token, CARTO's otherwise.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
import type { BasemapSource } from "@/lib/basemap"

export function GET() {
  const source: BasemapSource = process.env.MAPBOX_ACCESS_TOKEN ? "mapbox" : "carto"
  return Response.json({ source }, { headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } })
}
