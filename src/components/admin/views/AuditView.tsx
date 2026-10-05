"use client"
import { useState } from "react"
import { useAdmin, useDebounced, PageHeader, Table, Td, Select, SearchBox, Pager, Loading, ErrorState, Empty, fmtDate } from "../ui"
import { actionLabel, ACTION_GROUPS } from "./audit-labels"

interface Entry {
  id: string
  actorId: string
  actorEmail: string | null
  action: string
  target: string | null
  detail: Record<string, unknown>
  createdAt: string
}

export default function AuditView() {
  const [action, setAction] = useState("")
  const [q, setQ] = useState("")
  const [page, setPage] = useState(1)
  const query = useDebounced(q)
  const params = new URLSearchParams({ page: String(page) })
  if (action) params.set("action", action)
  if (query) params.set("q", query)
  const { data, error, loading, reload } = useAdmin<{ entries: Entry[]; total: number; page: number; perPage: number }>(`/api/admin/audit?${params}`)
  return (
    <>
      <PageHeader title="Audit log" description="Every change made in the back office: who made it, what changed and when. Entries cannot be edited or removed here." />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select label="Kind" value={action} onChange={(v) => { setAction(v); setPage(1) }} options={ACTION_GROUPS} />
        <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder="Search by person or detail" />
      </div>
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !data ? (
        <Loading />
      ) : (
        <>
          <Table head={["When", "Who", "Change"]} empty={data.entries.length === 0 ? <Empty title="No changes recorded">Changes appear here as staff make them.</Empty> : null}>
            {data.entries.map((e) => (
              <tr key={e.id} className={loading ? "opacity-60" : ""}>
                <Td className="whitespace-nowrap text-wf-muted">{fmtDate(e.createdAt)}</Td>
                <Td className="max-w-[220px]">
                  <span className="block truncate">{e.actorEmail ?? e.actorId}</span>
                </Td>
                <Td>
                  <p className="text-wf-ink">{actionLabel(e.action, e.detail)}</p>
                  <p className="font-mono text-[11.5px] text-wf-faint">
                    {e.action}
                    {e.target ? ` · ${e.target}` : ""}
                  </p>
                </Td>
              </tr>
            ))}
          </Table>
          <Pager page={data.page} perPage={data.perPage} total={data.total} onPage={setPage} />
        </>
      )}
    </>
  )
}
