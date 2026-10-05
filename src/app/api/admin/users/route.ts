// Accounts (Clerk) and the back office team.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
import { requireStaff, clerkConfigured } from "@/lib/backoffice/staff"
import { listAccounts, team } from "@/lib/backoffice/accounts"
import { ok, failed, intParam, textParam } from "@/lib/backoffice/http"

const PER_PAGE = 25

export async function GET(request: Request) {
  const { response } = await requireStaff(request, "users.view")
  if (response) return response
  const url = new URL(request.url)
  const page = intParam(url, "page", 1, 1, 10_000)
  try {
    const members = await team()
    if (!clerkConfigured()) return ok({ clerk: false, team: members, accounts: [], total: 0, page, perPage: PER_PAGE })
    const { accounts, total } = await listAccounts({ q: textParam(url, "q"), limit: PER_PAGE, offset: (page - 1) * PER_PAGE })
    return ok({ clerk: true, team: members, accounts, total, page, perPage: PER_PAGE })
  } catch (err) {
    return failed("list accounts", err)
  }
}
