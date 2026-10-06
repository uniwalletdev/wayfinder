"use client"
import { useState } from "react"
import { RefreshCw, ExternalLink, Play } from "lucide-react"
import { useAdmin, adminSend, PageHeader, Card, Badge, Button, Loading, ErrorState, Notice, fmtAgo, fmtNumber, errorText } from "../ui"
import { useStaff } from "../AdminShell"
import { toast } from "@/components/Toast"

interface Run {
  number: number
  status: string
  conclusion: string | null
  event: string
  branch: string
  title: string
  createdAt: string
  updatedAt: string
  url: string
}
interface SystemData {
  database: { ok: boolean; latencyMs: number | null; tables: { name: string; rows: number }[]; error?: string }
  integrations: { accounts: boolean; ownerEmails: number; outdoorRouting: boolean; signReading: boolean; siteUrl: string | null; dataRefreshFromHere: boolean }
  build: { commit: string | null; branch: string | null; environment: string | null; region: string | null; repository: string }
  workflows: { file: string; name: string; url: string; runs: Run[]; error?: string }[]
}

function On({ on, yes = "On", no = "Off" }: { on: boolean; yes?: string; no?: string }) {
  return <Badge tone={on ? "green" : "neutral"}>{on ? yes : no}</Badge>
}

function RunBadge({ run }: { run: Run }) {
  if (run.status !== "completed") return <Badge tone="primary">{run.status === "in_progress" ? "Running" : run.status}</Badge>
  if (run.conclusion === "success") return <Badge tone="green">Succeeded</Badge>
  if (run.conclusion === "cancelled" || run.conclusion === "skipped") return <Badge tone="neutral">{run.conclusion}</Badge>
  return <Badge tone="red">{run.conclusion ?? "failed"}</Badge>
}

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-3 py-2">
    <span className="text-[13.5px] text-wf-body">{label}</span>
    <span className="text-right text-[13.5px]">{children}</span>
  </div>
)

