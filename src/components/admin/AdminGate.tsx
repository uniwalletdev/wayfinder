"use client"
// What the back office shows to anyone who is not (yet) staff: sign in, no
// access, or — on a deployment without accounts — what to set up.
import Link from "next/link"
import { usePathname } from "next/navigation"
import { SignInButton, SignOutButton } from "@clerk/nextjs"
import { Navigation, KeyRound, ShieldAlert, Lock } from "lucide-react"
import type { ReactNode } from "react"

type GateState =
  | { kind: "signed-out" }
  | { kind: "no-access"; email: string | null; ownersConfigured: boolean }
  | { kind: "unconfigured"; missing: string[] }

function Frame({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <main className="flex h-dvh items-center justify-center overflow-y-auto bg-wf-surface-2 px-4 py-10">
      <div className="w-full max-w-[460px] rounded-3xl border border-wf-border bg-white p-7 shadow-[0_20px_50px_rgba(11,27,46,0.08)]">
        <Link href="/" className="mb-6 flex items-center gap-2.5">
          <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[10px] bg-gradient-to-br from-wf-primary to-wf-teal">
            <Navigation size={15} className="text-white" aria-hidden="true" />
          </span>
          <span className="font-display text-lg font-bold text-wf-ink">Findway</span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-wf-muted">Back office</span>
        </Link>
        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EEF5FD] text-wf-primary">{icon}</span>
        <h1 className="font-display text-[24px] font-bold leading-tight text-wf-ink">{title}</h1>
        <div className="mt-2 text-[14.5px] leading-relaxed text-wf-muted">{children}</div>
      </div>
    </main>
  )
}

export default function AdminGate({ state }: { state: GateState }) {
  const pathname = usePathname()
  if (state.kind === "signed-out") {
    return (
      <Frame icon={<Lock size={22} aria-hidden="true" />} title="Sign in to the back office">
        <p>The back office manages Findway: its venues, coverage, users and data. It is for the people who run Findway.</p>
        <SignInButton mode="modal" forceRedirectUrl={pathname} signUpForceRedirectUrl={pathname}>
          <button className="mt-6 w-full rounded-xl bg-wf-primary py-3 text-[15px] font-semibold text-white shadow-[0_8px_20px_rgba(10,93,194,0.3)] hover:bg-wf-primary-deep">
            Sign in
          </button>
        </SignInButton>
        <Link href="/navigate" className="mt-4 block text-center text-[13.5px] font-medium text-wf-muted hover:text-wf-primary">
          Looking for a ward? Open the map — no sign-in needed
        </Link>
      </Frame>
    )
  }
  if (state.kind === "no-access") {
    return (
      <Frame icon={<ShieldAlert size={22} aria-hidden="true" />} title="No back office access">
        <p>
          You are signed in{state.email ? <> as <span className="font-semibold text-wf-ink">{state.email}</span></> : null}, but this account has no back office role.
          Ask an owner or admin to give you one.
        </p>
        {!state.ownersConfigured && (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2.5 text-[13px] text-amber-900">
            If you run this deployment: add your email address to the <code className="font-mono">ADMIN_EMAILS</code> environment variable and redeploy. That makes you an owner.
          </p>
        )}
        <div className="mt-6 flex gap-2">
          <SignOutButton redirectUrl={pathname}>
            <button className="flex-1 rounded-xl border border-wf-border py-2.5 text-[14px] font-semibold text-wf-body hover:border-wf-primary hover:text-wf-primary">Sign out</button>
          </SignOutButton>
          <Link href="/navigate" className="flex flex-1 items-center justify-center rounded-xl bg-wf-primary py-2.5 text-[14px] font-semibold text-white">
            Open the map
          </Link>
        </div>
      </Frame>
    )
  }
  return (
    <Frame icon={<KeyRound size={22} aria-hidden="true" />} title="Set up back office sign-in">
      <p>The back office needs accounts, so only the people who run Findway can open it. This deployment has none yet.</p>
      <ol className="mt-4 list-decimal space-y-2 pl-5 text-[14px] text-wf-body">
        <li>
          Create a free application at <span className="font-semibold">dashboard.clerk.com</span> and copy its two API keys.
        </li>
        <li>
          In the hosting project&apos;s environment variables, add{" "}
          {state.missing.map((m, i) => (
            <span key={m}>
              {i > 0 && " and "}
              <code className="font-mono text-[12.5px]">{m}</code>
            </span>
          ))}
          , plus <code className="font-mono text-[12.5px]">ADMIN_EMAILS</code> with your email address.
        </li>
        <li>Redeploy, come back here and sign in with that email. You will be the owner.</li>
      </ol>
      <p className="mt-4 text-[13px] text-wf-faint">Keys go in the host&apos;s settings only — never in code or chat. docs/backoffice.md has the details.</p>
    </Frame>
  )
}
