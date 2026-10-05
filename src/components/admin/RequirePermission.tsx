"use client"
// A section the signed-in role may not open shows why, instead of an error.
// The API refuses the data either way; this only makes the refusal readable.
import type { ReactNode } from "react"
import { useStaff } from "./AdminShell"
import { NoPermission } from "./ui"
import type { Permission } from "@/lib/backoffice/roles"

export default function RequirePermission({ permission, what, children }: { permission: Permission; what: string; children: ReactNode }) {
  const staff = useStaff()
  return staff.can(permission) ? <>{children}</> : <NoPermission what={what} />
}
