import "server-only"
import { query } from "../db"
import { isOfficial, nextStatus, type SiteStatus, type SiteUpdate } from "./status"
import type { OrgRole } from "./org-roles"
import type { SiteKind } from "./claim"
import type { Currency, Interval, Tier } from "./plans"

// Reads and writes for hospital subscriptions. Callers check
// isDatabaseConfigured() first.

export interface Org {
  id: string
  name: string
  kind: SiteKind
  country: string
  stripeCustomerId: string | null
  billingEmail: string | null
  brandColor: string | null
  hasLogo: boolean
  createdAt: string
}

export interface OrgSite {
  id: string
  orgId: string
  venueId: string
  venueName: string
  tier: Tier
  interval: Interval
  currency: Currency
  billing: "invoice" | "online"
  status: SiteStatus
  renewsOn: string | null
  poNumber: string | null
  claimEmail: string
  termsVersion: string
  createdAt: string
}

export interface OrgMember {
  email: string
  role: OrgRole
  userId: string | null
  createdAt: string
}

const ORG_COLS = "id::text, name, kind, country, stripe_customer_id, billing_email, brand_color, logo_data is not null as has_logo, created_at::text"
const SITE_COLS =
  "id::text, org_id::text, venue_id, venue_name, tier, billing_interval, currency, billing, status, renews_on::text, po_number, claim_email, terms_version, created_at::text"

type OrgRow = { id: string; name: string; kind: SiteKind; country: string; stripe_customer_id: string | null; billing_email: string | null; brand_color: string | null; has_logo: boolean; created_at: string }
type SiteRow = {
  id: string; org_id: string; venue_id: string; venue_name: string; tier: Tier; billing_interval: Interval; currency: Currency; billing: "invoice" | "online"
  status: SiteStatus; renews_on: string | null; po_number: string | null; claim_email: string; terms_version: string; created_at: string
}

const orgOf = (r: OrgRow): Org => ({
  id: r.id, name: r.name, kind: r.kind, country: r.country, stripeCustomerId: r.stripe_customer_id, billingEmail: r.billing_email,
  brandColor: r.brand_color, hasLogo: r.has_logo, createdAt: r.created_at,
})
const siteOf = (r: SiteRow): OrgSite => ({
  id: r.id, orgId: r.org_id, venueId: r.venue_id, venueName: r.venue_name, tier: r.tier, interval: r.billing_interval, currency: r.currency, billing: r.billing,
  status: r.status, renewsOn: r.renews_on, poNumber: r.po_number, claimEmail: r.claim_email, termsVersion: r.terms_version, createdAt: r.created_at,
})

// ---- organisations and who belongs to them -------------------------------

// The organisations any of these (verified) addresses belong to, with the
// role each has there.
export async function orgsFor(emails: string[]): Promise<(Org & { role: OrgRole })[]> {
  if (!emails.length) return []
  const { rows } = await query<OrgRow & { role: OrgRole }>(
    `select o.id::text, o.name, o.kind, o.country, o.stripe_customer_id, o.billing_email, o.brand_color,
            o.logo_data is not null as has_logo, o.created_at::text, m.role
       from public.wf_org_members m join public.wf_orgs o on o.id = m.org_id
      where m.email = any($1::text[])
      order by o.name`,
    [emails.map((e) => e.toLowerCase())]
  )
  // Several addresses can reach the same organisation: the highest role wins.
  const byId = new Map<string, Org & { role: OrgRole }>()
  for (const r of rows) {
    const prev = byId.get(r.id)
    if (!prev || (prev.role === "viewer" && r.role === "manager")) byId.set(r.id, { ...orgOf(r), role: r.role })
  }
  return [...byId.values()]
}

export async function getOrg(id: string): Promise<Org | null> {
  const { rows } = await query<OrgRow>(`select ${ORG_COLS} from public.wf_orgs where id = $1`, [id])
  return rows[0] ? orgOf(rows[0]) : null
}

