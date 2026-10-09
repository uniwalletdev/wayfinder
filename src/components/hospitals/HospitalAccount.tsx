"use client"
// A hospital's own account: its listed sites and their status, billing
// (Stripe's portal), branding, colleagues, and what visitors searched for.

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { SignInButton } from "@clerk/nextjs"
import { BadgeCheck, CreditCard, Loader2, Plus, Trash2, Upload, MapPinned } from "lucide-react"
import { formatPrice, priceFor, TIER_LABELS, type Currency, type Interval, type Tier } from "@/lib/billing/plans"
import { ORG_ROLE_LABELS, LOGO_MAX_BYTES, type OrgRole } from "@/lib/billing/org-roles"

interface Site {
  id: string
  venueId: string
  venueName: string
  tier: Tier
  interval: Interval
  currency: Currency
  billing: "invoice" | "online"
  status: "pending" | "review" | "trial" | "active" | "past_due" | "lapsed"
  renewsOn: string | null
  poNumber: string | null
}

interface Org {
  id: string
  name: string
  role: OrgRole
  billingEmail: string | null
  brandColor: string | null
  hasLogo: boolean
  stripeCustomerId: string | null
  sites: Site[]
  members: { email: string; role: OrgRole; userId: string | null }[]
}

const STATUS: Record<Site["status"], { label: string; tone: string; detail: string }> = {
  active: { label: "Official", tone: "bg-wf-green-tint text-wf-green-text", detail: "Paid and showing as Official." },
  trial: { label: "Official · invoice open", tone: "bg-wf-teal-tint text-wf-teal-text", detail: "Live while your invoice is paid." },
  past_due: { label: "Payment late", tone: "bg-red-50 text-red-700", detail: "Still Official while Stripe retries. Update payment in Billing." },
  pending: { label: "Not paid yet", tone: "bg-wf-surface text-wf-body", detail: "Choose how to pay to go live." },
  review: { label: "Being checked", tone: "bg-amber-50 text-amber-800", detail: "Findway is confirming you work here. Nothing is charged until then." },
  lapsed: { label: "Ended", tone: "bg-wf-surface text-wf-muted", detail: "No longer Official. The map stays for patients." },
}

const clerkEnabled = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
const input = "rounded-xl border border-wf-border bg-white px-3 py-2 text-[14.5px] text-wf-ink outline-none focus:border-wf-primary"

async function send(method: string, path: string, body: unknown): Promise<{ ok: boolean; error?: string; url?: string }> {
  const res = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  const d = await res.json().catch(() => ({}))
  return res.ok ? { ok: true, ...d } : { ok: false, error: d.error ?? "failed" }
}

function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-wf-border bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-wf-border-faint px-5 py-3.5">
        <h2 className="font-display text-[17px] font-semibold text-wf-ink">{title}</h2>
        {action}
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  )
}

