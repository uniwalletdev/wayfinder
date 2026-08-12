import Link from "next/link"
import { ReopenDemand, ResolveDemand } from "@/components/admin/DemandActions"
import { FilterForm } from "@/components/admin/forms"
import { resolutionLabel } from "@/components/admin/labels"
import {
  Badge,
  BTN_QUIET,
  Card,
  EmptyState,
  INPUT,
  Notice,
  PageHeader,
  Pagination,
  TABLE,
  TABLE_SCROLL,
  TD,
  TH,
  formatNumber,
  timeAgo,
} from "@/components/admin/ui"
import { listDemand } from "@/lib/admin/data"

// What people looked for and did not find.
//
// This is the most direct product feedback the app collects: somebody standing
// in a hospital, typing what they were told to find, getting nothing. Each row
// is a gap between how a building signs itself and how the map names itself —
// "EAU", "Fracture clinic", a consultant's surname on an appointment letter.
//
// Rows are grouped by venue and search text, case-insensitively, so ten people
// looking for the same ward is one line with a count rather than ten lines.
// Closing an entry closes every repeat of it, and asks what actually happened,
// because "we mapped it" and "that is not a place" empty the queue equally and
// mean opposite things.

export const dynamic = "force-dynamic"

const SELECT = "rounded-xl border border-wf-border bg-white px-3 py-2.5 text-[13px] text-wf-ink outline-none focus:border-wf-primary"

export default async function DemandPage({
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
  const state = (one("state") ?? "open") as "open" | "resolved" | "all"
  const sort = (one("sort") ?? "hits") as "hits" | "recent"
  const venueKey = one("venueKey") ?? ""
  const page = Number(one("page") ?? "1") || 1

  const result = await listDemand({ q, state, sort, venueKey: venueKey || undefined, page })

  return (
    <>
      <PageHeader
        title="Unmet searches"
        description="Every search made inside the app that returned nothing, grouped by what was typed. The shortest route to knowing what the map is missing."
      />

      <FilterForm action="/admin/demand" className="mb-5 flex flex-wrap items-center gap-2.5">
        {venueKey ? <input type="hidden" name="venueKey" value={venueKey} /> : null}
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search what people typed…"
          aria-label="Search unmet searches"
          className={`${INPUT} max-w-[280px] flex-1`}
        />
        <select name="state" defaultValue={state} aria-label="Filter by state" className={SELECT}>
          <option value="open">Open</option>
          <option value="resolved">Closed</option>
          <option value="all">Open and closed</option>
        </select>
        <select name="sort" defaultValue={sort} aria-label="Sort" className={SELECT}>
          <option value="hits">Most searched</option>
          <option value="recent">Most recent</option>
        </select>
        <button type="submit" className={BTN_QUIET}>
          Apply
        </button>
        <Link href="/admin/demand" className="px-1 text-[12.5px] font-semibold text-wf-muted hover:text-wf-primary">
          Reset
        </Link>
      </FilterForm>

      {venueKey ? (
        <div className="mb-5">
          <Notice tone="info" title="Filtered to one venue">
            <p>
              Showing searches recorded inside a single venue.{" "}
              <Link href="/admin/demand" className="underline">
                Show every venue
              </Link>
              .
            </p>
          </Notice>
        </div>
      ) : null}

      {!result.ok ? (
        <Notice
          tone={result.reason === "unconfigured" ? "info" : "bad"}
          title={result.reason === "unconfigured" ? "No database configured" : "The searches could not be read"}
        >
          <p className="break-words">{result.message}</p>
        </Notice>
      ) : (
        <Card bodyClassName="">
          {result.data.rows.length === 0 ? (
            <EmptyState
              title={state === "open" ? "Nothing outstanding" : "Nothing here"}
              body={
                state === "open"
                  ? "Every search people made has found something — or everything recorded has already been dealt with."
                  : "Try a different filter."
              }
            />
          ) : (
            <div className={TABLE_SCROLL}>
              <table className={TABLE}>
                <thead>
                  <tr>
                    <th className={TH}>Searched for</th>
                    <th className={TH}>Where</th>
                    <th className={`${TH} text-right`}>Times</th>
                    <th className={TH}>Last seen</th>
                    <th className={TH}>State</th>
                    <th className={`${TH} text-right`}>Decision</th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.rows.map((d) => (
                    <tr key={`${d.venueKey}:${d.query}`} className="transition-colors hover:bg-wf-surface-2">
                      <td className={TD}>
                        <p className="font-medium text-wf-ink">{d.query}</p>
                        {d.suggested ? (
                          <p className="mt-0.5 text-[11.5px] text-wf-faint">The app offered a suggestion at the time</p>
                        ) : null}
                      </td>
                      <td className={TD}>
                        <span className="text-wf-body">{d.venueLabel}</span>
                      </td>
                      <td className={`${TD} text-right tabular-nums font-semibold text-wf-ink`}>{formatNumber(d.hits)}</td>
                      <td className={`${TD} whitespace-nowrap text-wf-muted`}>{timeAgo(d.lastSeen)}</td>
                      <td className={TD}>
                        <Badge tone={d.resolution ? "good" : "warn"}>{resolutionLabel(d.resolution)}</Badge>
                        {d.resolvedBy ? <p className="mt-0.5 text-[11px] text-wf-faint">by {d.resolvedBy}</p> : null}
                      </td>
                      <td className={`${TD} text-right`}>
                        {d.resolution ? (
                          <ReopenDemand venueKey={d.venueKey} query={d.query} />
                        ) : (
                          <ResolveDemand venueKey={d.venueKey} query={d.query} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination
            page={result.data.page}
            pageSize={result.data.pageSize}
            total={result.data.total}
            baseHref="/admin/demand"
            params={{ q, state, sort, venueKey }}
          />
        </Card>
      )}

      <div className="mt-6">
        <Notice tone="info" title="Where these come from">
          <p>
            Written by the app itself, fire-and-forget, when a search inside a venue returns no results
            (<code>/api/search-misses</code>). They carry the venue, the text and the time — never a device or a person.
            Free-text searches can still contain a name someone typed, so treat them as personal data:{" "}
            <Link href="/admin/privacy" className="underline">
              retention is managed here
            </Link>
            .
          </p>
        </Notice>
      </div>
    </>
  )
}
