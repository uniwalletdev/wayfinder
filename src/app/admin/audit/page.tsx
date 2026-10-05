import type { Metadata } from "next"
import AuditView from "@/components/admin/views/AuditView"
import RequirePermission from "@/components/admin/RequirePermission"

export const metadata: Metadata = { title: "Audit log · Back office" }

export default function Page() {
  return (
    <RequirePermission permission="audit.view" what="the audit log">
      <AuditView />
    </RequirePermission>
  )
}
