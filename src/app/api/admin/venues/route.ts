// Shared venues people have mapped, for moderation.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
import { isDatabaseConfigured } from "@/lib/db"
import { requireStaff } from "@/lib/backoffice/staff"
import { listVenues } from "@/lib/backoffice/data"
import { emailsOf } from "@/lib/backoffice/accounts"
import { can } from "@/lib/backoffice/roles"
import { ok, fail, failed, intParam, textParam } from "@/lib/backoffice/http"

const PER_PAGE = 25

export async function GET(request: Request) {
  const { staff, response } = await requireStaff(request, "venues.view")
  if (response) return response
  if (!isDatabaseConfigured()) return fail(503, "no_database")
  const url = new URL(request.url)
  const visibility = textParam(url, "visibility")
  const verifiedRaw = url.searchParams.get("verified")
  const page = intParam(url, "page", 1, 1, 10_000)
  try {
    const { venues, total } = await listVenues({
      q: textParam(url, "q"),
      visibility: visibility && ["public", "unlisted", "private"].includes(visibility) ? visibility : undefined,
      verified: verifiedRaw === "true" ? true : verifiedRaw === "false" ? false : null,
      limit: PER_PAGE,
      offset: (page - 1) * PER_PAGE,
    })
    // An owner's email is personal data: shown to those who manage accounts.
    const owners = can(staff.role, "users.view") ? await emailsOf(venues.map((v) => v.ownerId ?? "")) : {}
    return ok({ venues: venues.map((v) => ({ ...v, ownerEmail: v.ownerId ? (owners[v.ownerId] ?? null) : null })), total, page, perPage: PER_PAGE })
  } catch (err) {
    return failed("list venues", err)
  }
}
