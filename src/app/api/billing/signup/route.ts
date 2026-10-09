// Sign a hospital site up for an Official listing, or pay for one signed up
// before: proves the person works there, records the terms they accepted and
// hands payment to Stripe. src/lib/billing/signup.ts.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { requireHospitalUser } from "@/lib/billing/account"
import { findSite } from "@/lib/billing/sites"
import { checkChoice, signUp } from "@/lib/billing/signup"
import { StripeError } from "@/lib/billing/stripe"
import { rateLimit, readCappedJson, LIMITS, BODY_LIMITS } from "@/lib/rate-limit"

const noStore = { "Cache-Control": "no-store" }

export async function POST(request: Request) {
  const limited = rateLimit(request, "billing", LIMITS.billing.limit, LIMITS.billing.windowMs)
  if (limited) return limited
  const { user, response } = await requireHospitalUser(request)
  if (response) return response
  const read = await readCappedJson<Record<string, unknown>>(request, BODY_LIMITS.billing)
  const b = read.ok && read.body && typeof read.body === "object" && !Array.isArray(read.body) ? read.body : null
  if (!b) return Response.json({ error: "bad_request" }, { status: 400, headers: noStore })
  const choice = checkChoice(b)
  if (typeof choice === "string") return Response.json({ error: choice }, { status: 400, headers: noStore })
  const site = typeof b.venueId === "string" ? await findSite(b.venueId.trim().slice(0, 80)) : null
  if (!site) return Response.json({ error: "not_found" }, { status: 404, headers: noStore })
  try {
    const result = await signUp(user, site, choice, { orgId: b.orgId, orgName: b.orgName })
    if (result.kind === "refused") return Response.json({ error: result.error }, { status: result.status, headers: noStore })
    return Response.json(result, { headers: noStore })
  } catch (err) {
    console.warn("Hospital sign-up failed:", err instanceof Error ? err.message : err)
    const status = err instanceof StripeError && err.status < 500 ? 502 : 500
    return Response.json({ error: "payment_setup_failed" }, { status, headers: noStore })
  }
}
