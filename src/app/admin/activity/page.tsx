import type { Metadata } from "next"
import ActivityView from "@/components/admin/views/ActivityView"
import RequirePermission from "@/components/admin/RequirePermission"

export const metadata: Metadata = { title: "Activity · Back office" }

export default function Page() {
  return (
    <RequirePermission permission="activity.view" what="activity">
      <ActivityView />
    </RequirePermission>
  )
}
