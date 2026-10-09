// Checks hospital subscriptions (src/lib/billing/): the prices the sign-up
// page shows and Stripe is asked for, which work emails prove someone works
// at a hospital, what Stripe's webhook events do to a site's listing, that
// the webhook's signature check refuses forgeries and replays, and who in a
// hospital's own account may do what.
//
// Run: node scripts/lib-test/billing.test.mjs
import { register } from "node:module"
import { createHmac } from "node:crypto"
import { fileURLToPath } from "node:url"

register(new URL("./ts-hooks.mjs", import.meta.url), import.meta.url)

const SRC = new URL("../../src/lib/billing/", import.meta.url)
const P = await import(fileURLToPath(new URL("plans.ts", SRC)))
const C = await import(fileURLToPath(new URL("claim.ts", SRC)))
const S = await import(fileURLToPath(new URL("status.ts", SRC)))
const O = await import(fileURLToPath(new URL("org-roles.ts", SRC)))
const F = await import(fileURLToPath(new URL("form-encode.ts", SRC)))
const { group, check, report } = await import("../nhs/test/harness.mjs")

group("prices")
{
  check("yearly is ten months of monthly", P.TIERS.every((t) => P.CURRENCIES.every((c) => P.priceFor(t, "year", c) === P.priceFor(t, "month", c) * 10)))
  check("bigger sites cost more", P.CURRENCIES.every((c) => P.priceFor("small", "month", c) < P.priceFor("medium", "month", c) && P.priceFor("medium", "month", c) < P.priceFor("large", "month", c)))
  check("Stripe is asked in pence/cents", P.unitAmount("small", "month", "gbp") === P.priceFor("small", "month", "gbp") * 100)
  check("a lookup key names tier, interval, currency and version", P.lookupKey("large", "year", "eur") === `findway_official_v${P.PRICE_VERSION}_large_year_eur`)
  check("the UK pays in pounds", P.currencyFor("GB") === "gbp" && P.currencyFor("gb") === "gbp")
  check("the euro area in euros", ["IE", "FR", "DE", "LU", "NL"].every((c) => P.currencyFor(c) === "eur"))
  check("everyone else in dollars", P.currencyFor("US") === "usd" && P.currencyFor("NG") === "usd" && P.currencyFor(null) === "usd")
  check("prices are written with their symbol", P.formatPrice(2900, "gbp") === "£2,900" && P.formatPrice(340, "eur") === "€340")
}

group("tiers from the map")
{
  check("no map yet is small", P.tierFor({ floors: 0, places: 0 }) === "small")
  check("a few floors is medium", P.tierFor({ floors: 3, places: 10 }) === "medium")
  check("many places is medium", P.tierFor({ floors: 1, places: 60 }) === "medium")
  check("a big hospital is large", P.tierFor({ floors: 7, places: 20 }) === "large" && P.tierFor({ floors: 2, places: 200 }) === "large")
  check("isTier and isInterval know their values", P.isTier("medium") && !P.isTier("huge") && P.isInterval("year") && !P.isInterval("week"))
}

group("who may claim a hospital")
{
  const nhs = C.allowedDomains({ kind: "nhs", website: "https://www.mft.nhs.uk" })
  check("an NHS hospital takes nhs.net and its trust's domain", nhs.includes("nhs.net") && nhs.includes("mft.nhs.uk") && nhs.length === 2)
  check("an nhs.net address proves it", C.domainMatches("Jane.Doe@NHS.net", nhs))
  check("an address at the trust proves it", C.domainMatches("jane@mft.nhs.uk", nhs))
  check("and at part of the trust", C.domainMatches("jane@estates.mft.nhs.uk", nhs))
  check("another trust does not", !C.domainMatches("jane@gstt.nhs.uk", nhs))
  check("a look-alike domain does not", !C.domainMatches("jane@evilmft.nhs.uk", nhs) && !C.domainMatches("jane@mft.nhs.uk.evil.com", nhs))
  check("free mail never does", !C.domainMatches("jane@gmail.com", ["gmail.com"]))
  check("a private hospital takes its website's domain only", C.allowedDomains({ kind: "private", website: "http://www.spirehealthcare.com/x" }).join() === "spirehealthcare.com")
  check("a hospital with no website has nothing automatic", C.allowedDomains({ kind: "other", website: null }).length === 0)
  check("a website on a whole sector's domain proves nothing", C.websiteDomain("https://www.nhs.uk/services/hospital/x") === null && C.websiteDomain("https://facebook.com/hospital") === null)
  check("junk websites are ignored", C.websiteDomain("not a url") === null && C.websiteDomain("") === null)
  check("the first proving address is picked", C.provingEmail(["me@gmail.com", "me@mft.nhs.uk"], nhs) === "me@mft.nhs.uk" && C.provingEmail(["me@gmail.com"], nhs) === null)
  check("work email means not free mail", C.isWorkEmail("ap@trust.nhs.uk") && !C.isWorkEmail("me@hotmail.com") && !C.isWorkEmail("nope"))
}

