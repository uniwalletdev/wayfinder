// A hospital's account: the organisations the signed-in person belongs to,
// each with its sites and, for managers, its people.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { myOrgs, requireHospitalUser } from "@/lib/billing/account"
import { listMembers, sitesOf } from "@/lib/billing/store"
import { canOrg } from "@/lib/billing/org-roles"

export async function GET(request: Request) {
  const { user, response } = await requireHospitalUser(request)
  if (response) return response
  try {
    const orgs = await myOrgs(user)
    const full = await Promise.all(
      orgs.map(async (o) => ({
        ...o,
        sites: await sitesOf(o.id),
        members: canOrg(o.role, "members.manage") ? await listMembers(o.id) : [],
      }))
    )
    return Response.json({ user: { name: user.name, email: user.primaryEmail }, orgs: full }, { headers: { "Cache-Control": "no-store" } })
  } catch (err) {
    console.warn("Could not read a hospital account:", err instanceof Error ? err.message : err)
    return Response.json({ error: "failed" }, { status: 500 })
  }
}
