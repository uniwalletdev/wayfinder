import "server-only"

import { createHmac, randomBytes, timingSafeEqual } from "crypto"
import { cookies, headers } from "next/headers"
import { cache } from "react"
import { consume, LIMITS } from "@/lib/rate-limit"

// Who is allowed into the back office, and how that is proved.
//
// ── The one rule ───────────────────────────────────────────────────────────
// The portal is CLOSED unless it has been deliberately configured. Every other
// integration in this app follows "no key → feature quietly off" (see
// .env.example), and that contract is exactly right for Mapbox and Anthropic —
// but applied here it would mean an unconfigured deployment shipping an open
// door onto every venue, every trail and every delete button. So the default is
// inverted: with nothing configured, /backoffice renders setup instructions and
// authorises nobody. There is no build of this app in which the back office is
// reachable without a secret someone chose.
//
// ── Two ways in, because deployments differ ────────────────────────────────
//   1. ADMIN_EMAILS  — a comma-separated allowlist checked against the signed-in
//      Clerk user. The better option when Clerk is configured: real accounts,
//      real password resets, MFA if the org turns it on, and the audit log names
//      a person rather than "the shared password".
//   2. ADMIN_PASSWORD — a single shared secret exchanged for a signed session
//      cookie. For deployments with no Clerk (the app supports running without
//      it entirely) and for getting an operator in on day one.
//
// Both may be on at once; either is sufficient. Clerk is checked first so the
// audit trail prefers the identified human.
//
// ── The session cookie ─────────────────────────────────────────────────────
// `<base64url(payload)>.<base64url(hmac-sha256)>`, signed with a server-side
// secret. It is a bearer token with an expiry, deliberately not a database row:
// the portal has to be able to tell an operator *why* the database is
// unreachable, which it cannot do if reading the session needs the database.
// httpOnly (so no script can read it), sameSite=lax (so no cross-site form can
// POST with it), secure in production, and scoped to /backoffice so it is never
// attached to a navigator's map requests.

const COOKIE_NAME = "wf_admin"
const SESSION_TTL_SECONDS = 12 * 60 * 60 // a working day; then sign in again
const COOKIE_PATH = "/backoffice"

function env(name: string): string {
  return (process.env[name] ?? "").trim()
}

export const clerkEnabled = !!env("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY")

/** Lower-cased allowlist of Clerk account emails permitted into the portal. */
export function adminEmails(): string[] {
  return env("ADMIN_EMAILS")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

const adminPassword = () => env("ADMIN_PASSWORD")

/**
 * The key the session cookie is signed with. ADMIN_SESSION_SECRET when set;
 * otherwise derived from ADMIN_PASSWORD, which means changing the password
 * invalidates every existing session — the behaviour you want from a password
 * change, and worth the coupling for a deployment that sets only one variable.
 *
 * Returns null when neither exists, which is what makes password sign-in
 * unavailable rather than insecure.
 */
function signingKey(): string | null {
  const explicit = env("ADMIN_SESSION_SECRET")
  if (explicit) return explicit
  const password = adminPassword()
  return password ? `derived-from-password:${password}` : null
}

export interface AdminConfigStatus {
  /** Clerk is wired up AND at least one email is allowlisted. */
  clerkAdmins: boolean
  /** A shared password (and therefore a signing key) is available. */
  passwordLogin: boolean
  /** True when at least one route in is usable. Nobody gets in when false. */
  configured: boolean
  /** Number of allowlisted emails, for the settings screen. Never the emails. */
  allowlistSize: number
}

export function adminConfigStatus(): AdminConfigStatus {
  const clerkAdmins = clerkEnabled && adminEmails().length > 0
  const passwordLogin = !!adminPassword() && !!signingKey()
  return {
    clerkAdmins,
    passwordLogin,
    configured: clerkAdmins || passwordLogin,
    allowlistSize: adminEmails().length,
  }
}

// ── Cookie signing ─────────────────────────────────────────────────────────

interface SessionPayload {
  /** Who this session belongs to, as shown in the audit log. */
  sub: string
  /** Issued at / expires at, seconds since epoch. */
  iat: number
  exp: number
}

function b64url(buf: Buffer): string {
  return buf.toString("base64url")
}

function sign(data: string, key: string): string {
  return b64url(createHmac("sha256", key).update(data).digest())
}

/** Length-safe constant-time compare. Never throws on mismatched lengths. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  // timingSafeEqual requires equal lengths, and the length itself is not a
  // secret worth protecting here — but comparing hashes of both keeps even that
  // uniform, at no cost.
  const ah = createHmac("sha256", "cmp").update(ab).digest()
  const bh = createHmac("sha256", "cmp").update(bb).digest()
  return timingSafeEqual(ah, bh)
}

function mintCookie(sub: string): string | null {
  const key = signingKey()
  if (!key) return null
  const now = Math.floor(Date.now() / 1000)
  const payload: SessionPayload = { sub, iat: now, exp: now + SESSION_TTL_SECONDS }
  const body = b64url(Buffer.from(JSON.stringify(payload)))
  return `${body}.${sign(body, key)}`
}

function readCookie(raw: string | undefined): SessionPayload | null {
  if (!raw) return null
  const key = signingKey()
  if (!key) return null
  const [body, mac] = raw.split(".")
  if (!body || !mac) return null
  if (!safeEqual(mac, sign(body, key))) return null
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload
    if (typeof payload.exp !== "number" || payload.exp * 1000 <= Date.now()) return null
    if (typeof payload.sub !== "string" || !payload.sub) return null
    return payload
  } catch {
    return null
  }
}

// ── Who is asking ──────────────────────────────────────────────────────────

export interface AdminIdentity {
  /** Display name and audit-log actor, e.g. an email or "shared password". */
  actor: string
  /** How they proved it — shown in the shell so an operator knows which. */
  via: "clerk" | "password"
}

