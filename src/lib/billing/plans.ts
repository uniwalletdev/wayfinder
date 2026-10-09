// What an "Official" listing costs, and how a hospital site is placed on a
// tier. Pure: no I/O, so the prices the sign-up page shows are the prices
// Stripe is asked to charge, and both are unit-tested
// (scripts/lib-test/billing.test.mjs).
//
// One subscription per hospital site, monthly or yearly. Yearly is ten months'
// price: two months free for paying up front, which is how most hospitals
// prefer to buy (one purchase order a year).

export const TIERS = ["small", "medium", "large"] as const
export type Tier = (typeof TIERS)[number]

export const INTERVALS = ["month", "year"] as const
export type Interval = (typeof INTERVALS)[number]

export const CURRENCIES = ["gbp", "eur", "usd"] as const
export type Currency = (typeof CURRENCIES)[number]

export const TIER_LABELS: Record<Tier, string> = { small: "Small site", medium: "Medium site", large: "Large site" }

export const TIER_SUMMARIES: Record<Tier, string> = {
  small: "A community hospital or a single building",
  medium: "A district general hospital",
  large: "A major acute or teaching hospital",
}

// Monthly list price per site, in whole units of the currency. Edit here to
// change prices: Stripe prices are created from these on first use, keyed by
// lookup key, so a change here makes new prices (existing subscribers keep
// theirs until they are moved in Stripe).
const MONTHLY: Record<Currency, Record<Tier, number>> = {
  gbp: { small: 290, medium: 590, large: 1190 },
  eur: { small: 340, medium: 690, large: 1390 },
  usd: { small: 370, medium: 750, large: 1490 },
}

export const YEARLY_MONTHS = 10

export function priceFor(tier: Tier, interval: Interval, currency: Currency): number {
  const monthly = MONTHLY[currency][tier]
  return interval === "year" ? monthly * YEARLY_MONTHS : monthly
}

// Smallest currency unit, as Stripe wants it.
export function unitAmount(tier: Tier, interval: Interval, currency: Currency): number {
  return priceFor(tier, interval, currency) * 100
}

// Bumped whenever the amounts above change, so Stripe is asked for a new price
// rather than reusing one with the old amount.
export const PRICE_VERSION = 1

export function lookupKey(tier: Tier, interval: Interval, currency: Currency): string {
  return `findway_official_v${PRICE_VERSION}_${tier}_${interval}_${currency}`
}

// Euro area and the rest of the EEA that uses the euro; the UK in pounds;
// everyone else in dollars.
const EURO = new Set(["AT", "BE", "HR", "CY", "EE", "FI", "FR", "DE", "GR", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PT", "SK", "SI", "ES", "AD", "MC", "SM", "VA", "ME", "XK"])

export function currencyFor(country: string | null | undefined): Currency {
  const c = (country ?? "").toUpperCase()
  if (c === "GB" || c === "GG" || c === "JE" || c === "IM") return "gbp"
  if (EURO.has(c)) return "eur"
  return "usd"
}

const SYMBOL: Record<Currency, string> = { gbp: "£", eur: "€", usd: "$" }

export function formatPrice(amount: number, currency: Currency): string {
  return `${SYMBOL[currency]}${amount.toLocaleString("en-GB")}`
}

// The size of a site, from what the map knows about it: how many floors are
// drawn and how many places are on them. A hospital with no indoor map yet is
// priced as small; nobody is charged for a map that is not there.
export interface SiteSize {
  floors: number
  places: number
}

export function tierFor(size: SiteSize): Tier {
  if (size.floors >= 6 || size.places >= 150) return "large"
  if (size.floors >= 3 || size.places >= 50) return "medium"
  return "small"
}

export function isTier(v: unknown): v is Tier {
  return typeof v === "string" && (TIERS as readonly string[]).includes(v)
}

export function isInterval(v: unknown): v is Interval {
  return typeof v === "string" && (INTERVALS as readonly string[]).includes(v)
}

// The version of the terms a hospital accepts at sign-up. Bump it when
// /for-hospitals/terms changes; each site records the version it accepted.
export const TERMS_VERSION = "2026-10"
