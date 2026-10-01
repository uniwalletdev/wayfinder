import Link from "next/link"
import { Navigation, ArrowLeft } from "lucide-react"
import type { ReactNode } from "react"

// Shared frame for the reading pages (accessibility statement, privacy
// summary): the brand row, a title block, and a measure of prose that matches
// the landing page's type and colour.
export default function InfoPage({
  eyebrow,
  title,
  lead,
  updated,
  children,
}: {
  eyebrow: string
  title: string
  lead: string
  updated?: string
  children: ReactNode
}) {
  return (
    <main className="min-h-dvh bg-white">
      <nav className="flex items-center justify-between gap-4 border-b border-wf-border-faint px-6 py-5 sm:px-10 lg:px-16 xl:px-24">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Findway home">
          <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[10px] bg-gradient-to-br from-wf-primary to-wf-teal">
            <Navigation size={15} className="text-white" aria-hidden="true" />
          </span>
          <span className="font-display text-lg font-bold text-wf-ink">Findway</span>
        </Link>
        <Link
          href="/navigate"
          className="flex items-center gap-2 rounded-full bg-wf-primary px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(10,93,194,0.3)]"
        >
          Open the map
        </Link>
      </nav>

      <article className="mx-auto max-w-[720px] px-6 pb-24 pt-12 sm:px-10">
        <Link href="/" className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-wf-muted hover:text-wf-primary">
          <ArrowLeft size={14} aria-hidden="true" /> Home
        </Link>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.1em] text-wf-primary">{eyebrow}</p>
        <h1 className="mt-2 font-display text-[34px] font-bold leading-[1.1] -tracking-[0.8px] text-wf-ink sm:text-[40px]">{title}</h1>
        <p className="mt-4 text-[17px] leading-relaxed text-wf-muted">{lead}</p>
        {updated && <p className="mt-3 text-[13px] text-wf-faint">Last updated {updated}</p>}
        <div className="wf-prose mt-10">{children}</div>
      </article>

      <footer className="flex flex-col items-center justify-between gap-4 border-t border-wf-border-faint px-6 py-7 text-[13.5px] text-wf-muted sm:flex-row sm:px-10 lg:px-16 xl:px-24">
        <span>© 2026 Findway</span>
        <div className="flex items-center gap-6">
          <Link href="/privacy" className="hover:text-wf-primary">Privacy</Link>
          <Link href="/accessibility" className="hover:text-wf-primary">Accessibility</Link>
        </div>
      </footer>
    </main>
  )
}
