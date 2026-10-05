"use client"
// Building blocks shared by the back office pages: data fetching against
// /api/admin, page headers, cards, tables, badges, a confirmation dialog and
// the formatting the pages share. Same tokens as the rest of Findway.
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { Loader2, TriangleAlert, Lock, X } from "lucide-react"

// ---- data -----------------------------------------------------------------------

export class AdminError extends Error {
  constructor(public status: number, public code: string, public reason?: string) {
    super(reason ?? code)
  }
}

async function parse(res: Response) {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new AdminError(res.status, (data as { error?: string }).error ?? `http_${res.status}`, (data as { reason?: string }).reason)
  return data
}

export function useAdmin<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<AdminError | null>(null)
  const [loading, setLoading] = useState(!!path)
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick((t) => t + 1), [])
  useEffect(() => {
    if (!path) return
    const ac = new AbortController()
    // A new path or a reload starts a fetch; its answer arrives asynchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    fetch(path, { signal: ac.signal, cache: "no-store" })
      .then(parse)
      .then((d) => {
        setData(d as T)
        setError(null)
      })
      .catch((err) => {
        if (ac.signal.aborted) return
        setError(err instanceof AdminError ? err : new AdminError(0, "unreachable"))
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false)
      })
    return () => ac.abort()
  }, [path, tick])
  return { data, error, loading, reload }
}

export async function adminSend<T = { ok: boolean }>(method: "POST" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return (await parse(res)) as T
}

export function errorText(err: unknown): string {
  if (!(err instanceof AdminError)) return "Something went wrong. Try again."
  if (err.reason) return err.reason
  switch (err.code) {
    case "no_database":
      return "The database is not connected on this deployment, so there is nothing to show yet."
    case "no_accounts":
      return "Accounts (Clerk) are not set up on this deployment."
    case "forbidden":
    case "no_access":
      return "Your role does not allow this."
    case "signed_out":
      return "Your session has ended. Reload the page and sign in again."
    case "cross_origin":
      return "That request did not come from this site."
    case "unreachable":
      return "Could not reach the server. Check your connection."
    default:
      return "Something went wrong on the server. Try again."
  }
}

// ---- formatting ----------------------------------------------------------------------

export const fmtNumber = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("en-GB"))

export function fmtDate(iso: string | null | undefined, withTime = true): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}) })
}

export function fmtAgo(iso: string | null | undefined): string {
  if (!iso) return "never"
  const ms = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(ms)) return "—"
  const m = Math.round(ms / 60_000)
  if (m < 1) return "just now"
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 48) return `${h} h ago`
  const d = Math.round(h / 24)
  if (d < 60) return `${d} days ago`
  return fmtDate(iso, false)
}

// ---- layout ------------------------------------------------------------------------------

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-display text-[26px] font-bold leading-tight -tracking-[0.4px] text-wf-ink">{title}</h1>
        {description && <p className="mt-1 max-w-[720px] text-[14.5px] leading-relaxed text-wf-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Card({ title, action, children, className = "" }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-wf-border bg-white p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="font-display text-[16px] font-semibold text-wf-ink">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function Stat({ label, value, hint, tone = "default" }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "default" | "attention" }) {
  return (
    <div className={`rounded-2xl border bg-white px-4 py-4 ${tone === "attention" ? "border-amber-200" : "border-wf-border"}`}>
      <p className="text-[12.5px] font-medium text-wf-muted">{label}</p>
      <p className={`mt-1 font-display text-[26px] font-bold leading-none ${tone === "attention" ? "text-amber-700" : "text-wf-ink"}`}>{value}</p>
      {hint && <p className="mt-2 text-[12px] text-wf-faint">{hint}</p>}
    </div>
  )
}

const BADGE_TONES = {
  neutral: "bg-wf-surface text-wf-body",
  primary: "bg-[#E7F2FF] text-wf-primary",
  green: "bg-wf-green-tint text-wf-green-text",
  teal: "bg-wf-teal-tint text-wf-teal-text",
  amber: "bg-amber-50 text-amber-800",
  red: "bg-red-50 text-red-700",
} as const

export function Badge({ tone = "neutral", children, title }: { tone?: keyof typeof BADGE_TONES; children: ReactNode; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${BADGE_TONES[tone]}`}>
      {children}
    </span>
  )
}

const BUTTON_TONES = {
  primary: "bg-wf-primary text-white hover:bg-wf-primary-deep",
  secondary: "border border-wf-border bg-white text-wf-body hover:border-wf-primary hover:text-wf-primary",
  danger: "bg-red-600 text-white hover:bg-red-700",
  ghost: "text-wf-body hover:bg-wf-surface",
} as const

export function Button({
  tone = "secondary",
  size = "md",
  busy,
  children,
  className = "",
  ...rest
}: React.ComponentPropsWithRef<"button"> & { tone?: keyof typeof BUTTON_TONES; size?: "sm" | "md"; busy?: boolean }) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || busy}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
        size === "sm" ? "px-2.5 py-1.5 text-[12.5px]" : "px-3.5 py-2 text-[13.5px]"
      } ${BUTTON_TONES[tone]} ${className}`}
    >
      {busy && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
      {children}
    </button>
  )
}

export function Select({ label, value, onChange, options, disabled }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; disabled?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-[13px] text-wf-muted">
      <span className="sr-only sm:not-sr-only">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="rounded-xl border border-wf-border bg-white px-2.5 py-2 text-[13.5px] text-wf-ink outline-none focus:border-wf-primary disabled:opacity-50"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      className="w-full min-w-0 rounded-xl border border-wf-border bg-white px-3.5 py-2 text-[14px] text-wf-ink outline-none placeholder:text-wf-faint focus:border-wf-primary sm:w-72"
    />
  )
}

