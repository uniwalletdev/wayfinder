// How Findway is being used: navigation signals, aggregated — never per device.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
import { isDatabaseConfigured } from "@/lib/db"
import { requireStaff } from "@/lib/backoffice/staff"
import { activity } from "@/lib/backoffice/data"
import { ok, fail, failed, intParam } from "@/lib/backoffice/http"

export async function GET(request: Request) {
  const { response } = await requireStaff(request, "activity.view")
  if (response) return response
  if (!isDatabaseConfigured()) return fail(503, "no_database")
  try {
    return ok(await activity(intParam(new URL(request.url), "days", 30, 1, 365)))
  } catch (err) {
    return failed("read activity", err)
  }
}
