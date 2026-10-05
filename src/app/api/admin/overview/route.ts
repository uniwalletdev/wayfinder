// The back office's front page: what Findway holds, and what needs attention.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
import { isDatabaseConfigured } from "@/lib/db"
import { requireStaff } from "@/lib/backoffice/staff"
import { overview, listAudit } from "@/lib/backoffice/data"
import { countAccounts } from "@/lib/backoffice/accounts"
import { can } from "@/lib/backoffice/roles"
import { ok, failed } from "@/lib/backoffice/http"

export async function GET(request: Request) {
  const { staff, response } = await requireStaff(request, "overview.view")
  if (response) return response
  const accounts = await countAccounts()
  if (!isDatabaseConfigured()) return ok({ database: false, accounts })
  try {
    const [data, audit] = await Promise.all([
      overview(),
      can(staff.role, "audit.view") ? listAudit({ limit: 6, offset: 0 }).then((r) => r.entries) : Promise.resolve(null),
    ])
    return ok({ ...data, accounts, audit })
  } catch (err) {
    return failed("read the overview", err)
  }
}