// A value that settles after the user stops typing.
export function useDebounced<T>(value: T, ms = 300): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return settled
}

export function Table({ head, children, empty }: { head: ReactNode[]; children: ReactNode; empty?: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-wf-border bg-white">
      <table className="w-full min-w-[640px] border-collapse text-left text-[13.5px]">
        <thead>
          <tr className="border-b border-wf-border bg-wf-surface-2 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-wf-muted">
            {head.map((h, i) => (
              <th key={i} className="px-4 py-2.5 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-wf-border-faint">{children}</tbody>
      </table>
      {empty}
    </div>
  )
}

export const Td = ({ children, className = "" }: { children: ReactNode; className?: string }) => <td className={`px-4 py-3 align-middle ${className}`}>{children}</td>

export function Pager({ page, perPage, total, onPage }: { page: number; perPage: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / perPage))
  if (pages <= 1) return null
  return (
    <div className="mt-3 flex items-center justify-between text-[13px] text-wf-muted">
      <span>
        Page {page} of {pages} · {fmtNumber(total)} in all
      </span>
      <div className="flex gap-2">
        <Button size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <Button size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  )
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-wf-muted" role="status">
      <Loader2 size={18} className="animate-spin" aria-hidden="true" />
      <span className="text-[14px]">{label}</span>
    </div>
  )
}

export function Notice({ tone = "info", title, children }: { tone?: "info" | "warning" | "error"; title?: string; children: ReactNode }) {
  const tones = { info: "border-[#D9E9FB] bg-[#F2F8FF] text-wf-body", warning: "border-amber-200 bg-amber-50 text-amber-900", error: "border-red-200 bg-red-50 text-red-800" }
  return (
    <div className={`flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-[13.5px] leading-snug ${tones[tone]}`} role={tone === "error" ? "alert" : undefined}>
      <TriangleAlert size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
      <div>
        {title && <p className="font-semibold">{title}</p>}
        <div>{children}</div>
      </div>
    </div>
  )
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3">
      <Notice tone={error instanceof AdminError && error.code === "no_database" ? "info" : "error"}>{errorText(error)}</Notice>
      {onRetry && <Button onClick={onRetry}>Try again</Button>}
    </div>
  )
}

export function NoPermission({ what }: { what: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-wf-border bg-white px-6 py-14 text-center">
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-wf-surface text-wf-muted">
        <Lock size={20} aria-hidden="true" />
      </span>
      <p className="font-display text-[16px] font-semibold text-wf-ink">Your role cannot see {what}</p>
      <p className="mt-1 max-w-sm text-[13.5px] text-wf-muted">Ask an owner or admin of the back office if you need it.</p>
    </div>
  )
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="font-display text-[15px] font-semibold text-wf-ink">{title}</p>
      {children && <p className="mx-auto mt-1 max-w-md text-[13.5px] text-wf-muted">{children}</p>}
    </div>
  )
}

// ---- confirmation --------------------------------------------------------------------------

export interface ConfirmRequest {
  title: string
  body: ReactNode
  confirmLabel: string
  danger?: boolean
  // Ask the person to type this before the button works: for what cannot be undone.
  typeToConfirm?: string
  run: () => Promise<void>
}

export function ConfirmDialog({ request, onClose }: { request: ConfirmRequest | null; onClose: () => void }) {
  const [typed, setTyped] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const [shown, setShown] = useState<ConfirmRequest | null>(null)
  if (request !== shown) {
    setShown(request)
    setTyped("")
    setBusy(false)
    setError(null)
  }
  useEffect(() => {
    if (!request) return
    cancelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [request, busy, onClose])
  if (!request) return null
  const blocked = !!request.typeToConfirm && typed.trim() !== request.typeToConfirm
  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-[#0B1B2E]/40 p-4 sm:items-center" onClick={() => !busy && onClose()}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <h2 id="confirm-title" className="font-display text-[17px] font-semibold text-wf-ink">
            {request.title}
          </h2>
          <button onClick={onClose} disabled={busy} aria-label="Close" className="rounded-full p-1 text-wf-faint hover:bg-wf-surface hover:text-wf-ink">
            <X size={16} />
          </button>
        </div>
        <div className="mt-2 text-[14px] leading-relaxed text-wf-body">{request.body}</div>
        {request.typeToConfirm && (
          <label className="mt-4 block text-[13px] text-wf-muted">
            Type <span className="font-semibold text-wf-ink">{request.typeToConfirm}</span> to confirm
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-wf-border px-3 py-2 text-[14px] text-wf-ink outline-none focus:border-red-500"
              autoComplete="off"
            />
          </label>
        )}
        {error && <p className="mt-3 text-[13px] text-red-700">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button ref={cancelRef} onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            tone={request.danger ? "danger" : "primary"}
            busy={busy}
            disabled={blocked}
            onClick={async () => {
              setBusy(true)
              setError(null)
              try {
                await request.run()
                onClose()
              } catch (err) {
                setError(errorText(err))
                setBusy(false)
              }
            }}
          >
            {request.confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

export function downloadCsv(filename: string, rows: (string | number | null)[][]) {
  const cell = (v: string | number | null) => {
    const s = v == null ? "" : String(v)
    // A leading = + - @ would run as a formula in a spreadsheet.
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
  }
  const blob = new Blob([rows.map((r) => r.map(cell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
