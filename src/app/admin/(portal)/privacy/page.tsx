import Link from "next/link"
import { FilterForm } from "@/components/admin/forms"
import { EraseDeviceForm, PurgeForm } from "@/components/admin/RetentionForms"
import {
  BTN_QUIET,
  Card,
  INPUT,
  LABEL,
  Notice,
  PageHeader,
  StatTile,
  TABLE,
  TABLE_SCROLL,
  TD,
  TH,
  formatDateTime,
  formatNumber,
} from "@/components/admin/ui"
import { getDeviceRecord, getRetentionStats } from "@/lib/admin/data"

// Data protection, as controls rather than a policy document.
//
// docs/location-data-and-gdpr.md sets out the position: a trail is a timestamped
// indoor path keyed to an identifier that persists for the life of a browser's
// storage, and in a hospital the destination can be a health inference about the
// person who walked there. Whatever lawful basis is eventually settled on, two
// obligations are certain — hold it no longer than needed, and be able to answer
// "delete what you hold about me". This page is where both are actually done,
// and every use of it is written to the audit log.

export const dynamic = "force-dynamic"

export default async function PrivacyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const raw = sp.device
  const device = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? ""

  const [stats, record] = await Promise.all([
    getRetentionStats(),
    device ? getDeviceRecord(device) : Promise.resolve(null),
  ])

  return (
    <>
      <PageHeader
        title="Data & retention"
        description="What the app is holding about the people who used it, how to shorten that, and how to erase one person's share of it."
      />

      {!stats.ok ? (
        <Notice
          tone={stats.reason === "unconfigured" ? "info" : "bad"}
          title={stats.reason === "unconfigured" ? "No database configured" : "The stored data could not be read"}
        >
          {stats.reason === "unconfigured" ? (
            <p>
              With no database the app pools nothing at all: trails and searches never leave the device that made them.
              There is nothing here to retain or erase — which is the strongest privacy position available, and the
              default this app ships in.
            </p>
          ) : (
            <p className="break-words">{stats.message}</p>
          )}
        </Notice>
      ) : (
        <>
          <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label="Trails held"
              value={stats.data.signals.total}
              hint={stats.data.signals.oldest ? `Oldest from ${formatDateTime(stats.data.signals.oldest)}` : "Nothing held"}
            />
            <StatTile
              label="Older than 90 days"
              value={stats.data.signals.olderThan90}
              tone={stats.data.signals.olderThan90 > 0 ? "warn" : "good"}
              hint={`${formatNumber(stats.data.signals.olderThan365)} older than a year`}
            />
            <StatTile
              label="Searches held"
              value={stats.data.misses.total}
              hint={`${formatNumber(stats.data.misses.olderThan90)} older than 90 days`}
            />
            <StatTile
              label="Device identifiers"
              value={stats.data.devices.total}
              hint={`${formatNumber(stats.data.devices.active30)} seen in the last 30 days`}
            />
          </section>

          <section className="mb-6 grid gap-5 lg:grid-cols-2">
            <Card title="Trail retention" description="Indoor paths walked while being guided.">
              <p className="mb-4 text-[12.5px] leading-relaxed text-wf-muted">
                Trails are what make the map improve from being walked — they become the corridor networks routing
                follows. They are also the most sensitive thing here. Purge to the shortest window that still lets the
                corridor extraction work.
              </p>
              <PurgeForm kind="signals" defaultDays={90} affected={stats.data.signals.olderThan90} />
            </Card>

            <Card title="Search retention" description="Free text people typed into the app.">
              <p className="mb-4 text-[12.5px] leading-relaxed text-wf-muted">
                No device or account is stored against a search, but the text is whatever someone typed — which can be a
                clinician’s name, a relative’s name or a condition. Its value to you is aggregate, so it ages badly:
                keep the counts by purging the rows.
              </p>
              <PurgeForm kind="searches" defaultDays={180} affected={stats.data.misses.olderThan90} />
            </Card>
          </section>

          <Card
            title="Erasure request"
            description="Find everything held for one device identifier, then delete it."
          >
            <p className="mb-4 max-w-3xl text-[12.5px] leading-relaxed text-wf-muted">
              The app has no accounts, so a person is only ever identified here by the random id their browser minted
              into local storage. To answer a request, ask them for it: in the app it is stored under{" "}
              <code className="rounded bg-wf-surface px-1.5 py-0.5">wayfinder.deviceId</code>. Clearing site data on
              their device ends the collection; this deletes what was already pooled.
            </p>

            <FilterForm action="/admin/privacy" className="flex flex-wrap items-end gap-2.5">
              <div className="min-w-[280px] flex-1">
                <label className={LABEL} htmlFor="device">
                  Device identifier
                </label>
                <input
                  id="device"
                  name="device"
                  defaultValue={device}
                  className={INPUT}
                  placeholder="e.g. 6f1c2a3e-8b7d-4e5f-9a0b-1c2d3e4f5a6b"
                  autoComplete="off"
                />
              </div>
              <button type="submit" className={BTN_QUIET}>
                Look it up
              </button>
              {device ? (
                <Link href="/admin/privacy" className="px-1 pb-3 text-[12.5px] font-semibold text-wf-muted hover:text-wf-primary">
                  Clear
                </Link>
              ) : null}
            </FilterForm>

            {record && !record.ok ? (
              <div className="mt-5">
                <Notice tone="bad" title="The lookup failed">
                  <p className="break-words">{record.message}</p>
                </Notice>
              </div>
            ) : null}

            {record?.ok && !record.data ? (
              <div className="mt-5">
                <Notice tone="good" title="Nothing is held for that identifier">
                  <p>
                    Either it has just been erased, it was erased earlier, the device never navigated a mapped venue, or
                    the identifier was mistyped. Nothing further is needed to answer the request — and if an erasure did
                    just run, it is recorded with its count in the{" "}
                    <Link href="/admin/audit?action=retention.erase_device" className="underline">
                      audit log
                    </Link>
                    .
                  </p>
                </Notice>
              </div>
            ) : null}

            {record?.ok && record.data ? (
              <div className="mt-5 rounded-2xl border border-wf-border p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div>
                    <p className="font-display text-[15px] font-semibold text-wf-ink">
                      {formatNumber(record.data.trails)} trail(s) held
                    </p>
                    <p className="mt-1 text-[12.5px] text-wf-muted">
                      First {formatDateTime(record.data.first)} · last {formatDateTime(record.data.last)}
                    </p>
                  </div>
                  <code className="rounded-lg bg-wf-surface px-2.5 py-1.5 text-[12px] break-all text-wf-body">
                    {record.data.deviceId}
                  </code>
                </div>

                <div className={`${TABLE_SCROLL} mt-4`}>
                  <table className={TABLE}>
                    <thead>
                      <tr>
                        <th className={TH}>Venue</th>
                        <th className={`${TH} text-right`}>Trails</th>
                        <th className={TH}>Last walked</th>
                      </tr>
                    </thead>
                    <tbody>
                      {record.data.venues.map((v) => (
                        <tr key={v.venueKey}>
                          <td className={`${TD} font-medium text-wf-ink`}>{v.venueLabel}</td>
                          <td className={`${TD} text-right tabular-nums`}>{formatNumber(v.trails)}</td>
                          <td className={`${TD} whitespace-nowrap text-wf-muted`}>{formatDateTime(v.lastSeen)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p className="mt-4 text-[12px] leading-relaxed text-wf-faint">
                  This is the complete record for that identifier. Searches are stored without any device id, so they
                  cannot be tied to a person and are not included — say so when answering a subject access request,
                  rather than implying the list above is everything the app ever saw.
                </p>

                <div className="mt-4 border-t border-wf-border-faint pt-4">
                  <EraseDeviceForm deviceId={record.data.deviceId} />
                </div>
              </div>
            ) : null}
          </Card>
        </>
      )}

      <div className="mt-6">
        <Notice tone="info" title="Before this is deployed at scale">
          <p>
            <code>docs/location-data-and-gdpr.md</code> lists the gaps these controls do not close on their own — no
            consent gate, no published retention period, no DPIA. They are product and legal decisions, not code, and
            they are worth settling before an NHS deployment rather than after.
          </p>
        </Notice>
      </div>
    </>
  )
}
