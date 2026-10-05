import type { Metadata } from "next"
import VenuesView from "@/components/admin/views/VenuesView"
import RequirePermission from "@/components/admin/RequirePermission"

export const metadata: Metadata = { title: "Venues · Back office" }

export default function Page() {
  return (
    <RequirePermission permission="venues.view" what="shared venues">
      <VenuesView />
    </RequirePermission>
  )
}
