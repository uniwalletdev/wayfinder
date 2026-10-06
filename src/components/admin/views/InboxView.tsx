"use client"
import { useState } from "react"
import { CheckCheck, Undo2, Trash2, Ban, ExternalLink, Mail, Flag, MessageSquare } from "lucide-react"
import { useAdmin, adminSend, useDebounced, PageHeader, Badge, Button, Select, SearchBox, Pager, Loading, ErrorState, Empty, ConfirmDialog, type ConfirmRequest, fmtAgo, fmtDate, errorText } from "../ui"
import { useStaff } from "../AdminShell"
import { toast } from "@/components/Toast"
import { topicLabel } from "@/lib/feedback"

interface InboxPlace {
  visibility: string
  verified: boolean
  ownerId: string | null
  blockable: boolean
  blocked: boolean
  openReports: number
}

interface InboxItem {
  id: string
  kind: "report" | "support"
  topic: string
  venueId: string | null
  venueName: string | null
  message: string
  contactEmail: string | null
  source: string
  createdAt: string
  resolvedAt: string | null
  resolution: string | null
  place: InboxPlace | null
}

interface BlockedPublisher {
  key: string
  kind: "device" | "account"
  label: string
  venueName: string | null
  reason: string | null
  createdAt: string
}

const PER_PAGE = 50
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SOURCE_LABEL: Record<string, string> = { web: "Website", ios: "iPhone app", android: "Android app" }
const RESOLUTION_LABEL: Record<string, string> = {
  dismissed: "Dismissed",
  done: "Done",
  removed: "Place removed",
  removed_blocked: "Removed, publisher blocked",
}

type Tab = "open" | "resolved" | "blocked"

