"use client"
// Signing a hospital up for an Official listing, start to finish: find the
// hospital, sign in with a work email, choose monthly or yearly and how to
// pay, accept the terms, and go to Stripe. Nobody at Findway takes part
// unless the email does not prove the person works there.

import Link from "next/link"
import { useEffect, useState } from "react"
import { SignInButton, useUser } from "@clerk/nextjs"
import { Search, BadgeCheck, Loader2, Building2, CreditCard, FileText, Check } from "lucide-react"
import { formatPrice, TIER_LABELS, TIER_SUMMARIES, YEARLY_MONTHS, type Currency, type Interval, type Tier } from "@/lib/billing/plans"
import { countryName } from "@/lib/country"

interface Hit {
  venueId: string
  name: string
  subtitle: string | null
  mapped: boolean
}

interface SiteInfo {
  site: { venueId: string; name: string; subtitle: string | null; country: string; kind: string; mapped: boolean; tier: Tier }
  currency: Currency
  prices: Record<Interval, number>
  domains: string[]
  listed: { mine: boolean; status: string } | null
  signedIn: boolean
  proven: boolean
  orgs: { id: string; name: string }[]
}

const COUNTRIES = ["GB", "IE", "US", "CA", "AU", "NZ", "DE", "FR", "NL", "BE", "ES", "IT", "PT", "LU", "AT", "CH", "SE", "NO", "DK", "FI", "PL", "NG", "KE", "ZA", "GH", "IN", "AE", "SG"]

const ERRORS: Record<string, string> = {
  already_listed: "Another organisation already lists this hospital. If that is wrong, contact support.",
  already_listed_by_you: "Your organisation already lists this hospital. Manage it from your account.",
  terms_required: "Please accept the terms to continue.",
  billing_email_required: "Invoices need a work email address for your accounts team.",
  payment_setup_failed: "Stripe could not set up the payment. Please try again in a moment.",
  signed_out: "Please sign in first.",
  not_configured: "Sign-up is not open on this copy of Findway yet.",
  forbidden: "Only a manager of your organisation can do that.",
}

const clerkEnabled = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

const input = "w-full rounded-xl border border-wf-border bg-white px-3.5 py-2.5 text-[15px] text-wf-ink outline-none focus:border-wf-primary focus:ring-2 focus:ring-wf-primary/20"

