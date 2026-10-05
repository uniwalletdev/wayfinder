import type { Metadata } from "next"
import SearchesView from "@/components/admin/views/SearchesView"
import RequirePermission from "@/components/admin/RequirePermission"

export const metadata: Metadata = { title: "Missed searches · Back office" }

export default function Page() {
  return (
    <RequirePermission permission="searches.view" what="missed searches">
      <SearchesView />
    </RequirePermission>
  )
}
