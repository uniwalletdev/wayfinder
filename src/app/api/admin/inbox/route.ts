// Reports about places people published, and messages from the support page.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
import { isDatabaseConfigured } from "@/lib/db"
import { requireStaff } from "@/lib/backoffice/staff"
import { listInbox } from "@/lib/backoffice/data"
import { ok, fail, failed, intParam, textParam } from "@/lib/backoffice/http"

export async function GET(request: Request) {
  const { response } = await requireStaff(request, "inbox.view")
  if (response) return response
  if (!isDatabaseConfigured()) return fail(503, "no_database")
  const url = new URL(request.url)
  const status = url.searchParams.get("status") === "resolved" ? "resolved" : "open"
  const k = url.searchParams.get("kind")
  const kind = k === "report" || k === "support" ? k : undefined
  try {
    return ok({ status, ...(await listInbox({ status, kind, q: textParam(url, "q"), limit: 50, offset: intParam(url, "offset", 0, 0, 100000) })) })
  } catch (err) {
    return failed("list the inbox", err)
  }
}
