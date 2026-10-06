import { createHash, createHmac, scryptSync, timingSafeEqual } from "crypto"

// Signing in to the back office with one email address and password kept in
// the host's environment (BACKOFFICE_EMAIL, BACKOFFICE_PASSWORD): the owner's
// way in on a deployment that has no Clerk accounts. Whoever signs in this way
// is an owner. Clerk, when its keys are set, keeps working beside it for staff
// with their own accounts (src/lib/backoffice/staff.ts).
//
// A signed-in browser holds a cookie with an expiry time and an HMAC of it.
// Nothing is stored on the server. The signing key is derived from the email
// and password with scrypt, so:
//   - changing the password (or the email) signs every browser out at once;
//   - a stolen cookie is no shortcut to the password: each guess at it costs a
//     full scrypt run, not one hash.
// Signing out deletes the cookie; a copy taken before then stays valid until
// it expires, SESSION_DAYS at most. Changing the password ends those too.

export const SESSION_COOKIE = "findway_backoffice"
export const SESSION_DAYS = 7
export const MIN_PASSWORD_LENGTH = 12

const DAY_MS = 24 * 60 * 60 * 1000

export interface PasswordLogin {
  email: string
  password: string
}

export type PasswordLoginProblem = "missing_email" | "missing_password" | "bad_email" | "short_password"

export type PasswordLoginConfig = { ok: true; login: PasswordLogin } | { ok: false; problem: PasswordLoginProblem }

// The login set in the environment: null when neither variable is set (this
// deployment does not use it), a problem when it is set but unusable. A short
// password is refused rather than accepted: this page faces the internet.
export function readPasswordLogin(env: Record<string, string | undefined>): PasswordLoginConfig | null {
  const email = env.BACKOFFICE_EMAIL?.trim() ?? ""
  const password = env.BACKOFFICE_PASSWORD ?? ""
  if (!email && !password) return null
  if (!email) return { ok: false, problem: "missing_email" }
  if (!password) return { ok: false, problem: "missing_password" }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, problem: "bad_email" }
  if (password.length < MIN_PASSWORD_LENGTH) return { ok: false, problem: "short_password" }
  return { ok: true, login: { email: email.toLowerCase(), password } }
}

const digest = (s: string) => createHash("sha256").update(s, "utf8").digest()

// Whether what was typed is the login. Both halves are always compared, in
// constant time, so a reply never hints which one was wrong.
export function checkCredentials(email: unknown, password: unknown, login: PasswordLogin): boolean {
  if (typeof email !== "string" || typeof password !== "string") return false
  const emailOk = timingSafeEqual(digest(email.trim().toLowerCase()), digest(login.email))
  const passwordOk = timingSafeEqual(digest(password), digest(login.password))
  return emailOk && passwordOk
}

// One derivation per login per server instance: scrypt is deliberately slow.
let cachedKey: { id: string; key: Buffer } | null = null
function signingKey(login: PasswordLogin): Buffer {
  const id = digest(`${login.email}\n${login.password}`).toString("hex")
  if (cachedKey?.id !== id) {
    cachedKey = { id, key: scryptSync(login.password, `findway-backoffice:${login.email}`, 32, { N: 16384, r: 8, p: 1 }) }
  }
  return cachedKey.key
}

function signature(expiresAt: number, login: PasswordLogin): string {
  return createHmac("sha256", signingKey(login)).update(`v1.${login.email}.${expiresAt}`).digest("base64url")
}

// A new session's cookie value and when it expires.
export function signSession(login: PasswordLogin, now: number): { value: string; expiresAt: number } {
  const expiresAt = now + SESSION_DAYS * DAY_MS
  return { value: `v1.${expiresAt}.${signature(expiresAt, login)}`, expiresAt }
}

// Whether a cookie value is a live session for this login.
export function verifySession(value: string | undefined, login: PasswordLogin, now: number): boolean {
  if (!value) return false
  const m = /^v1\.(\d{1,15})\.([A-Za-z0-9_-]{43})$/.exec(value)
  if (!m) return false
  const expiresAt = Number(m[1])
  // Expired, or further out than any session this code issues.
  if (!(expiresAt > now) || expiresAt > now + SESSION_DAYS * DAY_MS + 60_000) return false
  const expected = Buffer.from(signature(expiresAt, login))
  const given = Buffer.from(m[2])
  return given.length === expected.length && timingSafeEqual(given, expected)
}
