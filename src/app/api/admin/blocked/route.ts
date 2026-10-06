// Publishers blocked from sharing places (from the Inbox), and unblocking them.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
import { isDatabaseConfigured } from "@/lib/db"
import { requireStaff, audit } from "@/lib/backoffice/staff"
import { listBlocked, unblockPublisher } from "@/lib/backoffice/data"
import { ok, fail, failed, body } from "@/lib/backoffice/http"

export async function GET(request: Request) {
  const { response } = await requireStaff(request, "inbox.view")
  if (response) return response
  if (!isDatabaseConfigured()) return fail(503, "no_database")
  try {
    return ok({ blocked: await listBlocked() })
  } catch (err) {
    return failed("list blocked publishers", err)
  }
}

export async function DELETE(request: Request) {
  const { staff, response } = await requireStaff(request, "inbox.edit")
  if (response) return response
  if (!isDatabaseConfigured()) return fail(503, "no_database")
  const b = await body(request)
  const key = typeof b?.key === "string" && /^[ad]:[\w-]{1,80}$/.test(b.key) ? b.key : null
  if (!key) return fail(400, "bad_request")
  try {
    const gone = await unblockPublisher(key)
    if (!gone) return fail(404, "not_found")
    await audit(staff, "publisher.unblock", key, { name: gone.venueName ?? "" })
    return ok({ ok: true })
  } catch (err) {
    return failed("unblock the publisher", err)
  }
}
