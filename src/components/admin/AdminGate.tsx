"use client"
// What the back office shows to anyone who is not (yet) staff: sign in, no
// access, or — on a deployment with no way in yet — what to set up.
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { SignInButton, SignOutButton } from "@clerk/nextjs"
import { Navigation, KeyRound, ShieldAlert, Lock, Loader2 } from "lucide-react"
import { useState, type ReactNode } from "react"

type GateState =
  | { kind: "signed-out"; password: boolean; clerk: boolean }
  | { kind: "no-access"; email: string | null; ownersConfigured: boolean }
  | { kind: "unconfigured"; missing: string[]; passwordProblem: "missing_email" | "missing_password" | "bad_email" | "short_password" | null }

// Why BACKOFFICE_EMAIL and BACKOFFICE_PASSWORD, though set, do not let anyone
// in yet.
const PASSWORD_PROBLEMS: Record<NonNullable<Extract<GateState, { kind: "unconfigured" }>["passwordProblem"]>, string> = {
  missing_email: "BACKOFFICE_PASSWORD is set but BACKOFFICE_EMAIL is not.",
  missing_password: "BACKOFFICE_EMAIL is set but BACKOFFICE_PASSWORD is not.",
  bad_email: "BACKOFFICE_EMAIL is not an email address.",
  short_password: "BACKOFFICE_PASSWORD is shorter than 12 characters. Choose a longer one.",
}

const inputClass =
  "mt-1.5 w-full rounded-xl border border-wf-border bg-white px-3.5 py-3 text-[15px] text-wf-ink outline-none placeholder:text-wf-faint focus:border-wf-primary focus:ring-2 focus:ring-wf-primary/15"

// The owner's email and password from the host's environment.
function PasswordSignIn() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <form
      className="mt-6"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        setError(null)
        try {
          const res = await fetch("/api/admin/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
          })
          if (res.ok) {
            // Draw the layout again: the server now sees the session cookie.
            router.refresh()
            return
          }
          setError(
            res.status === 401
              ? "That email and password don’t match."
              : res.status === 429
                ? "Too many attempts. Wait 15 minutes and try again."
                : "Couldn’t sign in just now. Try again in a moment."
          )
        } catch {
          setError("Couldn’t reach the server. Check your connection and try again.")
        }
        setBusy(false)
      }}
    >
      <label className="block text-[13px] font-semibold text-wf-ink">
        Email
        <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
      </label>
      <label className="mt-3 block text-[13px] font-semibold text-wf-ink">
        Password
        <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
      </label>
      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2.5 text-[13px] text-red-800">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-wf-primary py-3 text-[15px] font-semibold text-white shadow-[0_8px_20px_rgba(10,93,194,0.3)] hover:bg-wf-primary-deep disabled:opacity-70"
      >
        {busy && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
        Sign in
      </button>
    </form>
  )
}

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
        {state.password && <PasswordSignIn />}
        {state.password && state.clerk && (
          <p className="mt-5 flex items-center gap-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-wf-faint">
            <span className="h-px flex-1 bg-wf-border" />
            or
            <span className="h-px flex-1 bg-wf-border" />
          </p>
        )}
        {state.clerk && (
          <SignInButton mode="modal" forceRedirectUrl={pathname} signUpForceRedirectUrl={pathname}>
            <button
              className={
                state.password
                  ? "mt-5 w-full rounded-xl border border-wf-border py-3 text-[15px] font-semibold text-wf-body hover:border-wf-primary hover:text-wf-primary"
                  : "mt-6 w-full rounded-xl bg-wf-primary py-3 text-[15px] font-semibold text-white shadow-[0_8px_20px_rgba(10,93,194,0.3)] hover:bg-wf-primary-deep"
              }
            >
              {state.password ? "Sign in with a staff account" : "Sign in"}
            </button>
          </SignInButton>
        )}
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
      <p>Only the people who run Findway can open the back office, so it needs a way to sign in. This deployment has none yet.</p>
      {state.passwordProblem && (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2.5 text-[13px] text-amber-900">{PASSWORD_PROBLEMS[state.passwordProblem]}</p>
      )}
      <ol className="mt-4 list-decimal space-y-2 pl-5 text-[14px] text-wf-body">
        <li>
          In the hosting project&apos;s environment variables, add <code className="font-mono text-[12.5px]">BACKOFFICE_EMAIL</code> with your email address and{" "}
          <code className="font-mono text-[12.5px]">BACKOFFICE_PASSWORD</code> with a password of at least 12 characters.
        </li>
        <li>Redeploy, come back here and sign in with them. You will be the owner.</li>
      </ol>
      <p className="mt-4 text-[13px] text-wf-muted">
        To give other people their own accounts and roles, add Clerk later:{" "}
        {state.missing.map((m, i) => (
          <span key={m}>
            {i > 0 && " and "}
            <code className="font-mono text-[12px]">{m}</code>
          </span>
        ))}{" "}
        from <span className="font-semibold">dashboard.clerk.com</span>.
      </p>
      <p className="mt-4 text-[13px] text-wf-faint">Passwords and keys go in the host&apos;s settings only — never in code or chat. docs/backoffice.md has the details.</p>
    </Frame>
  )
}
