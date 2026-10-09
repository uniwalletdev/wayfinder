"use client"
import { useState } from "react"
import { ExternalLink, Check, X } from "lucide-react"
import { useAdmin, adminSend, useDebounced, PageHeader, Table, Td, Badge, Button, Select, SearchBox, Loading, ErrorState, Empty, Notice, Stat, fmtDate, fmtAgo, errorText, downloadCsv } from "../ui"
import { useStaff } from "../AdminShell"
import { toast } from "@/components/Toast"
import { formatPrice, priceFor, TIER_LABELS, type Currency, type Interval, type Tier } from "@/lib/billing/plans"

interface Customer {
  id: string
  orgId: string
  orgName: string
  orgKind: "nhs" | "public" | "private" | "other"
  stripeCustomerId: string | null
  venueId: string
  venueName: string
  tier: Tier
  interval: Interval
  currency: Currency
  billing: "invoice" | "online"
  status: "pending" | "review" | "trial" | "active" | "past_due" | "lapsed"
  renewsOn: string | null
  poNumber: string | null
  claimEmail: string
  createdAt: string
}

const STATUS: Record<Customer["status"], { label: string; tone: "neutral" | "primary" | "green" | "teal" | "amber" | "red" }> = {
  review: { label: "Needs review", tone: "amber" },
  pending: { label: "Not paid yet", tone: "neutral" },
  trial: { label: "Live · invoice open", tone: "teal" },
  active: { label: "Paid", tone: "green" },
  past_due: { label: "Payment late", tone: "red" },
  lapsed: { label: "Lapsed", tone: "neutral" },
}

const KIND: Record<Customer["orgKind"], string> = { nhs: "NHS", public: "Public", private: "Private", other: "Hospital" }

const daysUntil = (iso: string | null) => (iso ? Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000) : null)

