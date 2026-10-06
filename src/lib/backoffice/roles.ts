// Who may do what in the back office (/admin). Pure: no I/O, so the rules are
// unit-tested (scripts/lib-test/backoffice-roles.test.mjs) and the same answers
// gate the API routes, the navigation and the buttons.
//
// Four staff roles, each including everything below it:
//   viewer — reads every page except the inbox, the account list and the
//            audit log
//   editor — viewer, plus moderating shared venues, reports, support messages
//            and search misses
//   admin  — editor, plus accounts (ban, unban, give or take editor/viewer),
//            the audit log, data retention and starting a data refresh
//   owner  — admin, plus granting and revoking admin and owner, and deleting
//            accounts
// Everyone else who signs in is an ordinary Findway user and sees no back
// office. Owners named in ADMIN_EMAILS are fixed: the back office cannot demote,
// ban or delete them, so a deployment can never lock its own owners out.

export const ROLES = ["owner", "admin", "editor", "viewer"] as const
export type Role = (typeof ROLES)[number]
// What the account list shows for someone who is not staff.
export type RoleOrNone = Role | "none"

const RANK: Record<Role, number> = { viewer: 1, editor: 2, admin: 3, owner: 4 }

export const ROLE_LABELS: Record<RoleOrNone, string> = {
  owner: "Owner",
  admin: "Admin",
  editor: "Editor",
  viewer: "Viewer",
  none: "User",
}

export const ROLE_SUMMARIES: Record<Role, string> = {
  owner: "Everything, including who is an admin or owner, and deleting accounts",
  admin: "Accounts, the audit log, data retention and data refreshes",
  editor: "Moderates shared venues, reports, messages and search misses",
  viewer: "Reads the back office except the inbox and accounts; changes nothing",
}

export const PERMISSIONS = {
  "overview.view": "viewer",
  "coverage.view": "viewer",
  "venues.view": "viewer",
  "searches.view": "viewer",
  "activity.view": "viewer",
  "system.view": "viewer",
  "venues.edit": "editor",
  "searches.edit": "editor",
  // Reports about places and support messages. Editors answer them, so they
  // see the email someone typed in to get a reply.
  "inbox.view": "editor",
  "inbox.edit": "editor",
  "users.view": "admin",
  "users.manage": "admin",
  "audit.view": "admin",
  "data.purge": "admin",
  "pipeline.run": "admin",
  "roles.admin": "owner",
  "users.delete": "owner",
} as const satisfies Record<string, Role>

export type Permission = keyof typeof PERMISSIONS

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value)
}

export function atLeast(role: Role, min: Role): boolean {
  return RANK[role] >= RANK[min]
}

export function can(role: Role | null | undefined, permission: Permission): boolean {
  return !!role && atLeast(role, PERMISSIONS[permission])
}

export function permissionsOf(role: Role): Permission[] {
  return (Object.keys(PERMISSIONS) as Permission[]).filter((p) => can(role, p))
}

// ADMIN_EMAILS: comma, space or semicolon separated, any case.
export function parseOwnerEmails(raw: string | undefined | null): string[] {
  return (raw ?? "")
    .split(/[\s,;]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s))
}

// The staff role of a signed-in account. Only a VERIFIED address counts for
// ADMIN_EMAILS: an unverified one could have been typed in by anyone.
export function resolveRole(input: { verifiedEmails: string[]; ownerEmails: string[]; storedRole: string | null | undefined }): {
  role: Role | null
  fixedOwner: boolean
} {
  const verified = new Set(input.verifiedEmails.map((e) => e.toLowerCase()))
  if (input.ownerEmails.some((e) => verified.has(e))) return { role: "owner", fixedOwner: true }
  return { role: isRole(input.storedRole) ? input.storedRole : null, fixedOwner: false }
}

export interface Actor {
  userId: string
  role: Role
}

export interface Target {
  userId: string
  role: RoleOrNone
  // Named in ADMIN_EMAILS: its role cannot be changed here.
  fixedOwner: boolean
}

export type Refusal = string

// Roles an actor may hand out at all.
export function assignableRoles(actor: Role): RoleOrNone[] {
  if (actor === "owner") return ["owner", "admin", "editor", "viewer", "none"]
  if (actor === "admin") return ["editor", "viewer", "none"]
  return []
}

// May `actor` act on `target` at all (change role, ban, delete)? Admins act on
// editors, viewers and ordinary users; owners on anyone; nobody on themselves
// or on an owner fixed by ADMIN_EMAILS.
function mayTouch(actor: Actor, target: Target): Refusal | null {
  if (actor.userId === target.userId) return "You cannot change your own account here"
  if (target.fixedOwner) return "This owner is set in the deployment's ADMIN_EMAILS and can only be changed there"
  if (actor.role === "owner") return null
  if (actor.role === "admin") return target.role === "owner" || target.role === "admin" ? "Only an owner can change an admin or owner" : null
  return "Your role cannot manage accounts"
}

export function checkRoleChange(actor: Actor, target: Target, next: RoleOrNone): Refusal | null {
  const touch = mayTouch(actor, target)
  if (touch) return touch
  if (!assignableRoles(actor.role).includes(next)) return `Your role cannot make someone ${ROLE_LABELS[next].toLowerCase()}`
  if (next === target.role) return "That is already their role"
  return null
}

export function checkBan(actor: Actor, target: Target): Refusal | null {
  if (!can(actor.role, "users.manage")) return "Your role cannot ban accounts"
  return mayTouch(actor, target)
}

export function checkDelete(actor: Actor, target: Target): Refusal | null {
  if (!can(actor.role, "users.delete")) return "Only an owner can delete accounts"
  return mayTouch(actor, target)
}
