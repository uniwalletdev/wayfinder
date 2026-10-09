// Find a hospital to list: any the app knows, in the given country, by name.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { searchSites } from "@/lib/billing/sites"
import { rateLimit, LIMITS } from "@/lib/rate-limit"
import { parseCountry } from "@/lib/world-db"

export async function GET(request: Request) {
  const limited = rateLimit(request, "billingSearch", LIMITS.billingSearch.limit, LIMITS.billingSearch.windowMs)
  if (limited) return limited
  const sp = new URL(request.url).searchParams
  const q = (sp.get("q") ?? "").trim().slice(0, 80)
  const country = parseCountry(sp.get("country")) ?? "GB"
  if (q.length < 2) return Response.json({ results: [] })
  return Response.json({ results: await searchSites(q, country) }, { headers: { "Cache-Control": "no-store" } })
}
