// Act on one inbox item:
//   resolve          — dealt with (a report dismissed: the place stays)
//   reopen           — back on the list
//   remove-place     — a report upheld: delete the shared place, and close
//                      every open report about it
//   remove-and-block — the same, and stop whoever published it publishing again
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
import { isDatabaseConfigured } from "@/lib/db"
import { requireStaff, audit } from "@/lib/backoffice/staff"
import { can } from "@/lib/backoffice/roles"
import { getInboxItem, setInboxResolved, resolveReportsFor, blockPublisherOf, removeVenue, isUuid } from "@/lib/backoffice/data"
import { ok, fail, failed, body } from "@/lib/backoffice/http"

const ACTIONS = ["resolve", "reopen", "remove-place", "remove-and-block"] as const
type Action = (typeof ACTIONS)[number]

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { staff, response } = await requireStaff(request, "inbox.edit")
  if (response) return response
  if (!isDatabaseConfigured()) return fail(503, "no_database")
  const { id } = await params
  const b = await body(request)
  const action = typeof b?.action === "string" && (ACTIONS as readonly string[]).includes(b.action) ? (b.action as Action) : null
  if (!action) return fail(400, "bad_request")
  try {
    const item = await getInboxItem(id)
    if (!item) return fail(404, "not_found")

    if (action === "resolve" || action === "reopen") {
      const resolution = action === "reopen" ? null : item.kind === "report" ? "dismissed" : "done"
      await setInboxResolved(id, resolution, staff.userId)
      await audit(staff, action === "reopen" ? "inbox.reopen" : "inbox.resolve", id, { kind: item.kind, name: item.venueName ?? "" })
      return ok({ ok: true })
    }

    // Removing a place is venue moderation too; check it rather than assume
    // that whoever answers the inbox may also delete venues.
    if (!can(staff.role, "venues.edit")) return fail(403, "forbidden")
    if (item.kind !== "report" || !item.venueId || !isUuid(item.venueId)) return fail(409, "not_a_shared_place")
    const venueId = item.venueId.toLowerCase()

    let blocked = 0
    if (action === "remove-and-block") {
      const result = await blockPublisherOf(venueId, `Report ${id}`, staff.userId)
      if (!result) return fail(409, "cannot_block")
      blocked = result.blocked
      await audit(staff, "publisher.block", venueId, { name: result.name, keys: result.blocked, report: id })
    }
    const gone = await removeVenue(venueId)
    // Already deleted (by its publisher, or another moderator): the reports
    // are still dealt with.
    if (gone) await audit(staff, "venue.delete", venueId, { name: gone.name, waypoints: gone.waypoints, report: id })
    const resolution = action === "remove-and-block" ? "removed_blocked" : "removed"
    const closed = await resolveReportsFor(item.venueId, resolution, staff.userId)
    if (item.venueId !== venueId) await resolveReportsFor(venueId, resolution, staff.userId)
    return ok({ ok: true, removed: !!gone, blocked, closed })
  } catch (err) {
    return failed("update the inbox", err)
  }
}
