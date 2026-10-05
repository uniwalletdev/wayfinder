import type { Metadata } from "next"
import SystemView from "@/components/admin/views/SystemView"
import RequirePermission from "@/components/admin/RequirePermission"

export const metadata: Metadata = { title: "System · Back office" }

export default function Page() {
  return (
    <RequirePermission permission="system.view" what="the system page">
      <SystemView />
    </RequirePermission>
  )
}
