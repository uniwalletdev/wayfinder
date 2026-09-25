"use client"

import { useEffect } from "react"
import Link from "next/link"
import { Navigation, RefreshCw } from "lucide-react"

// The route-level error boundary. Before this existed a crash anywhere under
// the map — a bad venue record, a sensor API that threw — showed Next's bare
// default, with nothing telling someone in a corridor how to get going again.
// Retry re-renders the segment; the link is a full reload of the map, which
// also clears any state the crash was in.
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-wf-surface-2 px-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-wf-primary to-wf-teal">
        <Navigation size={26} className="text-white" aria-hidden="true" />
      </span>
      <h1 className="mt-6 font-display text-[28px] font-bold -tracking-[0.5px] text-wf-ink">Something went wrong</h1>
      <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-wf-muted">
        The map hit a problem it couldn’t recover from. Your saved places are safe on this device.
        {error.digest ? ` (Reference ${error.digest})` : ""}
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button
          onClick={() => unstable_retry()}
          className="flex items-center justify-center gap-2 rounded-2xl bg-wf-primary px-6 py-3.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(10,93,194,0.3)]"
        >
          <RefreshCw size={16} aria-hidden="true" />
          Try again
        </button>
        <Link
          href="/navigate"
          className="flex items-center justify-center gap-2 rounded-2xl border border-wf-border bg-white px-6 py-3.5 text-sm font-semibold text-wf-ink"
        >
          Open the map afresh
        </Link>
      </div>
    </main>
  )
}