export default function CustomersView() {
  const staff = useStaff()
  const canEdit = staff.can("customers.edit")
  const [q, setQ] = useState("")
  const [status, setStatus] = useState("")
  const query = useDebounced(q)
  const params = new URLSearchParams()
  if (query) params.set("q", query)
  if (status) params.set("status", status)
  const { data, error, loading, reload } = useAdmin<{ sites: Customer[]; stripe: boolean; live: boolean }>(`/api/admin/customers?${params}`)
  const [busy, setBusy] = useState<string | null>(null)

  const review = async (c: Customer, action: "approve" | "reject") => {
    setBusy(c.id)
    try {
      await adminSend("PATCH", `/api/admin/customers/${c.id}`, { action })
      toast.success(action === "approve" ? `${c.venueName} approved: they can pay now` : `Sign-up for ${c.venueName} turned down`)
      reload()
    } catch (err) {
      toast.error("Could not change the sign-up", errorText(err))
    } finally {
      setBusy(null)
    }
  }

  const sites = data?.sites ?? []
  const listed = sites.filter((s) => s.status === "trial" || s.status === "active" || s.status === "past_due")
  // What listed sites bring in a year, by currency.
  const yearly = new Map<Currency, number>()
  for (const s of listed) yearly.set(s.currency, (yearly.get(s.currency) ?? 0) + (s.interval === "year" ? priceFor(s.tier, "year", s.currency) : priceFor(s.tier, "month", s.currency) * 12))
  const renewing = listed.filter((s) => {
    const d = daysUntil(s.renewsOn)
    return d != null && d >= 0 && d <= 90
  })
  const stripeBase = data?.live ? "https://dashboard.stripe.com" : "https://dashboard.stripe.com/test"

  return (
    <>
      <PageHeader
        title="Customers"
        description="Hospitals that pay for an Official listing. They sign up, pay and renew on their own through Stripe; the only thing here that needs a person is a sign-up whose email did not prove the person works at that hospital."
        actions={
          sites.length > 0 && (
            <Button
              size="sm"
              onClick={() =>
                downloadCsv("findway-customers.csv", [
                  ["Organisation", "Kind", "Site", "Status", "Tier", "Billing", "Interval", "Renews", "PO number", "Signed up by", "Signed up"],
                  ...sites.map((s) => [s.orgName, KIND[s.orgKind], s.venueName, STATUS[s.status].label, TIER_LABELS[s.tier], s.billing, s.interval, s.renewsOn, s.poNumber, s.claimEmail, s.createdAt]),
                ])
              }
            >
              Export CSV
            </Button>
          )
        }
      />
      {data && !data.stripe && (
        <div className="mb-4">
          <Notice tone="warning" title="Stripe is not set up">
            Hospitals cannot sign up until STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET are set in the deployment. See docs/subscriptions.md.
          </Notice>
        </div>
      )}
      {data && (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Listed sites" value={listed.length} />
          <Stat label="A year, listed sites" value={[...yearly].map(([c, n]) => formatPrice(n, c)).join(" + ") || "—"} />
          <Stat label="Renewing in 90 days" value={renewing.length} />
          <Stat label="Needs review" value={sites.filter((s) => s.status === "review").length} tone={sites.some((s) => s.status === "review") ? "attention" : "default"} />
        </div>
      )}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchBox value={q} onChange={setQ} placeholder="Search hospitals, organisations, emails" />
        <Select
          label="Status"
          value={status}
          onChange={setStatus}
          options={[{ value: "", label: "Any status" }, ...(Object.keys(STATUS) as Customer["status"][]).map((k) => ({ value: k, label: STATUS[k].label }))]}
        />
      </div>
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !data ? (
        <Loading />
      ) : (
        <Table
          head={["Site", "Organisation", "Status", "Plan", "Renews", "Signed up by", ""]}
          empty={sites.length === 0 ? <Empty title={q || status ? "No sign-ups match" : "No hospitals have signed up yet"}>They sign up at /for-hospitals.</Empty> : null}
        >
          {sites.map((c) => {
            const d = daysUntil(c.renewsOn)
            return (
              <tr key={c.id} className={busy === c.id || loading ? "opacity-60" : ""}>
                <Td>
                  <p className="font-semibold text-wf-ink">{c.venueName}</p>
                  <p className="text-[12.5px] text-wf-muted">{fmtAgo(c.createdAt)}</p>
                </Td>
                <Td>
                  <p className="text-wf-ink">{c.orgName}</p>
                  <p className="text-[12.5px] text-wf-muted">{KIND[c.orgKind]}</p>
                </Td>
                <Td>
                  <Badge tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Badge>
                </Td>
                <Td className="whitespace-nowrap">
                  <p className="text-wf-ink">
                    {TIER_LABELS[c.tier]} · {formatPrice(priceFor(c.tier, c.interval, c.currency), c.currency)}/{c.interval === "year" ? "yr" : "mo"}
                  </p>
                  <p className="text-[12.5px] text-wf-muted">
                    {c.billing === "invoice" ? "Invoice" : "Online"}
                    {c.poNumber ? ` · PO ${c.poNumber}` : ""}
                  </p>
                </Td>
                <Td className="whitespace-nowrap">
                  {c.renewsOn ? (
                    <span className={d != null && d <= 30 && d >= 0 ? "font-semibold text-amber-800" : "text-wf-body"}>{fmtDate(c.renewsOn, false)}</span>
                  ) : (
                    <span className="text-wf-faint">—</span>
                  )}
                </Td>
                <Td className="max-w-[220px]">
                  <span className="block truncate text-[13px] text-wf-body">{c.claimEmail}</span>
                </Td>
                <Td>
                  <div className="flex justify-end gap-1">
                    {c.status === "review" && canEdit && (
                      <>
                        <Button size="sm" tone="primary" disabled={busy === c.id} onClick={() => review(c, "approve")} title="They work there: let them pay">
                          <Check size={14} aria-hidden="true" /> Approve
                        </Button>
                        <Button size="sm" tone="ghost" disabled={busy === c.id} onClick={() => review(c, "reject")} title="Turn it down: the hospital is free for someone else">
                          <X size={14} aria-hidden="true" /> Turn down
                        </Button>
                      </>
                    )}
                    {c.stripeCustomerId && (
                      <a href={`${stripeBase}/customers/${c.stripeCustomerId}`} target="_blank" rel="noreferrer" className="rounded-lg p-1.5 text-wf-muted hover:bg-wf-surface hover:text-wf-primary" aria-label={`${c.orgName} in Stripe`} title="Open in Stripe">
                        <ExternalLink size={15} />
                      </a>
                    )}
                  </div>
                </Td>
              </tr>
            )
          })}
        </Table>
      )}
    </>
  )
}
