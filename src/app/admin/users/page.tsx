import type { Metadata } from "next"
import UsersView from "@/components/admin/views/UsersView"
import RequirePermission from "@/components/admin/RequirePermission"

export const metadata: Metadata = { title: "Users & roles · Back office" }

export default function Page() {
  return (
    <RequirePermission permission="users.view" what="accounts">
      <UsersView />
    </RequirePermission>
  )
}
