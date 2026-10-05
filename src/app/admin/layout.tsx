import type { Metadata } from "next"
import type { ReactNode } from "react"
import AdminShell from "@/components/admin/AdminShell"
import AdminGate from "@/components/admin/AdminGate"
import { getStaffState, publicStaff } from "@/lib/backoffice/staff"

// The back office: managing Findway itself. Web only — the apps' static export
// leaves it out (scripts/app-shell-build.mjs). The check here decides what is
// drawn; every API route under /api/admin checks the role again on its own,
// since a layout is not re-run on client-side navigation.
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Back office",
  robots: { index: false, follow: false },
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const state = await getStaffState()
  if (state.kind !== "staff") return <AdminGate state={state} />
  return <AdminShell staff={publicStaff(state.staff)}>{children}</AdminShell>
}
