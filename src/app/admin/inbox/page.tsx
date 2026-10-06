import type { Metadata } from "next"
import InboxView from "@/components/admin/views/InboxView"
import RequirePermission from "@/components/admin/RequirePermission"

export const metadata: Metadata = { title: "Inbox · Back office" }

export default function Page() {
  return (
    <RequirePermission permission="inbox.view" what="the inbox">
      <InboxView />
    </RequirePermission>
  )
}