export default function InboxView() {
  const staff = useStaff()
  const canEdit = staff.can("inbox.edit")
  const canRemove = canEdit && staff.can("venues.edit")
  const [tab, setTab] = useState<Tab>("open")
  const [kind, setKind] = useState("")
  const [q, setQ] = useState("")
  const [page, setPage] = useState(1)
  const query = useDebounced(q)
  const params = new URLSearchParams({ status: tab === "resolved" ? "resolved" : "open", offset: String((page - 1) * PER_PAGE) })
  if (kind) params.set("kind", kind)
  if (query) params.set("q", query)
  const inbox = useAdmin<{ items: InboxItem[]; total: number; open: { report: number; support: number } }>(tab === "blocked" ? null : `/api/admin/inbox?${params}`)
  const blocked = useAdmin<{ blocked: BlockedPublisher[] }>(tab === "blocked" ? "/api/admin/blocked" : null)
  const [busy, setBusy] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)

  const act = async (item: InboxItem, action: "resolve" | "reopen", done: string) => {
    setBusy(item.id)
    try {
      await adminSend("PATCH", `/api/admin/inbox/${item.id}`, { action })
      toast.success(done)
      inbox.reload()
    } catch (err) {
      toast.error("Could not update the inbox", errorText(err))
    } finally {
      setBusy(null)
    }
  }

  const removePlace = (item: InboxItem, block: boolean) =>
    setConfirm({
      title: block ? `Remove “${item.venueName}” and block its publisher?` : `Remove “${item.venueName}”?`,
      body: (
        <>
          This deletes the place and everything mapped in it, for everyone, and closes {item.place && item.place.openReports > 1 ? `all ${item.place.openReports} open reports` : "the report"} about it. It cannot be undone.
          {block && " Whoever published it will no longer be able to share places from that device or account; you can unblock them under Blocked publishers."}
        </>
      ),
      confirmLabel: block ? "Remove and block" : "Remove place",
      danger: true,
      run: async () => {
        await adminSend("PATCH", `/api/admin/inbox/${item.id}`, { action: block ? "remove-and-block" : "remove-place" })
        toast.success(block ? `${item.venueName} removed and its publisher blocked` : `${item.venueName} removed`)
        inbox.reload()
      },
    })

  const unblock = (b: BlockedPublisher) =>
    setConfirm({
      title: "Unblock this publisher?",
      body: <>They will be able to share places again{b.venueName ? ` (blocked over “${b.venueName}”)` : ""}.</>,
      confirmLabel: "Unblock",
      run: async () => {
        await adminSend("DELETE", "/api/admin/blocked", { key: b.key })
        toast.success("Publisher unblocked")
        blocked.reload()
      },
    })

  const open = inbox.data?.open
  return (
    <>
      <PageHeader
        title="Inbox"
        description="Reports about places people published, sent from the app, and messages from the support page. Act on a report within a day: remove a place that breaks the rules, block whoever published it if it was deliberate, or dismiss the report. Reply to a message from your own email."
      />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex rounded-xl border border-wf-border bg-white p-0.5" role="tablist">
          {(["open", "resolved", "blocked"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => {
                setTab(t)
                setPage(1)
              }}
              className={`rounded-[10px] px-3.5 py-1.5 text-[13px] font-semibold ${tab === t ? "bg-wf-primary text-white" : "text-wf-body"}`}
            >
              {t === "open" ? `To review${open ? ` (${open.report + open.support})` : ""}` : t === "resolved" ? "Resolved" : "Blocked publishers"}
            </button>
          ))}
        </div>
        {tab !== "blocked" && (
          <>
            <Select
              label="Show"
              value={kind}
              onChange={(v) => {
                setKind(v)
                setPage(1)
              }}
              options={[
                { value: "", label: "Reports and messages" },
                { value: "report", label: `Reports${open ? ` · ${open.report} open` : ""}` },
                { value: "support", label: `Messages${open ? ` · ${open.support} open` : ""}` },
              ]}
            />
            <SearchBox
              value={q}
              onChange={(v) => {
                setQ(v)
                setPage(1)
              }}
              placeholder="Filter by text, place or email"
            />
          </>
        )}
      </div>

      {tab === "blocked" ? (
        blocked.error ? (
          <ErrorState error={blocked.error} onRetry={blocked.reload} />
        ) : !blocked.data ? (
          <Loading />
        ) : blocked.data.blocked.length === 0 ? (
          <div className="rounded-2xl border border-wf-border bg-white">
            <Empty title="Nobody is blocked">Publishers blocked from a report are listed here, and can be unblocked.</Empty>
          </div>
        ) : (
          <ul className="divide-y divide-wf-border-faint rounded-2xl border border-wf-border bg-white">
            {blocked.data.blocked.map((b) => (
              <li key={b.key} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold text-wf-ink">
                    {b.kind === "account" ? "Signed-in account" : b.label}
                    {b.kind === "account" && <span className="ml-2 font-mono text-[12px] font-normal text-wf-muted">{b.label}</span>}
                  </p>
                  <p className="truncate text-[12.5px] text-wf-muted">
                    {b.venueName ? `Over “${b.venueName}” · ` : ""}blocked {fmtAgo(b.createdAt)}
                  </p>
                </div>
                {canEdit && (
                  <Button size="sm" tone="ghost" onClick={() => unblock(b)}>
                    <Undo2 size={14} aria-hidden="true" /> Unblock
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )
      ) : inbox.error ? (
        <ErrorState error={inbox.error} onRetry={inbox.reload} />
      ) : !inbox.data ? (
        <Loading />
      ) : inbox.data.items.length === 0 ? (
        <div className="rounded-2xl border border-wf-border bg-white">
          <Empty title={tab === "open" ? "Nothing to review" : "Nothing resolved yet"}>{tab === "open" ? "Every report and message has been dealt with." : undefined}</Empty>
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {inbox.data.items.map((item) => {
              const report = item.kind === "report"
              const shared = !!item.venueId && UUID.test(item.venueId)
              return (
                <li key={item.id} className={`rounded-2xl border border-wf-border bg-white p-4 ${busy === item.id || inbox.loading ? "opacity-60" : ""}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    {report ? (
                      <Badge tone="red">
                        <Flag size={11} aria-hidden="true" /> Report
                      </Badge>
                    ) : (
                      <Badge tone="primary">
                        <MessageSquare size={11} aria-hidden="true" /> Message
                      </Badge>
                    )}
                    <span className="text-[13.5px] font-semibold text-wf-ink">{topicLabel(item.kind, item.topic)}</span>
                    <span className="text-[12.5px] text-wf-muted">
                      {SOURCE_LABEL[item.source] ?? item.source} · <time title={fmtDate(item.createdAt)}>{fmtAgo(item.createdAt)}</time>
                    </span>
                    {item.resolution && <Badge tone="neutral">{RESOLUTION_LABEL[item.resolution] ?? item.resolution}</Badge>}
                  </div>

                  {report && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="text-[14px] text-wf-body">
                        About <span className="font-semibold text-wf-ink">{item.venueName || item.venueId}</span>
                      </span>
                      {item.place ? (
                        <>
                          <Badge tone={item.place.visibility === "public" ? "green" : "amber"}>{item.place.visibility}</Badge>
                          {item.place.verified ? <Badge tone="primary">Verified</Badge> : <Badge tone="neutral">Unverified</Badge>}
                          {item.place.openReports > 1 && <Badge tone="amber">{item.place.openReports} open reports</Badge>}
                          {item.place.blocked && <Badge tone="red">Publisher blocked</Badge>}
                        </>
                      ) : shared ? (
                        <Badge tone="neutral">Already removed</Badge>
                      ) : (
                        <Badge tone="neutral">Findway map</Badge>
                      )}
                      {item.venueId && (item.place || !shared) && (
                        <a
                          href={`/navigate?venue=${encodeURIComponent(item.venueId)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-wf-primary"
                        >
                          Open in the map <ExternalLink size={12} aria-hidden="true" />
                        </a>
                      )}
                    </div>
                  )}

                  {item.message ? (
                    <p className="mt-2 whitespace-pre-wrap break-words text-[14px] leading-relaxed text-wf-body">{item.message}</p>
                  ) : (
                    <p className="mt-2 text-[13.5px] italic text-wf-faint">No details given.</p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    {item.contactEmail ? (
                      <a
                        href={`mailto:${item.contactEmail}?subject=${encodeURIComponent(report ? `Your report about ${item.venueName ?? "a place"} on Findway` : "Your message to Findway")}`}
                        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-wf-primary"
                      >
                        <Mail size={14} aria-hidden="true" /> Reply to {item.contactEmail}
                      </a>
                    ) : (
                      <span className="text-[12.5px] text-wf-faint">No email given</span>
                    )}
                    {canEdit && (
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {tab === "resolved" ? (
                          <Button size="sm" tone="ghost" disabled={busy === item.id} onClick={() => act(item, "reopen", "Back on the list")}>
                            <Undo2 size={14} aria-hidden="true" /> Reopen
                          </Button>
                        ) : (
                          <>
                            {/* Least to most severe, left to right. */}
                            <Button size="sm" disabled={busy === item.id} onClick={() => act(item, "resolve", report && item.place ? "Report dismissed" : "Marked done")}>
                              <CheckCheck size={14} aria-hidden="true" /> {report && item.place ? "Dismiss" : "Done"}
                            </Button>
                            {report && item.place && canRemove && (
                              <>
                                <Button size="sm" tone="danger" onClick={() => removePlace(item, false)}>
                                  <Trash2 size={14} aria-hidden="true" /> Remove place
                                </Button>
                                {item.place.blockable && !item.place.blocked && (
                                  <Button size="sm" tone="danger" onClick={() => removePlace(item, true)}>
                                    <Ban size={14} aria-hidden="true" /> Remove and block
                                  </Button>
                                )}
                              </>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
          <Pager page={page} perPage={PER_PAGE} total={inbox.data.total} onPage={setPage} />
        </>
      )}
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </>
  )
}
