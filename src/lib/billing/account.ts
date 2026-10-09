import "server-only"
import { clerkConfigured } from "../backoffice/staff"
import { sameOrigin } from "../backoffice/origin"
import { isDatabaseConfigured } from "../db"
import { stripeConfigured } from "./stripe"
import { linkMember, orgsFor, type Org } from "./store"
import type { OrgRole } from "./org-roles"

// Who is signed in to a hospital's account, from their Clerk session. Only
// verified email addresses count: they are what proves where someone works,
// and what an organisation's colleagues are invited by.

export interface HospitalUser {
  userId: string
  name: string
  emails: string[]
  primaryEmail: string
}

export type BillingSetup = { ready: true } | { ready: false; missing: string[] }

export function billingSetup(): BillingSetup {
  const missing = [
    ...(!isDatabaseConfigured() ? ["DATABASE_URL"] : []),
    ...(!clerkConfigured() ? ["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY"] : []),
    ...(!stripeConfigured() ? ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"] : []),
  ]
  return missing.length ? { ready: false, missing } : { ready: true }
}

export async function currentHospitalUser(): Promise<HospitalUser | null> {
  if (!clerkConfigured()) return null
  const { auth, currentUser } = await import("@clerk/nextjs/server")
  const { userId } = await auth()
  if (!userId) return null
  const user = await currentUser()
  if (!user || user.banned || user.locked) return null
  const emails = user.emailAddresses.filter((e) => e.verification?.status === "verified").map((e) => e.emailAddress.toLowerCase())
  if (!emails.length) return null
  const primary = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress.toLowerCase()
  const primaryEmail = primary && emails.includes(primary) ? primary : emails[0]
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || primaryEmail
  return { userId, name, emails, primaryEmail }
}

const json = (status: number, body: Record<string, unknown>) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } })

// For the /api/billing routes: the signed-in person, or the response to send.
export async function requireHospitalUser(request: Request): Promise<{ user: HospitalUser; response?: undefined } | { response: Response; user?: undefined }> {
  if (request.method !== "GET" && !sameOrigin(request.headers)) return { response: json(403, { error: "cross_origin" }) }
  const setup = billingSetup()
  if (!setup.ready) return { response: json(503, { error: "not_configured" }) }
  const user = await currentHospitalUser()
  if (!user) return { response: json(401, { error: "signed_out" }) }
  return { user }
}

// The organisations the person belongs to, recording their account against
// any invitation they are signing in to for the first time.
export async function myOrgs(user: HospitalUser): Promise<(Org & { role: OrgRole })[]> {
  const orgs = await orgsFor(user.emails)
  if (orgs.length) await linkMember(user.emails, user.userId).catch(() => {})
  return orgs
}

export async function myOrg(user: HospitalUser, orgId: unknown): Promise<(Org & { role: OrgRole }) | null> {
  if (typeof orgId !== "string") return null
  return (await myOrgs(user)).find((o) => o.id === orgId) ?? null
}
