// Stripe tells Findway what happened to a hospital's payments: a checkout
// completed, an invoice paid or overdue, a subscription changed or ended.
// Each event moves the site's status (src/lib/billing/status.ts), which is
// what makes it Official in the app or not. Signed with STRIPE_WEBHOOK_SECRET;
// anything unsigned, stale or tampered with is refused.
//
// In the Stripe dashboard (Developers → Webhooks) point an endpoint at
// <site>/api/stripe/webhook with these events: checkout.session.completed,
// invoice.paid, invoice.overdue, invoice.payment_failed,
// customer.subscription.created, customer.subscription.updated,
// customer.subscription.deleted.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { isDatabaseConfigured, query } from "@/lib/db"
import { updateFromEvent, verifyStripeSignature } from "@/lib/billing/status"
import { applyUpdate, firstDelivery, forgetDelivery } from "@/lib/billing/store"
import { BODY_LIMITS } from "@/lib/rate-limit"

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret || !isDatabaseConfigured()) return new Response("Billing is not configured", { status: 503 })
  // The signature covers the exact bytes Stripe sent, so read them as text
  // before anything parses them.
  const payload = await request.text()
  if (payload.length > BODY_LIMITS.stripeWebhook) return new Response("Too large", { status: 413 })
  if (!verifyStripeSignature(payload, request.headers.get("stripe-signature"), secret, Math.floor(Date.now() / 1000))) {
    return new Response("Bad signature", { status: 400 })
  }
  let event: { id?: unknown; type?: unknown; data?: unknown }
  try {
    event = JSON.parse(payload)
  } catch {
    return new Response("Bad JSON", { status: 400 })
  }
  const id = typeof event.id === "string" ? event.id : null
  const type = typeof event.type === "string" ? event.type : ""
  const update = updateFromEvent(event)
  // Not about a site: acknowledged, so Stripe does not retry it.
  if (!id || !update) return Response.json({ received: true })
  try {
    if (!(await firstDelivery(id, type))) return Response.json({ received: true, duplicate: true })
    const changed = await applyUpdate(update, type)
    if (changed) {
      await query(
        "insert into public.backoffice_audit (actor_id, actor_email, action, target, detail) values ('stripe', null, 'billing.status', $1, $2)",
        [changed.siteId, JSON.stringify({ event: type, from: changed.from, to: changed.to })]
      )
    }
    return Response.json({ received: true })
  } catch (err) {
    // Stripe retries a failed delivery for days: let it, and let the retry
    // be applied rather than skipped as a duplicate.
    console.warn("Could not apply a Stripe event:", err instanceof Error ? err.message : err)
    await forgetDelivery(id).catch(() => {})
    return new Response("Failed", { status: 500 })
  }
}
