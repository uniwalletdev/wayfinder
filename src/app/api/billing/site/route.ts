// One hospital site as the sign-up page needs it: its tier and prices, whether
// it is listed already, and whether the signed-in person's email proves they
// work there (so it goes live at once) or a person will check first.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { findSite } from "@/lib/billing/sites"
import { allowedDomains, provingEmail } from "@/lib/billing/claim"
import { currencyFor, priceFor } from "@/lib/billing/plans"
import { currentHospitalUser, myOrgs } from "@/lib/billing/account"
import { liveSiteFor } from "@/lib/billing/store"
import { isDatabaseConfigured } from "@/lib/db"
import { rateLimit, LIMITS } from "@/lib/rate-limit"

export async function GET(request: Request) {
  const limited = rateLimit(request, "billingSearch", LIMITS.billingSearch.limit, LIMITS.billingSearch.windowMs)
  if (limited) return limited
  const venueId = (new URL(request.url).searchParams.get("venueId") ?? "").trim().slice(0, 80)
  const site = venueId ? await findSite(venueId) : null
  if (!site) return Response.json({ error: "not_found" }, { status: 404 })
  const currency = currencyFor(site.country)
  const user = await currentHospitalUser().catch(() => null)
  const live = isDatabaseConfigured() ? await liveSiteFor(site.venueId).catch(() => null) : null
  const orgs = user && isDatabaseConfigured() ? await myOrgs(user).catch(() => []) : []
  const domains = allowedDomains(site)
  return Response.json(
    {
      site: { venueId: site.venueId, name: site.name, subtitle: site.subtitle, country: site.country, kind: site.kind, mapped: site.mapped, tier: site.tier },
      currency,
      prices: { month: priceFor(site.tier, "month", currency), year: priceFor(site.tier, "year", currency) },
      // Which email domains are accepted at once, so the page can say so.
      domains,
      listed: live ? { mine: orgs.some((o) => o.id === live.orgId), status: live.status } : null,
      signedIn: !!user,
      proven: user ? !!provingEmail(user.emails, domains) : false,
      orgs: orgs.filter((o) => o.role === "manager").map((o) => ({ id: o.id, name: o.name })),
    },
    { headers: { "Cache-Control": "no-store" } }
  )
}
