// What a hospital's own staff may do in their account (/for-hospitals/account).
// Separate from the Findway back office roles (src/lib/backoffice/roles.ts):
// those run the whole deployment, these reach only the sites of one
// organisation. Pure, and unit-tested (scripts/lib-test/billing.test.mjs).
//
//   manager — everything for the organisation's sites: billing, branding,
//             adding sites, adding and removing colleagues
//   viewer  — reads the sites, their searches and activity; changes nothing

export const ORG_ROLES = ["manager", "viewer"] as const
export type OrgRole = (typeof ORG_ROLES)[number]

export const ORG_ROLE_LABELS: Record<OrgRole, string> = { manager: "Manager", viewer: "Viewer" }

const ORG_PERMISSIONS = {
  "sites.view": "viewer",
  "insights.view": "viewer",
  "sites.add": "manager",
  "billing.manage": "manager",
  "branding.edit": "manager",
  "members.manage": "manager",
} as const satisfies Record<string, OrgRole>

export type OrgPermission = keyof typeof ORG_PERMISSIONS

const RANK: Record<OrgRole, number> = { viewer: 1, manager: 2 }

export function isOrgRole(v: unknown): v is OrgRole {
  return typeof v === "string" && (ORG_ROLES as readonly string[]).includes(v)
}

export function canOrg(role: OrgRole | null | undefined, permission: OrgPermission): boolean {
  return !!role && RANK[role] >= RANK[ORG_PERMISSIONS[permission]]
}

// A manager may not remove or demote themselves: an organisation must always
// have someone who can pay its bills.
export function checkMemberChange(actor: { email: string; role: OrgRole }, target: { email: string }, managersLeft: number): string | null {
  if (!canOrg(actor.role, "members.manage")) return "Only a manager can change who has access"
  if (actor.email.toLowerCase() === target.email.toLowerCase()) return "You cannot change your own access"
  if (managersLeft < 1) return "Your organisation needs at least one manager"
  return null
}

// A brand colour the app can put on screen: #rgb or #rrggbb.
export function parseBrandColor(v: unknown): string | null {
  return typeof v === "string" && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(v.trim()) ? v.trim().toLowerCase() : null
}

// A logo, uploaded rather than linked: the app serves it itself
// (/api/official/logo/<org>), so showing a hospital's logo never sends a
// patient's address to anyone else's server. PNG, JPEG or WebP, up to 100 KB.
export const LOGO_MAX_BYTES = 100 * 1024

export function parseLogo(v: unknown): { type: string; data: string } | null {
  if (typeof v !== "string") return null
  const m = v.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/)
  if (!m) return null
  const bytes = Math.floor((m[2].length * 3) / 4) - (m[2].endsWith("==") ? 2 : m[2].endsWith("=") ? 1 : 0)
  return bytes > 0 && bytes <= LOGO_MAX_BYTES ? { type: m[1], data: m[2] } : null
}
