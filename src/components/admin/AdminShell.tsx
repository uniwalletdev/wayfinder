"use client"
// The back office frame: the sections a role may open, who is signed in, and
// the page. Narrow screens get the sections as a row of tabs under the brand.
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { createContext, useContext, useState, type ReactNode } from "react"
import { UserButton } from "@clerk/nextjs"
import { LayoutDashboard, Earth, Building2, Inbox, SearchX, Activity, Users, ScrollText, Server, Navigation, ExternalLink, LogOut, CreditCard } from "lucide-react"
import ToastHost from "@/components/Toast"
import { Badge } from "./ui"
import { ROLE_LABELS, type Permission, type Role } from "@/lib/backoffice/roles"

export interface ClientStaff {
  userId: string
  email: string | null
  name: string
  imageUrl: string | null
  role: Role
  fixedOwner: boolean
  via: "clerk" | "password" | "dev"
  permissions: Permission[]
}

const StaffContext = createContext<ClientStaff | null>(null)

export function useStaff(): ClientStaff & { can: (p: Permission) => boolean } {
  const staff = useContext(StaffContext)
  if (!staff) throw new Error("useStaff outside the back office")
  return { ...staff, can: (p: Permission) => staff.permissions.includes(p) }
}

export const SECTIONS: { href: string; label: string; icon: typeof LayoutDashboard; permission: Permission }[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, permission: "overview.view" },
  { href: "/admin/coverage", label: "Coverage", icon: Earth, permission: "coverage.view" },
  { href: "/admin/venues", label: "Venues", icon: Building2, permission: "venues.view" },
  { href: "/admin/inbox", label: "Inbox", icon: Inbox, permission: "inbox.view" },
  { href: "/admin/searches", label: "Searches", icon: SearchX, permission: "searches.view" },
  { href: "/admin/activity", label: "Activity", icon: Activity, permission: "activity.view" },
  { href: "/admin/customers", label: "Customers", icon: CreditCard, permission: "customers.view" },
  { href: "/admin/users", label: "Users & roles", icon: Users, permission: "users.view" },
  { href: "/admin/audit", label: "Audit log", icon: ScrollText, permission: "audit.view" },
  { href: "/admin/system", label: "System", icon: Server, permission: "system.view" },
]

const ROLE_TONE: Record<Role, "primary" | "teal" | "green" | "neutral"> = { owner: "primary", admin: "teal", editor: "green", viewer: "neutral" }

function Brand() {
  return (
    <Link href="/admin" className="flex items-center gap-2.5">
      <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[10px] bg-gradient-to-br from-wf-primary to-wf-teal">
        <Navigation size={15} className="text-white" aria-hidden="true" />
      </span>
      <span className="leading-tight">
        <span className="block font-display text-[16px] font-bold text-wf-ink">Findway</span>
        <span className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-wf-muted">Back office</span>
      </span>
    </Link>
  )
}

// Signing out of a password session: the server deletes its cookie, then the
// layout is drawn again and shows the sign-in form.
function PasswordSignOut() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        try {
          await fetch("/api/admin/session", { method: "DELETE" })
        } finally {
          router.refresh()
        }
      }}
      aria-label="Sign out"
      title="Sign out"
      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-wf-muted hover:bg-wf-surface hover:text-wf-primary disabled:opacity-50"
    >
      <LogOut size={16} aria-hidden="true" />
    </button>
  )
}

function Who({ staff }: { staff: ClientStaff }) {
  const initials = (staff.via === "password" ? (staff.email ?? staff.name).slice(0, 2) : staff.name.split(/\s+/).map((s) => s[0]).join("").slice(0, 2)).toUpperCase()
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {staff.via === "clerk" ? (
        <UserButton />
      ) : (
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-wf-surface text-[12px] font-semibold text-wf-muted">{initials}</span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-wf-ink">{staff.name}</p>
        <p className="flex items-center gap-1.5 truncate text-[11.5px] text-wf-muted">
          <Badge tone={ROLE_TONE[staff.role]}>{ROLE_LABELS[staff.role]}</Badge>
          {staff.via === "dev" && <span>development</span>}
        </p>
      </div>
      {staff.via === "password" && <PasswordSignOut />}
    </div>
  )
}

export default function AdminShell({ staff, children }: { staff: ClientStaff; children: ReactNode }) {
  const pathname = usePathname()
  const sections = SECTIONS.filter((s) => staff.permissions.includes(s.permission))
  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`))
  return (
    <StaffContext.Provider value={staff}>
      <ToastHost />
      {/* Scrolls itself, like the reading pages: a page that relied on body
          scrolling froze in the iOS app. */}
      <div className="flex h-dvh flex-col bg-wf-surface-2 lg:flex-row">
        <aside className="hidden w-[248px] flex-shrink-0 flex-col border-r border-wf-border bg-white lg:flex">
          <div className="px-5 pb-4 pt-5">
            <Brand />
          </div>
          <nav className="flex-1 overflow-y-auto px-3" aria-label="Back office sections">
            {sections.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                aria-current={isActive(href) ? "page" : undefined}
                className={`mb-0.5 flex items-center gap-2.5 rounded-xl px-3 py-2 text-[14px] font-medium transition-colors ${
                  isActive(href) ? "bg-[#EEF5FD] text-wf-primary" : "text-wf-body hover:bg-wf-surface"
                }`}
              >
                <Icon size={17} aria-hidden="true" />
                {label}
              </Link>
            ))}
          </nav>
          <div className="border-t border-wf-border-faint px-4 py-3">
            <Link href="/navigate" className="mb-3 flex items-center gap-2 text-[13px] font-medium text-wf-muted hover:text-wf-primary">
              <ExternalLink size={14} aria-hidden="true" /> Open the map
            </Link>
            <Who staff={staff} />
          </div>
        </aside>

        <header className="flex-shrink-0 border-b border-wf-border bg-white lg:hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <Brand />
            <Who staff={staff} />
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-2" aria-label="Back office sections">
            {sections.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                aria-current={isActive(href) ? "page" : undefined}
                className={`flex-shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-medium ${
                  isActive(href) ? "bg-wf-primary text-white" : "bg-wf-surface text-wf-body"
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>
        </header>

        <main className="min-w-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-auto max-w-[1180px] px-4 pb-20 pt-6 sm:px-8 lg:pt-8">{children}</div>
        </main>
      </div>
    </StaffContext.Provider>
  )
}
