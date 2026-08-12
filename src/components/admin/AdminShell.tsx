"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, type ReactNode } from "react"
import {
  Activity,
  Building2,
  LayoutDashboard,
  Map,
  Menu,
  Navigation,
  ScrollText,
  Search,
  Settings,
  ShieldCheck,
  X,
} from "lucide-react"

// The frame every back-office screen sits in.
//
// A dark rail against the light workspace, matching the app's own hero — an
// operator moving between the portal and the map should recognise the same
// product. The rail is a full column on desktop and a sheet on mobile, because
// "the estates lead checks the queue on a phone between wards" is a real way
// this gets used.

const SECTIONS: { heading: string; items: { href: string; label: string; Icon: typeof Activity }[] }[] = [
  {
    heading: "Overview",
    items: [{ href: "/admin", label: "Dashboard", Icon: LayoutDashboard }],
  },
  {
    heading: "The map",
    items: [
      { href: "/admin/venues", label: "Shared venues", Icon: Building2 },
      { href: "/admin/catalog", label: "Venue catalogue", Icon: Map },
    ],
  },
  {
    heading: "What people do",
    items: [
      { href: "/admin/demand", label: "Unmet searches", Icon: Search },
      { href: "/admin/activity", label: "Navigation activity", Icon: Activity },
    ],
  },
  {
    heading: "Governance",
    items: [
      { href: "/admin/privacy", label: "Data & retention", Icon: ShieldCheck },
      { href: "/admin/audit", label: "Audit log", Icon: ScrollText },
      { href: "/admin/settings", label: "Settings & health", Icon: Settings },
    ],
  },
]

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin"
  return pathname === href || pathname.startsWith(`${href}/`)
}

function Rail({ pathname, onNavigate, signOut }: { pathname: string; onNavigate?: () => void; signOut: ReactNode }) {
  return (
    <div className="flex h-full flex-col bg-wf-ink-hero">
      <div className="flex items-center gap-2.5 px-5 pt-6 pb-5">
        <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-gradient-to-br from-wf-primary to-wf-teal">
          <Navigation size={17} className="text-white" />
        </span>
        <div className="min-w-0">
          <p className="font-display text-[15px] font-bold leading-tight text-white">Wayfinder</p>
          <p className="text-[11.5px] leading-tight text-white/55">Back office</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {SECTIONS.map((section) => (
          <div key={section.heading} className="mb-5">
            <p className="px-3 pb-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-white/35">
              {section.heading}
            </p>
            <ul className="flex flex-col gap-0.5">
              {section.items.map(({ href, label, Icon }) => {
                const active = isActive(pathname, href)
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13.5px] transition-colors ${
                        active ? "bg-white/15 font-semibold text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <Icon size={16} className="flex-shrink-0" aria-hidden />
                      {label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 px-3 py-4">
        <Link
          href="/navigate"
          className="mb-1 flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <Navigation size={15} aria-hidden />
          Open the app
        </Link>
        {signOut}
      </div>
    </div>
  )
}

export default function AdminShell({
  children,
  actor,
  via,
  signOut,
}: {
  children: ReactNode
  actor: string
  via: "clerk" | "password"
  signOut: ReactNode
}) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="min-h-full bg-wf-surface">
      {/* Desktop rail */}
      <aside className="fixed inset-y-0 left-0 hidden w-[248px] lg:block">
        <Rail pathname={pathname} signOut={signOut} />
      </aside>

      {/* Mobile sheet */}
      {menuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-wf-ink/50"
            onClick={() => setMenuOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-[264px] shadow-2xl">
            <Rail pathname={pathname} onNavigate={() => setMenuOpen(false)} signOut={signOut} />
          </aside>
        </div>
      ) : null}

      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-wf-border bg-white/92 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-wf-border text-wf-body lg:hidden"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
          >
            {menuOpen ? <X size={17} /> : <Menu size={17} />}
          </button>
          <p className="hidden text-[12.5px] text-wf-muted lg:block">
            Managing the pooled data behind Wayfinder — shared venues, the places inside them, and what people looked for.
          </p>
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="min-w-0 text-right">
              <p className="truncate text-[12.5px] font-semibold text-wf-ink">{actor}</p>
              <p className="text-[11px] text-wf-faint">{via === "clerk" ? "Signed in with an account" : "Shared password"}</p>
            </div>
            <span
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-wf-surface text-[12px] font-semibold uppercase text-wf-muted"
              aria-hidden
            >
              {actor.slice(0, 1)}
            </span>
          </div>
        </header>

        <main className="px-4 py-7 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  )
}
