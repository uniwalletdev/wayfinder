// Hospitals that pay for an Official listing, for Findway's own staff.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
import { isDatabaseConfigured } from "@/lib/db"
import { requireStaff } from "@/lib/backoffice/staff"
import { listCustomers } from "@/lib/billing/store"
import { SITE_STATUSES, type SiteStatus } from "@/lib/billing/status"
import { stripeConfigured } from "@/lib/billing/stripe"
import { ok, fail, failed, textParam } from "@/lib/backoffice/http"

export async function GET(request: Request) {
  const { response } = await requireStaff(request, "customers.view")
  if (response) return response
  if (!isDatabaseConfigured()) return fail(503, "no_database")
  const url = new URL(request.url)
  const status = textParam(url, "status")
  try {
    const sites = await listCustomers({
      status: status && (SITE_STATUSES as readonly string[]).includes(status) ? (status as SiteStatus) : undefined,
      q: textParam(url, "q"),
    })
    return ok({ sites, stripe: stripeConfigured(), live: (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_live_") })
  } catch (err) {
    return failed("list customers", err)
  }
}
