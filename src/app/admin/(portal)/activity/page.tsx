import Link from "next/link"
import { ColumnChart } from "@/components/admin/charts"
import { Badge, Card, EmptyState, Notice, PageHeader, StatTile, TABLE, TABLE_SCROLL, TD, TH, formatDateTime, formatNumber, timeAgo } from "@/components/admin/ui"
import { getActivity, isUuid } from "@/lib/admin/data"

// Is anyone using this, and where?
//
// The only usage signal the app pools is the trail: the path actually walked
// while being routed, written after the walk (`/api/signals`). That makes this
// page a fair proxy for real navigation and a poor proxy for visits — someone
// who opened the map, read it and walked off leaves nothing here.
//
// Device counts are shown as counts and identifiers are truncated. The whole
// identifier is never needed to read this screen, and the screen is read over
// shoulders.

export const dynamic = "force-dynamic"

export default async function ActivityPage() {
  const result = await getActivity(30)

  return (
    <>
      <PageHeader
        title="Navigation activity"
        description="Trails recorded while people were being guided. The evidence that the map is being walked, and where."
      />

      {!result.ok ? (
        <Notice
          tone={result.reason === "unconfigured" ? "info" : "bad"}
          title={result.reason === "unconfigured" ? "No database configured" : "Activity could not be read"}
        >
          {result.reason === "unconfigured" ? (
            <p>
              Without a database the app never pools anything: a walk stays on the device that walked it. Set{" "}
              <span className="font-semibold">DATABASE_URL</span> to start collecting.
            </p>
          ) : (
            <p className="break-words">{result.message}</p>
          )}
        </Notice>
      ) : (
        <>
          <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile label="Trails recorded" value={result.data.totals.trails} hint="Since the app started pooling" />
            <StatTile label="Venues walked" value={result.data.totals.venues} hint="Distinct venues with at least one trail" />
            <StatTile label="Devices" value={result.data.totals.devices} hint="Browsers, not people — one person may have several" />
            <StatTile
              label="Most recent"
              value={result.data.totals.last ? timeAgo(result.data.totals.last) : "Never"}
              hint={result.data.totals.last ? formatDateTime(result.data.totals.last) : "Nothing recorded yet"}
            />
          </section>

          <div className="mb-6">
            <Card title="Trails per day" description="The last 30 days.">
              <ColumnChart
                points={result.data.series.map((p) => ({ key: p.day, label: shortDay(p.day), value: p.signals }))}
                unit="trails"
                height={200}
                emptyMessage="No trails recorded in the last 30 days."
              />
            </Card>
          </div>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
            <Card title="Where people are navigating" description="Every venue with a recorded trail, busiest first." bodyClassName="">
              {result.data.venues.length === 0 ? (
                <EmptyState title="No trails yet" body="Once someone is guided through a venue, it appears here." />
              ) : (
                <div className={TABLE_SCROLL}>
                  <table className={TABLE}>
                    <thead>
                      <tr>
                        <th className={TH}>Venue</th>
                        <th className={TH}>Kind</th>
                        <th className={`${TH} text-right`}>Trails</th>
                        <th className={`${TH} text-right`}>Devices</th>
                        <th className={TH}>Last</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.data.venues.map((v) => (
                        <tr key={v.venueKey} className="transition-colors hover:bg-wf-surface-2">
                          <td className={TD}>
                            {v.source === "shared" && isUuid(v.venueKey) ? (
                              <Link href={`/admin/venues/${v.venueKey}`} className="font-medium text-wf-ink hover:text-wf-primary">
                                {v.venueLabel}
                              </Link>
                            ) : (
                              <span className="font-medium text-wf-ink">{v.venueLabel}</span>
                            )}
                          </td>
                          <td className={TD}>
                            <Badge tone={v.source === "shared" ? "info" : "neutral"}>{SOURCE_LABEL[v.source]}</Badge>
                          </td>
                          <td className={`${TD} text-right tabular-nums font-semibold text-wf-ink`}>{formatNumber(v.trails)}</td>
                          <td className={`${TD} text-right tabular-nums`}>{formatNumber(v.devices)}</td>
                          <td className={`${TD} whitespace-nowrap text-wf-muted`}>{timeAgo(v.lastSeen)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card title="Latest trails" description="The most recent walks, newest first." bodyClassName="">
              {result.data.recent.length === 0 ? (
                <EmptyState title="Nothing recorded" />
              ) : (
                <ul className="divide-y divide-wf-border-faint">
                  {result.data.recent.map((t) => (
                    <li key={t.id} className="flex items-start justify-between gap-3 px-5 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-wf-ink">{t.venueLabel}</p>
                        <p className="mt-0.5 text-[11.5px] text-wf-faint">
                          {t.floor === 0 ? "Ground floor" : `Floor ${t.floor}`} · {formatNumber(t.points)} points · device {t.deviceId}
                        </p>
                      </div>
                      <p className="flex-shrink-0 text-[11.5px] text-wf-muted">{timeAgo(t.createdAt)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </section>

          <div className="mt-6">
            <Notice tone="warn" title="These are location traces">
              <p>
                A trail is a timestamped indoor path, and in a hospital its destination can imply a diagnosis. Keep the
                retention window short and honour erasure requests —{" "}
                <Link href="/admin/privacy" className="underline">
                  both are managed here
                </Link>
                . The full analysis is in <code>docs/location-data-and-gdpr.md</code>.
              </p>
            </Notice>
          </div>
        </>
      )}
    </>
  )
}

const SOURCE_LABEL: Record<string, string> = {
  shared: "Shared venue",
  catalog: "Ships with the app",
  device: "Mapped on one device",
  unknown: "Unknown",
}

function shortDay(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })
}
