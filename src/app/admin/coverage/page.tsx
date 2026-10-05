import type { Metadata } from "next"
import CoverageView from "@/components/admin/views/CoverageView"
import RequirePermission from "@/components/admin/RequirePermission"

export const metadata: Metadata = { title: "Coverage · Back office" }

export default function Page() {
  return (
    <RequirePermission permission="coverage.view" what="coverage">
      <CoverageView />
    </RequirePermission>
  )
}
