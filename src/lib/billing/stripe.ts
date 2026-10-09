import "server-only"
import { lookupKey, unitAmount, TIER_LABELS, type Currency, type Interval, type Tier } from "./plans"
import { formEncode, type Params } from "./form-encode"

// The few calls Findway makes to Stripe, over its REST API with fetch: no SDK
// to keep up to date for six endpoints. Optional like every integration here:
// without STRIPE_SECRET_KEY the sign-up page says billing is not set up, and
// nothing else changes.

export function stripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_WEBHOOK_SECRET
}

export class StripeError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message)
  }
}

async function stripe<T>(method: "GET" | "POST", path: string, params: Params = {}, idempotencyKey?: string): Promise<T> {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new StripeError("Stripe is not configured", 503)
  const body = formEncode(params)
  const url = `https://api.stripe.com/v1/${path}${method === "GET" && [...body].length ? `?${body}` : ""}`
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: method === "POST" ? body : undefined,
    cache: "no-store",
  })
  const data = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: string } }
  if (!res.ok) throw new StripeError(data.error?.message ?? `Stripe answered ${res.status}`, res.status, data.error?.code)
  return data as T
}

// The Stripe price for a tier, interval and currency, made the first time it
// is asked for. Prices are found again by lookup key, so the amounts live in
// src/lib/billing/plans.ts and nobody has to copy price ids into settings.
const priceIds = new Map<string, string>()

export async function ensurePrice(tier: Tier, interval: Interval, currency: Currency): Promise<string> {
  const lk = lookupKey(tier, interval, currency)
  const known = priceIds.get(lk)
  if (known) return known
  const found = await stripe<{ data: { id: string }[] }>("GET", "prices", { "lookup_keys[]": lk, active: "true", limit: 1 })
  let id = found.data[0]?.id
  if (!id) {
    const made = await stripe<{ id: string }>(
      "POST",
      "prices",
      {
        lookup_key: lk,
        currency,
        unit_amount: unitAmount(tier, interval, currency),
        recurring: { interval },
        tax_behavior: "exclusive",
        product_data: { name: `Findway Official listing · ${TIER_LABELS[tier]}`, metadata: { tier } },
      },
      `price-${lk}`
    )
    id = made.id
  }
  priceIds.set(lk, id)
  return id
}

export async function createCustomer(input: { name: string; email: string; country: string; orgId: string }): Promise<string> {
  const c = await stripe<{ id: string }>(
    "POST",
    "customers",
    { name: input.name, email: input.email, address: { country: input.country }, metadata: { org_id: input.orgId } },
    `customer-${input.orgId}`
  )
  return c.id
}

export async function updateCustomer(customerId: string, patch: { email?: string; poNumber?: string | null }): Promise<void> {
  await stripe("POST", `customers/${customerId}`, {
    ...(patch.email ? { email: patch.email } : {}),
    // Shown on every invoice: what a purchase order number is for.
    ...(patch.poNumber ? { invoice_settings: { custom_fields: [{ name: "PO number", value: patch.poNumber.slice(0, 30) }] } } : {}),
  })
}

// Paying online: card, or a direct debit, or whatever the Stripe account has
// turned on for the customer's country. Stripe chooses, so payment methods
// are switched on in the Stripe dashboard, not here.
export async function createCheckout(input: {
  customerId: string
  priceId: string
  siteId: string
  venueName: string
  successUrl: string
  cancelUrl: string
}): Promise<string> {
  const s = await stripe<{ url: string }>(
    "POST",
    "checkout/sessions",
    {
      mode: "subscription",
      customer: input.customerId,
      line_items: [{ price: input.priceId, quantity: 1 }],
      metadata: { site_id: input.siteId },
      subscription_data: { metadata: { site_id: input.siteId }, description: `Findway Official listing · ${input.venueName}` },
      customer_update: { address: "auto", name: "auto" },
      billing_address_collection: "required",
      tax_id_collection: { enabled: true },
      allow_promotion_codes: true,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
    }
  )
  return s.url
}

const BANK_TRANSFER: Record<Currency, Params> = {
  gbp: { type: "gb_bank_transfer" },
  eur: { type: "eu_bank_transfer", eu_bank_transfer: { country: "NL" } },
  usd: { type: "us_bank_transfer" },
}

// Paying by invoice: Stripe emails an invoice due in 30 days, every month or
// year, with the purchase order number on it. The customer pays by bank
// transfer into account details Stripe gives them alone, so the payment is
// matched to the invoice without anyone reconciling it; card stays open on
// the invoice page too.
export async function createInvoiceSubscription(input: { customerId: string; priceId: string; siteId: string; venueName: string; poNumber: string | null; currency: Currency }): Promise<{ id: string; currentPeriodEnd: string | null }> {
  const sub = await stripe<{ id: string; current_period_end?: number; items?: { data?: { current_period_end?: number }[] } }>(
    "POST",
    "subscriptions",
    {
      customer: input.customerId,
      items: [{ price: input.priceId }],
      collection_method: "send_invoice",
      days_until_due: 30,
      metadata: { site_id: input.siteId, ...(input.poNumber ? { po_number: input.poNumber } : {}) },
      description: `Findway Official listing · ${input.venueName}${input.poNumber ? ` · PO ${input.poNumber}` : ""}`,
      payment_settings: {
        payment_method_types: ["customer_balance", "card"],
        payment_method_options: { customer_balance: { funding_type: "bank_transfer", bank_transfer: BANK_TRANSFER[input.currency] } },
      },
    },
    `subscription-${input.siteId}`
  )
  const end = sub.items?.data?.[0]?.current_period_end ?? sub.current_period_end
  return { id: sub.id, currentPeriodEnd: end ? new Date(end * 1000).toISOString().slice(0, 10) : null }
}

// Stripe's own page for a customer's invoices, payment method, monthly or
// yearly switch and cancelling. What it offers is set in the Stripe dashboard
// (Settings → Billing → Customer portal).
export async function createPortal(customerId: string, returnUrl: string): Promise<string> {
  const s = await stripe<{ url: string }>("POST", "billing_portal/sessions", { customer: customerId, return_url: returnUrl })
  return s.url
}