function Choice({ checked, onChange, title, detail, icon }: { checked: boolean; onChange: () => void; title: string; detail: string; icon?: React.ReactNode }) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3.5 ${checked ? "border-wf-primary bg-[#EEF5FD]" : "border-wf-border bg-white hover:border-wf-primary/50"}`}>
      <input type="radio" checked={checked} onChange={onChange} className="mt-1 accent-[var(--wf-primary)]" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-[15px] font-semibold text-wf-ink">
          {icon}
          {title}
        </span>
        <span className="mt-0.5 block text-[13.5px] leading-snug text-wf-muted">{detail}</span>
      </span>
    </label>
  )
}

function SignIn({ redirect }: { redirect: string }) {
  if (!clerkEnabled) return <p className="text-[14px] text-wf-muted">Sign-in is not set up on this copy of Findway.</p>
  return (
    <SignInButton mode="modal" forceRedirectUrl={redirect} signUpForceRedirectUrl={redirect}>
      <button className="rounded-full bg-wf-primary px-5 py-2.5 text-[15px] font-semibold text-white shadow-[0_8px_20px_rgba(10,93,194,0.3)]">Sign in with your work email</button>
    </SignInButton>
  )
}

function useSignedIn(): boolean | null {
  // useUser needs a ClerkProvider, which exists only when Clerk is set up.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const u = clerkEnabled ? useUser() : null
  return u ? (u.isLoaded ? !!u.isSignedIn : null) : false
}

export default function HospitalSignup({ ready }: { ready: boolean }) {
  const signedIn = useSignedIn()
  const [country, setCountry] = useState("GB")
  const [q, setQ] = useState("")
  const [hits, setHits] = useState<Hit[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [venueId, setVenueId] = useState<string | null>(null)
  // What the server said about a hospital, kept with the id it was asked for
  // so a reply for one picked before is never shown for the next.
  const [loaded, setLoaded] = useState<{ for: string; info: SiteInfo | null } | null>(null)
  const info = venueId && loaded?.for === venueId ? loaded.info : null
  const [interval, setBillingInterval] = useState<Interval>("year")
  const [billing, setBilling] = useState<"online" | "invoice">("online")
  const [poNumber, setPoNumber] = useState("")
  const [billingEmail, setBillingEmail] = useState("")
  const [orgChoice, setOrgChoice] = useState<string>("new")
  const [orgName, setOrgName] = useState("")
  const [accept, setAccept] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<null | "review">(null)

  // A link from elsewhere can name the hospital: /for-hospitals?venue=<id>.
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get("venue")
    // The address bar exists only in the browser, after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (v) setVenueId(v)
  }, [])

  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) return
    const ctrl = new AbortController()
    const t = setTimeout(() => {
      setSearching(true)
      fetch(`/api/billing/sites?${new URLSearchParams({ q: term, country })}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((d: { results: Hit[] }) => setHits(d.results ?? []))
        .catch(() => {})
        .finally(() => setSearching(false))
    }, 250)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [q, country])

  useEffect(() => {
    if (!venueId) return
    let live = true
    fetch(`/api/billing/site?${new URLSearchParams({ venueId })}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: SiteInfo | null) => {
        if (!live) return
        setLoaded({ for: venueId, info: d })
        if (d) {
          setOrgName((n) => n || d.site.name)
          if (d.orgs.length) setOrgChoice(d.orgs[0].id)
        }
      })
      .catch(() => live && setLoaded({ for: venueId, info: null }))
    return () => {
      live = false
    }
  }, [venueId, signedIn])

  const submit = async () => {
    if (!info) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/billing/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venueId: info.site.venueId,
          interval,
          billing,
          poNumber: poNumber.trim() || undefined,
          billingEmail: billingEmail.trim() || undefined,
          acceptTerms: accept,
          ...(orgChoice === "new" ? { orgName: orgName.trim() || info.site.name } : { orgId: orgChoice }),
        }),
      })
      const d = (await res.json().catch(() => ({}))) as { kind?: string; url?: string; error?: string }
      if (!res.ok) throw new Error(d.error ?? "failed")
      if (d.kind === "redirect" && d.url) window.location.assign(d.url)
      else if (d.kind === "review") setDone("review")
      else window.location.assign("/for-hospitals/account?welcome=1")
    } catch (err) {
      const code = err instanceof Error ? err.message : "failed"
      setError(ERRORS[code] ?? "Something went wrong. Please try again.")
      setBusy(false)
    }
  }

  if (!ready) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-[15px] text-amber-900">
        Sign-up is not open on this copy of Findway yet. Contact <Link href="/support" className="font-semibold underline">support</Link> to list your hospital.
      </div>
    )
  }

  if (done === "review") {
    return (
      <div className="rounded-2xl border border-wf-border bg-wf-surface px-5 py-5">
        <p className="font-display text-[19px] font-semibold text-wf-ink">Thanks — we’ll check and come back to you</p>
        <p className="mt-2 text-[15px] leading-relaxed text-wf-body">
          Your email address isn’t one we can match to {info?.site.name} automatically, so someone at Findway will confirm you work there. Nothing
          is charged until then. Once approved, sign in to <Link href="/for-hospitals/account" className="font-semibold text-wf-primary">your account</Link> to pay.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 1. The hospital */}
      <section>
        <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-wf-muted">1 · Your hospital</p>
        {info ? (
          <div className="mt-3 flex items-start gap-3 rounded-2xl border border-wf-border bg-white px-4 py-3.5">
            <Building2 size={20} className="mt-0.5 flex-shrink-0 text-wf-primary" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-wf-ink">{info.site.name}</p>
              <p className="text-[13.5px] text-wf-muted">
                {[info.site.subtitle, countryName(info.site.country)].filter(Boolean).join(" · ")}
                {info.site.mapped ? " · indoor map ready" : " · no indoor map yet: you can upload your plans after signing up"}
              </p>
            </div>
            <button onClick={() => { setVenueId(null); setError(null) }} className="text-[13.5px] font-semibold text-wf-primary">
              Change
            </button>
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <select value={country} onChange={(e) => setCountry(e.target.value)} aria-label="Country" className={`${input} sm:w-[180px]`}>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {countryName(c)}
                </option>
              ))}
            </select>
            <div className="relative flex-1">
              <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-wf-faint" aria-hidden="true" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Hospital name" aria-label="Hospital name" className={`${input} pl-10`} />
              {searching && <Loader2 size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-wf-faint" aria-hidden="true" />}
            </div>
          </div>
        )}
        {!info && hits && q.trim().length >= 2 && (
          <ul className="mt-2 overflow-hidden rounded-2xl border border-wf-border bg-white">
            {hits.length === 0 ? (
              <li className="px-4 py-3 text-[14px] text-wf-muted">
                No hospital by that name in {countryName(country)}. <Link href="/support" className="font-semibold text-wf-primary">Ask us to add it</Link>.
              </li>
            ) : (
              hits.map((h) => (
                <li key={h.venueId} className="border-b border-wf-border-faint last:border-0">
                  <button onClick={() => setVenueId(h.venueId)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-wf-surface">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-wf-ink">{h.name}</span>
                      {h.subtitle && <span className="block truncate text-[13px] text-wf-muted">{h.subtitle}</span>}
                    </span>
                    {h.mapped && <span className="flex-shrink-0 text-[12px] font-semibold text-wf-primary">Mapped</span>}
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
        {venueId && !info && (
          <p className="mt-2 text-[14px] text-wf-muted">
            {loaded?.for === venueId ? "That hospital can’t be listed. Search for it again above." : "Loading…"}
          </p>
        )}
      </section>

      {info && info.listed && (
        <div className="rounded-2xl border border-wf-border bg-wf-surface px-4 py-3.5 text-[15px] text-wf-body">
          {info.listed.mine ? (
            info.listed.status === "pending" ? (
              <>Your organisation signed this hospital up but hasn’t paid yet. Choose below to finish.</>
            ) : (
              <>
                Your organisation already lists this hospital. <Link href="/for-hospitals/account" className="font-semibold text-wf-primary">Open your account</Link>.
              </>
            )
          ) : (
            <>Another organisation already lists this hospital. If that’s wrong, <Link href="/support" className="font-semibold text-wf-primary">tell us</Link>.</>
          )}
        </div>
      )}

      {info && (!info.listed || (info.listed.mine && info.listed.status === "pending")) && (
        <>
          {/* 2. Who you are */}
          <section>
            <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-wf-muted">2 · Sign in</p>
            {signedIn ? (
              <p className="mt-3 flex items-start gap-2 text-[15px] text-wf-body">
                {info.proven || info.listed ? (
                  <>
                    <BadgeCheck size={18} className="mt-0.5 flex-shrink-0 text-wf-green-text" aria-hidden="true" />
                    {info.listed ? "You’re confirmed for this hospital" : "Your email shows you work at this hospital"}, so it goes live as soon as
                    you’ve chosen how to pay.
                  </>
                ) : (
                  <>
                    Your email isn’t at {info.domains.length ? info.domains.join(" or ") : "an address we know for this hospital"}, so Findway will
                    check you work there before anything is charged. Signing in with your work email avoids the wait.
                  </>
                )}
              </p>
            ) : signedIn === false ? (
              <div className="mt-3 flex flex-col gap-3">
                <p className="text-[15px] text-wf-body">
                  Use your work email{info.domains.length ? ` (${info.domains.map((d) => `@${d}`).join(" or ")})` : ""}: it’s how we know you
                  work at the hospital, with no paperwork.
                </p>
                <div>
                  <SignIn redirect={`/for-hospitals?venue=${encodeURIComponent(info.site.venueId)}`} />
                </div>
              </div>
            ) : (
              <p className="mt-3 text-[14px] text-wf-muted">Checking…</p>
            )}
          </section>

          {signedIn && (
            <>
              {/* 3. The plan */}
              <section>
                <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-wf-muted">3 · Plan</p>
                <p className="mt-3 text-[15px] text-wf-body">
                  <span className="font-semibold text-wf-ink">{TIER_LABELS[info.site.tier]}</span> — {TIER_SUMMARIES[info.site.tier].toLowerCase()}, sized from the
                  hospital’s map.
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Choice checked={interval === "month"} onChange={() => setBillingInterval("month")} title={`${formatPrice(info.prices.month, info.currency)} a month`} detail="Pay monthly, cancel any time." />
                  <Choice
                    checked={interval === "year"}
                    onChange={() => setBillingInterval("year")}
                    title={`${formatPrice(info.prices.year, info.currency)} a year`}
                    detail={`${12 - YEARLY_MONTHS} months free. One payment, one purchase order.`}
                  />
                </div>
                <p className="mt-2 text-[13px] text-wf-faint">Prices exclude VAT or sales tax, added where it applies.</p>
              </section>

              {/* 4. Paying */}
              <section>
                <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-wf-muted">4 · How to pay</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Choice
                    checked={billing === "online"}
                    onChange={() => setBilling("online")}
                    icon={<CreditCard size={16} className="text-wf-primary" aria-hidden="true" />}
                    title="Pay online now"
                    detail="Card or direct debit, renewed automatically."
                  />
                  <Choice
                    checked={billing === "invoice"}
                    onChange={() => setBilling("invoice")}
                    icon={<FileText size={16} className="text-wf-primary" aria-hidden="true" />}
                    title="Invoice, 30 days"
                    detail="Emailed to your accounts team with your PO number. Pay by bank transfer. You go live today."
                  />
                </div>
                {billing === "invoice" && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <input value={billingEmail} onChange={(e) => setBillingEmail(e.target.value)} type="email" placeholder="Accounts payable email" aria-label="Accounts payable email" className={input} />
                    <input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder="Purchase order number (optional)" aria-label="Purchase order number" maxLength={30} className={input} />
                  </div>
                )}
              </section>

              {/* 5. Organisation */}
              {!info.listed && (
                <section>
                  <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-wf-muted">5 · Organisation</p>
                  {info.orgs.length > 0 && (
                    <div className="mt-3 flex flex-col gap-2">
                      {info.orgs.map((o) => (
                        <Choice key={o.id} checked={orgChoice === o.id} onChange={() => setOrgChoice(o.id)} title={`Add to ${o.name}`} detail="One account and one bill for all your sites." />
                      ))}
                      <Choice checked={orgChoice === "new"} onChange={() => setOrgChoice("new")} title="A new organisation" detail="Billed and managed separately." />
                    </div>
                  )}
                  {orgChoice === "new" && (
                    <input value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Trust or company name, as it should appear on invoices" aria-label="Organisation name" maxLength={160} className={`${input} mt-3`} />
                  )}
                </section>
              )}

              <label className="flex items-start gap-3 text-[14.5px] text-wf-body">
                <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} className="mt-1 accent-[var(--wf-primary)]" />
                <span>
                  I accept the{" "}
                  <Link href="/for-hospitals/terms" target="_blank" className="font-semibold text-wf-primary">
                    terms, data processing agreement and service levels
                  </Link>{" "}
                  for my organisation.
                </span>
              </label>

              {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-[14.5px] text-red-700">{error}</p>}

              <div>
                <button
                  onClick={submit}
                  disabled={busy || !accept || (billing === "invoice" && !billingEmail.trim())}
                  className="inline-flex items-center gap-2 rounded-full bg-wf-primary px-6 py-3 text-[15.5px] font-semibold text-white shadow-[0_8px_20px_rgba(10,93,194,0.3)] disabled:opacity-50"
                >
                  {busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
                  {!info.proven && !info.listed ? "Send for approval" : billing === "online" ? "Continue to payment" : "Go live and send the invoice"}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