export default function SystemView() {
  const staff = useStaff()
  const { data, error, loading, reload } = useAdmin<SystemData>("/api/admin/system")
  const [countries, setCountries] = useState("")
  const [starting, setStarting] = useState(false)
  return (
    <>
      <PageHeader
        title="System"
        description="What this deployment has switched on, the database's health, and the workflows that refresh Findway's data and build its apps. Secrets are never shown — only whether each is set."
        actions={
          <Button onClick={reload} busy={loading}>
            <RefreshCw size={14} aria-hidden="true" /> Refresh
          </Button>
        }
      />
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !data ? (
        <Loading />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Integrations">
            <div className="divide-y divide-wf-border-faint">
              <Row label="Accounts and back office sign-in (Clerk)"><On on={data.integrations.accounts} /></Row>
              <Row label="Fixed owners (ADMIN_EMAILS)"><span className="text-wf-ink">{data.integrations.ownerEmails}</span></Row>
              <Row label="Shared database"><On on={data.database.ok} yes="Connected" no={data.database.error === "not_configured" ? "Not set" : "Unreachable"} /></Row>
              <Row label="Street map, street routing and address search (Mapbox)"><On on={data.integrations.outdoorRouting} /></Row>
              <Row label="Sign reading in Survey Mode (Anthropic)"><On on={data.integrations.signReading} /></Row>
              <Row label="Data refresh from the back office"><On on={data.integrations.dataRefreshFromHere} /></Row>
              <Row label="Public site address"><span className="text-wf-ink">{data.integrations.siteUrl ?? <span className="text-wf-faint">inferred from the host</span>}</span></Row>
            </div>
          </Card>
          <Card title="Database">
            {data.database.ok ? (
              <>
                <p className="mb-2 text-[13px] text-wf-muted">Answered in {data.database.latencyMs} ms.</p>
                <div className="divide-y divide-wf-border-faint">
                  {data.database.tables.map((t) => (
                    <Row key={t.name} label={t.name}>
                      <span className="font-mono text-wf-ink">{fmtNumber(t.rows)}</span>
                    </Row>
                  ))}
                </div>
              </>
            ) : (
              <Notice tone={data.database.error === "not_configured" ? "info" : "error"}>
                {data.database.error === "not_configured" ? "DATABASE_URL is not set on this deployment." : `The database did not answer: ${data.database.error}`}
              </Notice>
            )}
          </Card>
          <Card title="Deployment">
            <div className="divide-y divide-wf-border-faint">
              <Row label="Environment"><span className="text-wf-ink">{data.build.environment ?? "—"}</span></Row>
              <Row label="Commit"><span className="font-mono text-wf-ink">{data.build.commit ?? "—"}</span></Row>
              <Row label="Branch"><span className="text-wf-ink">{data.build.branch ?? "—"}</span></Row>
              <Row label="Region"><span className="text-wf-ink">{data.build.region ?? "—"}</span></Row>
              <Row label="Repository">
                <a className="text-wf-primary" href={`https://github.com/${data.build.repository}`} target="_blank" rel="noreferrer">
                  {data.build.repository}
                </a>
              </Row>
            </div>
          </Card>
          {staff.can("pipeline.run") && (
            <Card title="Refresh world hospital data">
              <p className="text-[13.5px] leading-relaxed text-wf-muted">
                Starts the World hospital data workflow on main for the countries given — ISO codes such as <span className="font-mono">NG,KE</span>, or <span className="font-mono">ALL</span> for the world (several runs, a day or more). Countries publish only when complete.
              </p>
              {data.integrations.dataRefreshFromHere ? (
                <form
                  className="mt-3 flex gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault()
                    setStarting(true)
                    try {
                      await adminSend("POST", "/api/admin/system/refresh", { countries })
                      toast.success("Data refresh started", "It shows below within a minute.")
                      setCountries("")
                      setTimeout(reload, 4000)
                    } catch (err) {
                      toast.error("Could not start the refresh", errorText(err))
                    } finally {
                      setStarting(false)
                    }
                  }}
                >
                  <input
                    value={countries}
                    onChange={(e) => setCountries(e.target.value)}
                    placeholder="NG,KE or ALL"
                    aria-label="Countries"
                    className="min-w-0 flex-1 rounded-xl border border-wf-border px-3 py-2 font-mono text-[14px] uppercase outline-none focus:border-wf-primary"
                  />
                  <Button tone="primary" type="submit" busy={starting} disabled={!countries.trim()}>
                    <Play size={14} aria-hidden="true" /> Start
                  </Button>
                </form>
              ) : (
                <p className="mt-3 rounded-xl bg-wf-surface px-3 py-2.5 text-[13px] text-wf-body">
                  To start it from here, add a GitHub token with Actions read and write on the repository as <span className="font-mono">GITHUB_DISPATCH_TOKEN</span>. Until then, use the workflow&apos;s Run workflow button on GitHub.
                </p>
              )}
            </Card>
          )}
          {data.workflows.map((w) => (
            <Card
              key={w.file}
              title={w.name}
              className="lg:col-span-2"
              action={
                <a href={w.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[13px] font-semibold text-wf-primary">
                  On GitHub <ExternalLink size={13} aria-hidden="true" />
                </a>
              }
            >
              {w.error && !w.runs.length ? (
                <p className="text-[13.5px] text-wf-muted">Could not read the runs just now ({w.error}).</p>
              ) : w.runs.length === 0 ? (
                <p className="text-[13.5px] text-wf-muted">No runs yet.</p>
              ) : (
                <ul className="divide-y divide-wf-border-faint">
                  {w.runs.map((r) => (
                    <li key={r.number} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <a href={r.url} target="_blank" rel="noreferrer" className="block truncate text-[14px] font-medium text-wf-ink hover:text-wf-primary">
                          #{r.number} · {r.title}
                        </a>
                        <p className="text-[12.5px] text-wf-muted">
                          {r.event === "workflow_dispatch" ? "started by hand or by the chain" : r.event} · {r.branch} · {r.status === "completed" ? `finished ${fmtAgo(r.updatedAt)}` : `started ${fmtAgo(r.createdAt)}`}
                        </p>
                      </div>
                      <RunBadge run={r} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
