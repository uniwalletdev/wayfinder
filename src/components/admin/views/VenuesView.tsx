"use client"
import { useState } from "react"
import { ExternalLink, Trash2, BadgeCheck } from "lucide-react"
import { useAdmin, adminSend, useDebounced, PageHeader, Table, Td, Badge, Button, Select, SearchBox, Pager, Loading, ErrorState, Empty, ConfirmDialog, type ConfirmRequest, fmtAgo, fmtNumber, errorText } from "../ui"
import { useStaff } from "../AdminShell"
import { toast } from "@/components/Toast"

interface AdminVenue {
  id: string
  name: string
  subtitle: string | null
  category: string
  visibility: "public" | "unlisted" | "private"
  ownerId: string | null
  ownerEmail: string | null
  verified: boolean
  waypoints: number
  createdAt: string
}

const VIS_TONE = { public: "green", unlisted: "amber", private: "neutral" } as const

export default function VenuesView() {
  const staff = useStaff()
  const canEdit = staff.can("venues.edit")
  const [q, setQ] = useState("")
  const [visibility, setVisibility] = useState("")
  const [verified, setVerified] = useState("")
  const [page, setPage] = useState(1)
  const query = useDebounced(q)
  const params = new URLSearchParams({ page: String(page) })
  if (query) params.set("q", query)
  if (visibility) params.set("visibility", visibility)
  if (verified) params.set("verified", verified)
  const { data, error, loading, reload } = useAdmin<{ venues: AdminVenue[]; total: number; page: number; perPage: number }>(`/api/admin/venues?${params}`)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const patch = async (v: AdminVenue, change: { visibility?: string; verified?: boolean }, done: string) => {
    setBusy(v.id)
    try {
      await adminSend("PATCH", `/api/admin/venues/${v.id}`, change)
      toast.success(done)
      reload()
    } catch (err) {
      toast.error("Could not change the venue", errorText(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <PageHeader
        title="Shared venues"
        description="Places people have mapped and shared from Findway. Public ones are listed for everyone; unlisted and private ones open only by link or for their owner. Verified venues show a verified badge in the app."
      />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder="Search venues" />
        <Select label="Visibility" value={visibility} onChange={(v) => { setVisibility(v); setPage(1) }} options={[{ value: "", label: "Any visibility" }, { value: "public", label: "Public" }, { value: "unlisted", label: "Unlisted" }, { value: "private", label: "Private" }]} />
        <Select label="Verified" value={verified} onChange={(v) => { setVerified(v); setPage(1) }} options={[{ value: "", label: "Verified or not" }, { value: "true", label: "Verified" }, { value: "false", label: "Not verified" }]} />
      </div>
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !data ? (
        <Loading />
      ) : (
        <>
          <Table
            head={["Venue", "Visibility", "Verified", "Places", "Owner", "Created", ""]}
            empty={data.venues.length === 0 ? <Empty title={q || visibility || verified ? "No venues match" : "No shared venues yet"}>Venues appear here when someone maps a place and shares it.</Empty> : null}
          >
            {data.venues.map((v) => (
              <tr key={v.id} className={busy === v.id || loading ? "opacity-60" : ""}>
                <Td>
                  <p className="font-semibold text-wf-ink">{v.name}</p>
                  <p className="text-[12.5px] text-wf-muted">{v.subtitle || v.category}</p>
                </Td>
                <Td>
                  {canEdit ? (
                    <select
                      value={v.visibility}
                      aria-label={`Visibility of ${v.name}`}
                      disabled={busy === v.id}
                      onChange={(e) => patch(v, { visibility: e.target.value }, `${v.name} is now ${e.target.value}`)}
                      className="rounded-lg border border-wf-border bg-white px-2 py-1 text-[13px]"
                    >
                      <option value="public">Public</option>
                      <option value="unlisted">Unlisted</option>
                      <option value="private">Private</option>
                    </select>
                  ) : (
                    <Badge tone={VIS_TONE[v.visibility]}>{v.visibility}</Badge>
                  )}
                </Td>
                <Td>
                  {canEdit ? (
                    <Button size="sm" tone={v.verified ? "secondary" : "ghost"} disabled={busy === v.id} onClick={() => patch(v, { verified: !v.verified }, v.verified ? `${v.name} is no longer verified` : `${v.name} verified`)}>
                      <BadgeCheck size={14} className={v.verified ? "text-wf-primary" : "text-wf-faint"} aria-hidden="true" />
                      {v.verified ? "Verified" : "Verify"}
                    </Button>
                  ) : v.verified ? (
                    <Badge tone="primary">Verified</Badge>
                  ) : (
                    <span className="text-wf-faint">—</span>
                  )}
                </Td>
                <Td>{fmtNumber(v.waypoints)}</Td>
                <Td className="max-w-[200px]">
                  <span className="block truncate text-[13px] text-wf-body">{v.ownerEmail ?? (v.ownerId ? "An account" : "Device only")}</span>
                </Td>
                <Td className="whitespace-nowrap text-wf-muted">{fmtAgo(v.createdAt)}</Td>
                <Td>
                  <div className="flex justify-end gap-1">
                    <a href={`/navigate?venue=${encodeURIComponent(v.id)}`} target="_blank" rel="noreferrer" className="rounded-lg p-1.5 text-wf-muted hover:bg-wf-surface hover:text-wf-primary" aria-label={`Open ${v.name} in the map`} title="Open in the map">
                      <ExternalLink size={15} />
                    </a>
                    {canEdit && (
                      <button
                        className="rounded-lg p-1.5 text-wf-muted hover:bg-red-50 hover:text-red-600"
                        aria-label={`Delete ${v.name}`}
                        title="Delete"
                        onClick={() =>
                          setConfirm({
                            title: `Delete “${v.name}”?`,
                            body: <>This removes the venue and its {v.waypoints} mapped places for everyone, including its owner. It cannot be undone.</>,
                            confirmLabel: "Delete venue",
                            danger: true,
                            typeToConfirm: v.name,
                            run: async () => {
                              await adminSend("DELETE", `/api/admin/venues/${v.id}`)
                              toast.success(`${v.name} deleted`)
                              reload()
                            },
                          })
                        }
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </Td>
              </tr>
            ))}
          </Table>
          <Pager page={data.page} perPage={data.perPage} total={data.total} onPage={setPage} />
        </>
      )}
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </>
  )
}
