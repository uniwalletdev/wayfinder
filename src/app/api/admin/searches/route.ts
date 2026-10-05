// What people searched for and did not find, grouped, and marking it dealt with.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
import { isDatabaseConfigured } from "@/lib/db"
import { requireStaff, audit } from "@/lib/backoffice/staff"
import { listMisses, setMissesResolved } from "@/lib/backoffice/data"
import { ok, fail, failed, body, intParam, textParam } from "@/lib/backoffice/http"

export async function GET(request: Request) {
  const { response } = await requireStaff(request, "searches.view")
  if (response) return response
  if (!isDatabaseConfigured()) return fail(503, "no_database")
  const url = new URL(request.url)
  const status = url.searchParams.get("status") === "resolved" ? "resolved" : "open"
  const days = intParam(url, "days", 30, 1, 365)
  try {
    return ok({ status, days, groups: await listMisses({ status, days, q: textParam(url, "q"), limit: 200 }) })
  } catch (err) {
    return failed("list search misses", err)
  }
}

export async function PATCH(request: Request) {
  const { staff, response } = await requireStaff(request, "searches.edit")
  if (response) return response
  if (!isDatabaseConfigured()) return fail(503, "no_database")
  const b = await body(request)
  const venueKey = typeof b?.venueKey === "string" ? b.venueKey.slice(0, 80) : ""
  const query = typeof b?.query === "string" ? b.query.slice(0, 160) : ""
  if (!venueKey || !query || typeof b?.resolved !== "boolean") return fail(400, "bad_request")
  try {
    const changed = await setMissesResolved(venueKey, query, b.resolved, staff.userId)
    await audit(staff, b.resolved ? "search.resolve" : "search.reopen", venueKey, { query, rows: changed })
    return ok({ ok: true, changed })
  } catch (err) {
    return failed("update search misses", err)
  }
}
