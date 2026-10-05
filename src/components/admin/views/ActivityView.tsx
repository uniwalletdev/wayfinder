"use client"
import { useMemo, useState } from "react"
import { Trash2, Table2, BarChart3 } from "lucide-react"
import { useAdmin, adminSend, PageHeader, Card, Stat, Button, Select, Loading, ErrorState, Empty, ConfirmDialog, type ConfirmRequest, fmtNumber, fmtDate } from "../ui"
import { useStaff } from "../AdminShell"
import { toast } from "@/components/Toast"

interface ActivityData {
  days: number
  total: number
  devices: number
  daily: { day: string; kind: string; count: number }[]
  venues: { venueKey: string; venue: string; count: number; devices: number }[]
  retention: { days: number; older: number; oldest: string | null }
}

const KIND_LABELS: Record<string, string> = { trail: "Walked trails", arrival: "Arrivals", qr_fix: "Poster scans", off_route: "Off-route" }

// Every day of the period, oldest first, with its total and its counts by kind
// — days with no signals included, so the chart's gaps are real.
function byDay(data: ActivityData) {
  const days: { day: string; total: number; kinds: Record<string, number> }[] = []
  const index = new Map<string, number>()
  const today = new Date()
  for (let i = data.days - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i))
    const key = d.toISOString().slice(0, 10)
    index.set(key, days.length)
    days.push({ day: key, total: 0, kinds: {} })
  }
  for (const r of data.daily) {
    const i = index.get(r.day)
    if (i === undefined) continue
    days[i].total += r.count
    days[i].kinds[r.kind] = (days[i].kinds[r.kind] ?? 0) + r.count
  }
  return days
}

const dayLabel = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })

