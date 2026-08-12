import Link from "next/link"
import { AlertTriangle, CheckCircle2, Info, ShieldAlert } from "lucide-react"
import type { ReactNode } from "react"

// The back office's vocabulary of surfaces: a card, a stat tile, a badge, a
// table, a notice, an empty state. Everything a screen needs is composed from
// these, so the portal looks like one product rather than eleven pages.
//
// They are Server Components on purpose. A moderation table is read far more
// often than it is clicked, and a page whose data, layout and type badges all
// render on the server ships no JavaScript to draw them — the interactive parts
// (forms, filters) are the only things that opt into the client.
//
// The palette is the app's own (globals.css): wf-ink for headings, wf-muted for
// secondary text, wf-primary for action, wf-surface for the page behind the
// cards. An operator moving between the portal and the map should not feel they
// changed products.

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-display text-[26px] font-bold -tracking-[0.5px] text-wf-ink">{title}</h1>
        {description ? <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-wf-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  )
}

export function Card({
  title,
  description,
  actions,
  children,
  className = "",
  bodyClassName = "p-5",
}: {
  title?: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section className={`rounded-2xl border border-wf-border bg-white shadow-[0_1px_2px_rgba(11,27,46,0.04)] ${className}`}>
      {title ? (
        <div className="flex items-start justify-between gap-3 border-b border-wf-border-faint px-5 py-4">
          <div className="min-w-0">
            <h2 className="font-display text-[15px] font-semibold text-wf-ink">{title}</h2>
            {description ? <p className="mt-0.5 text-[12.5px] leading-relaxed text-wf-muted">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={bodyClassName}>{children}</div>
    </section>
  )
}

/**
 * Label, value, and optionally one supporting fact. Deliberately not a one-bar
 * bar chart: a current count is a number, and a number is the clearest way to
 * print a number.
 */
export function StatTile({
  label,
  value,
  hint,
  tone = "neutral",
  href,
  children,
}: {
  label: string
  value: string | number
  hint?: string
  tone?: "neutral" | "good" | "warn" | "bad"
  href?: string
  children?: ReactNode
}) {
  const accent =
    tone === "good" ? "text-wf-green-text" : tone === "warn" ? "text-[#8A5A00]" : tone === "bad" ? "text-[#B3261E]" : "text-wf-ink"

  const body = (
    <>
      <p className="text-[12.5px] font-medium text-wf-muted">{label}</p>
      <p className={`mt-1.5 font-display text-[28px] font-bold leading-none -tracking-[0.6px] ${accent}`}>
        {typeof value === "number" ? formatNumber(value) : value}
      </p>
      {hint ? <p className="mt-2 text-[12px] leading-snug text-wf-faint">{hint}</p> : null}
      {children}
    </>
  )

  const shell = "rounded-2xl border border-wf-border bg-white p-5 shadow-[0_1px_2px_rgba(11,27,46,0.04)]"
  if (href) {
    return (
      <Link href={href} className={`${shell} block transition-colors hover:border-wf-primary/40`}>
        {body}
      </Link>
    )
  }
  return <div className={shell}>{body}</div>
}

/**
 * The one number a screen leads with. Exactly one per view — a page with three
 * heroes has no hero.
 */
export function Hero({ value, label, sub }: { value: string | number; label: string; sub?: string }) {
  return (
    <div>
      <p className="text-[13px] font-medium text-wf-muted">{label}</p>
      <p className="mt-1 font-display text-[52px] font-bold leading-none -tracking-[2px] text-wf-ink">
        {typeof value === "number" ? formatNumber(value) : value}
      </p>
      {sub ? <p className="mt-2 text-[13px] leading-relaxed text-wf-muted">{sub}</p> : null}
    </div>
  )
}

export type Tone = "neutral" | "good" | "warn" | "bad" | "info"

const TONES: Record<Tone, string> = {
  neutral: "bg-wf-surface text-wf-muted ring-wf-border",
  good: "bg-wf-green-tint text-wf-green-text ring-[#BCE7CB]",
  warn: "bg-[#FFF6E3] text-[#8A5A00] ring-[#F5DDAE]",
  bad: "bg-[#FDEDEC] text-[#B3261E] ring-[#F3C6C2]",
  info: "bg-[#E7F2FF] text-wf-primary-deep ring-[#C5DDF7]",
}

/**
 * A state, in words. Status is never carried by colour alone here — the label is
 * always present and the tone only reinforces it, which is what keeps the
 * moderation table readable in greyscale, in high-contrast mode, and to the
 * ~8% of men who would otherwise see the amber and the green as one colour.
 */
export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-semibold ring-1 ring-inset ${TONES[tone]}`}
    >
      {children}
    </span>
  )
}

export function Notice({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warn" | "bad" | "good"
  title: string
  children?: ReactNode
}) {
  const Icon = tone === "bad" ? ShieldAlert : tone === "warn" ? AlertTriangle : tone === "good" ? CheckCircle2 : Info
  const skin =
    tone === "bad"
      ? "border-[#F3C6C2] bg-[#FDEDEC] text-[#B3261E]"
      : tone === "warn"
        ? "border-[#F5DDAE] bg-[#FFF6E3] text-[#8A5A00]"
        : tone === "good"
          ? "border-[#BCE7CB] bg-wf-green-tint text-wf-green-text"
          : "border-[#C5DDF7] bg-[#E7F2FF] text-wf-primary-deep"

  return (
    <div className={`flex gap-3 rounded-2xl border p-4 ${skin}`}>
      <Icon size={17} className="mt-0.5 flex-shrink-0" aria-hidden />
      <div className="min-w-0 text-[13px] leading-relaxed">
        <p className="font-semibold">{title}</p>
        {children ? <div className="mt-1 opacity-90">{children}</div> : null}
      </div>
    </div>
  )
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="px-5 py-14 text-center">
      <p className="font-display text-[15px] font-semibold text-wf-ink">{title}</p>
      {body ? <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-wf-muted">{body}</p> : null}
    </div>
  )
}

// ── Table primitives ───────────────────────────────────────────────────────
// Shared class strings rather than a component per cell: a table built from
// <Th>/<Td> wrappers reads worse than the HTML it replaces, and these keep every
// table in the portal aligned without hiding the markup.

export const TABLE = "w-full border-collapse text-left text-[13px]"
export const TH = "border-b border-wf-border px-4 py-2.5 text-[11.5px] font-semibold uppercase tracking-wide text-wf-faint"
export const TD = "border-b border-wf-border-faint px-4 py-3 align-middle text-wf-body"
/** Wrap every table: wide content scrolls inside its own box, never the page. */
export const TABLE_SCROLL = "overflow-x-auto"

// ── Formatting ─────────────────────────────────────────────────────────────

export function formatNumber(n: number): string {
  return n.toLocaleString("en-GB")
}

/**
 * Dates are rendered on the server, so they must not depend on the reader's
 * locale or timezone — a server-rendered string that disagrees with the client's
 * would hydrate mismatched. Fixed to en-GB/UTC, and labelled UTC where the exact
 * time matters.
 */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—"
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—"
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}, ${d.toLocaleTimeString(
    "en-GB",
    { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }
  )} UTC`
}

/** "3 days ago" — computed on the server, so it is as of render time. */
export function timeAgo(value: string | Date | null | undefined): string {
  if (!value) return "never"
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return "never"
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000)
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`
  const days = Math.floor(hours / 24)
  if (days < 31) return `${days} day${days === 1 ? "" : "s"} ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`
  return `${Math.floor(months / 12)} year${months < 24 ? "" : "s"} ago`
}

// ── Pagination ─────────────────────────────────────────────────────────────

export function Pagination({
  page,
  pageSize,
  total,
  baseHref,
  params,
}: {
  page: number
  pageSize: number
  total: number
  baseHref: string
  params: Record<string, string | undefined>
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (total === 0) return null
  const href = (p: number) => {
    const search = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) if (v) search.set(k, v)
    if (p > 1) search.set("page", String(p))
    const qs = search.toString()
    return qs ? `${baseHref}?${qs}` : baseHref
  }
  const from = (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)

  const button = "rounded-lg border border-wf-border px-3 py-1.5 text-[12.5px] font-semibold text-wf-body transition-colors hover:border-wf-primary/40 hover:text-wf-primary"
  const disabled = "rounded-lg border border-wf-border-faint px-3 py-1.5 text-[12.5px] font-semibold text-wf-faint"

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 text-[12.5px] text-wf-muted">
      <p>
        {formatNumber(from)}–{formatNumber(to)} of {formatNumber(total)}
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={href(page - 1)} className={button}>
            Previous
          </Link>
        ) : (
          <span className={disabled}>Previous</span>
        )}
        <span className="px-1">
          Page {page} of {pages}
        </span>
        {page < pages ? (
          <Link href={href(page + 1)} className={button}>
            Next
          </Link>
        ) : (
          <span className={disabled}>Next</span>
        )}
      </div>
    </div>
  )
}

// ── Buttons (links that act like buttons) ──────────────────────────────────

export const BTN_PRIMARY =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-wf-primary px-4 py-2.5 text-[13px] font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-60"
export const BTN_QUIET =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-wf-border bg-white px-4 py-2.5 text-[13px] font-semibold text-wf-body transition-colors hover:border-wf-primary/40 hover:text-wf-primary disabled:opacity-60"
export const BTN_DANGER =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-[#F3C6C2] bg-[#FDEDEC] px-4 py-2.5 text-[13px] font-semibold text-[#B3261E] transition-colors hover:bg-[#FBE0DE] disabled:opacity-60"
export const INPUT =
  "w-full rounded-xl border border-wf-border bg-white px-3.5 py-2.5 text-[13.5px] text-wf-ink outline-none transition-colors placeholder:text-wf-faint focus:border-wf-primary focus:ring-2 focus:ring-wf-primary/15"
export const LABEL = "mb-1.5 block text-[12.5px] font-semibold text-wf-body"
