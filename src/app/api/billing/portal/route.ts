// Stripe's billing page for an organisation: invoices, payment method,
// monthly or yearly, cancelling. Managers only.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { myOrg, requireHospitalUser } from "@/lib/billing/account"
import { createPortal } from "@/lib/billing/stripe"
import { canOrg } from "@/lib/billing/org-roles"
import { siteUrl } from "@/lib/site-url"
import { rateLimit, readCappedJson, LIMITS, BODY_LIMITS } from "@/lib/rate-limit"

const fail = (status: number, error: string) => Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } })

export async function POST(request: Request) {
  const limited = rateLimit(request, "billing", LIMITS.billing.limit, LIMITS.billing.windowMs)
  if (limited) return limited
  const { user, response } = await requireHospitalUser(request)
  if (response) return response
  const r = await readCappedJson<{ orgId?: unknown }>(request, BODY_LIMITS.billing)
  const org = r.ok && r.body ? await myOrg(user, r.body.orgId) : null
  if (!org) return fail(404, "no_such_organisation")
  if (!canOrg(org.role, "billing.manage")) return fail(403, "forbidden")
  if (!org.stripeCustomerId) return fail(409, "no_billing_yet")
  try {
    const url = await createPortal(org.stripeCustomerId, `${siteUrl().origin}/for-hospitals/account`)
    return Response.json({ url }, { headers: { "Cache-Control": "no-store" } })
  } catch (err) {
    console.warn("Could not open the billing portal:", err instanceof Error ? err.message : err)
    return fail(502, "portal_failed")
  }
}
