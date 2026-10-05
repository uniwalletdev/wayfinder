// Moderate one shared venue: change who can find it, mark it verified, or remove it.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
import { isDatabaseConfigured } from "@/lib/db"
import { requireStaff, audit } from "@/lib/backoffice/staff"
import { updateVenue, removeVenue, isUuid } from "@/lib/backoffice/data"
import { ok, fail, failed, body } from "@/lib/backoffice/http"

const VISIBILITY = ["public", "unlisted", "private"] as const

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { staff, response } = await requireStaff(request, "venues.edit")
  if (response) return response
  if (!isDatabaseConfigured()) return fail(503, "no_database")
  const { id } = await params
  if (!isUuid(id)) return fail(404, "not_found")
  const b = await body(request)
  if (!b) return fail(400, "bad_request")
  const visibility = typeof b.visibility === "string" && (VISIBILITY as readonly string[]).includes(b.visibility) ? (b.visibility as (typeof VISIBILITY)[number]) : undefined
  const verified = typeof b.verified === "boolean" ? b.verified : undefined
  if (visibility === undefined && verified === undefined) return fail(400, "nothing_to_change")
  try {
    const venue = await updateVenue(id, { visibility, verified }, staff.userId)
    if (!venue) return fail(404, "not_found")
    await audit(staff, "venue.update", id, { name: venue.name, ...(visibility ? { visibility } : {}), ...(verified !== undefined ? { verified } : {}) })
    return ok({ ok: true })
  } catch (err) {
    return failed("update the venue", err)
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { staff, response } = await requireStaff(request, "venues.edit")
  if (response) return response
  if (!isDatabaseConfigured()) return fail(503, "no_database")
  const { id } = await params
  if (!isUuid(id)) return fail(404, "not_found")
  try {
    const gone = await removeVenue(id)
    if (!gone) return fail(404, "not_found")
    await audit(staff, "venue.delete", id, { name: gone.name, waypoints: gone.waypoints })
    return ok({ ok: true })
  } catch (err) {
    return failed("delete the venue", err)
  }
}
