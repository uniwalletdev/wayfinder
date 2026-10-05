// Every change made in the back office: who, what, when.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
import { isDatabaseConfigured } from "@/lib/db"
import { requireStaff } from "@/lib/backoffice/staff"
import { listAudit } from "@/lib/backoffice/data"
import { ok, fail, failed, intParam, textParam } from "@/lib/backoffice/http"

const PER_PAGE = 50

export async function GET(request: Request) {
  const { response } = await requireStaff(request, "audit.view")
  if (response) return response
  if (!isDatabaseConfigured()) return fail(503, "no_database")
  const url = new URL(request.url)
  const page = intParam(url, "page", 1, 1, 10_000)
  const action = textParam(url, "action", 40)
  try {
    const { entries, total } = await listAudit({
      action: action && /^[a-z_.]+$/.test(action) ? action : undefined,
      q: textParam(url, "q"),
      limit: PER_PAGE,
      offset: (page - 1) * PER_PAGE,
    })
    return ok({ entries, total, page, perPage: PER_PAGE })
  } catch (err) {
    return failed("read the audit log", err)
  }
}
