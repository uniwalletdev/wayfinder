"use client"
import Link from "next/link"
import { RefreshCw, ChevronRight } from "lucide-react"
import { useAdmin, PageHeader, Card, Stat, Badge, Button, Loading, ErrorState, Notice, fmtNumber, fmtAgo, fmtDate } from "../ui"
import { useStaff } from "../AdminShell"
import { actionLabel } from "./audit-labels"

interface OverviewData {
  database: boolean
  accounts: number | null
  venues?: { total: number; public: number; unlisted: number; private: number; verified: number; newThisWeek: number }
  searches?: { openGroups: number; lastWeek: number }
  inbox?: { reports: number; messages: number }
  signals?: { lastWeek: number; lastMonth: number; devicesLastMonth: number }
  staff?: number
  world?: { countries: number; hospitals: number; siteMaps: number; indoorMaps: number; lastPublished: string | null } | null
  recentVenues?: { id: string; name: string; visibility: string; createdAt: string }[]
  topSearches?: { venueKey: string; venue: string; query: string; count: number }[]
  audit?: { id: string; actorEmail: string | null; action: string; target: string | null; detail: Record<string, unknown>; createdAt: string }[] | null
}

const VIS_TONE: Record<string, "green" | "amber" | "neutral"> = { public: "green", unlisted: "amber", private: "neutral" }

export default function OverviewView() {
  const staff = useStaff()
  const { data, error, loading, reload } = useAdmin<OverviewData>("/api/admin/overview")
  return (
    <>
      <PageHeader
        title={`Hello, ${staff.name.split(" ")[0]}`}
        description="What Findway holds today, and what needs attention."
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
      ) : !data.database ? (
        <Notice title="No database on this deployment">Add DATABASE_URL in the host&apos;s environment variables to see venues, searches and activity.</Notice>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Hospitals listed" value={fmtNumber(data.world?.hospitals ?? 0)} hint={data.world ? `in ${data.world.countries} countries` : "no world data published"} />
            <Stat label="Site maps" value={fmtNumber(data.world?.siteMaps ?? 0)} hint="hospital grounds" />
            <Stat label="Indoor maps" value={fmtNumber(data.world?.indoorMaps ?? 0)} hint="from OpenStreetMap" />
            <Stat label="Shared venues" value={fmtNumber(data.venues?.total)} hint={`${data.venues?.public ?? 0} public · ${data.venues?.verified ?? 0} verified`} />
            <Stat label="Accounts" value={data.accounts == null ? "—" : fmtNumber(data.accounts)} hint={`${(data.staff ?? 0)} with a staff role${data.accounts == null ? " · accounts not set up" : ""}`} />
            <Stat
              label="Searches to review"
              value={fmtNumber(data.searches?.openGroups)}
              hint={`${data.searches?.lastWeek ?? 0} missed searches this week`}
              tone={(data.searches?.openGroups ?? 0) > 0 ? "attention" : "default"}
            />
            <Stat
              label="Inbox to review"
              value={fmtNumber((data.inbox?.reports ?? 0) + (data.inbox?.messages ?? 0))}
              hint={
                staff.can("inbox.view") ? (
                  <Link href="/admin/inbox" className="font-semibold text-wf-primary">
                    {data.inbox?.reports ?? 0} reports · {data.inbox?.messages ?? 0} messages
                  </Link>
                ) : (
                  `${data.inbox?.reports ?? 0} reports · ${data.inbox?.messages ?? 0} messages`
                )
              }
              tone={(data.inbox?.reports ?? 0) > 0 ? "attention" : "default"}
            />
            <Stat label="Navigation signals" value={fmtNumber(data.signals?.lastWeek)} hint={`this week · ${fmtNumber(data.signals?.devicesLastMonth)} devices in 30 days`} />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <Card
              title="Most missed searches"
              action={
                <Link href="/admin/searches" className="flex items-center text-[13px] font-semibold text-wf-primary">
                  Review <ChevronRight size={14} aria-hidden="true" />
                </Link>
              }
            >
              {data.topSearches?.length ? (
                <ul className="divide-y divide-wf-border-faint">
                  {data.topSearches.map((s) => (
                    <li key={`${s.venueKey}|${s.query}`} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-medium text-wf-ink">“{s.query}”</p>
                        <p className="truncate text-[12.5px] text-wf-muted">{s.venue}</p>
                      </div>
                      <Badge tone="amber">{s.count}×</Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13.5px] text-wf-muted">Nothing unresolved in the last 30 days.</p>
              )}
            </Card>

            <Card
              title="Newest shared venues"
              action={
                <Link href="/admin/venues" className="flex items-center text-[13px] font-semibold text-wf-primary">
                  All venues <ChevronRight size={14} aria-hidden="true" />
                </Link>
              }
            >
              {data.recentVenues?.length ? (
                <ul className="divide-y divide-wf-border-faint">
                  {data.recentVenues.map((v) => (
                    <li key={v.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-medium text-wf-ink">{v.name}</p>
                        <p className="text-[12.5px] text-wf-muted">{fmtAgo(v.createdAt)}</p>
                      </div>
                      <Badge tone={VIS_TONE[v.visibility] ?? "neutral"}>{v.visibility}</Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13.5px] text-wf-muted">Nobody has shared a venue yet.</p>
              )}
            </Card>

            <Card
              title="World data"
              action={
                <Link href="/admin/coverage" className="flex items-center text-[13px] font-semibold text-wf-primary">
                  Coverage <ChevronRight size={14} aria-hidden="true" />
                </Link>
              }
            >
              {data.world ? (
                <p className="text-[14px] leading-relaxed text-wf-body">
                  {fmtNumber(data.world.hospitals)} hospitals in {data.world.countries} countries, with {fmtNumber(data.world.siteMaps)} site maps and {fmtNumber(data.world.indoorMaps)} indoor maps. Last published{" "}
                  <span className="font-semibold text-wf-ink">{fmtDate(data.world.lastPublished)}</span>.
                </p>
              ) : (
                <p className="text-[13.5px] text-wf-muted">The World hospital data workflow has not published to this database yet.</p>
              )}
              <Link href="/admin/system" className="mt-3 inline-flex text-[13px] font-semibold text-wf-primary">
                Data refresh status →
              </Link>
            </Card>

            {data.audit && (
              <Card
                title="Recent changes"
                action={
                  <Link href="/admin/audit" className="flex items-center text-[13px] font-semibold text-wf-primary">
                    Audit log <ChevronRight size={14} aria-hidden="true" />
                  </Link>
                }
              >
                {data.audit.length ? (
                  <ul className="divide-y divide-wf-border-faint">
                    {data.audit.map((a) => (
                      <li key={a.id} className="py-2.5">
                        <p className="text-[14px] text-wf-ink">{actionLabel(a.action, a.detail)}</p>
                        <p className="text-[12.5px] text-wf-muted">
                          {a.actorEmail ?? "Someone"} · {fmtAgo(a.createdAt)}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[13.5px] text-wf-muted">No changes made in the back office yet.</p>
                )}
              </Card>
            )}
          </div>
        </>
      )}
    </>
  )
}
