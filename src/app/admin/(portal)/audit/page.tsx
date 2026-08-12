import Link from "next/link"
import { FilterForm } from "@/components/admin/forms"
import { humanise } from "@/components/admin/labels"
import {
  Badge,
  BTN_QUIET,
  Card,
  EmptyState,
  INPUT,
  Notice,
  PageHeader,
  Pagination,
  formatDateTime,
} from "@/components/admin/ui"
import { isUuid, listAudit } from "@/lib/admin/data"

// Who did what, and what it used to be.
//
// Append-only: nothing in the portal writes to this table except the actions
// themselves, and no screen offers to edit or delete a row. That is what makes
// it usable as evidence — for the mapper whose venue was hidden, for a partner
// trust asking why a ward disappeared, and for the next operator trying to work
// out whether a change was deliberate.
//
// Each entry carries the before/after of the fields that moved, shown inline, so
// a decision can be reconstructed without going to the database.

export const dynamic = "force-dynamic"

const SELECT = "rounded-xl border border-wf-border bg-white px-3 py-2.5 text-[13px] text-wf-ink outline-none focus:border-wf-primary"

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const one = (key: string): string | undefined => {
    const v = sp[key]
    return Array.isArray(v) ? v[0] : v
  }

  const q = one("q") ?? ""
  const action = one("action") ?? "all"
  const page = Number(one("page") ?? "1") || 1

  const result = await listAudit({ q, action, page })

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Every change made from the back office, with who made it and what it replaced. Nothing in here can be edited or removed."
      />

      {!result.ok ? (
        <Notice
          tone={result.reason === "unconfigured" ? "info" : "bad"}
          title={result.reason === "unconfigured" ? "No database configured" : "The audit log could not be read"}
        >
          <p className="break-words">{result.message}</p>
        </Notice>
      ) : (
        <>
          <FilterForm action="/admin/audit" className="mb-5 flex flex-wrap items-center gap-2.5">
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Search by what changed, or who changed it…"
              aria-label="Search the audit log"
              className={`${INPUT} max-w-[320px] flex-1`}
            />
            <select name="action" defaultValue={action} aria-label="Filter by action" className={SELECT}>
              <option value="all">Every action</option>
              {result.data.actions.map((a) => (
                <option key={a} value={a}>
                  {humanise(a)}
                </option>
              ))}
            </select>
            <button type="submit" className={BTN_QUIET}>
              Apply
            </button>
            <Link href="/admin/audit" className="px-1 text-[12.5px] font-semibold text-wf-muted hover:text-wf-primary">
              Reset
            </Link>
          </FilterForm>

          <Card bodyClassName="">
            {result.data.rows.length === 0 ? (
              <EmptyState
                title="Nothing recorded"
                body={q || action !== "all" ? "No entries match those filters." : "Actions taken in the back office will appear here."}
              />
            ) : (
              <ul className="divide-y divide-wf-border-faint">
                {result.data.rows.map((entry) => {
                  const changed = entry.detail?.changed as Record<string, { from: unknown; to: unknown }> | undefined
                  const venueId = typeof entry.detail?.venueId === "string" ? entry.detail.venueId : null
                  return (
                    <li key={entry.id} className="px-5 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[13.5px] leading-snug text-wf-ink">{entry.summary}</p>
                          <p className="mt-1 text-[12px] text-wf-faint">
                            {entry.actor} · {formatDateTime(entry.createdAt)}
                            {venueId && isUuid(venueId) ? (
                              <>
                                {" · "}
                                <Link href={`/admin/venues/${venueId}`} className="font-semibold text-wf-primary hover:underline">
                                  open the venue
                                </Link>
                              </>
                            ) : null}
                          </p>
                        </div>
                        <Badge>{humanise(entry.action)}</Badge>
                      </div>

                      {changed && Object.keys(changed).length > 0 ? (
                        <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 rounded-xl bg-wf-surface px-3.5 py-2.5">
                          {Object.entries(changed).map(([field, move]) => (
                            <div key={field} className="text-[12px]">
                              <dt className="inline font-semibold text-wf-body">{humanise(field)}: </dt>
                              <dd className="inline text-wf-muted">
                                <span className="line-through">{render(move?.from)}</span>
                                {" → "}
                                <span className="text-wf-ink">{render(move?.to)}</span>
                              </dd>
                            </div>
                          ))}
                        </dl>
                      ) : null}

                      {entry.action.startsWith("venue.") && typeof entry.detail?.note === "string" && entry.detail.note ? (
                        <p className="mt-2.5 text-[12.5px] leading-relaxed text-wf-body">Reason: “{entry.detail.note}”</p>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            )}
            <Pagination
              page={result.data.page}
              pageSize={result.data.pageSize}
              total={result.data.total}
              baseHref="/admin/audit"
              params={{ q, action }}
            />
          </Card>
        </>
      )}
    </>
  )
}

/** Render a before/after value compactly, without pretending null is a string. */
function render(value: unknown): string {
  if (value === null || value === undefined || value === "") return "empty"
  if (typeof value === "boolean") return value ? "yes" : "no"
  if (typeof value === "number") return String(value)
  if (typeof value === "string") return value.length > 60 ? `${value.slice(0, 60)}…` : value
  return JSON.stringify(value)
}
