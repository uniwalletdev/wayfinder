"use client"
import { useState } from "react"
import { Download, CheckCheck, Undo2 } from "lucide-react"
import { useAdmin, adminSend, useDebounced, PageHeader, Table, Td, Badge, Button, Select, SearchBox, Loading, ErrorState, Empty, fmtAgo, errorText, downloadCsv } from "../ui"
import { useStaff } from "../AdminShell"
import { toast } from "@/components/Toast"

interface MissGroup {
  venueKey: string
  venue: string
  query: string
  count: number
  suggested: number
  firstSeen: string
  lastSeen: string
  resolvedAt: string | null
}

export default function SearchesView() {
  const staff = useStaff()
  const canEdit = staff.can("searches.edit")
  const [status, setStatus] = useState<"open" | "resolved">("open")
  const [days, setDays] = useState("30")
  const [q, setQ] = useState("")
  const query = useDebounced(q)
  const params = new URLSearchParams({ status, days })
  if (query) params.set("q", query)
  const { data, error, loading, reload } = useAdmin<{ groups: MissGroup[] }>(`/api/admin/searches?${params}`)
  const [busy, setBusy] = useState<string | null>(null)

  const setResolved = async (g: MissGroup, resolved: boolean) => {
    const key = `${g.venueKey}|${g.query}`
    setBusy(key)
    try {
      await adminSend("PATCH", "/api/admin/searches", { venueKey: g.venueKey, query: g.query, resolved })
      toast.success(resolved ? `“${g.query}” marked resolved` : `“${g.query}” reopened`)
      reload()
    } catch (err) {
      toast.error("Could not update the search", errorText(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <PageHeader
        title="Missed searches"
        description="What people searched for inside a hospital and did not find. A place searched for often is worth adding to the map; mark it resolved once it is. “Suggested” counts the people who pressed Suggest this place."
        actions={
          <Button
            disabled={!data?.groups.length}
            onClick={() =>
              downloadCsv(`findway-missed-searches-${status}-${days}d.csv`, [
                ["Search", "Venue", "Venue id", "Times", "Suggested", "First seen", "Last seen"],
                ...(data?.groups ?? []).map((g) => [g.query, g.venue, g.venueKey, g.count, g.suggested, g.firstSeen, g.lastSeen]),
              ])
            }
          >
            <Download size={14} aria-hidden="true" /> Export CSV
          </Button>
        }
      />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex rounded-xl border border-wf-border bg-white p-0.5" role="tablist">
          {(["open", "resolved"] as const).map((s) => (
            <button key={s} role="tab" aria-selected={status === s} onClick={() => setStatus(s)} className={`rounded-[10px] px-3.5 py-1.5 text-[13px] font-semibold ${status === s ? "bg-wf-primary text-white" : "text-wf-body"}`}>
              {s === "open" ? "To review" : "Resolved"}
            </button>
          ))}
        </div>
        <Select label="Period" value={days} onChange={setDays} options={[{ value: "7", label: "Last 7 days" }, { value: "30", label: "Last 30 days" }, { value: "90", label: "Last 90 days" }, { value: "365", label: "Last year" }]} />
        <SearchBox value={q} onChange={setQ} placeholder="Filter searches" />
      </div>
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !data ? (
        <Loading />
      ) : (
        <Table
          head={["Search", "Venue", "Times", "Suggested", "Last seen", ""]}
          empty={data.groups.length === 0 ? <Empty title={status === "open" ? "Nothing to review" : "Nothing resolved in this period"}>{status === "open" ? "Every missed search in this period has been dealt with." : undefined}</Empty> : null}
        >
          {data.groups.map((g) => {
            const key = `${g.venueKey}|${g.query}`
            return (
              <tr key={key} className={busy === key || loading ? "opacity-60" : ""}>
                <Td>
                  <span className="font-semibold text-wf-ink">“{g.query}”</span>
                </Td>
                <Td className="max-w-[260px]">
                  <span className="block truncate text-wf-body" title={g.venueKey}>
                    {g.venue}
                  </span>
                </Td>
                <Td>
                  <Badge tone={g.count >= 5 ? "amber" : "neutral"}>{g.count}×</Badge>
                </Td>
                <Td>{g.suggested ? <Badge tone="primary">{g.suggested}</Badge> : <span className="text-wf-faint">—</span>}</Td>
                <Td className="whitespace-nowrap text-wf-muted">{fmtAgo(g.lastSeen)}</Td>
                <Td>
                  {canEdit && (
                    <div className="flex justify-end">
                      {status === "open" ? (
                        <Button size="sm" disabled={busy === key} onClick={() => setResolved(g, true)}>
                          <CheckCheck size={14} aria-hidden="true" /> Resolved
                        </Button>
                      ) : (
                        <Button size="sm" tone="ghost" disabled={busy === key} onClick={() => setResolved(g, false)}>
                          <Undo2 size={14} aria-hidden="true" /> Reopen
                        </Button>
                      )}
                    </div>
                  )}
                </Td>
              </tr>
            )
          })}
        </Table>
      )}
    </>
  )
}
