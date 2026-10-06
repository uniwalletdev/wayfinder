// Checks the back office's email-and-password sign-in
// (src/lib/backoffice/password-login.ts): when the environment's login is
// usable, that only the exact login gets in, and that a session cookie cannot
// be forged, stretched or carried over to a changed password.
//
// Run: node scripts/lib-test/backoffice-password.test.mjs
import { register } from "node:module"
import { fileURLToPath } from "node:url"

register(new URL("./ts-hooks.mjs", import.meta.url), import.meta.url)

const SRC = new URL("../../src/lib/", import.meta.url)
const P = await import(fileURLToPath(new URL("backoffice/password-login.ts", SRC)))
const { group, check, report } = await import("../nhs/test/harness.mjs")

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.UTC(2026, 9, 6, 12)
const login = { email: "owner@example.org", password: "correct horse battery" }

group("reading the login from the environment")
{
  check("neither variable set: not in use", P.readPasswordLogin({}) === null)
  check("blank values count as unset", P.readPasswordLogin({ BACKOFFICE_EMAIL: "  ", BACKOFFICE_PASSWORD: "" }) === null)
  check("a password with no email is a problem", P.readPasswordLogin({ BACKOFFICE_PASSWORD: "long enough password" })?.problem === "missing_email")
  check("an email with no password is a problem", P.readPasswordLogin({ BACKOFFICE_EMAIL: "a@b.co" })?.problem === "missing_password")
  check("an email must look like one", P.readPasswordLogin({ BACKOFFICE_EMAIL: "owner", BACKOFFICE_PASSWORD: "long enough password" })?.problem === "bad_email")
  check("a password under 12 characters is refused", P.readPasswordLogin({ BACKOFFICE_EMAIL: "a@b.co", BACKOFFICE_PASSWORD: "elevenchars" })?.problem === "short_password")
  const ok = P.readPasswordLogin({ BACKOFFICE_EMAIL: "  Owner@Example.org ", BACKOFFICE_PASSWORD: "twelve chars" })
  check("a usable login is read, its email trimmed and lowercased", ok?.ok === true && ok.login.email === "owner@example.org" && ok.login.password === "twelve chars")
  check("the password is kept exactly, spaces and case included", P.readPasswordLogin({ BACKOFFICE_EMAIL: "a@b.co", BACKOFFICE_PASSWORD: " Spaced Pass 1 " })?.login.password === " Spaced Pass 1 ")
}

group("checking what was typed")
{
  check("the exact login gets in", P.checkCredentials("owner@example.org", "correct horse battery", login))
  check("the email ignores case and surrounding spaces", P.checkCredentials("  OWNER@example.ORG ", "correct horse battery", login))
  check("a wrong password is refused", !P.checkCredentials("owner@example.org", "correct horse batter", login))
  check("the password is case-sensitive", !P.checkCredentials("owner@example.org", "Correct horse battery", login))
  check("a wrong email is refused", !P.checkCredentials("someone@example.org", "correct horse battery", login))
  check("an empty password is refused", !P.checkCredentials("owner@example.org", "", login))
  check("anything but strings is refused", !P.checkCredentials(undefined, undefined, login) && !P.checkCredentials(["owner@example.org"], { p: 1 }, login))
}

group("session cookies")
{
  const { value, expiresAt } = P.signSession(login, NOW)
  check("a new session lasts SESSION_DAYS", expiresAt === NOW + P.SESSION_DAYS * DAY)
  check("a fresh session is accepted", P.verifySession(value, login, NOW + 1000))
  check("it is still accepted a minute before it expires", P.verifySession(value, login, expiresAt - 60_000))
  check("it is refused once it expires", !P.verifySession(value, login, expiresAt) && !P.verifySession(value, login, expiresAt + DAY))
  check("changing the password ends it", !P.verifySession(value, { ...login, password: "a different password" }, NOW + 1000))
  check("changing the email ends it", !P.verifySession(value, { ...login, email: "new@example.org" }, NOW + 1000))
  const [v, exp, sig] = value.split(".")
  const later = String(Number(exp) + DAY)
  check("a stretched expiry breaks the signature", !P.verifySession(`${v}.${later}.${sig}`, login, NOW + 1000))
  const flipped = sig.slice(0, -1) + (sig.endsWith("A") ? "B" : "A")
  check("a changed signature is refused", !P.verifySession(`${v}.${exp}.${flipped}`, login, NOW + 1000))
  const farOff = P.signSession(login, NOW + 30 * DAY).value
  check("a session dated further out than this code issues is refused", !P.verifySession(farOff, login, NOW))
  check("missing, empty and malformed values are refused", [undefined, "", "v1", "v1..", `v2.${exp}.${sig}`, `v1.${exp}.${sig}x`, `v1.abc.${sig}`, `${value} `].every((x) => !P.verifySession(x, login, NOW + 1000)))
  check("the same login signs the same expiry the same way", P.signSession(login, NOW).value === value)
}

report()
