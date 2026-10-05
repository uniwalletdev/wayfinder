import "server-only"
import { isDatabaseConfigured } from "../db"
import { clerkConfigured, ownerEmails } from "./staff"
import { listMembers, storedRoles, venuesOwnedBy } from "./data"
import type { RoleOrNone, Target } from "./roles"

// Accounts are Clerk's: the back office reads and changes them through Clerk's
// Backend API, and adds what Findway knows about each one — its staff role and
// the venues it owns. Imported lazily, so a deployment without Clerk never
// loads its server SDK.

async function clerk() {
  const { clerkClient } = await import("@clerk/nextjs/server")
  return clerkClient()
}
type ClerkUser = Awaited<ReturnType<Awaited<ReturnType<typeof clerk>>["users"]["getUser"]>>

export interface Account {
  id: string
  name: string
  email: string | null
  emailVerified: boolean
  imageUrl: string | null
  createdAt: string
  lastSignInAt: string | null
  lastActiveAt: string | null
  banned: boolean
  role: RoleOrNone
  fixedOwner: boolean
  venues: number
}

const iso = (ms: number | null | undefined) => (ms ? new Date(ms).toISOString() : null)

function verifiedEmails(u: ClerkUser): string[] {
  return u.emailAddresses.filter((e) => e.verification?.status === "verified").map((e) => e.emailAddress.toLowerCase())
}

function toAccount(u: ClerkUser, roles: Record<string, RoleOrNone>, venues: Record<string, number>, owners: string[]): Account {
  const primary = u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId) ?? u.emailAddresses[0]
  const fixedOwner = verifiedEmails(u).some((e) => owners.includes(e))
  return {
    id: u.id,
    name: [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || primary?.emailAddress || u.id,
    email: primary?.emailAddress ?? null,
    emailVerified: primary?.verification?.status === "verified",
    imageUrl: u.imageUrl || null,
    createdAt: iso(u.createdAt) ?? new Date(0).toISOString(),
    lastSignInAt: iso(u.lastSignInAt),
    lastActiveAt: iso(u.lastActiveAt),
    banned: u.banned,
    role: fixedOwner ? "owner" : (roles[u.id] ?? "none"),
    fixedOwner,
    venues: venues[u.id] ?? 0,
  }
}

async function decorate(users: ClerkUser[]): Promise<Account[]> {
  const ids = users.map((u) => u.id)
  const [roles, venues] = isDatabaseConfigured() ? await Promise.all([storedRoles(ids), venuesOwnedBy(ids)]) : [{}, {}]
  const owners = ownerEmails()
  return users.map((u) => toAccount(u, roles, venues, owners))
}

export async function listAccounts(opts: { q?: string; limit: number; offset: number }): Promise<{ accounts: Account[]; total: number }> {
  const c = await clerk()
  const res = await c.users.getUserList({ limit: opts.limit, offset: opts.offset, query: opts.q || undefined, orderBy: "-created_at" })
  return { accounts: await decorate(res.data), total: res.totalCount }
}

export async function getAccount(id: string): Promise<Account | null> {
  if (!/^user_[A-Za-z0-9]+$/.test(id)) return null
  try {
    const c = await clerk()
    const [account] = await decorate([await c.users.getUser(id)])
    return account
  } catch {
    return null
  }
}

export function targetOf(a: Account): Target {
  return { userId: a.id, role: a.role, fixedOwner: a.fixedOwner }
}

export async function setBanned(id: string, banned: boolean): Promise<void> {
  const c = await clerk()
  if (banned) await c.users.banUser(id)
  else await c.users.unbanUser(id)
}

export async function deleteAccount(id: string): Promise<void> {
  const c = await clerk()
  await c.users.deleteUser(id)
}

export async function countAccounts(): Promise<number | null> {
  if (!clerkConfigured()) return null
  try {
    const c = await clerk()
    return await c.users.getCount()
  } catch {
    return null
  }
}

// The emails of venue owners, for the venues table.
export async function emailsOf(userIds: string[]): Promise<Record<string, string>> {
  const ids = [...new Set(userIds)].filter(Boolean)
  if (!ids.length || !clerkConfigured()) return {}
  try {
    const c = await clerk()
    const res = await c.users.getUserList({ userId: ids.slice(0, 100), limit: 100 })
    const out: Record<string, string> = {}
    for (const u of res.data) {
      const primary = u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId) ?? u.emailAddresses[0]
      if (primary) out[u.id] = primary.emailAddress
    }
    return out
  } catch {
    return {}
  }
}

// The team: every account with a staff role, the ADMIN_EMAILS owners first —
// including an owner who has not signed in yet, who shows by email alone.
export interface TeamMember {
  userId: string | null
  email: string
  name: string | null
  role: RoleOrNone
  fixedOwner: boolean
  lastSignInAt: string | null
  banned: boolean
}

export async function team(): Promise<TeamMember[]> {
  const owners = ownerEmails()
  const members = isDatabaseConfigured() ? await listMembers() : []
  const c = clerkConfigured() ? await clerk() : null
  const byEmail = new Map<string, ClerkUser>()
  const byId = new Map<string, ClerkUser>()
  if (c) {
    if (owners.length) for (const u of (await c.users.getUserList({ emailAddress: owners, limit: 100 })).data) for (const e of verifiedEmails(u)) byEmail.set(e, u)
    const ids = members.map((m) => m.userId)
    if (ids.length) for (const u of (await c.users.getUserList({ userId: ids.slice(0, 100), limit: 100 })).data) byId.set(u.id, u)
  }
  const nameOf = (u: ClerkUser | undefined) => (u ? [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || null : null)
  const out: TeamMember[] = owners.map((email) => {
    const u = byEmail.get(email)
    return { userId: u?.id ?? null, email, name: nameOf(u), role: "owner", fixedOwner: true, lastSignInAt: iso(u?.lastSignInAt), banned: !!u?.banned }
  })
  const fixedIds = new Set(out.map((m) => m.userId).filter(Boolean))
  for (const m of members) {
    if (fixedIds.has(m.userId)) continue
    const u = byId.get(m.userId)
    const email = u?.emailAddresses.find((e) => e.id === u.primaryEmailAddressId)?.emailAddress ?? m.email ?? m.userId
    out.push({ userId: m.userId, email, name: nameOf(u), role: m.role, fixedOwner: false, lastSignInAt: iso(u?.lastSignInAt), banned: !!u?.banned })
  }
  return out
}
