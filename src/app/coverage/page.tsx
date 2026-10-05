import { redirect } from "next/navigation"

// Coverage is part of the back office now: everything Findway holds, for the
// people who run it. Old links land there, behind sign-in.
export const dynamic = "force-dynamic"

export default function CoveragePage() {
  redirect("/admin/coverage")
}
