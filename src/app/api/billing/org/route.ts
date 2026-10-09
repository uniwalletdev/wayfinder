// A manager changes their organisation's name, billing email or branding.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { myOrg, requireHospitalUser } from "@/lib/billing/account"
import { updateOrg } from "@/lib/billing/store"
import { updateCustomer } from "@/lib/billing/stripe"
import { canOrg, parseBrandColor, parseLogo } from "@/lib/billing/org-roles"
import { isWorkEmail } from "@/lib/billing/claim"
import { rateLimit, readCappedJson, LIMITS, BODY_LIMITS } from "@/lib/rate-limit"

const fail = (status: number, error: string) => Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } })

export async function PATCH(request: Request) {
  const limited = rateLimit(request, "billing", LIMITS.billing.limit, LIMITS.billing.windowMs)
  if (limited) return limited
  const { user, response } = await requireHospitalUser(request)
  if (response) return response
  const read = await readCappedJson<Record<string, unknown>>(request, BODY_LIMITS.billingLogo)
  if (!read.ok) return fail(read.reason === "too_large" ? 413 : 400, read.reason)
  const b = read.body && typeof read.body === "object" && !Array.isArray(read.body) ? read.body : null
  if (!b) return fail(400, "bad_request")
  const org = await myOrg(user, b.orgId)
  if (!org) return fail(404, "no_such_organisation")
  const patch: Parameters<typeof updateOrg>[1] = {}
  if (b.name !== undefined) {
    if (typeof b.name !== "string" || !b.name.trim()) return fail(400, "name_required")
    if (!canOrg(org.role, "billing.manage")) return fail(403, "forbidden")
    patch.name = b.name.trim()
  }
  if (b.billingEmail !== undefined) {
    if (typeof b.billingEmail !== "string" || !isWorkEmail(b.billingEmail.trim())) return fail(400, "billing_email_required")
    if (!canOrg(org.role, "billing.manage")) return fail(403, "forbidden")
    patch.billingEmail = b.billingEmail.trim().toLowerCase()
  }
  if (b.brandColor !== undefined) {
    if (!canOrg(org.role, "branding.edit")) return fail(403, "forbidden")
    const c = b.brandColor === null ? null : parseBrandColor(b.brandColor)
    if (b.brandColor !== null && !c) return fail(400, "bad_colour")
    patch.brandColor = c
  }
  if (b.logo !== undefined) {
    if (!canOrg(org.role, "branding.edit")) return fail(403, "forbidden")
    const logo = b.logo === null ? null : parseLogo(b.logo)
    if (b.logo !== null && !logo) return fail(400, "bad_logo")
    patch.logo = logo
  }
  try {
    await updateOrg(org.id, patch)
    if (org.stripeCustomerId && patch.billingEmail) await updateCustomer(org.stripeCustomerId, { email: patch.billingEmail })
  } catch (err) {
    console.warn("Could not update an organisation:", err instanceof Error ? err.message : err)
    return fail(500, "failed")
  }
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } })
}
