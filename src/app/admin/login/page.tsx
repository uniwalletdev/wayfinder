import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Navigation } from "lucide-react"
import { ActionForm, SubmitButton } from "@/components/admin/forms"
import { BTN_PRIMARY, INPUT, LABEL } from "@/components/admin/ui"
import { loginAction } from "@/lib/admin/actions"
import { adminConfigStatus, getAdmin } from "@/lib/admin/auth"
import Setup from "../(portal)/setup"

// Sign-in sits OUTSIDE the (portal) route group on purpose: the group's layout
// redirects anyone unauthenticated to this page, so a login screen inside it
// would redirect to itself forever.

export const metadata: Metadata = {
  title: "Sign in — Wayfinder back office",
  robots: { index: false, follow: false, nocache: true },
}

export const dynamic = "force-dynamic"

export default async function LoginPage() {
  const config = adminConfigStatus()
  if (!config.configured) return <Setup />

  const admin = await getAdmin()
  if (admin) redirect("/admin")

  return (
    <main className="flex min-h-full items-center justify-center bg-wf-surface px-5 py-16">
      <div className="w-full max-w-[400px]">
        <div className="mb-7 flex items-center justify-center gap-2.5">
          <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-gradient-to-br from-wf-primary to-wf-teal">
            <Navigation size={17} className="text-white" />
          </span>
          <span className="font-display text-xl font-bold text-wf-ink">Wayfinder</span>
        </div>

        <div className="rounded-2xl border border-wf-border bg-white p-6 shadow-[0_1px_2px_rgba(11,27,46,0.04)]">
          <h1 className="font-display text-[20px] font-bold text-wf-ink">Back office</h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-wf-muted">
            For the people who run Wayfinder. Navigating the app never needs an account — this does.
          </p>

          {config.passwordLogin ? (
            <ActionForm action={loginAction} className="mt-6">
              <label className={LABEL} htmlFor="password">
                Back-office password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                autoFocus
                className={INPUT}
                placeholder="••••••••••••"
              />
              <SubmitButton className={`${BTN_PRIMARY} mt-4 w-full`} pendingLabel="Checking…">
                Sign in
              </SubmitButton>
            </ActionForm>
          ) : null}

          {config.clerkAdmins ? (
            <div className={config.passwordLogin ? "mt-6 border-t border-wf-border-faint pt-5" : "mt-6"}>
              <p className="text-[13px] leading-relaxed text-wf-muted">
                {config.passwordLogin ? "Or sign in with your account. " : ""}
                Administrators sign in with the same account they use everywhere else, then come back here.
              </p>
              <Link href="/navigate" className="mt-3 inline-block text-[13px] font-semibold text-wf-primary">
                Sign in through the app →
              </Link>
            </div>
          ) : null}
        </div>

        <p className="mt-5 text-center text-[12px] leading-relaxed text-wf-faint">
          Sign-in attempts are rate limited, and every action taken in here is recorded against whoever took it.
        </p>
      </div>
    </main>
  )
}
