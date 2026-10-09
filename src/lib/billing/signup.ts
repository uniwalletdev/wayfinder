import "server-only"
import { siteUrl } from "../site-url"
import { allowedDomains, isWorkEmail, provingEmail } from "./claim"
import { currencyFor, TERMS_VERSION, type Interval } from "./plans"
import { createCheckout, createCustomer, createInvoiceSubscription, ensurePrice, updateCustomer } from "./stripe"
import { createOrg, createSite, getOrg, liveSiteFor, restartSite, setSiteStatus, setSiteSubscription, setStripeCustomer, type Org, type OrgSite } from "./store"
import type { ClaimableSite } from "./sites"
import type { HospitalUser } from "./account"
import { myOrg } from "./account"
import { canOrg, type OrgRole } from "./org-roles"

// Signing a hospital site up, end to end and with nobody in the loop:
// prove the person works there, record the terms they accepted, then hand
// payment to Stripe — Checkout to pay online, or a subscription that emails
// invoices to pay by bank transfer. Stripe's webhook (/api/stripe/webhook)
// takes it from there.

export type PaymentChoice = {
  interval: Interval
  billing: "online" | "invoice"
  poNumber: string | null
  billingEmail: string | null
}

export type SignupResult =
  | { kind: "redirect"; url: string }
  | { kind: "live"; siteId: string }
  | { kind: "review"; siteId: string }
  | { kind: "refused"; status: number; error: string }

const refuse = (status: number, error: string): SignupResult => ({ kind: "refused", status, error })

function origin(): string {
  return siteUrl().origin
}

// Takes payment for a site that is signed up and allowed to pay.
export async function startPayment(org: Org, site: OrgSite, choice: PaymentChoice, user: HospitalUser): Promise<SignupResult> {
  const priceId = await ensurePrice(site.tier, choice.interval, site.currency)
  const billingEmail = choice.billingEmail ?? org.billingEmail ?? user.primaryEmail
  let customerId = org.stripeCustomerId
  if (!customerId) {
    customerId = await createCustomer({ name: org.name, email: billingEmail, country: org.country, orgId: org.id })
    await setStripeCustomer(org.id, customerId)
  }
  if (choice.billing === "online") {
    const url = await createCheckout({
      customerId,
      priceId,
      siteId: site.id,
      venueName: site.venueName,
      successUrl: `${origin()}/for-hospitals/account?welcome=${encodeURIComponent(site.id)}`,
      cancelUrl: `${origin()}/for-hospitals/account?unpaid=${encodeURIComponent(site.id)}`,
    })
    return { kind: "redirect", url }
  }
  await updateCustomer(customerId, { email: billingEmail, poNumber: choice.poNumber })
  const sub = await createInvoiceSubscription({ customerId, priceId, siteId: site.id, venueName: site.venueName, poNumber: choice.poNumber, currency: site.currency })
  await setSiteSubscription(site.id, sub.id, sub.currentPeriodEnd)
  // Live straight away, as a trial, while the invoice is paid.
  await setSiteStatus(site.id, "trial")
  return { kind: "live", siteId: site.id }
}

export function checkChoice(b: Record<string, unknown>): PaymentChoice | string {
  const interval = b.interval === "month" || b.interval === "year" ? b.interval : null
  const billing = b.billing === "online" || b.billing === "invoice" ? b.billing : null
  if (!interval || !billing) return "bad_request"
  if (b.acceptTerms !== true) return "terms_required"
  const po = typeof b.poNumber === "string" ? b.poNumber.trim().slice(0, 30) : ""
  const email = typeof b.billingEmail === "string" ? b.billingEmail.trim().toLowerCase().slice(0, 254) : ""
  if (billing === "invoice") {
    if (!email || !isWorkEmail(email)) return "billing_email_required"
  }
  return { interval, billing, poNumber: po || null, billingEmail: email || null }
}

export async function signUp(user: HospitalUser, site: ClaimableSite, choice: PaymentChoice, opts: { orgId?: unknown; orgName?: unknown }): Promise<SignupResult> {
  const live = await liveSiteFor(site.venueId)
  let org: (Org & { role: OrgRole }) | null = null
  if (opts.orgId !== undefined && opts.orgId !== null) {
    const mine = await myOrg(user, opts.orgId)
    if (!mine) return refuse(404, "no_such_organisation")
    if (!canOrg(mine.role, "sites.add")) return refuse(403, "forbidden")
    org = mine
  }
  if (live) {
    // Someone else lists this hospital already.
    if (!org || live.orgId !== org.id) {
      const theirs = await myOrg(user, live.orgId)
      if (!theirs) return refuse(409, "already_listed")
      org = theirs
    }
    if (live.status === "review") return { kind: "review", siteId: live.id }
    if (live.status !== "pending") return refuse(409, "already_listed_by_you")
    if (!canOrg(org.role, "billing.manage")) return refuse(403, "forbidden")
    // Signed up before but not paid (a checkout closed, or a review just
    // approved): start again with today's choices.
    await restartSite(live.id, { interval: choice.interval, billing: choice.billing, status: "pending", poNumber: choice.poNumber, termsVersion: TERMS_VERSION, userId: user.userId })
    const fresh = (await getOrg(org.id)) ?? org
    return startPayment(fresh, { ...live, interval: choice.interval, billing: choice.billing, poNumber: choice.poNumber }, choice, user)
  }

  const proving = provingEmail(user.emails, allowedDomains(site))
  if (!org) {
    const name = typeof opts.orgName === "string" && opts.orgName.trim() ? opts.orgName.trim() : site.name
    org = { role: "manager", ...(await createOrg({ name, kind: site.kind, country: site.country, billingEmail: choice.billingEmail ?? user.primaryEmail, managerEmail: user.primaryEmail, userId: user.userId })) }
  }
  const created = await createSite({
    orgId: org.id,
    venueId: site.venueId,
    venueName: site.name,
    tier: site.tier,
    interval: choice.interval,
    currency: currencyFor(site.country),
    billing: choice.billing,
    // Nothing proves they work there: a person checks before anything is
    // charged.
    status: proving ? "pending" : "review",
    poNumber: choice.poNumber,
    claimEmail: proving ?? user.primaryEmail,
    termsVersion: TERMS_VERSION,
    userId: user.userId,
  })
  // Someone else signed the same hospital up a moment ago.
  if (!created) return refuse(409, "already_listed")
  if (!proving) return { kind: "review", siteId: created.id }
  return startPayment(org, created, choice, user)
}
