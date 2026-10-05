// Data retention: delete navigation signals older than a number of days
// (docs/location-data-and-gdpr.md recommends thirty).
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
import { isDatabaseConfigured } from "@/lib/db"
import { requireStaff, audit } from "@/lib/backoffice/staff"
import { purgeSignals, RETENTION_DAYS } from "@/lib/backoffice/data"
import { ok, fail, failed, body } from "@/lib/backoffice/http"

export async function POST(request: Request) {
  const { staff, response } = await requireStaff(request, "data.purge")
  if (response) return response
  if (!isDatabaseConfigured()) return fail(503, "no_database")
  const b = await body(request)
  const days = typeof b?.olderThanDays === "number" ? Math.floor(b.olderThanDays) : RETENTION_DAYS
  // Never younger than a week: the newest signals are what corrections are built from.
  if (!(days >= 7 && days <= 3650)) return fail(400, "bad_days")
  try {
    const deleted = await purgeSignals(days)
    await audit(staff, "data.purge_signals", null, { olderThanDays: days, deleted })
    return ok({ ok: true, deleted })
  } catch (err) {
    return failed("purge signals", err)
  }
}