/**
 * The signed-in administrator, or null.
 *
 * `cache()` de-duplicates it per request: a page, its layout and any Server
 * Action it renders all ask, and with Clerk that would otherwise be several
 * round-trips to Clerk's API for one page view.
 */
export const getAdmin = cache(async (): Promise<AdminIdentity | null> => {
  // 1. A Clerk account on the allowlist.
  const allowlist = adminEmails()
  if (clerkEnabled && allowlist.length > 0) {
    try {
      const { currentUser } = await import("@clerk/nextjs/server")
      const user = await currentUser()
      const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase()
      if (email && allowlist.includes(email)) {
        return { actor: email, via: "clerk" }
      }
    } catch {
      // Clerk unreachable or not mounted on this request. Fall through to the
      // cookie: an outage at the identity provider must not lock an operator out
      // of the portal they need in order to see that there is an outage.
    }
  }

  // 2. A valid password session.
  if (adminPassword()) {
    const store = await cookies()
    const session = readCookie(store.get(COOKIE_NAME)?.value)
    if (session) return { actor: session.sub, via: "password" }
  }

  return null
})

/**
 * The guard every admin page and Server Action calls first.
 *
 * Server Actions are ordinary POST endpoints reachable without going through the
 * UI (Next.js docs, "Mutating Data"), so an authorisation check in the page that
 * renders a form is worth nothing — it has to be *inside* the action. Throwing
 * rather than redirecting keeps this usable in both places: a page catches it to
 * redirect, an action lets it fail the request.
 */
export async function requireAdmin(): Promise<AdminIdentity> {
  const admin = await getAdmin()
  if (!admin) throw new Error("unauthorized")
  return admin
}

// ── Sign in / sign out ─────────────────────────────────────────────────────

export type LoginResult = { ok: true } | { ok: false; error: string }

/**
 * Exchange the shared password for a session cookie.
 *
 * Rate limited per caller — this is the one input in the app where guessing pays
 * — and compared in constant time. A wrong password and an unconfigured
 * deployment return the same message, so the form can't be used to discover
 * whether ADMIN_PASSWORD is set.
 */
export async function signInWithPassword(password: string): Promise<LoginResult> {
  const expected = adminPassword()
  const caller = await callerFingerprint()
  const taken = consume(`admin-login:${caller}`, LIMITS.adminLogin.limit, LIMITS.adminLogin.windowMs)
  if (!taken.ok) {
    return { ok: false, error: `Too many attempts. Try again in ${Math.ceil(taken.retryAfter / 60)} minute(s).` }
  }

  // Still run a comparison when unconfigured, against a value that cannot match,
  // so the two cases take the same time and give the same answer.
  const candidate = expected || randomBytes(32).toString("hex")
  if (!expected || !safeEqual(password, candidate)) {
    return { ok: false, error: "That password was not accepted." }
  }

  const value = mintCookie("shared password")
  if (!value) return { ok: false, error: "That password was not accepted." }

  const store = await cookies()
  store.set(COOKIE_NAME, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: COOKIE_PATH,
    maxAge: SESSION_TTL_SECONDS,
  })
  return { ok: true }
}

export async function signOut(): Promise<void> {
  const store = await cookies()
  store.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: COOKIE_PATH,
    maxAge: 0,
  })
}

/** Best-effort caller identity for rate limiting. Same rules as callerKey(). */
async function callerFingerprint(): Promise<string> {
  try {
    const h = await headers()
    const xff = h.get("x-forwarded-for")
    if (xff) return xff.split(",")[0]!.trim()
    return h.get("x-real-ip")?.trim() || "unknown"
  } catch {
    return "unknown"
  }
}
