// A manager gives a colleague access to their organisation's account, by
// work email, or takes it away. The colleague signs in with that address.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { myOrg, requireHospitalUser } from "@/lib/billing/account"
import { listMembers, removeMember, setMember } from "@/lib/billing/store"
import { checkMemberChange, isOrgRole } from "@/lib/billing/org-roles"
import { isWorkEmail } from "@/lib/billing/claim"
import { rateLimit, readCappedJson, LIMITS, BODY_LIMITS } from "@/lib/rate-limit"

const fail = (status: number, error: string) => Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } })

async function read(request: Request) {
  const limited = rateLimit(request, "billing", LIMITS.billing.limit, LIMITS.billing.windowMs)
  if (limited) return { response: limited }
  const { user, response } = await requireHospitalUser(request)
  if (response) return { response }
  const r = await readCappedJson<Record<string, unknown>>(request, BODY_LIMITS.billing)
  const b = r.ok && r.body && typeof r.body === "object" && !Array.isArray(r.body) ? r.body : null
  if (!b) return { response: fail(400, "bad_request") }
  const org = await myOrg(user, b.orgId)
  if (!org) return { response: fail(404, "no_such_organisation") }
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase().slice(0, 254) : ""
  if (!isWorkEmail(email)) return { response: fail(400, "bad_email") }
  return { user, org, email, b }
}

export async function POST(request: Request) {
  const r = await read(request)
  if (r.response) return r.response
  const { user, org, email, b } = r
  if (!isOrgRole(b.role)) return fail(400, "bad_role")
  const members = await listMembers(org.id)
  const managersLeft = members.filter((m) => m.role === "manager" && (m.email !== email || b.role === "manager")).length
  if (user.emails.includes(email)) return fail(403, "You cannot change your own access")
  const refusal = checkMemberChange({ email: user.primaryEmail, role: org.role }, { email }, managersLeft)
  if (refusal) return fail(403, refusal)
  await setMember(org.id, email, b.role, user.userId)
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } })
}

export async function DELETE(request: Request) {
  const r = await read(request)
  if (r.response) return r.response
  const { user, org, email } = r
  const members = await listMembers(org.id)
  const managersLeft = members.filter((m) => m.role === "manager" && m.email !== email).length
  if (user.emails.includes(email)) return fail(403, "You cannot change your own access")
  const refusal = checkMemberChange({ email: user.primaryEmail, role: org.role }, { email }, managersLeft)
  if (refusal) return fail(403, refusal)
  await removeMember(org.id, email)
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } })
}
