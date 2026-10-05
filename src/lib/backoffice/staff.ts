import "server-only"
import { cache } from "react"
import { headers } from "next/headers"
import { isDatabaseConfigured, query } from "../db"
import { can, parseOwnerEmails, permissionsOf, resolveRole, type Permission, type Role } from "./roles"
import { sameOrigin } from "./origin"

// Who is using the back office, checked on the server for every page render
// and every API call (the data access layer the Next.js auth guide describes:
// node_modules/next/dist/docs/01-app/02-guides/authentication.md). Sign-in is
// Clerk's; the staff role is ours — ADMIN_EMAILS for the fixed owners, the
// backoffice_members table for everyone else.
//
// Development only: with BACKOFFICE_DEV=1 and NODE_ENV not "production" (that
// is, `next dev` — never a deployed build, where `next build` fixes NODE_ENV),
// the back office opens as an owner without signing in, so it can be worked on
// with no Clerk keys. Only for requests to localhost — `next dev` listens on
// every interface — and never alongside a live Clerk key.

export function clerkConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && !!process.env.CLERK_SECRET_KEY
}

async function devMode(): Promise<boolean> {
  if (process.env.NODE_ENV === "production" || process.env.BACKOFFICE_DEV !== "1") return false
  if ((process.env.CLERK_SECRET_KEY ?? "").startsWith("sk_live_")) return false
  const host = ((await headers()).get("host") ?? "").replace(/:\d+$/, "").replace(/^\[|\]$/g, "")
  return host === "localhost" || host === "127.0.0.1" || host === "::1"
}

export function ownerEmails(): string[] {
  return parseOwnerEmails(process.env.ADMIN_EMAILS)
}

export interface Staff {
  userId: string
  email: string | null
  name: string
  imageUrl: string | null
  role: Role
  fixedOwner: boolean
  dev: boolean
}

export type StaffState =
  | { kind: "staff"; staff: Staff }
  | { kind: "signed-out" }
  | { kind: "no-access"; email: string | null; ownersConfigured: boolean }
  | { kind: "unconfigured"; missing: string[] }

export async function storedRole(userId: string): Promise<string | null> {
  if (!isDatabaseConfigured()) return null
  try {
    const { rows } = await query<{ role: string }>("select role from public.backoffice_members where user_id = $1", [userId])
    return rows[0]?.role ?? null
  } catch (err) {
    console.warn("Could not read the back office role:", err instanceof Error ? err.message : err)
    return null
  }
}

export const getStaffState = cache(async (): Promise<StaffState> => {
  if (await devMode()) {
    return {
      kind: "staff",
      staff: { userId: "dev-owner", email: "dev@localhost", name: "Development owner", imageUrl: null, role: "owner", fixedOwner: true, dev: true },
    }
  }
  if (!clerkConfigured()) {
    const missing = ["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY"].filter((k) => !process.env[k])
    return { kind: "unconfigured", missing }
  }
  const { auth, currentUser } = await import("@clerk/nextjs/server")
  const { userId } = await auth()
  if (!userId) return { kind: "signed-out" }
  const user = await currentUser()
  // Banning revokes the sessions, but a session token already issued stays
  // valid for up to a minute: a banned or locked account is out at once.
  if (!user || user.banned || user.locked) return { kind: "signed-out" }
  const verified = user.emailAddresses.filter((e) => e.verification?.status === "verified").map((e) => e.emailAddress)
  const primary = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ?? verified[0] ?? null
  const owners = ownerEmails()
  const { role, fixedOwner } = resolveRole({ verifiedEmails: verified, ownerEmails: owners, storedRole: await storedRole(userId) })
  if (!role) return { kind: "no-access", email: primary, ownersConfigured: owners.length > 0 }
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || primary || "Staff member"
  return { kind: "staff", staff: { userId, email: primary, name, imageUrl: user.imageUrl || null, role, fixedOwner, dev: false } }
})

// What the client is told about the signed-in staff member.
export function publicStaff(staff: Staff) {
  return { ...staff, permissions: permissionsOf(staff.role) }
}
export type PublicStaff = ReturnType<typeof publicStaff>

const json = (status: number, body: Record<string, unknown>) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } })

// For the API routes under /api/admin: the staff member when they hold
// `permission`, otherwise the response to send.
export async function requireStaff(request: Request, permission: Permission): Promise<{ staff: Staff; response?: undefined } | { response: Response; staff?: undefined }> {
  if (request.method !== "GET" && request.method !== "HEAD" && !sameOrigin(request.headers)) {
    return { response: json(403, { error: "cross_origin" }) }
  }
  const state = await getStaffState()
  if (state.kind === "unconfigured") return { response: json(503, { error: "not_configured", missing: state.missing }) }
  if (state.kind === "signed-out") return { response: json(401, { error: "signed_out" }) }
  if (state.kind === "no-access") return { response: json(403, { error: "no_access" }) }
  if (!can(state.staff.role, permission)) return { response: json(403, { error: "forbidden", permission }) }
  return { staff: state.staff }
}

// One line per change made in the back office. A failure to record it is
// logged, not thrown: the change itself has already happened.
export async function audit(staff: Staff, action: string, target: string | null, detail: Record<string, unknown> = {}): Promise<void> {
  if (!isDatabaseConfigured()) return
  try {
    await query(
      "insert into public.backoffice_audit (actor_id, actor_email, action, target, detail) values ($1, $2, $3, $4, $5)",
      [staff.userId, staff.email, action, target, JSON.stringify(detail)]
    )
  } catch (err) {
    console.warn("Could not record a back office change:", err instanceof Error ? err.message : err)
  }
}