group("what Stripe events do")
{
  const ev = (type, object) => ({ type, data: { object } })
  const done = S.updateFromEvent(ev("checkout.session.completed", { mode: "subscription", payment_status: "paid", subscription: "sub_1", customer: "cus_1", metadata: { site_id: "s1" } }))
  check("a paid checkout is active", done?.status === "active" && done.siteId === "s1" && done.subscriptionId === "sub_1" && done.customerId === "cus_1")
  check("a direct debit still clearing is a trial", S.updateFromEvent(ev("checkout.session.completed", { mode: "subscription", payment_status: "unpaid", metadata: { site_id: "s1" } }))?.status === "trial")
  check("a one-off checkout is not ours", S.updateFromEvent(ev("checkout.session.completed", { mode: "payment" })) === null)
  const paidOld = S.updateFromEvent(ev("invoice.paid", { subscription: "sub_1", lines: { data: [{ period: { end: 1767225600 } }] } }))
  check("a paid invoice is active, renewing at its period end", paidOld?.status === "active" && paidOld.subscriptionId === "sub_1" && paidOld.renewsOn === "2026-01-01")
  const paidNew = S.updateFromEvent(ev("invoice.paid", { parent: { subscription_details: { subscription: "sub_2", metadata: { site_id: "s2" } } } }))
  check("newer API versions' invoices are read too", paidNew?.subscriptionId === "sub_2" && paidNew.siteId === "s2")
  check("an overdue invoice is late", S.updateFromEvent(ev("invoice.overdue", { subscription: "sub_1" }))?.status === "past_due")
  check("a failed payment is late", S.updateFromEvent(ev("invoice.payment_failed", { subscription: "sub_1" }))?.status === "past_due")
  check("a cancelled subscription lapses", S.updateFromEvent(ev("customer.subscription.deleted", { id: "sub_1" }))?.status === "lapsed")
  const upd = S.updateFromEvent(ev("customer.subscription.updated", { id: "sub_1", status: "past_due", items: { data: [{ current_period_end: 1767225600 }] } }))
  check("a subscription update carries status and period", upd?.status === "past_due" && upd.renewsOn === "2026-01-01")
  check("Stripe's statuses map to ours", S.statusOfSubscription("trialing") === "trial" && S.statusOfSubscription("unpaid") === "past_due" && S.statusOfSubscription("canceled") === "lapsed" && S.statusOfSubscription("incomplete") === null)
  check("other events change nothing", S.updateFromEvent(ev("customer.created", {})) === null && S.updateFromEvent({}) === null)
}

group("status moves")
{
  check("a payment makes a trial active", S.nextStatus("trial", "active", "invoice.paid") === "active")
  check("an invoice subscription reading active is not a payment", S.nextStatus("trial", "active", "customer.subscription.updated") === null && S.nextStatus("pending", "active", "customer.subscription.created") === null)
  check("a late event cannot undo a cancellation", S.nextStatus("lapsed", "past_due", "customer.subscription.updated") === null)
  check("a payment brings a lapsed site back", S.nextStatus("lapsed", "active", "invoice.paid") === "active")
  check("nothing from Stripe moves a review", S.nextStatus("review", "active", "invoice.paid") === null)
  check("no change is no move", S.nextStatus("active", "active", "invoice.paid") === null)
  check("a late payment holds a site back", S.nextStatus("active", "past_due", "invoice.overdue") === "past_due")
  check("Official while live, late or on trial; not otherwise", ["trial", "active", "past_due"].every(S.isOfficial) && !["pending", "review", "lapsed"].some(S.isOfficial))
}