export async function createOrg(input: { name: string; kind: SiteKind; country: string; billingEmail: string; managerEmail: string; userId: string }): Promise<Org> {
  const { rows } = await query<OrgRow>(
    `insert into public.wf_orgs (name, kind, country, billing_email, created_by) values ($1, $2, $3, $4, $5) returning ${ORG_COLS}`,
    [input.name.slice(0, 160), input.kind, input.country, input.billingEmail, input.userId]
  )
  await query(
    `insert into public.wf_org_members (org_id, email, role, user_id, added_by) values ($1, $2, 'manager', $3, $3) on conflict do nothing`,
    [rows[0].id, input.managerEmail.toLowerCase(), input.userId]
  )
  return orgOf(rows[0])
}

export async function setStripeCustomer(orgId: string, customerId: string): Promise<void> {
  await query("update public.wf_orgs set stripe_customer_id = $2, updated_at = now() where id = $1", [orgId, customerId])
}

export async function updateOrg(orgId: string, patch: { name?: string; billingEmail?: string; brandColor?: string | null; logo?: { type: string; data: string } | null }): Promise<void> {
  const sets: string[] = []
  const vals: unknown[] = [orgId]
  const add = (col: string, v: unknown) => {
    vals.push(v)
    sets.push(`${col} = $${vals.length}`)
  }
  if (patch.name !== undefined) add("name", patch.name.slice(0, 160))
  if (patch.billingEmail !== undefined) add("billing_email", patch.billingEmail)
  if (patch.brandColor !== undefined) add("brand_color", patch.brandColor)
  if (patch.logo !== undefined) {
    add("logo_type", patch.logo?.type ?? null)
    add("logo_data", patch.logo?.data ?? null)
  }
  if (!sets.length) return
  await query(`update public.wf_orgs set ${sets.join(", ")}, updated_at = now() where id = $1`, vals)
}

export async function getLogo(orgId: string): Promise<{ type: string; data: Buffer } | null> {
  const { rows } = await query<{ logo_type: string | null; logo_data: string | null }>("select logo_type, logo_data from public.wf_orgs where id = $1", [orgId])
  const r = rows[0]
  return r?.logo_type && r.logo_data ? { type: r.logo_type, data: Buffer.from(r.logo_data, "base64") } : null
}

export async function listMembers(orgId: string): Promise<OrgMember[]> {
  const { rows } = await query<{ email: string; role: OrgRole; user_id: string | null; created_at: string }>(
    "select email, role, user_id, created_at::text from public.wf_org_members where org_id = $1 order by role, email",
    [orgId]
  )
  return rows.map((r) => ({ email: r.email, role: r.role, userId: r.user_id, createdAt: r.created_at }))
}

export async function setMember(orgId: string, email: string, role: OrgRole, addedBy: string): Promise<void> {
  await query(
    `insert into public.wf_org_members (org_id, email, role, added_by) values ($1, $2, $3, $4)
     on conflict (org_id, email) do update set role = excluded.role`,
    [orgId, email.toLowerCase(), role, addedBy]
  )
}

export async function removeMember(orgId: string, email: string): Promise<void> {
  await query("delete from public.wf_org_members where org_id = $1 and email = $2", [orgId, email.toLowerCase()])
}

// Records the account an invited address signed in with, for the record.
export async function linkMember(emails: string[], userId: string): Promise<void> {
  if (!emails.length) return
  await query("update public.wf_org_members set user_id = $2 where email = any($1::text[]) and user_id is null", [emails.map((e) => e.toLowerCase()), userId])
}

// ---- sites ---------------------------------------------------------------

export async function sitesOf(orgId: string): Promise<OrgSite[]> {
  const { rows } = await query<SiteRow>(`select ${SITE_COLS} from public.wf_org_sites where org_id = $1 order by venue_name, created_at desc`, [orgId])
  return rows.map(siteOf)
}

export async function getSite(id: string): Promise<OrgSite | null> {
  const { rows } = await query<SiteRow>(`select ${SITE_COLS} from public.wf_org_sites where id = $1`, [id])
  return rows[0] ? siteOf(rows[0]) : null
}

