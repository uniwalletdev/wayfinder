import Link from "next/link"
import { ArrowRight, Building2, MapPin, Search, Activity as ActivityIcon } from "lucide-react"
import { BarList, COVERAGE_SHADES, ColumnChart, ShareBar } from "@/components/backoffice/charts"
import {
  Badge,
  Card,
  EmptyState,
  Hero,
  Notice,
  PageHeader,
  StatTile,
  TABLE,
  TABLE_SCROLL,
  TD,
  TH,
  formatNumber,
  timeAgo,
} from "@/components/backoffice/ui"
import { catalogSummary } from "@/lib/backoffice/catalog"
import { getOverview } from "@/lib/backoffice/data"
import type { Overview } from "@/lib/backoffice/types"
import { statusBadge } from "@/components/backoffice/labels"

// The one screen an operator opens without being sent there.
//
// It answers, in order: how much of the country can people actually navigate,
// what is waiting for a decision, is the app being used, and what did people
// look for and not find. Everything else in the portal is a drill-down from one
// of those four questions.
//
// The catalogue half works with no database at all — those venues ship with the
// build — so this page still tells an operator something useful in device-only
// mode, rather than being an error screen.

export default async function DashboardPage() {
  const overview = await getOverview()
  const catalog = catalogSummary()

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Coverage, the moderation queue, and what people have been doing in the app."
      />

      {/* Coverage — from the shipped catalogue, so it renders with or without a database. */}
      <section className="mb-6 grid gap-5 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <Card>
          <Hero
            value={catalog.navigable}
            label="Venues someone can navigate inside"
            sub={`Out of ${formatNumber(catalog.total)} in the catalogue — the rest are a plan with nothing named on it yet, or a located pin waiting to be surveyed.`}
          />
        </Card>

        <Card
          title="Catalogue coverage"
          description="How far each venue that ships with the app has got."
          actions={
            <Link href="/backoffice/catalog" className="text-[12.5px] font-semibold text-wf-primary">
              Browse →
            </Link>
          }
        >
          <ShareBar
            segments={[
              { key: "navigable", label: "Navigable inside", value: catalog.navigable, shade: COVERAGE_SHADES.navigable },
              { key: "sheet", label: "Plan only", value: catalog.sheet, shade: COVERAGE_SHADES.sheet },
              { key: "located", label: "Located pin", value: catalog.located, shade: COVERAGE_SHADES.located, ink: "#06336B" },
            ]}
          />
          <dl className="mt-5 grid grid-cols-3 gap-4 border-t border-wf-border-faint pt-4 text-center">
            <div>
              <dt className="text-[12px] text-wf-muted">Floor plans</dt>
              <dd className="mt-0.5 font-display text-[18px] font-bold text-wf-ink">{formatNumber(catalog.floorPlans)}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-wf-muted">Places mapped</dt>
              <dd className="mt-0.5 font-display text-[18px] font-bold text-wf-ink">{formatNumber(catalog.waypoints)}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-wf-muted">Corridor networks</dt>
              <dd className="mt-0.5 font-display text-[18px] font-bold text-wf-ink">{formatNumber(catalog.trails)}</dd>
            </div>
          </dl>
        </Card>
      </section>

      {!overview.ok ? (
        <Notice
          tone={overview.reason === "unconfigured" ? "info" : "bad"}
          title={overview.reason === "unconfigured" ? "No database configured" : "The database could not be read"}
        >
          {overview.reason === "unconfigured" ? (
            <p>
              Wayfinder runs device-only without one: venues people map stay on their phone, and nothing is pooled. Set{" "}
              <span className="font-semibold">DATABASE_URL</span> to collect shared venues, unmet searches and navigation
              activity — then this page fills in. <Link href="/backoffice/settings" className="underline">Check the settings</Link>.
            </p>
          ) : (
            <p className="break-words">{overview.message}</p>
          )}
        </Notice>
      ) : (
        <DashboardBody data={overview.data} />
      )}
    </>
  )
}

