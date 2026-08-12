import { KeyRound, Lock, Navigation, ShieldCheck } from "lucide-react"

// What /backoffice looks like before anyone has been given the keys.
//
// This screen exists because the alternative — a portal that quietly works with
// no configuration — would mean any deployment of this app shipped an open door
// to every venue, trail and delete button in the database. So the unconfigured
// state is not a broken state, it is a documented one, and this page is the
// documentation: it names the two variables, says which to choose, and gives no
// hint about the database it is not connected to.

const shell = "rounded-2xl border border-wf-border bg-white p-6"

export default function Setup() {
  return (
    <main className="flex min-h-full items-center justify-center bg-wf-surface px-5 py-16">
      <div className="w-full max-w-2xl">
        <div className="mb-7 flex items-center gap-2.5">
          <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-gradient-to-br from-wf-primary to-wf-teal">
            <Navigation size={17} className="text-white" />
          </span>
          <span className="font-display text-xl font-bold text-wf-ink">Wayfinder</span>
        </div>

        <h1 className="font-display text-[30px] font-bold -tracking-[0.8px] text-wf-ink">The back office is closed</h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-wf-muted">
          Nobody can sign in until this deployment has been given a way to recognise an administrator. Set{" "}
          <em>one</em> of the following and restart the app.
        </p>

        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          <section className={shell}>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E7F2FF]">
              <ShieldCheck size={17} className="text-wf-primary" aria-hidden />
            </span>
            <h2 className="mt-3.5 font-display text-[15px] font-semibold text-wf-ink">Accounts (preferred)</h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-wf-muted">
              With Clerk already configured, list the people who may administer the app.
            </p>
            <code className="mt-3 block rounded-xl bg-wf-surface px-3 py-2.5 text-[12px] break-all text-wf-ink">
              ADMIN_EMAILS=you@trust.nhs.uk,ops@trust.nhs.uk
            </code>
            <p className="mt-2.5 text-[12px] leading-relaxed text-wf-faint">
              Each action is then recorded against a named person rather than a shared secret, and sign-in inherits
              whatever the organisation already enforces.
            </p>
          </section>

          <section className={shell}>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-wf-teal-tint">
              <KeyRound size={17} className="text-wf-teal-text" aria-hidden />
            </span>
            <h2 className="mt-3.5 font-display text-[15px] font-semibold text-wf-ink">A shared password</h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-wf-muted">
              For deployments running without accounts, or to get the first operator in today.
            </p>
            <code className="mt-3 block rounded-xl bg-wf-surface px-3 py-2.5 text-[12px] break-all text-wf-ink">
              ADMIN_PASSWORD=a-long-random-passphrase
            </code>
            <p className="mt-2.5 text-[12px] leading-relaxed text-wf-faint">
              Optionally set <span className="font-semibold">ADMIN_SESSION_SECRET</span> too, so sessions survive a
              password change instead of all ending with it.
            </p>
          </section>
        </div>

        <div className="mt-5 flex gap-3 rounded-2xl border border-wf-border bg-white p-4">
          <Lock size={16} className="mt-0.5 flex-shrink-0 text-wf-faint" aria-hidden />
          <p className="text-[12.5px] leading-relaxed text-wf-muted">
            This screen is what an unauthenticated visitor sees, and it is all they see: the portal reads nothing from
            the database until somebody is signed in.
          </p>
        </div>
      </div>
    </main>
  )
}