// The listing a venue has now, by anyone: lapsed listings do not count.
export async function liveSiteFor(venueId: string): Promise<OrgSite | null> {
  const { rows } = await query<SiteRow>(`select ${SITE_COLS} from public.wf_org_sites where venue_id = $1 and status <> 'lapsed'`, [venueId])
  return rows[0] ? siteOf(rows[0]) : null
}

export async function createSite(input: {
  orgId: string
  venueId: string
  venueName: string
  tier: Tier
  interval: Interval
  currency: Currency
  billing: "invoice" | "online"
  status: SiteStatus
  poNumber: string | null
  claimEmail: string
  termsVersion: string
  userId: string
}): Promise<OrgSite | null> {
  const { rows } = await query<SiteRow>(
    `insert into public.wf_org_sites
       (org_id, venue_id, venue_name, tier, billing_interval, currency, billing, status, po_number, claim_email, terms_version, terms_accepted_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     on conflict do nothing
     returning ${SITE_COLS}`,
    [input.orgId, input.venueId, input.venueName, input.tier, input.interval, input.currency, input.billing, input.status, input.poNumber, input.claimEmail, input.termsVersion, input.userId]
  )
  return rows[0] ? siteOf(rows[0]) : null
}

// A sign-up left unpaid (the checkout closed) can be started again, by the
// same organisation, with other choices.
export async function restartSite(id: string, patch: { interval: Interval; billing: "invoice" | "online"; status: SiteStatus; poNumber: string | null; termsVersion: string; userId: string }): Promise<void> {
  await query(
    `update public.wf_org_sites set billing_interval = $2, billing = $3, status = $4, po_number = $5, terms_version = $6,
            terms_accepted_by = $7, terms_accepted_at = now(), updated_at = now()
      where id = $1 and status = 'pending'`,
    [id, patch.interval, patch.billing, patch.status, patch.poNumber, patch.termsVersion, patch.userId]
  )
}

export async function setSiteSubscription(id: string, subscriptionId: string, renewsOn: string | null): Promise<void> {
  await query("update public.wf_org_sites set stripe_subscription_id = $2, renews_on = coalesce($3::date, renews_on), updated_at = now() where id = $1", [id, subscriptionId, renewsOn])
}

export async function setSiteStatus(id: string, status: SiteStatus): Promise<void> {
  await query("update public.wf_org_sites set status = $2, updated_at = now() where id = $1", [id, status])
}

export async function deleteSite(id: string): Promise<void> {
  await query("delete from public.wf_org_sites where id = $1", [id])
}

// Applies what a Stripe event says to the site it is about. Returns the
// site's status before and after, or null when the event is not about a
// site of ours or changes nothing.
export async function applyUpdate(update: SiteUpdate, eventType: string): Promise<{ siteId: string; from: SiteStatus; to: SiteStatus } | null> {
  const { rows } = await query<{ id: string; status: SiteStatus; stripe_subscription_id: string | null }>(
    `select id::text, status, stripe_subscription_id from public.wf_org_sites
      where ($1::text is not null and stripe_subscription_id = $1)
         or ($2::text is not null and $2 ~ '^[0-9a-f-]{36}$' and id = $2::uuid)
      order by (stripe_subscription_id = $1) desc nulls last
      limit 1`,
    [update.subscriptionId, update.siteId]
  )
  const site = rows[0]
  if (!site) return null
  // An event about an older subscription of a site that has since signed up
  // again belongs to neither.
  if (site.stripe_subscription_id && update.subscriptionId && site.stripe_subscription_id !== update.subscriptionId) return null
  const status = nextStatus(site.status, update.status, eventType)
  await query(
    `update public.wf_org_sites
        set stripe_subscription_id = coalesce(stripe_subscription_id, $2),
            renews_on = coalesce($3::date, renews_on),
            status = coalesce($4, status),
            updated_at = now()
      where id = $1`,
    [site.id, update.subscriptionId, update.renewsOn, status]
  )
  return status ? { siteId: site.id, from: site.status, to: status } : null
}