group("the webhook's signature")
{
  const secret = "whsec_test"
  const body = '{"id":"evt_1","type":"invoice.paid"}'
  const now = 1_800_000_000
  const sign = (t, payload = body, key = secret) => createHmac("sha256", key).update(`${t}.${payload}`).digest("hex")
  check("a genuine delivery passes", S.verifyStripeSignature(body, `t=${now},v1=${sign(now)}`, secret, now))
  check("any of several signatures may match (secret rotation)", S.verifyStripeSignature(body, `t=${now},v1=deadbeef,v1=${sign(now)}`, secret, now))
  check("a changed body fails", !S.verifyStripeSignature(body.replace("paid", "void"), `t=${now},v1=${sign(now)}`, secret, now))
  check("another secret fails", !S.verifyStripeSignature(body, `t=${now},v1=${sign(now, body, "whsec_other")}`, secret, now))
  check("an old delivery is refused", !S.verifyStripeSignature(body, `t=${now - 600},v1=${sign(now - 600)}`, secret, now))
  check("no header, no secret or junk fails", !S.verifyStripeSignature(body, null, secret, now) && !S.verifyStripeSignature(body, `t=${now},v1=${sign(now)}`, "", now) && !S.verifyStripeSignature(body, "garbage", secret, now))
}

group("a hospital's own roles")
{
  check("a viewer reads", O.canOrg("viewer", "sites.view") && O.canOrg("viewer", "insights.view"))
  check("a viewer changes nothing", ["sites.add", "billing.manage", "branding.edit", "members.manage"].every((p) => !O.canOrg("viewer", p)))
  check("a manager does everything", ["sites.view", "sites.add", "billing.manage", "branding.edit", "members.manage"].every((p) => O.canOrg("manager", p)))
  check("nobody without a role can do anything", !O.canOrg(null, "sites.view"))
  check("a manager cannot change their own access", O.checkMemberChange({ email: "a@x.org", role: "manager" }, { email: "A@x.org" }, 1) !== null)
  check("the last manager stays", O.checkMemberChange({ email: "a@x.org", role: "manager" }, { email: "b@x.org" }, 0) !== null)
  check("a manager changes a colleague", O.checkMemberChange({ email: "a@x.org", role: "manager" }, { email: "b@x.org" }, 1) === null)
  check("a viewer cannot", O.checkMemberChange({ email: "a@x.org", role: "viewer" }, { email: "b@x.org" }, 1) !== null)
  check("brand colours are #rgb or #rrggbb", O.parseBrandColor("#0A5DC2") === "#0a5dc2" && O.parseBrandColor("#abc") === "#abc" && O.parseBrandColor("red") === null && O.parseBrandColor("#12345") === null)
  const png = `data:image/png;base64,${Buffer.alloc(1000).toString("base64")}`
  check("a small PNG logo is taken", O.parseLogo(png)?.type === "image/png")
  check("an SVG is refused", O.parseLogo(`data:image/svg+xml;base64,${Buffer.from("<svg/>").toString("base64")}`) === null)
  check("a logo over 100 KB is refused", O.parseLogo(`data:image/png;base64,${Buffer.alloc(O.LOGO_MAX_BYTES + 1).toString("base64")}`) === null)
  check("a linked logo is refused", O.parseLogo("https://example.org/logo.png") === null)
}

group("Stripe's form encoding")
{
  const f = F.formEncode({ mode: "subscription", line_items: [{ price: "p", quantity: 1 }], metadata: { site_id: "s" }, payment_method_types: ["card"], skip: undefined, none: null }).toString()
  check("nested objects and arrays use brackets", f === "mode=subscription&line_items%5B0%5D%5Bprice%5D=p&line_items%5B0%5D%5Bquantity%5D=1&metadata%5Bsite_id%5D=s&payment_method_types%5B0%5D=card", f)
}

report()
