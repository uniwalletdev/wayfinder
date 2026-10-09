import type { Metadata } from "next"
import Link from "next/link"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { BadgeCheck, Palette, RefreshCw, BarChart3, Download } from "lucide-react"
import InfoPage from "@/components/InfoPage"
import HospitalSignup from "@/components/hospitals/HospitalSignup"
import { billingSetup } from "@/lib/billing/account"
import { CURRENCIES, TIERS, TIER_LABELS, TIER_SUMMARIES, YEARLY_MONTHS, formatPrice, priceFor } from "@/lib/billing/plans"
import { PROCUREMENT_PACK } from "@/lib/billing/procurement"

export const metadata: Metadata = {
  title: "For hospitals",
  description: "Make your hospital Official on Findway: a verified, maintained indoor map with your branding. Sign up, pay monthly or yearly, and go live today.",
}

// Read on each request: whether sign-up is open depends on the deployment's
// settings, and the pack on what is in public/procurement.
export const dynamic = "force-dynamic"

const BENEFITS = [
  { icon: BadgeCheck, title: "An Official badge", body: "Patients and visitors see the map is yours, checked and kept up to date by the hospital." },
  { icon: Palette, title: "Your branding", body: "Your logo and colour on your sites in the Findway app and website." },
  { icon: RefreshCw, title: "Priority map updates", body: "A ward moves or a clinic opens: your changes go to the front of the queue." },
  { icon: BarChart3, title: "What visitors look for", body: "Anonymous counts of who was guided where, and what people searched for and could not find." },
]

export default function ForHospitalsPage() {
  const ready = billingSetup().ready
  const pack = PROCUREMENT_PACK.filter((p) => existsSync(join(process.cwd(), "public", "procurement", p.file)))
  return (
    <InfoPage
      eyebrow="For hospitals"
      title="Make your hospital Official on Findway"
      lead="Findway is free for patients and always will be. Hospitals pay to make their listing Official: verified, branded and kept up to date. Sign up in a few minutes, pay monthly or yearly, and go live today, with no meeting needed."
      wide
    >
      <div className="not-prose grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {BENEFITS.map((b) => (
          <div key={b.title} className="rounded-2xl border border-wf-border bg-white px-5 py-4">
            <b.icon size={20} className="text-wf-primary" aria-hidden="true" />
            <p className="mt-2 font-display text-[16px] font-semibold text-wf-ink">{b.title}</p>
            <p className="mt-1 text-[14px] leading-snug text-wf-muted">{b.body}</p>
          </div>
        ))}
      </div>

      <h2>Prices</h2>
      <p>
        Per hospital site. Yearly is {YEARLY_MONTHS} months’ price: two months free. Your site’s size is worked out from its map when you sign up. Prices
        exclude VAT or sales tax.
      </p>
      <div className="not-prose overflow-x-auto rounded-2xl border border-wf-border">
        <table className="w-full min-w-[560px] text-left text-[14.5px]">
          <thead className="bg-wf-surface text-[13px] text-wf-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Site</th>
              {CURRENCIES.map((c) => (
                <th key={c} className="px-4 py-3 font-semibold">
                  {c.toUpperCase()} · month / year
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TIERS.map((t) => (
              <tr key={t} className="border-t border-wf-border-faint">
                <td className="px-4 py-3">
                  <p className="font-semibold text-wf-ink">{TIER_LABELS[t]}</p>
                  <p className="text-[13px] text-wf-muted">{TIER_SUMMARIES[t]}</p>
                </td>
                {CURRENCIES.map((c) => (
                  <td key={c} className="whitespace-nowrap px-4 py-3 text-wf-body">
                    {formatPrice(priceFor(t, "month", c), c)} / {formatPrice(priceFor(t, "year", c), c)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>How it works</h2>
      <ol>
        <li>Find your hospital below. Any hospital Findway knows can be listed, mapped or not.</li>
        <li>
          Sign in with your work email. An NHS address, or one at your hospital’s own website, shows you work there, so there is nothing to send us.
        </li>
        <li>Choose monthly or yearly, and pay online by card or direct debit, or by invoice with your purchase order number.</li>
        <li>
          Your listing is Official straight away. Stripe handles renewals, receipts and reminders; change plan, update payment or cancel from your
          account whenever you like.
        </li>
      </ol>
      <p className="mt-4">
        If you stop paying, your hospital’s map stays in Findway for patients. It just stops being Official. Read the{" "}
        <Link href="/for-hospitals/terms">terms</Link>.
      </p>

      <h2 id="sign-up">Sign up</h2>
      <div className="not-prose">
        <HospitalSignup ready={ready} />
      </div>
      <p>
        Already signed up? <Link href="/for-hospitals/account">Open your account</Link>.
      </p>

      <h2>For your procurement team</h2>
      {pack.length ? (
        <>
          <p>Everything your buyers usually ask a new supplier for, ready to download.</p>
          <ul className="not-prose grid gap-2 sm:grid-cols-2">
            {pack.map((p) => (
              <li key={p.file}>
                <a href={`/procurement/${p.file}`} download className="flex items-start gap-3 rounded-2xl border border-wf-border bg-white px-4 py-3 hover:border-wf-primary">
                  <Download size={17} className="mt-0.5 flex-shrink-0 text-wf-primary" aria-hidden="true" />
                  <span>
                    <span className="block font-semibold text-wf-ink">{p.title}</span>
                    <span className="block text-[13.5px] text-wf-muted">{p.detail}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p>
          Supplier details, insurance and NHS assurance documents (DTAC, DCB0129, DSPT) are available from <Link href="/support">support</Link>.
        </p>
      )}
    </InfoPage>
  )
}
