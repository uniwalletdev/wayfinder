import Link from "next/link"
import { Navigation, Search } from "lucide-react"

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-wf-surface-2 px-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-wf-primary to-wf-teal">
        <Navigation size={26} className="text-white" aria-hidden="true" />
      </span>
      <p className="mt-6 text-xs font-semibold uppercase tracking-[0.1em] text-wf-primary">Page not found</p>
      <h1 className="mt-2 font-display text-[28px] font-bold -tracking-[0.5px] text-wf-ink">That page isn’t on the map</h1>
      <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-wf-muted">
        The link may be old or mistyped. The map is still here — search for the ward or clinic you need.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/navigate"
          className="flex items-center justify-center gap-2 rounded-2xl bg-wf-primary px-6 py-3.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(10,93,194,0.3)]"
        >
          <Search size={16} aria-hidden="true" />
          Find a ward or clinic
        </Link>
        <Link href="/" className="flex items-center justify-center rounded-2xl border border-wf-border bg-white px-6 py-3.5 text-sm font-semibold text-wf-ink">
          Back to home
        </Link>
      </div>
    </main>
  )
}
