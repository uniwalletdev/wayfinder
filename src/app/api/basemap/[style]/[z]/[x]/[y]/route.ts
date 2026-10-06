// One street map tile from Mapbox, with this deployment's token added here so
// it never reaches a browser or the apps (src/lib/basemap.ts).
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
import { mapboxTileUrl, parseTile, tileCacheSeconds } from "@/lib/basemap"
import { rateLimit, LIMITS } from "@/lib/rate-limit"

export async function GET(request: Request, { params }: { params: Promise<{ style: string; z: string; x: string; y: string }> }) {
  const limited = rateLimit(request, "basemap", LIMITS.basemap.limit, LIMITS.basemap.windowMs)
  if (limited) return limited
  const { style, z, x, y } = await params
  const tile = parseTile(style, z, x, y)
  if (!tile) return Response.json({ error: "bad_tile" }, { status: 400 })
  const token = process.env.MAPBOX_ACCESS_TOKEN
  if (!token) return Response.json({ error: "not_configured" }, { status: 404 })

  try {
    const upstream = await fetch(mapboxTileUrl(tile, token), { signal: AbortSignal.timeout(10_000) })
    if (!upstream.ok) {
      // The token itself must never be logged; the status says enough (401 or
      // 403: the token lacks the styles:tiles scope or is restricted to URLs).
      console.warn(`Mapbox tile refused: ${upstream.status} for ${tile.style} ${tile.z}/${tile.x}/${tile.y}`)
      return Response.json({ error: "upstream", status: upstream.status }, { status: upstream.status === 404 ? 404 : 502 })
    }
    const seconds = tileCacheSeconds(upstream.headers.get("cache-control"))
    return new Response(upstream.body, {
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "image/png",
        "Cache-Control": `public, max-age=${seconds}, s-maxage=${seconds}`,
      },
    })
  } catch (err) {
    console.warn("Mapbox tile failed:", err instanceof Error ? err.message : err)
    return Response.json({ error: "upstream" }, { status: 502 })
  }
}
