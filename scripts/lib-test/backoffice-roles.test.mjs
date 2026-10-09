// Checks who may do what in the back office (src/lib/backoffice/roles.ts):
// the permission ladder, how a signed-in account becomes staff, and the rules
// for changing roles, banning and deleting — above all that nobody can lock
// out an owner set in ADMIN_EMAILS, or themselves.
//
// Run: node scripts/lib-test/backoffice-roles.test.mjs
import { register } from "node:module"
import { fileURLToPath } from "node:url"

register(new URL("./ts-hooks.mjs", import.meta.url), import.meta.url)

const SRC = new URL("../../src/lib/", import.meta.url)
const R = await import(fileURLToPath(new URL("backoffice/roles.ts", SRC)))
const { group, check, report } = await import("../nhs/test/harness.mjs")

group("the permission ladder")
{
  check("a viewer reads the pages", R.can("viewer", "overview.view") && R.can("viewer", "venues.view") && R.can("viewer", "system.view"))
  check("a viewer changes nothing", !R.can("viewer", "venues.edit") && !R.can("viewer", "searches.edit"))
  check("a viewer does not see accounts or the audit log", !R.can("viewer", "users.view") && !R.can("viewer", "audit.view"))
  check("an editor moderates venues and searches", R.can("editor", "venues.edit") && R.can("editor", "searches.edit"))
  check("an editor does not manage accounts", !R.can("editor", "users.manage"))
  check("an editor answers the inbox; a viewer cannot read it", R.can("editor", "inbox.view") && R.can("editor", "inbox.edit") && !R.can("viewer", "inbox.view"))
  check("an admin manages accounts, the audit log, retention and refreshes", ["users.view", "users.manage", "audit.view", "data.purge", "pipeline.run"].every((p) => R.can("admin", p)))
  check("an admin sees and reviews paying hospitals; an editor does not", R.can("admin", "customers.view") && R.can("admin", "customers.edit") && !R.can("editor", "customers.view"))
  check("an admin does not grant admin or delete accounts", !R.can("admin", "roles.admin") && !R.can("admin", "users.delete"))
  check("an owner can do everything", Object.keys(R.PERMISSIONS).every((p) => R.can("owner", p)))
  check("nobody without a role can do anything", Object.keys(R.PERMISSIONS).every((p) => !R.can(null, p) && !R.can(undefined, p)))
  check("permissionsOf lists exactly what can() allows", R.permissionsOf("editor").length === Object.keys(R.PERMISSIONS).filter((p) => R.can("editor", p)).length)
  check("isRole knows the four roles and nothing else", R.ROLES.every(R.isRole) && !R.isRole("none") && !R.isRole("superuser") && !R.isRole(undefined))
}

group("ADMIN_EMAILS")
{
  check("commas, spaces and semicolons, any case", R.parseOwnerEmails(" A@x.org, b@Y.com;c@z.io  d@w.net").join() === "a@x.org,b@y.com,c@z.io,d@w.net")
  check("junk is dropped", R.parseOwnerEmails("not-an-email, @x.org, a@b").length === 0)
  check("unset is empty", R.parseOwnerEmails(undefined).length === 0 && R.parseOwnerEmails("").length === 0)
}

group("resolveRole")
{
  const owners = ["boss@findway.org"]
  const fixed = R.resolveRole({ verifiedEmails: ["Boss@Findway.org"], ownerEmails: owners, storedRole: "viewer" })
  check("a verified ADMIN_EMAILS address is a fixed owner, whatever is stored", fixed.role === "owner" && fixed.fixedOwner)
  check("an unverified one is not", R.resolveRole({ verifiedEmails: [], ownerEmails: owners, storedRole: null }).role === null)
  const stored = R.resolveRole({ verifiedEmails: ["ed@findway.org"], ownerEmails: owners, storedRole: "editor" })
  check("otherwise the stored role", stored.role === "editor" && !stored.fixedOwner)
  check("a stored owner is an owner, but not fixed", (() => { const r = R.resolveRole({ verifiedEmails: [], ownerEmails: [], storedRole: "owner" }); return r.role === "owner" && !r.fixedOwner })())
  check("a stored role that is not a role is no role", R.resolveRole({ verifiedEmails: [], ownerEmails: [], storedRole: "god" }).role === null)
}

group("changing roles")
{
  const owner = { userId: "o1", role: "owner" }
  const admin = { userId: "a1", role: "admin" }
  const editor = { userId: "e1", role: "editor" }
  const user = { userId: "u1", role: "none", fixedOwner: false }
  const otherAdmin = { userId: "a2", role: "admin", fixedOwner: false }
  const fixedOwner = { userId: "o0", role: "owner", fixedOwner: true }
  check("an owner can make a user an admin", R.checkRoleChange(owner, user, "admin") === null)
  check("an owner can make a user an owner", R.checkRoleChange(owner, user, "owner") === null)
  check("an owner can demote an admin", R.checkRoleChange(owner, otherAdmin, "viewer") === null)
  check("an admin can make a user an editor or viewer", R.checkRoleChange(admin, user, "editor") === null && R.checkRoleChange(admin, user, "viewer") === null)
  check("an admin cannot make anyone an admin", R.checkRoleChange(admin, user, "admin") !== null)
  check("an admin cannot touch another admin", /Only an owner/.test(R.checkRoleChange(admin, otherAdmin, "viewer") ?? ""))
  check("an editor cannot change roles", R.checkRoleChange(editor, user, "viewer") !== null)
  check("nobody changes their own role", /your own/.test(R.checkRoleChange(owner, { userId: "o1", role: "owner", fixedOwner: false }, "viewer") ?? ""))
  check("nobody changes an ADMIN_EMAILS owner", /ADMIN_EMAILS/.test(R.checkRoleChange(owner, fixedOwner, "viewer") ?? ""))
  check("setting the same role is refused", R.checkRoleChange(owner, user, "none") !== null)
  check("what each role may hand out", R.assignableRoles("owner").length === 5 && R.assignableRoles("admin").join() === "editor,viewer,none" && R.assignableRoles("editor").length === 0)
}

group("banning and deleting")
{
  const owner = { userId: "o1", role: "owner" }
  const admin = { userId: "a1", role: "admin" }
  const user = { userId: "u1", role: "none", fixedOwner: false }
  const editorT = { userId: "e2", role: "editor", fixedOwner: false }
  const otherOwner = { userId: "o2", role: "owner", fixedOwner: false }
  const fixedOwner = { userId: "o0", role: "owner", fixedOwner: true }
  check("an admin can ban a user or an editor", R.checkBan(admin, user) === null && R.checkBan(admin, editorT) === null)
  check("an admin cannot ban an owner", R.checkBan(admin, otherOwner) !== null)
  check("an owner can ban another (stored) owner", R.checkBan(owner, otherOwner) === null)
  check("nobody bans an ADMIN_EMAILS owner", R.checkBan(owner, fixedOwner) !== null)
  check("nobody bans themselves", R.checkBan(admin, { userId: "a1", role: "admin", fixedOwner: false }) !== null)
  check("an editor cannot ban", R.checkBan({ userId: "e1", role: "editor" }, user) !== null)
  check("only an owner deletes accounts", R.checkDelete(owner, user) === null && R.checkDelete(admin, user) !== null)
  check("an owner cannot delete an ADMIN_EMAILS owner or themselves", R.checkDelete(owner, fixedOwner) !== null && R.checkDelete(owner, { userId: "o1", role: "owner", fixedOwner: false }) !== null)
}

report()
