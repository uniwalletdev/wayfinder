import { Check, Minus } from "lucide-react"
import { Badge, Card, Notice, PageHeader, StatTile, TABLE, TABLE_SCROLL, TD, TH, formatNumber } from "@/components/backoffice/ui"
import { adminConfigStatus } from "@/lib/backoffice/auth"
import { getDbHealth } from "@/lib/backoffice/data"
import { moderationMode } from "@/lib/backoffice/moderation"
import { LIMITS } from "@/lib/rate-limit"

// How this deployment is put together, and whether the parts are answering.
//
// Every integration in Wayfinder is optional and fails soft — no Mapbox key
// means no outdoor routing, no database means device-only mode — which is a good
// property and a confusing one: a feature that is "quietly off" looks identical
// to a feature that is broken. This page is the difference. It reports whether
// each variable is SET, never what it is set to; a portal that prints secrets is
// a portal that leaks them into screenshots.

export const dynamic = "force-dynamic"

interface Integration {
  name: string
  env: string[]
  configured: boolean
  effect: string
}

export default async function SettingsPage() {
  const config = adminConfigStatus()
  const health = await getDbHealth()
  const mode = moderationMode()

  const isSet = (name: string) => !!(process.env[name] ?? "").trim()

  const integrations: Integration[] = [
    {
      name: "Shared database",
      env: ["DATABASE_URL", "DATABASE_PUBLIC_URL"],
      configured: isSet("DATABASE_URL") || isSet("DATABASE_PUBLIC_URL"),
      effect: "Shared venues, pooled trails and recorded searches. Without it the app runs device-only.",
    },
    {
      name: "Outdoor routing & search",
      env: ["MAPBOX_ACCESS_TOKEN"],
      configured: isSet("MAPBOX_ACCESS_TOKEN"),
      effect: "Real street routing to the front door, and place search. Without it, straight-line guidance only.",
    },
    {
      name: "AI sign reading",
      env: ["ANTHROPIC_API_KEY"],
      configured: isSet("ANTHROPIC_API_KEY"),
      effect: "Survey Mode reads signage from camera frames, and uploaded floor plans are parsed into rooms.",
    },
    {
      name: "Accounts",
      env: ["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY"],
      configured: isSet("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY") && isSet("CLERK_SECRET_KEY"),
      effect: "Optional sign-in for saved places. Navigation never requires it, and /navigate stays off the auth path.",
    },
  ]

  return (
    <>
      <PageHeader
        title="Settings & health"
        description="What this deployment has been given, and whether it is answering. Values are never shown — only whether they are set."
      />

      <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Database"
          value={!health.configured ? "Not set up" : health.reachable ? "Reachable" : "Unreachable"}
          tone={!health.configured ? "neutral" : health.reachable ? "good" : "bad"}
          hint={
            !health.configured
              ? "Nothing to connect to — the app is running device-only"
              : health.reachable
                ? `Answered in ${health.latencyMs} ms`
                : "The connection was refused or timed out"
          }
        />
        <StatTile
          label="Back-office access"
          value={config.clerkAdmins && config.passwordLogin ? "Accounts + password" : config.clerkAdmins ? "Accounts" : "Shared password"}
          tone="good"
          hint={config.clerkAdmins ? `${formatNumber(config.allowlistSize)} email(s) allowlisted` : "One shared secret"}
        />
        <StatTile
          label="New venues"
          value={mode === "queue" ? "Held for review" : "Listed at once"}
          tone={mode === "queue" ? "good" : "warn"}
          hint={mode === "queue" ? "Nothing reaches the picker unreviewed" : "Set WAYFINDER_VENUE_MODERATION=queue to review first"}
        />
        <StatTile label="Environment" value={process.env.NODE_ENV ?? "unknown"} hint={`Node ${process.version}`} />
      </section>

      <section className="mb-6 grid items-start gap-5 lg:grid-cols-2">
        <Card title="Integrations" description="Each one is optional; the app degrades rather than erroring." bodyClassName="">
          <ul className="divide-y divide-wf-border-faint">
            {integrations.map((i) => (
              <li key={i.name} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-semibold text-wf-ink">{i.name}</p>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-wf-muted">{i.effect}</p>
                    <p className="mt-1.5 flex flex-wrap gap-1.5">
                      {i.env.map((name) => (
                        <code key={name} className="rounded bg-wf-surface px-1.5 py-0.5 text-[11px] text-wf-body">
                          {name}
                        </code>
                      ))}
                    </p>
                  </div>
                  <Badge tone={i.configured ? "good" : "neutral"}>
                    {i.configured ? <Check size={12} aria-hidden /> : <Minus size={12} aria-hidden />}
                    {i.configured ? "Set" : "Not set"}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <div className="flex flex-col gap-5">
          <Card title="Database" description="The pool behind everything on the other screens.">
            {!health.configured ? (
              <Notice tone="info" title="Running device-only">
                <p>
                  No <code>DATABASE_URL</code> is set, so nothing is pooled: venues people map stay on their phone, and
                  the app makes no database calls at all. Everything else here still works.
                </p>
              </Notice>
            ) : !health.reachable ? (
              <Notice tone="bad" title="Configured, but not answering">
                <p className="break-words">{health.error ?? "The connection failed."}</p>
              </Notice>
            ) : (
              <>
                <p className="text-[12.5px] text-wf-muted">{health.version}</p>
                <div className={`${TABLE_SCROLL} mt-3.5`}>
                  <table className={TABLE}>
                    <thead>
                      <tr>
                        <th className={TH}>Table</th>
                        <th className={`${TH} text-right`}>Rows</th>
                        <th className={`${TH} text-right`}>State</th>
                      </tr>
                    </thead>
                    <tbody>
                      {health.tables.map((t) => (
                        <tr key={t.table}>
                          <td className={`${TD} font-mono text-[12px]`}>{t.table}</td>
                          <td className={`${TD} text-right tabular-nums`}>{t.present ? formatNumber(t.rows) : "—"}</td>
                          <td className={`${TD} text-right`}>
                            <Badge tone={t.present ? "good" : "bad"}>{t.present ? "Ready" : "Missing"}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3.5 text-[12px] leading-relaxed text-wf-faint">
                  The schema is applied automatically on first use and mirrored in <code>db/migrations/</code>. A
                  missing table means the app could not create it — check the connection string’s permissions.
                </p>
              </>
            )}
          </Card>

          <Card title="Cost ceilings" description="Per-caller limits on the endpoints that spend money or CPU.">
            <div className={TABLE_SCROLL}>
              <table className={TABLE}>
                <thead>
                  <tr>
                    <th className={TH}>Endpoint</th>
                    <th className={`${TH} text-right`}>Allowance</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(LIMITS).map(([name, limit]) => (
                    <tr key={name}>
                      <td className={`${TD} font-mono text-[12px]`}>{name}</td>
                      <td className={`${TD} text-right tabular-nums`}>
                        {limit.limit} / {humaniseWindow(limit.windowMs)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3.5 text-[12px] leading-relaxed text-wf-faint">
              In-memory and per instance, so under fan-out the effective ceiling is this multiplied by however many
              instances are warm. Set real spend caps in the Anthropic and Mapbox consoles as the backstop.
            </p>
          </Card>
        </div>
      </section>

      <Card title="Who can get in here" description="The two ways an administrator is recognised.">
        <ul className="flex flex-col gap-4">
          <li className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[13.5px] font-semibold text-wf-ink">Account allowlist</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-wf-muted">
                <code className="rounded bg-wf-surface px-1.5 py-0.5 text-[11px]">ADMIN_EMAILS</code> — signed-in Clerk
                accounts whose email is listed. Preferred: every action is then attributed to a named person, and
                sign-in inherits whatever the organisation already enforces.
              </p>
            </div>
            <Badge tone={config.clerkAdmins ? "good" : "neutral"}>
              {config.clerkAdmins ? `${formatNumber(config.allowlistSize)} allowed` : "Off"}
            </Badge>
          </li>
          <li className="flex items-start justify-between gap-4 border-t border-wf-border-faint pt-4">
            <div className="min-w-0">
              <p className="text-[13.5px] font-semibold text-wf-ink">Shared password</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-wf-muted">
                <code className="rounded bg-wf-surface px-1.5 py-0.5 text-[11px]">ADMIN_PASSWORD</code> exchanged for a
                signed session cookie lasting 12 hours, rate limited to {LIMITS.adminLogin.limit} attempts per{" "}
                {humaniseWindow(LIMITS.adminLogin.windowMs)}. Without{" "}
                <code className="rounded bg-wf-surface px-1.5 py-0.5 text-[11px]">ADMIN_SESSION_SECRET</code>, changing
                the password ends every open session.
              </p>
            </div>
            <Badge tone={config.passwordLogin ? "good" : "neutral"}>{config.passwordLogin ? "On" : "Off"}</Badge>
          </li>
        </ul>
      </Card>

      <div className="mt-6">
        <Notice tone="info" title="Moderation mode">
          <p>
            Venue creation is unauthenticated, and by default a new venue is listed the moment it is written. Set{" "}
            <code>WAYFINDER_VENUE_MODERATION=queue</code> to hold every new venue for review instead — it then appears in{" "}
            <strong>Shared venues</strong> as “held for review” and reaches nobody until it is listed. Currently{" "}
            <strong>{mode === "queue" ? "holding new venues for review" : "listing new venues immediately"}</strong>.
          </p>
        </Notice>
      </div>
    </>
  )
}

function humaniseWindow(ms: number): string {
  const minutes = ms / 60000
  if (minutes < 60) return minutes === 1 ? "minute" : `${minutes} min`
  const hours = minutes / 60
  return hours === 1 ? "hour" : `${hours} hours`
}
