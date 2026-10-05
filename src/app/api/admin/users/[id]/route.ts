// One account: change its back office role, ban or unban it, or delete it.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
import { isDatabaseConfigured } from "@/lib/db"
import { requireStaff, audit, clerkConfigured } from "@/lib/backoffice/staff"
import { getAccount, targetOf, setBanned, deleteAccount } from "@/lib/backoffice/accounts"
import { setMemberRole, releaseAccount } from "@/lib/backoffice/data"
import { checkBan, checkDelete, checkRoleChange, isRole, type RoleOrNone } from "@/lib/backoffice/roles"
import { ok, fail, failed, body } from "@/lib/backoffice/http"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { staff, response } = await requireStaff(request, "users.manage")
  if (response) return response
  if (!clerkConfigured()) return fail(503, "no_accounts")
  const { id } = await params
  const b = await body(request)
  if (!b) return fail(400, "bad_request")
  const account = await getAccount(id)
  if (!account) return fail(404, "not_found")
  const actor = { userId: staff.userId, role: staff.role }
  try {
    if (b.role !== undefined) {
      const next = b.role === "none" || isRole(b.role) ? (b.role as RoleOrNone) : null
      if (!next) return fail(400, "bad_role")
      if (!isDatabaseConfigured()) return fail(503, "no_database")
      const refusal = checkRoleChange(actor, targetOf(account), next)
      if (refusal) return fail(403, "refused", { reason: refusal })
      await setMemberRole(account.id, next, account.email, staff.userId)
      await audit(staff, "user.role", account.id, { email: account.email, from: account.role, to: next })
    }
    if (typeof b.banned === "boolean") {
      const refusal = checkBan(actor, targetOf(account))
      if (refusal) return fail(403, "refused", { reason: refusal })
      if (b.banned !== account.banned) {
        await setBanned(account.id, b.banned)
        await audit(staff, b.banned ? "user.ban" : "user.unban", account.id, { email: account.email })
      }
    }
    return ok({ ok: true, account: await getAccount(id) })
  } catch (err) {
    return failed("update the account", err)
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { staff, response } = await requireStaff(request, "users.delete")
  if (response) return response
  if (!clerkConfigured()) return fail(503, "no_accounts")
  const { id } = await params
  const account = await getAccount(id)
  if (!account) return fail(404, "not_found")
  const refusal = checkDelete({ userId: staff.userId, role: staff.role }, targetOf(account))
  if (refusal) return fail(403, "refused", { reason: refusal })
  try {
    const released = isDatabaseConfigured() ? await releaseAccount(account.id) : 0
    await deleteAccount(account.id)
    await audit(staff, "user.delete", account.id, { email: account.email, venuesReleased: released })
    return ok({ ok: true, venuesReleased: released })
  } catch (err) {
    return failed("delete the account", err)
  }
}
