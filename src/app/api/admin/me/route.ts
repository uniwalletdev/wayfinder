// Who is signed in to the back office, and what they may do.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
import { getStaffState, publicStaff } from "@/lib/backoffice/staff"
import { ok } from "@/lib/backoffice/http"

export async function GET() {
  const state = await getStaffState()
  if (state.kind === "staff") return ok({ kind: "staff", staff: publicStaff(state.staff) })
  return ok(state)
}