// One series, so one hue (the brand blue, validated at 3:1 on white) and no
// legend: the card's title names it. Columns are capped at 24 px with a 2 px
// gap, rounded at the data end and square on the baseline; each is its own
// hover and focus target, and the table view carries every value as well.
function DailyChart({ days }: { days: ReturnType<typeof byDay> }) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(1, ...days.map((d) => d.total))
  const h = days[hover ?? -1]
  return (
    <div>
      <div className="flex items-baseline justify-between text-[12px] text-wf-muted">
        <span>{fmtNumber(max)} a day at most</span>
        <span className="min-h-[18px] text-right text-[13px] text-wf-ink" aria-live="polite">
          {h ? (
            <>
              <span className="font-semibold">{fmtNumber(h.total)}</span> on {dayLabel(h.day)}
            </>
          ) : null}
        </span>
      </div>
      <div className="relative mt-2 flex h-40 items-end border-b border-wf-border" onPointerLeave={() => setHover(null)}>
        {days.map((d, i) => (
          <div
            key={d.day}
            tabIndex={0}
            role="img"
            aria-label={`${dayLabel(d.day)}: ${d.total} signals`}
            onPointerEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            className="flex h-full flex-1 cursor-default items-end justify-center px-px outline-none focus-visible:bg-wf-surface"
          >
            <div
              className={`w-full max-w-[24px] rounded-t-[4px] ${hover === i ? "bg-wf-primary-deep" : "bg-wf-primary"}`}
              style={{ height: d.total ? `${Math.max(2, (d.total / max) * 100)}%` : 0 }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[11.5px] text-wf-muted">
        <span>{dayLabel(days[0].day)}</span>
        {days.length > 2 && <span>{dayLabel(days[Math.floor(days.length / 2)].day)}</span>}
        <span>{dayLabel(days[days.length - 1].day)}</span>
      </div>
    </div>
  )
}

export default function ActivityView() {
  const staff = useStaff()
  const [days, setDays] = useState("30")
  const [asTable, setAsTable] = useState(false)
  const { data, error, loading, reload } = useAdmin<ActivityData>(`/api/admin/activity?days=${days}`)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const series = useMemo(() => (data ? byDay(data) : []), [data])
  const kinds = useMemo(() => [...new Set((data?.daily ?? []).map((r) => r.kind))], [data])
  const topMax = Math.max(1, ...(data?.venues ?? []).map((v) => v.count))

  return (
    <>
      <PageHeader
        title="Activity"
        description="How Findway is used, from the anonymous signals the app sends while someone is being guided — the walked trails that improve the maps. Counted, never followed: devices are random ids, and no one is identified."
        actions={<Select label="Period" value={days} onChange={setDays} options={[{ value: "7", label: "Last 7 days" }, { value: "30", label: "Last 30 days" }, { value: "90", label: "Last 90 days" }]} />}
      />
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !data ? (
        <Loading />
      ) : (
        <>
          <div className={`grid grid-cols-2 gap-3 md:grid-cols-4 ${loading ? "opacity-60" : ""}`}>
            <Stat label="Signals" value={fmtNumber(data.total)} hint={`last ${data.days} days`} />
            <Stat label="Devices" value={fmtNumber(data.devices)} hint="sent at least one" />
            <Stat label="A day, on average" value={fmtNumber(Math.round(data.total / data.days))} />
            <Stat label="Hospitals" value={fmtNumber(data.venues.length)} hint={data.venues.length === 12 ? "top 12 shown below" : "with activity"} />
          </div>

          <Card
            className="mt-4"
            title="Signals a day"
            action={
              <Button size="sm" tone="ghost" onClick={() => setAsTable((t) => !t)} aria-pressed={asTable}>
                {asTable ? <BarChart3 size={14} aria-hidden="true" /> : <Table2 size={14} aria-hidden="true" />}
                {asTable ? "Show chart" : "Show as table"}
              </Button>
            }
          >
            {data.total === 0 ? (
              <Empty title="No signals in this period">They arrive as people use guidance inside a mapped hospital.</Empty>
            ) : asTable ? (
              <div className="max-h-80 overflow-y-auto">
                <table className="w-full text-left text-[13px]">
                  <thead className="sticky top-0 bg-white text-[11.5px] uppercase tracking-[0.06em] text-wf-muted">
                    <tr>
                      <th className="py-1.5 font-semibold">Day</th>
                      <th className="py-1.5 text-right font-semibold">All</th>
                      {kinds.map((k) => (
                        <th key={k} className="py-1.5 text-right font-semibold">
                          {KIND_LABELS[k] ?? k}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-wf-border-faint">
                    {[...series].reverse().map((d) => (
                      <tr key={d.day}>
                        <td className="py-1.5 text-wf-body">{dayLabel(d.day)}</td>
                        <td className="py-1.5 text-right font-semibold text-wf-ink">{fmtNumber(d.total)}</td>
                        {kinds.map((k) => (
                          <td key={k} className="py-1.5 text-right text-wf-body">
                            {fmtNumber(d.kinds[k] ?? 0)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <DailyChart days={series} />
            )}
          </Card>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_380px]">
            <Card title="Busiest hospitals">
              {data.venues.length === 0 ? (
                <p className="text-[13.5px] text-wf-muted">No activity in this period.</p>
              ) : (
                <ul className="space-y-2.5">
                  {data.venues.map((v) => (
                    <li key={v.venueKey}>
                      <div className="flex items-baseline justify-between gap-3 text-[13.5px]">
                        <span className="truncate text-wf-ink" title={v.venueKey}>
                          {v.venue}
                        </span>
                        <span className="flex-shrink-0 text-wf-muted">
                          <span className="font-semibold text-wf-ink">{fmtNumber(v.count)}</span> · {fmtNumber(v.devices)} device{v.devices === 1 ? "" : "s"}
                        </span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-wf-surface">
                        <div className="h-2 rounded-full bg-wf-primary" style={{ width: `${Math.max(2, (v.count / topMax) * 100)}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title="Data retention">
              <p className="text-[13.5px] leading-relaxed text-wf-body">
                Signals are kept for {data.retention.days} days, as the privacy notes recommend: by then any map correction they support has been made.
              </p>
              <dl className="mt-3 space-y-1.5 text-[13.5px]">
                <div className="flex justify-between gap-3">
                  <dt className="text-wf-muted">Older than {data.retention.days} days</dt>
                  <dd className="font-semibold text-wf-ink">{fmtNumber(data.retention.older)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-wf-muted">Oldest signal</dt>
                  <dd className="text-wf-ink">{fmtDate(data.retention.oldest, false)}</dd>
                </div>
              </dl>
              {staff.can("data.purge") && (
                <Button
                  className="mt-4"
                  tone={data.retention.older > 0 ? "danger" : "secondary"}
                  disabled={data.retention.older === 0}
                  onClick={() =>
                    setConfirm({
                      title: `Delete ${fmtNumber(data.retention.older)} old signals?`,
                      body: <>Signals older than {data.retention.days} days are deleted for good. Newer ones, and everything already learned from them, stay.</>,
                      confirmLabel: "Delete old signals",
                      danger: true,
                      run: async () => {
                        const r = await adminSend<{ deleted: number }>("POST", "/api/admin/activity/purge", { olderThanDays: data.retention.days })
                        toast.success(`${fmtNumber(r.deleted)} old signals deleted`)
                        reload()
                      },
                    })
                  }
                >
                  <Trash2 size={14} aria-hidden="true" /> Delete signals older than {data.retention.days} days
                </Button>
              )}
            </Card>
          </div>
        </>
      )}
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </>
  )
}