function DashboardBody({ data }: { data: Overview }) {
  const needsAttention =
    data.venues.pending + (data.demand.open > 0 ? 1 : 0) + (data.venues.emptyOfWaypoints > 0 ? 1 : 0)

  return (
    <>
      <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Shared venues listed"
          value={data.venues.listed}
          hint={`${formatNumber(data.venues.total)} in total · ${formatNumber(data.venues.newLast7)} added this week`}
          href="/backoffice/venues"
        />
        <StatTile
          label="Places inside them"
          value={data.waypoints.total}
          hint={
            data.venues.emptyOfWaypoints > 0
              ? `${formatNumber(data.venues.emptyOfWaypoints)} venue(s) have none yet`
              : "Every shared venue has at least one"
          }
          href="/backoffice/venues?sort=waypoints"
        />
        <StatTile
          label="Trails this week"
          value={data.signals.last7d}
          hint={`${formatNumber(data.signals.devices30d)} device(s) across ${formatNumber(data.signals.venues30d)} venue(s) in 30 days`}
          href="/backoffice/activity"
        />
        <StatTile
          label="Unmet searches open"
          value={data.demand.open}
          tone={data.demand.open > 0 ? "warn" : "good"}
          hint={`${formatNumber(data.demand.last7d)} recorded in the last 7 days`}
          href="/backoffice/demand"
        />
      </section>

      <section className="mb-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
        <Card title="Navigation activity" description="Trails recorded per day over the last 30 days.">
          <ColumnChart
            points={data.series.map((p) => ({ key: p.day, label: shortDay(p.day), value: p.signals }))}
            unit="trails"
            emptyMessage="No trails recorded in the last 30 days."
          />
        </Card>

        <Card title="Waiting on you" description="Everything the portal thinks needs a decision.">
          {needsAttention === 0 ? (
            <EmptyState title="Nothing waiting" body="No venues are held for review and every recorded search has been dealt with." />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {data.venues.pending > 0 ? (
                <QueueRow
                  href="/backoffice/venues?status=pending"
                  Icon={Building2}
                  title={`${formatNumber(data.venues.pending)} venue(s) held for review`}
                  body="Created in the app and not yet listed to anyone."
                />
              ) : null}
              {data.demand.open > 0 ? (
                <QueueRow
                  href="/backoffice/demand"
                  Icon={Search}
                  title={`${formatNumber(data.demand.open)} unmet search(es)`}
                  body="People looked for these and the map had nothing."
                />
              ) : null}
              {data.venues.emptyOfWaypoints > 0 ? (
                <QueueRow
                  href="/backoffice/venues?sort=waypoints"
                  Icon={MapPin}
                  title={`${formatNumber(data.venues.emptyOfWaypoints)} venue(s) with no places`}
                  body="Someone created the venue but never mapped anything inside it."
                />
              ) : null}
            </ul>
          )}
        </Card>
      </section>

      <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <Card
          title="Newest shared venues"
          description="Created in the app by whoever was standing in them."
          actions={
            <Link href="/backoffice/venues" className="text-[12.5px] font-semibold text-wf-primary">
              All venues →
            </Link>
          }
          bodyClassName=""
        >
          {data.recentVenues.length === 0 ? (
            <EmptyState title="No shared venues yet" body="Venues created in the app appear here as soon as someone maps one." />
          ) : (
            <div className={TABLE_SCROLL}>
              <table className={TABLE}>
                <thead>
                  <tr>
                    <th className={TH}>Venue</th>
                    <th className={TH}>State</th>
                    <th className={TH}>Places</th>
                    <th className={TH}>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentVenues.map((v) => {
                    const badge = statusBadge(v.status)
                    return (
                      <tr key={v.id}>
                        <td className={TD}>
                          <Link href={`/backoffice/venues/${v.id}`} className="font-semibold text-wf-ink hover:text-wf-primary">
                            {v.name}
                          </Link>
                          <p className="text-[11.5px] text-wf-faint">{v.category}</p>
                        </td>
                        <td className={TD}>
                          <Badge tone={badge.tone}>{badge.label}</Badge>
                        </td>
                        <td className={`${TD} tabular-nums`}>{formatNumber(v.waypointCount)}</td>
                        <td className={`${TD} whitespace-nowrap text-wf-muted`}>{timeAgo(v.createdAt)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="flex flex-col gap-5">
          <Card
            title="Most-wanted missing places"
            description="Searches that came back empty, most repeated first."
            actions={
              <Link href="/backoffice/demand" className="text-[12.5px] font-semibold text-wf-primary">
                All →
              </Link>
            }
          >
            <BarList
              unit="searches"
              emptyMessage="Nobody has searched for something the map didn't have."
              items={data.topDemand.map((d) => ({
                key: `${d.venueKey}:${d.query}`,
                label: d.query,
                value: d.hits,
                meta: d.venueLabel,
              }))}
            />
          </Card>

          <Card
            title="Recent administration"
            actions={
              <Link href="/backoffice/audit" className="text-[12.5px] font-semibold text-wf-primary">
                Full log →
              </Link>
            }
          >
            {data.recentAudit.length === 0 ? (
              <p className="py-4 text-center text-[13px] text-wf-faint">Nothing has been changed in here yet.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {data.recentAudit.map((entry) => (
                  <li key={entry.id} className="flex gap-3">
                    <ActivityIcon size={14} className="mt-1 flex-shrink-0 text-wf-faint" aria-hidden />
                    <div className="min-w-0">
                      <p className="text-[13px] leading-snug text-wf-ink">{entry.summary}</p>
                      <p className="mt-0.5 text-[11.5px] text-wf-faint">
                        {entry.actor} · {timeAgo(entry.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </section>
    </>
  )
}

function QueueRow({
  href,
  Icon,
  title,
  body,
}: {
  href: string
  Icon: typeof Building2
  title: string
  body: string
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-start gap-3 rounded-xl border border-wf-border px-3.5 py-3 transition-colors hover:border-wf-primary/40"
      >
        <Icon size={16} className="mt-0.5 flex-shrink-0 text-wf-primary" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold text-wf-ink">{title}</span>
          <span className="mt-0.5 block text-[12px] leading-snug text-wf-muted">{body}</span>
        </span>
        <ArrowRight size={15} className="mt-0.5 flex-shrink-0 text-wf-faint" aria-hidden />
      </Link>
    </li>
  )
}

/** "12 Aug" — the axis wants a date, not a timestamp. */
function shortDay(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })
}
