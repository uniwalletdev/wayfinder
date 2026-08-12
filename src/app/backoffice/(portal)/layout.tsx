import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { LogOut } from "lucide-react"
import AdminShell from "@/components/backoffice/AdminShell"
import { SubmitButton } from "@/components/backoffice/forms"
import { adminConfigStatus, getAdmin } from "@/lib/backoffice/auth"
import { logoutAction } from "@/lib/backoffice/actions"
import Setup from "./setup"

// The gate, and the frame.
//
// Three states, decided here so no individual screen has to think about them:
//
//   • Nothing configured  → setup instructions. The portal cannot authorise
//     anyone, and says how to change that. It never falls open.
//   • Configured, nobody signed in → bounced to /backoffice/login.
//   • Signed in → the shell, with the operator's identity in the corner.
//
// The layout runs for every /backoffice route, including ones added later, so the
// check cannot be forgotten on a new page. It is not the only check: each Server
// Action re-authorises independently, because an action is a POST endpoint that
// never passes through this file.

export const metadata: Metadata = {
  title: "Wayfinder back office",
  // Belt and braces alongside the auth gate: nothing here should ever be
  // indexed, cached by an intermediary, or previewed in a link unfurl.
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
}

// Every screen reads cookies and live database state. None of it may be cached
// or prerendered — a moderation queue served from a build-time snapshot would be
// worse than no queue at all.
export const dynamic = "force-dynamic"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const config = adminConfigStatus()
  if (!config.configured) return <Setup />

  const admin = await getAdmin()
  if (!admin) redirect("/backoffice/login")

  return (
    <AdminShell
      actor={admin.actor}
      via={admin.via}
      signOut={
        <form action={logoutAction}>
          <SubmitButton
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            pendingLabel="Signing out…"
          >
            <LogOut size={15} aria-hidden />
            Sign out
          </SubmitButton>
        </form>
      }
    >
      {children}
    </AdminShell>
  )
}
