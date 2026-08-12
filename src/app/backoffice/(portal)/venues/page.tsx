import Link from "next/link"
import { BadgeCheck } from "lucide-react"
import { FilterForm } from "@/components/backoffice/forms"
import { statusBadge, visibilityLabel } from "@/components/backoffice/labels"
import { QuickStatusButton } from "@/components/backoffice/VenueActions"
import {
  Badge,
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
  BTN_QUIET,
  formatNumber,
  timeAgo,
} from "@/components/backoffice/ui"
import { listVenues, type VenueSort } from "@/lib/backoffice/data"
import type { VenueStatus } from "@/lib/backoffice/types"

// Every venue somebody created through the app, and what to do about it.
//
// This is the moderation queue. A venue arrives here anonymously — POST
// /api/venues needs no account — and by default lands 'published', which means
// it is already in the picker every user sees. That default is deliberate (see
// db/migrations/0004_admin.sql) but it puts the burden here: this table is where
// someone notices that "Test test test" is being offered to patients next to
// Great Ormond Street.

export const dynamic = "force-dynamic"

const STATUSES: { value: VenueStatus | "all"; label: string }[] = [
  { value: "all", label: "Any state" },
  { value: "published", label: "Listed" },
  { value: "pending", label: "Held for review" },
  { value: "suppressed", label: "Hidden" },
]

const SORTS: { value: VenueSort; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "updated", label: "Recently changed" },
  { value: "name", label: "Name (A–Z)" },
  { value: "waypoints", label: "Most places" },
  { value: "activity", label: "Most walked" },
]

const SELECT = "rounded-xl border border-wf-border bg-white px-3 py-2.5 text-[13px] text-wf-ink outline-none focus:border-wf-primary"

export default async function VenuesPage({
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
  const status = (one("status") ?? "all") as VenueStatus | "all"
  const visibility = (one("visibility") ?? "all") as "public" | "unlisted" | "private" | "all"
  const verified = (one("verified") ?? "all") as "yes" | "no" | "all"
  const sort = (one("sort") ?? "newest") as VenueSort
  const page = Number(one("page") ?? "1") || 1

  const result = await listVenues({ q, status, visibility, verified, sort, page })

  return (
    <>
      <PageHeader
        title="Shared venues"
        description="Venues created in the app and stored on the server, where anyone else can use them. Listing, verification and deletion are decided here."
      />

      {one("deleted") ? <div className="mb-5"><Notice tone="good" title="Venue deleted">The venue and every place inside it have been removed.</Notice></div> : null}

      <FilterForm action="/backoffice/venues" className="mb-5 flex flex-wrap items-center gap-2.5">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search name or subtitle…"
          aria-label="Search venues"
          className={`${INPUT} max-w-[260px] flex-1`}
        />
        <select name="status" defaultValue={status} aria-label="Filter by state" className={SELECT}>
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <select name="visibility" defaultValue={visibility} aria-label="Filter by visibility" className={SELECT}>
          <option value="all">Any visibility</option>
          <option value="public">Public</option>
          <option value="unlisted">Unlisted</option>
          <option value="private">Private</option>
        </select>
        <select name="verified" defaultValue={verified} aria-label="Filter by verification" className={SELECT}>
          <option value="all">Verified or not</option>
          <option value="yes">Verified only</option>
          <option value="no">Unverified only</option>
        </select>
        <select name="sort" defaultValue={sort} aria-label="Sort" className={SELECT}>
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <button type="submit" className={BTN_QUIET}>
          Apply
        </button>
        <Link href="/backoffice/venues" className="px-1 text-[12.5px] font-semibold text-wf-muted hover:text-wf-primary">
          Reset
        </Link>
      </FilterForm>

      {!result.ok ? (
        <Notice
          tone={result.reason === "unconfigured" ? "info" : "bad"}
          title={result.reason === "unconfigured" ? "No database configured" : "The venues could not be read"}
        >
          <p className="break-words">{result.message}</p>
        </Notice>
      ) : (
        <Card bodyClassName="">
          {result.data.rows.length === 0 ? (
            <EmptyState
              title="No venues match"
              body={
                q || status !== "all" || visibility !== "all" || verified !== "all"
                  ? "Try widening the filters."
                  : "Venues created through “Map a place” in the app will appear here."
              }
            />
          ) : (
            <div className={TABLE_SCROLL}>
              <table className={TABLE}>
                <thead>
                  <tr>
                    <th className={TH}>Venue</th>
                    <th className={TH}>State</th>
                    <th className={TH}>Visibility</th>
                    <th className={`${TH} text-right`}>Places</th>
                    <th className={`${TH} text-right`}>Trails</th>
                    <th className={TH}>Created</th>
                    <th className={`${TH} text-right`}>Decision</th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.rows.map((v) => {
                    const badge = statusBadge(v.status)
                    const vis = visibilityLabel(v.visibility)
                    return (
                      <tr key={v.id} className="transition-colors hover:bg-wf-surface-2">
                        <td className={TD}>
                          <Link
                            href={`/backoffice/venues/${v.id}`}
                            className="font-semibold text-wf-ink hover:text-wf-primary"
                          >
                            {v.name}
                          </Link>
                          {v.verified ? (
                            <BadgeCheck size={14} className="ml-1 inline align-text-top text-wf-primary" aria-label="Verified" />
                          ) : null}
                          <p className="mt-0.5 text-[11.5px] text-wf-faint">
                            {v.subtitle ? `${v.subtitle} · ` : ""}
                            {v.category}
                          </p>
                        </td>
                        <td className={TD}>
                          <Badge tone={badge.tone}>{badge.label}</Badge>
                        </td>
                        <td className={TD}>
                          <Badge tone={vis.tone}>{vis.label}</Badge>
                        </td>
                        <td className={`${TD} text-right tabular-nums`}>{formatNumber(v.waypointCount)}</td>
                        <td className={`${TD} text-right tabular-nums`}>{formatNumber(v.signalCount)}</td>
                        <td className={`${TD} whitespace-nowrap text-wf-muted`}>{timeAgo(v.createdAt)}</td>
                        <td className={`${TD} text-right`}>
                          <div className="flex items-center justify-end gap-2">
                            {v.status !== "published" ? <QuickStatusButton venueId={v.id} to="published" /> : null}
                            {v.status === "published" ? <QuickStatusButton venueId={v.id} to="suppressed" /> : null}
                            <Link
                              href={`/backoffice/venues/${v.id}`}
                              className="text-[12.5px] font-semibold text-wf-primary hover:underline"
                            >
                              Open
                            </Link>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <Pagination
            page={result.data.page}
            pageSize={result.data.pageSize}
            total={result.data.total}
            baseHref="/backoffice/venues"
            params={{ q, status, visibility, verified, sort }}
          />
        </Card>
      )}
    </>
  )
}
