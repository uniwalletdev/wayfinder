// One floor plan of a world venue, as the SVG the pipeline drew. Loaded by the
// map as an image, so it carries a long cache and the OpenStreetMap credit is
// inside the drawing itself.

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { getPlan, parsePlanId, parseWorldId, worldAvailable } from "@/lib/world-db"
import { rateLimit, LIMITS } from "@/lib/rate-limit"

export async function GET(request: Request, { params }: { params: Promise<{ id: string; plan: string }> }) {
  const limited = rateLimit(request, "world", LIMITS.world.limit, LIMITS.world.windowMs)
  if (limited) return limited
  const { id, plan } = await params
  const parsed = parseWorldId(id)
  const planId = parsePlanId(plan)
  if (!parsed || !planId) return new Response("Not a plan", { status: 400 })
  if (!worldAvailable()) return new Response("No world data on this deployment", { status: 404 })
  const svg = await getPlan(parsed.id, planId)
  if (!svg) return new Response("No such plan", { status: 404, headers: { "cache-control": "public, max-age=600" } })
  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000",
      "access-control-allow-origin": "*",
    },
  })
}
