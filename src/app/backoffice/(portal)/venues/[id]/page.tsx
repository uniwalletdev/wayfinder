import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ExternalLink } from "lucide-react"
import { ColumnChart } from "@/components/backoffice/charts"
import DangerZone from "@/components/backoffice/DangerZone"
import ModerationPanel from "@/components/backoffice/ModerationPanel"
import VenueEditor from "@/components/backoffice/VenueEditor"
import WaypointsPanel from "@/components/backoffice/WaypointsPanel"
import { humanise, resolutionLabel } from "@/components/backoffice/labels"
import {
  Badge,
  Card,
  Notice,
  PageHeader,
  StatTile,
  TABLE,
  TABLE_SCROLL,
  TD,
  TH,
  formatDateTime,
  formatNumber,
  timeAgo,
} from "@/components/backoffice/ui"
import { getVenueDetail } from "@/lib/backoffice/data"

// One shared venue, everything known about it, and every lever over it.
//
// Ordered by how often it is needed: the decision (list it / hide it / verify
// it) first, because that is why someone opened this page; then what the venue
// says about itself; then what is inside it; then the irreversible things, last
// and visually separated.

export const dynamic = "force-dynamic"

export default async function VenuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await getVenueDetail(id)

  if (!result.ok) {
    return (
      <>
        <BackLink />
        <PageHeader title="Venue" />
        <Notice
          tone={result.reason === "unconfigured" ? "info" : "bad"}
          title={result.reason === "unconfigured" ? "No database configured" : "This venue could not be read"}
        >
          <p className="break-words">{result.message}</p>
        </Notice>
      </>
    )
  }
  if (!result.data) notFound()

  const { venue, waypoints, floorCounts, typeCounts, signals, demand, audit } = result.data

  return (
    <>
      <BackLink />
      <PageHeader
        title={venue.name}
        description={venue.subtitle ?? undefined}
        actions={
          <Link
            href="/navigate"
            // The app has no venue deep link — it opens on whichever venue that
            // device last used — so this is "go and look", not "go and look at
            // this one". Pick the venue from the picker once you are there.
            title="Opens the app; choose this venue from the picker"
            className="inline-flex items-center gap-2 rounded-xl border border-wf-border bg-white px-4 py-2.5 text-[13px] font-semibold text-wf-body transition-colors hover:border-wf-primary/40 hover:text-wf-primary"
          >
            <ExternalLink size={15} aria-hidden />
            Open the app
          </Link>
        }
      />

      <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Places mapped" value={waypoints.length} hint={`Across ${formatNumber(floorCounts.length)} floor(s)`} />
        <StatTile label="Trails walked here" value={signals.total} hint={`${formatNumber(signals.devices)} device(s)`} />
        <StatTile label="Last walked" value={signals.last ? timeAgo(signals.last) : "Never"} hint={signals.last ? formatDateTime(signals.last) : "No navigation recorded"} />
        <StatTile
          label="Unmet searches here"
          value={demand.filter((d) => !d.resolution).length}
          tone={demand.some((d) => !d.resolution) ? "warn" : "good"}
          hint="Searches inside this venue that found nothing"
        />
      </section>

      <section className="mb-6 grid gap-5 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <Card title="Listing decision" description="What people using the app can see of this venue.">
          <ModerationPanel venue={venue} />
        </Card>

        <div className="flex flex-col gap-5">
          <Card title="Venue details" description="How this place describes itself, and where the map opens.">
            <VenueEditor venue={venue} />
          </Card>

          <Card title="Provenance">
            <dl className="grid gap-x-6 gap-y-3 text-[13px] sm:grid-cols-2">
              <Row label="Venue id" value={<code className="break-all text-[12px] text-wf-body">{venue.id}</code>} />
              <Row label="Slug" value={venue.slug ?? "—"} />
              <Row label="Created" value={formatDateTime(venue.createdAt)} />
              <Row label="Last changed" value={formatDateTime(venue.updatedAt)} />
              <Row label="Centre" value={`${venue.centerLat.toFixed(5)}, ${venue.centerLng.toFixed(5)}`} />
              <Row label="Opening zoom" value={String(venue.defaultZoom)} />
            </dl>
            <p className="mt-4 border-t border-wf-border-faint pt-3.5 text-[12px] leading-relaxed text-wf-faint">
              Created anonymously through the app — venue creation needs no account, so there is no person to attribute
              this to beyond the device that still holds its edit token.
            </p>
          </Card>
        </div>
      </section>

      <div className="mb-6">
        <Card
          title="Places inside this venue"
          description="Every destination someone can search for and be routed to."
          bodyClassName=""
        >
          <WaypointsPanel venueId={venue.id} waypoints={waypoints} />
        </Card>
      </div>

      <section className="mb-6 grid items-start gap-5 lg:grid-cols-2">
        <Card title="How it is being used" description="Trails recorded in this venue over the last 30 days.">
          <ColumnChart
            points={signals.series.map((p) => ({ key: p.day, label: shortDay(p.day), value: p.signals }))}
            unit="trails"
            emptyMessage="Nobody has navigated here in the last 30 days."
          />
          {floorCounts.length > 0 || typeCounts.length > 0 ? (
            <div className="mt-5 grid gap-4 border-t border-wf-border-faint pt-4 sm:grid-cols-2">
              <div>
                <p className="text-[12px] font-semibold text-wf-muted">Places per floor</p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {floorCounts.map((f) => (
                    <li key={f.floor}>
                      <Badge>
                        {f.floor === 0 ? "Ground" : `Floor ${f.floor}`} · {formatNumber(f.count)}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-[12px] font-semibold text-wf-muted">Places by kind</p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {typeCounts.slice(0, 8).map((t) => (
                    <li key={t.type}>
                      <Badge>
                        {humanise(t.type)} · {formatNumber(t.count)}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </Card>

        <Card
          title="What people looked for here"
          description="Searches inside this venue that came back empty."
          bodyClassName=""
          actions={
            <Link href={`/backoffice/demand?venueKey=${venue.id}`} className="text-[12.5px] font-semibold text-wf-primary">
              Manage →
            </Link>
          }
        >
          {demand.length === 0 ? (
            <p className="px-5 py-12 text-center text-[13px] text-wf-faint">
              Every search made inside this venue has found something.
            </p>
          ) : (
            <div className={TABLE_SCROLL}>
              <table className={TABLE}>
                <thead>
                  <tr>
                    <th className={TH}>Searched for</th>
                    <th className={`${TH} text-right`}>Times</th>
                    <th className={TH}>Last</th>
                    <th className={TH}>State</th>
                  </tr>
                </thead>
                <tbody>
                  {demand.map((d) => (
                    <tr key={`${d.venueKey}:${d.query}`}>
                      <td className={`${TD} font-medium text-wf-ink`}>{d.query}</td>
                      <td className={`${TD} text-right tabular-nums`}>{formatNumber(d.hits)}</td>
                      <td className={`${TD} whitespace-nowrap text-wf-muted`}>{timeAgo(d.lastSeen)}</td>
                      <td className={TD}>
                        <Badge tone={d.resolution ? "good" : "warn"}>{resolutionLabel(d.resolution)}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>

      <section className="grid items-start gap-5 lg:grid-cols-2">
        <Card title="History" description="Everything done to this venue from the back office.">
          {audit.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-wf-faint">Nothing has been changed here yet.</p>
          ) : (
            <ul className="flex flex-col gap-3.5">
              {audit.map((entry) => (
                <li key={entry.id} className="border-l-2 border-wf-border pl-3.5">
                  <p className="text-[13px] leading-snug text-wf-ink">{entry.summary}</p>
                  <p className="mt-0.5 text-[11.5px] text-wf-faint">
                    {entry.actor} · {formatDateTime(entry.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Irreversible" description="Read the wording before using either of these." className="border-[#F3C6C2]">
          <DangerZone venue={venue} />
        </Card>
      </section>
    </>
  )
}

function BackLink() {
  return (
    <Link
      href="/backoffice/venues"
      className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-wf-muted transition-colors hover:text-wf-primary"
    >
      <ArrowLeft size={14} aria-hidden />
      All shared venues
    </Link>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[12px] text-wf-muted">{label}</dt>
      <dd className="mt-0.5 text-wf-ink">{value}</dd>
    </div>
  )
}

function shortDay(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })
}
