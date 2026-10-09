// Approve or turn down a sign-up waiting for review: someone whose email did
// not prove they work at the hospital. Approving lets them pay; nothing is
// charged before. Turning it down frees the hospital for someone else.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
import { isDatabaseConfigured } from "@/lib/db"
import { audit, requireStaff } from "@/lib/backoffice/staff"
import { deleteSite, getSite, setSiteStatus } from "@/lib/billing/store"
import { ok, fail, failed, body } from "@/lib/backoffice/http"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { staff, response } = await requireStaff(request, "customers.edit")
  if (response) return response
  if (!isDatabaseConfigured()) return fail(503, "no_database")
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail(404, "not_found")
  const b = await body(request)
  const action = b?.action
  if (action !== "approve" && action !== "reject") return fail(400, "bad_request")
  try {
    const site = await getSite(id)
    if (!site) return fail(404, "not_found")
    if (site.status !== "review") return fail(409, "not_in_review")
    if (action === "approve") await setSiteStatus(id, "pending")
    else await deleteSite(id)
    await audit(staff, action === "approve" ? "customers.approve" : "customers.reject", site.venueName, { name: site.venueName, siteId: id, email: site.claimEmail })
    return ok({ ok: true })
  } catch (err) {
    return failed("review a sign-up", err)
  }
}
