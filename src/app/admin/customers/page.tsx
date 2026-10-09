import type { Metadata } from "next"
import CustomersView from "@/components/admin/views/CustomersView"
import RequirePermission from "@/components/admin/RequirePermission"

export const metadata: Metadata = { title: "Customers · Back office" }

export default function Page() {
  return (
    <RequirePermission permission="customers.view" what="paying hospitals">
      <CustomersView />
    </RequirePermission>
  )
}
