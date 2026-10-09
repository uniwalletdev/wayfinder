// What an organisation sees about its own sites: how many people were guided
// to a destination, and what they searched for and did not find. Counts
// only, from the same anonymous data the back office reads, and only for
// the sites the organisation currently lists.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { myOrg, requireHospitalUser } from "@/lib/billing/account"
import { insightsFor, sitesOf } from "@/lib/billing/store"
import { canOrg } from "@/lib/billing/org-roles"
import { isOfficial } from "@/lib/billing/status"

export async function GET(request: Request) {
  const { user, response } = await requireHospitalUser(request)
  if (response) return response
  const url = new URL(request.url)
  const org = await myOrg(user, url.searchParams.get("orgId"))
  if (!org) return Response.json({ error: "no_such_organisation" }, { status: 404 })
  if (!canOrg(org.role, "insights.view")) return Response.json({ error: "forbidden" }, { status: 403 })
  const days = [7, 30, 90].includes(Number(url.searchParams.get("days"))) ? Number(url.searchParams.get("days")) : 30
  const sites = (await sitesOf(org.id)).filter((s) => isOfficial(s.status))
  try {
    return Response.json({ days, ...(await insightsFor(sites.map((s) => s.venueId), days)) }, { headers: { "Cache-Control": "no-store" } })
  } catch (err) {
    console.warn("Could not read a hospital's insights:", err instanceof Error ? err.message : err)
    return Response.json({ error: "failed" }, { status: 500 })
  }
}
