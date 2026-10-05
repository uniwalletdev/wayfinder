// Start the World hospital data workflow for some countries, or ALL.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
import { requireStaff, audit } from "@/lib/backoffice/staff"
import { parseCountries, startDataRefresh } from "@/lib/backoffice/pipeline"
import { ok, fail, failed, body } from "@/lib/backoffice/http"

export async function POST(request: Request) {
  const { staff, response } = await requireStaff(request, "pipeline.run")
  if (response) return response
  const b = await body(request)
  const countries = parseCountries(b?.countries)
  if (!countries) return fail(400, "bad_countries")
  try {
    const result = await startDataRefresh(countries)
    if (!result.ok) return fail(result.error === "not_configured" ? 503 : 502, result.error ?? "dispatch_failed")
    await audit(staff, "data.refresh", "world-data.yml", { countries })
    return ok({ ok: true })
  } catch (err) {
    return failed("start the data refresh", err)
  }
}