function Insights({ org }: { org: Org }) {
  const [data, setData] = useState<{ routes: { venueId: string; count: number }[]; misses: { venueId: string; query: string; count: number }[] } | null>(null)
  useEffect(() => {
    fetch(`/api/billing/insights?${new URLSearchParams({ orgId: org.id, days: "30" })}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => {})
  }, [org.id])
  const name = (id: string) => org.sites.find((s) => s.venueId === id)?.venueName ?? id
  if (!data) return <p className="text-[14px] text-wf-muted">Loading…</p>
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div>
        <p className="text-[13px] font-semibold text-wf-muted">People guided to their destination</p>
        {data.routes.length ? (
          <ul className="mt-2 space-y-1 text-[14.5px]">
            {data.routes.map((r) => (
              <li key={r.venueId} className="flex justify-between gap-3">
                <span className="truncate text-wf-body">{name(r.venueId)}</span>
                <span className="font-semibold text-wf-ink">{r.count.toLocaleString("en-GB")}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[14px] text-wf-faint">None recorded yet.</p>
        )}
      </div>
      <div>
        <p className="text-[13px] font-semibold text-wf-muted">Searched for and not found</p>
        {data.misses.length ? (
          <ul className="mt-2 space-y-1 text-[14.5px]">
            {data.misses.slice(0, 12).map((m) => (
              <li key={`${m.venueId}-${m.query}`} className="flex justify-between gap-3">
                <span className="truncate text-wf-body">
                  “{m.query}” <span className="text-wf-faint">· {name(m.venueId)}</span>
                </span>
                <span className="font-semibold text-wf-ink">{m.count}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[14px] text-wf-faint">Nothing missed. Visitors found what they looked for.</p>
        )}
        <p className="mt-2 text-[12.5px] text-wf-faint">Anonymous counts for the last 30 days. Add what’s missing from the map editor.</p>
      </div>
    </div>
  )
}

function Branding({ org, onSaved }: { org: Org; onSaved: () => void }) {
  const [color, setColor] = useState(org.brandColor ?? "#0a5dc2")
  // Bumped on each upload, so the new logo is fetched rather than the cached one.
  const [logoVersion, setLogoVersion] = useState(0)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const save = async (patch: Record<string, unknown>, done: string) => {
    setBusy(true)
    const r = await send("PATCH", "/api/billing/org", { orgId: org.id, ...patch })
    setBusy(false)
    setMsg(r.ok ? done : r.error === "bad_logo" ? `A PNG, JPEG or WebP up to ${LOGO_MAX_BYTES / 1024} KB, please.` : "Could not save that.")
    if (r.ok) onSaved()
  }
  const upload = (file: File) => {
    if (file.size > LOGO_MAX_BYTES) {
      setMsg(`The logo must be ${LOGO_MAX_BYTES / 1024} KB or smaller.`)
      return
    }
    const reader = new FileReader()
    reader.onload = () => save({ logo: reader.result }, "Logo saved.").then(() => setLogoVersion((v) => v + 1))
    reader.readAsDataURL(file)
  }
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-wf-border bg-wf-surface">
        {org.hasLogo ? (
          // eslint-disable-next-line @next/next/no-img-element -- served by our own API, sized here
          <img src={`/api/official/logo/${org.id}?v=${logoVersion}`} alt="" className="h-full w-full object-contain" />
        ) : (
          <BadgeCheck size={22} className="text-wf-faint" aria-hidden="true" />
        )}
      </div>
      <label className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border border-wf-border px-3 py-2 text-[14px] font-semibold text-wf-body hover:border-wf-primary ${busy ? "opacity-50" : ""}`}>
        <Upload size={15} aria-hidden="true" /> Upload logo
        <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      </label>
      <label className="flex items-center gap-2 text-[14px] text-wf-body">
        Brand colour
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-12 cursor-pointer rounded-lg border border-wf-border" />
      </label>
      <button disabled={busy} onClick={() => save({ brandColor: color }, "Colour saved.")} className="rounded-xl bg-wf-primary px-3.5 py-2 text-[14px] font-semibold text-white disabled:opacity-50">
        Save colour
      </button>
      {msg && <p className="text-[13.5px] text-wf-muted">{msg}</p>}
    </div>
  )
}

function People({ org, onSaved }: { org: Org; onSaved: () => void }) {
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<OrgRole>("viewer")
  const [msg, setMsg] = useState<string | null>(null)
  const add = async () => {
    const r = await send("POST", "/api/billing/members", { orgId: org.id, email: email.trim(), role })
    setMsg(r.ok ? `${email.trim()} can now sign in to this account with that address.` : r.error === "bad_email" ? "Use a work email address." : r.error ?? "Could not add them.")
    if (r.ok) {
      setEmail("")
      onSaved()
    }
  }
  const remove = async (e: string) => {
    const r = await send("DELETE", "/api/billing/members", { orgId: org.id, email: e })
    setMsg(r.ok ? `${e} removed.` : (r.error ?? "Could not remove them."))
    if (r.ok) onSaved()
  }
  return (
    <div>
      <ul className="divide-y divide-wf-border-faint">
        {org.members.map((m) => (
          <li key={m.email} className="flex items-center justify-between gap-3 py-2 text-[14.5px]">
            <span className="min-w-0 truncate text-wf-body">
              {m.email} <span className="text-wf-faint">· {ORG_ROLE_LABELS[m.role]}{m.userId ? "" : " · not signed in yet"}</span>
            </span>
            <button onClick={() => remove(m.email)} aria-label={`Remove ${m.email}`} className="rounded-lg p-1.5 text-wf-muted hover:bg-red-50 hover:text-red-600">
              <Trash2 size={15} />
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="colleague@hospital.org" aria-label="Colleague's work email" className={`${input} flex-1`} />
        <select value={role} onChange={(e) => setRole(e.target.value as OrgRole)} aria-label="Role" className={input}>
          <option value="viewer">Viewer — reads only</option>
          <option value="manager">Manager — billing and settings</option>
        </select>
        <button onClick={add} disabled={!email.trim()} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-wf-primary px-3.5 py-2 text-[14px] font-semibold text-white disabled:opacity-50">
          <Plus size={15} aria-hidden="true" /> Add
        </button>
      </div>
      {msg && <p className="mt-2 text-[13.5px] text-wf-muted">{msg}</p>}
    </div>
  )
}

function OrgPanel({ org, reload }: { org: Org; reload: () => void }) {
  const manager = org.role === "manager"
  const [portalBusy, setPortalBusy] = useState(false)
  const openPortal = async () => {
    setPortalBusy(true)
    const r = await send("POST", "/api/billing/portal", { orgId: org.id })
    if (r.ok && r.url) window.location.assign(r.url)
    else setPortalBusy(false)
  }
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[28px] font-bold text-wf-ink">{org.name}</h1>
          <p className="text-[14px] text-wf-muted">You’re a {ORG_ROLE_LABELS[org.role].toLowerCase()} of this account.</p>
        </div>
        <div className="flex gap-2">
          {manager && (
            <Link href="/for-hospitals#sign-up" className="inline-flex items-center gap-1.5 rounded-full border border-wf-border px-4 py-2 text-[14px] font-semibold text-wf-body hover:border-wf-primary">
              <Plus size={15} aria-hidden="true" /> Add a site
            </Link>
          )}
          {manager && org.stripeCustomerId && (
            <button onClick={openPortal} disabled={portalBusy} className="inline-flex items-center gap-1.5 rounded-full bg-wf-primary px-4 py-2 text-[14px] font-semibold text-white disabled:opacity-60">
              {portalBusy ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <CreditCard size={15} aria-hidden="true" />} Billing and invoices
            </button>
          )}
        </div>
      </div>

      <Card title="Sites">
        <ul className="divide-y divide-wf-border-faint">
          {org.sites.map((s) => (
            <li key={s.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-semibold text-wf-ink">
                  {s.venueName}
                  <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${STATUS[s.status].tone}`}>{STATUS[s.status].label}</span>
                </p>
                <p className="text-[13.5px] text-wf-muted">
                  {TIER_LABELS[s.tier]} · {formatPrice(priceFor(s.tier, s.interval, s.currency), s.currency)} a {s.interval}
                  {s.billing === "invoice" ? " · by invoice" : ""}
                  {s.poNumber ? ` · PO ${s.poNumber}` : ""}
                  {s.renewsOn ? ` · renews ${new Date(s.renewsOn).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : ""}
                </p>
                <p className="text-[13px] text-wf-faint">{STATUS[s.status].detail}</p>
              </div>
              <div className="flex flex-shrink-0 gap-2">
                {manager && (s.status === "pending" || s.status === "lapsed") && (
                  <Link href={`/for-hospitals?venue=${encodeURIComponent(s.venueId)}#sign-up`} className="rounded-full bg-wf-primary px-3.5 py-1.5 text-[13.5px] font-semibold text-white">
                    {s.status === "lapsed" ? "Sign up again" : "Pay now"}
                  </Link>
                )}
                <Link href={`/map?venue=${encodeURIComponent(s.venueId)}`} className="inline-flex items-center gap-1 rounded-full border border-wf-border px-3.5 py-1.5 text-[13.5px] font-semibold text-wf-body hover:border-wf-primary" title="Upload floor plans or correct the map">
                  <MapPinned size={14} aria-hidden="true" /> Edit map
                </Link>
                <Link href={`/navigate?venue=${encodeURIComponent(s.venueId)}`} className="rounded-full border border-wf-border px-3.5 py-1.5 text-[13.5px] font-semibold text-wf-body hover:border-wf-primary">
                  Open
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="What visitors looked for">
        <Insights org={org} />
      </Card>

      {manager && (
        <Card title="Branding">
          <p className="mb-3 text-[14px] text-wf-muted">Shown beside the Official badge on your sites in the app.</p>
          <Branding org={org} onSaved={reload} />
        </Card>
      )}

      {manager && (
        <Card title="People">
          <People org={org} onSaved={reload} />
        </Card>
      )}
    </div>
  )
}

export default function HospitalAccount() {
  const [state, setState] = useState<{ kind: "loading" } | { kind: "signed-out" } | { kind: "unavailable" } | { kind: "ok"; orgs: Org[]; email: string }>({ kind: "loading" })
  const [current, setCurrent] = useState<string | null>(null)
  const [welcome, setWelcome] = useState(false)

  const load = useCallback(() => {
    fetch("/api/billing/account")
      .then(async (r) => {
        if (r.status === 401) return setState({ kind: "signed-out" })
        if (!r.ok) return setState({ kind: "unavailable" })
        const d = (await r.json()) as { orgs: Org[]; user: { email: string } }
        // Back from Stripe's checkout.
        setWelcome(new URLSearchParams(window.location.search).has("welcome"))
        setState({ kind: "ok", orgs: d.orgs, email: d.user.email })
        setCurrent((c) => c ?? d.orgs[0]?.id ?? null)
      })
      .catch(() => setState({ kind: "unavailable" }))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (state.kind === "loading") return <p className="text-wf-muted">Loading…</p>
  if (state.kind === "unavailable") return <p className="text-wf-muted">Hospital accounts are not available on this copy of Findway right now.</p>
  if (state.kind === "signed-out") {
    return (
      <div className="flex flex-col items-start gap-4">
        <p className="text-[16px] text-wf-body">Sign in with your work email to manage your hospital’s listing.</p>
        {clerkEnabled && (
          <SignInButton mode="modal" forceRedirectUrl="/for-hospitals/account" signUpForceRedirectUrl="/for-hospitals/account">
            <button className="rounded-full bg-wf-primary px-5 py-2.5 text-[15px] font-semibold text-white">Sign in</button>
          </SignInButton>
        )}
      </div>
    )
  }
  if (!state.orgs.length) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-[16px] text-wf-body">{state.email} isn’t part of a hospital account yet.</p>
        <p className="text-[15px] text-wf-muted">If a colleague manages one, ask them to add this address. Otherwise:</p>
        <Link href="/for-hospitals#sign-up" className="rounded-full bg-wf-primary px-5 py-2.5 text-[15px] font-semibold text-white">
          List your hospital
        </Link>
      </div>
    )
  }
  const org = state.orgs.find((o) => o.id === current) ?? state.orgs[0]
  return (
    <div className="flex flex-col gap-5">
      {welcome && (
        <p className="rounded-2xl bg-wf-green-tint px-4 py-3 text-[15px] text-wf-green-text">
          Thank you. Your listing goes Official as soon as Stripe confirms the payment, usually within a minute; invoices go live straight away.
        </p>
      )}
      {state.orgs.length > 1 && (
        <select value={org.id} onChange={(e) => setCurrent(e.target.value)} aria-label="Organisation" className={`${input} self-start`}>
          {state.orgs.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      )}
      <OrgPanel org={org} reload={load} />
    </div>
  )
}
