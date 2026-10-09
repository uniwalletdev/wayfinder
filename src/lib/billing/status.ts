import { createHmac, timingSafeEqual } from "node:crypto"

// What Stripe's webhook events mean for a hospital site's listing, and the
// check that an event really came from Stripe. Pure (no I/O), and unit-tested
// (scripts/lib-test/billing.test.mjs).
//
// A site's status:
//   pending  — signed up, payment not started (a checkout left open)
//   review   — the email did not prove they work there; staff check it
//   trial    — live as Official while the first invoice is outstanding
//   active   — paid
//   past_due — a payment is late; still Official while Stripe retries
//   lapsed   — cancelled or never paid; the map stays, the badge goes
//
// Whatever the status, a hospital's map is never taken away from patients.

export const SITE_STATUSES = ["pending", "review", "trial", "active", "past_due", "lapsed"] as const
export type SiteStatus = (typeof SITE_STATUSES)[number]

// Shown as Official in the app.
export function isOfficial(status: string): boolean {
  return status === "trial" || status === "active" || status === "past_due"
}

export interface SiteUpdate {
  // Which site: the id we gave Stripe in metadata, or the subscription.
  siteId: string | null
  subscriptionId: string | null
  customerId: string | null
  status: SiteStatus | null
  // When the paid-for period ends, ISO date.
  renewsOn: string | null
}

type Obj = Record<string, unknown>
const obj = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {})
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null)
const idOf = (v: unknown): string | null => str(v) ?? str(obj(v).id)
const dateOf = (secs: unknown): string | null => (typeof secs === "number" && secs > 0 ? new Date(secs * 1000).toISOString().slice(0, 10) : null)

// Stripe's own subscription status, in ours.
export function statusOfSubscription(status: string | null): SiteStatus | null {
  switch (status) {
    case "active":
      return "active"
    case "trialing":
      return "trial"
    case "past_due":
    case "unpaid":
      return "past_due"
    case "canceled":
    case "incomplete_expired":
      return "lapsed"
    default:
      return null
  }
}

// The subscription an invoice belongs to. Newer API versions moved it under
// parent.subscription_details; older ones have it at the top.
function invoiceSubscription(inv: Obj): string | null {
  return idOf(inv.subscription) ?? idOf(obj(obj(inv.parent).subscription_details).subscription)
}

function invoiceSiteId(inv: Obj): string | null {
  return (
    str(obj(obj(obj(inv.parent).subscription_details).metadata).site_id) ??
    str(obj(obj(inv.subscription_details).metadata).site_id)
  )
}

// The end of the period an invoice pays for: its subscription line's.
function invoicePeriodEnd(inv: Obj): string | null {
  const lines = obj(inv.lines).data
  if (Array.isArray(lines)) {
    for (const l of lines) {
      const end = dateOf(obj(obj(l).period).end)
      if (end) return end
    }
  }
  return dateOf(inv.period_end)
}

// Newer API versions put the period on each item; older ones on the
// subscription.
function subscriptionPeriodEnd(sub: Obj): string | null {
  const items = obj(sub.items).data
  if (Array.isArray(items)) {
    for (const it of items) {
      const end = dateOf(obj(it).current_period_end)
      if (end) return end
    }
  }
  return dateOf(sub.current_period_end)
}

// null for an event that changes nothing about a site.
export function updateFromEvent(event: { type?: unknown; data?: unknown }): SiteUpdate | null {
  const type = str(event.type)
  const o = obj(obj(event.data).object)
  switch (type) {
    case "checkout.session.completed": {
      if (o.mode !== "subscription") return null
      const siteId = str(obj(o.metadata).site_id)
      return {
        siteId,
        subscriptionId: idOf(o.subscription),
        customerId: idOf(o.customer),
        // A card is paid there and then; a direct debit takes days to clear,
        // and the site is live meanwhile.
        status: o.payment_status === "paid" || o.payment_status === "no_payment_required" ? "active" : "trial",
        renewsOn: null,
      }
    }
    case "invoice.paid":
      return { siteId: invoiceSiteId(o), subscriptionId: invoiceSubscription(o), customerId: idOf(o.customer), status: "active", renewsOn: invoicePeriodEnd(o) }
    case "invoice.overdue":
    case "invoice.payment_failed":
      return { siteId: invoiceSiteId(o), subscriptionId: invoiceSubscription(o), customerId: idOf(o.customer), status: "past_due", renewsOn: null }
    case "customer.subscription.created":
    case "customer.subscription.updated":
      return {
        siteId: str(obj(o.metadata).site_id),
        subscriptionId: idOf(o.id),
        customerId: idOf(o.customer),
        status: statusOfSubscription(str(o.status)),
        renewsOn: subscriptionPeriodEnd(o),
      }
    case "customer.subscription.deleted":
      return { siteId: str(obj(o.metadata).site_id), subscriptionId: idOf(o.id), customerId: idOf(o.customer), status: "lapsed", renewsOn: null }
    default:
      return null
  }
}

// A status may only move forward from what Stripe last said, except that a
// review waits for staff: payments cannot start before it is approved, and
// nothing from Stripe can turn a review into a listing.
//
// Stripe does not promise to deliver events in order, so a late "subscription
// updated" must not undo a cancellation that arrived first: only a payment or
// a new checkout brings a lapsed site back.
export function nextStatus(current: string, incoming: SiteStatus | null, eventType: string): SiteStatus | null {
  if (!incoming || current === "review" || incoming === current) return null
  if (current === "lapsed" && eventType !== "invoice.paid" && eventType !== "checkout.session.completed") return null
  // A subscription paid by invoice reads "active" in Stripe as soon as the
  // invoice is sent, before anything is paid. Only a payment makes a listing
  // paid: subscription events can hold a site back, never promote it.
  if (incoming === "active" && eventType.startsWith("customer.subscription.")) return null
  return incoming
}

// Stripe signs each delivery: the Stripe-Signature header carries a timestamp
// and an HMAC-SHA256 of "<timestamp>.<raw body>" under the endpoint's secret.
// Deliveries older than `toleranceSecs` are refused, so a captured one cannot
// be replayed later.
export function verifyStripeSignature(payload: string, header: string | null, secret: string, nowSecs: number, toleranceSecs = 300): boolean {
  if (!header || !secret) return false
  let t: number | null = null
  const sigs: string[] = []
  for (const part of header.split(",")) {
    const [k, v] = part.trim().split("=", 2)
    if (k === "t" && v && /^\d+$/.test(v)) t = Number(v)
    else if (k === "v1" && v) sigs.push(v)
  }
  if (t == null || !sigs.length || Math.abs(nowSecs - t) > toleranceSecs) return false
  const expected = Buffer.from(createHmac("sha256", secret).update(`${t}.${payload}`, "utf8").digest("hex"), "utf8")
  return sigs.some((s) => {
    const given = Buffer.from(s, "utf8")
    return given.length === expected.length && timingSafeEqual(given, expected)
  })
}
