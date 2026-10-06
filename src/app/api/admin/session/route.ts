// Signing in to the back office with the owner's email and password from the
// environment, and signing out (src/lib/backoffice/password-login.ts).
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
import { cookies } from "next/headers"
import { sameOrigin } from "@/lib/backoffice/origin"
import { audit, getStaffState, PASSWORD_OWNER_ID } from "@/lib/backoffice/staff"
import { body, fail, ok } from "@/lib/backoffice/http"
import { checkCredentials, readPasswordLogin, signSession, SESSION_COOKIE } from "@/lib/backoffice/password-login"
import { rateLimit, LIMITS } from "@/lib/rate-limit"

export async function POST(request: Request) {
  if (!sameOrigin(request.headers)) return fail(403, "cross_origin")
  const limited = rateLimit(request, "backoffice-login", LIMITS.backofficeLogin.limit, LIMITS.backofficeLogin.windowMs)
  if (limited) return limited
  const config = readPasswordLogin(process.env)
  if (!config?.ok) return fail(503, "not_configured")
  const input = await body(request)
  if (!input) return fail(400, "bad_request")
  if (!checkCredentials(input.email, input.password, config.login)) {
    console.warn("Back office: a password sign-in was refused")
    return fail(401, "wrong_credentials")
  }
  const { value, expiresAt } = signSession(config.login, Date.now())
  ;(await cookies()).set(SESSION_COOKIE, value, {
    httpOnly: true,
    // Plain http only for `next dev` on this machine.
    secure: process.env.NODE_ENV === "production",
    // Lax, not strict, so following a link to the back office from an email
    // still arrives signed in. Changes need a same-origin request anyway
    // (requireStaff), whatever cookies come with them.
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
  })
  const { email } = config.login
  await audit({ userId: PASSWORD_OWNER_ID, email, name: email, imageUrl: null, role: "owner", fixedOwner: true, via: "password" }, "session.sign_in", null)
  return ok({ ok: true })
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request.headers)) return fail(403, "cross_origin")
  const state = await getStaffState()
  ;(await cookies()).delete(SESSION_COOKIE)
  if (state.kind === "staff" && state.staff.via === "password") await audit(state.staff, "session.sign_out", null)
  return ok({ ok: true })
}
