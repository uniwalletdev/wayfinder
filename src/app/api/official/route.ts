// Which hospitals are Official: listed and kept up to date by the hospital
// itself, with its name and branding. Small, public and the same for
// everyone, so cached at the edge. An empty list when billing is not set up.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { isDatabaseConfigured } from "@/lib/db"
import { officialListings } from "@/lib/billing/store"

export async function GET() {
  if (!isDatabaseConfigured()) return Response.json({ sites: {} })
  try {
    return Response.json({ sites: await officialListings() }, { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" } })
  } catch (err) {
    console.warn("Could not list official hospitals:", err instanceof Error ? err.message : err)
    return Response.json({ sites: {} })
  }
}