// A Stripe event already applied? Records it if not.
export async function firstDelivery(eventId: string, type: string): Promise<boolean> {
  const { rowCount } = await query("insert into public.wf_billing_events (id, type) values ($1, $2) on conflict do nothing", [eventId, type])
  return (rowCount ?? 0) > 0
}

export async function forgetDelivery(eventId: string): Promise<void> {
  await query("delete from public.wf_billing_events where id = $1", [eventId])
}

// ---- what the app shows --------------------------------------------------

export interface OfficialListing {
  org: string
  orgId: string
  brandColor: string | null
  logo: boolean
}

export async function officialListings(): Promise<Record<string, OfficialListing>> {
  const { rows } = await query<{ venue_id: string; status: string; org_id: string; name: string; brand_color: string | null; has_logo: boolean }>(
    `select s.venue_id, s.status, o.id::text as org_id, o.name, o.brand_color, o.logo_data is not null as has_logo
       from public.wf_org_sites s join public.wf_orgs o on o.id = s.org_id
      where s.status in ('trial','active','past_due')`
  )
  const out: Record<string, OfficialListing> = {}
  for (const r of rows) if (isOfficial(r.status)) out[r.venue_id] = { org: r.name, orgId: r.org_id, brandColor: r.brand_color, logo: r.has_logo }
  return out
}

// ---- what the organisation sees about its sites ---------------------------

export async function insightsFor(venueIds: string[], days: number): Promise<{
  routes: { venueId: string; count: number }[]
  misses: { venueId: string; query: string; count: number }[]
}> {
  if (!venueIds.length) return { routes: [], misses: [] }
  const [routes, misses] = await Promise.all([
    query<{ venue_key: string; count: number }>(
      `select venue_key, count(*)::int as count from public.nav_signals
        where venue_key = any($1::text[]) and kind = 'arrival' and created_at > now() - make_interval(days => $2)
        group by venue_key`,
      [venueIds, days]
    ),
    query<{ venue_key: string; query: string; count: number }>(
      `select venue_key, min(query) as query, count(*)::int as count from public.search_misses
        where venue_key = any($1::text[]) and created_at > now() - make_interval(days => $2)
        group by venue_key, lower(query)
        order by count desc limit 50`,
      [venueIds, days]
    ),
  ])
  return {
    routes: routes.rows.map((r) => ({ venueId: r.venue_key, count: r.count })),
    misses: misses.rows.map((r) => ({ venueId: r.venue_key, query: r.query, count: r.count })),
  }
}

// ---- for Findway's own staff (/admin/customers) ----------------------------

export interface CustomerRow extends OrgSite {
  orgName: string
  orgKind: SiteKind
  stripeCustomerId: string | null
}

export async function listCustomers(opts: { status?: SiteStatus; q?: string }): Promise<CustomerRow[]> {
  const { rows } = await query<SiteRow & { org_name: string; org_kind: SiteKind; stripe_customer_id: string | null }>(
    `select ${SITE_COLS.split(", ").map((c) => `s.${c}`).join(", ")}, o.name as org_name, o.kind as org_kind, o.stripe_customer_id
       from public.wf_org_sites s join public.wf_orgs o on o.id = s.org_id
      where ($1::text is null or s.status = $1)
        and ($2::text is null or s.venue_name ilike $2 or o.name ilike $2 or s.claim_email ilike $2)
      order by case s.status when 'review' then 0 when 'past_due' then 1 else 2 end, s.renews_on nulls last, s.created_at desc
      limit 500`,
    [opts.status ?? null, opts.q ? `%${opts.q.replace(/[%_\\]/g, "\\$&")}%` : null]
  )
  return rows.map((r) => ({ ...siteOf(r), orgName: r.org_name, orgKind: r.org_kind, stripeCustomerId: r.stripe_customer_id }))
}
