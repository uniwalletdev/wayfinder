import Link from "next/link"
import { BadgeCheck } from "lucide-react"
import { COVERAGE_SHADES, ShareBar } from "@/components/admin/charts"
import { FilterForm } from "@/components/admin/forms"
import { tierLabel } from "@/components/admin/labels"
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
} from "@/components/admin/ui"
import { catalogSummary, queryCatalog, type CoverageTier } from "@/lib/admin/catalog"

// The venues that ship with the build — the NHS directory and the hospitals that
// have been mapped inside — as an inventory to audit rather than edit.
//
// Nothing on this page has a save button, and that is the honest representation:
// these venues are TypeScript modules under src/lib/venues/, most of them written
// by the pipeline in scripts/nhs/. Changing one means changing the source and
// shipping a build. What this page is for is knowing *where the gaps are*: which
// hospitals are a working map, which are a picture of a site with nothing named
// on it, and which are still just a pin.

export const dynamic = "force-dynamic"

const SELECT = "rounded-xl border border-wf-border bg-white px-3 py-2.5 text-[13px] text-wf-ink outline-none focus:border-wf-primary"

export default async function CatalogPage({
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
  const tier = (one("tier") ?? "all") as CoverageTier | "all"
  const category = one("category") ?? "all"
  const page = Number(one("page") ?? "1") || 1

  const summary = catalogSummary()
  const { rows, total, pageSize } = queryCatalog({ q, tier, category, page })
  const currentPage = Math.max(1, Math.min(page, Math.max(1, Math.ceil(total / pageSize))))

  return (
    <>
      <PageHeader
        title="Venue catalogue"
        description="Every venue that ships with the app, and how complete each one is. Read-only: these are built from open data and trusts' own published plans, not from the database."
      />

      <div className="mb-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
        <Card title="Coverage" description="What a person arriving at each of these places can actually do.">
          <ShareBar
            segments={[
              { key: "navigable", label: "Navigable inside", value: summary.navigable, shade: COVERAGE_SHADES.navigable },
              { key: "sheet", label: "Plan only", value: summary.sheet, shade: COVERAGE_SHADES.sheet },
              { key: "located", label: "Located pin", value: summary.located, shade: COVERAGE_SHADES.located, ink: "#06336B" },
            ]}
          />
          <p className="mt-4 text-[12.5px] leading-relaxed text-wf-muted">
            A located pin still earns its place: it is what someone opens before surveying the building, and it is why
            searching for a hospital by name works at all. But only the first band can answer “where is Cardiology?”.
          </p>
        </Card>

        <Card title="By category">
          <ul className="flex flex-col gap-2">
            {summary.byCategory.map((c) => (
              <li key={c.category} className="flex items-center justify-between text-[13px]">
                <span className="text-wf-body">{c.category.charAt(0).toUpperCase() + c.category.slice(1)}</span>
                <span className="font-semibold tabular-nums text-wf-ink">{formatNumber(c.count)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t border-wf-border-faint pt-3.5 text-[12px] leading-relaxed text-wf-faint">
            {formatNumber(summary.verified)} of {formatNumber(summary.total)} are marked verified in their source module.
          </p>
        </Card>
      </div>

      <FilterForm action="/admin/catalog" className="mb-5 flex flex-wrap items-center gap-2.5">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search name, postcode or ODS code…"
          aria-label="Search the catalogue"
          className={`${INPUT} max-w-[300px] flex-1`}
        />
        <select name="tier" defaultValue={tier} aria-label="Filter by coverage" className={SELECT}>
          <option value="all">Any coverage</option>
          <option value="navigable">Navigable inside</option>
          <option value="sheet">Plan only</option>
          <option value="located">Located pin only</option>
        </select>
        <select name="category" defaultValue={category} aria-label="Filter by category" className={SELECT}>
          <option value="all">Any category</option>
          {summary.byCategory.map((c) => (
            <option key={c.category} value={c.category}>
              {c.category.charAt(0).toUpperCase() + c.category.slice(1)}
            </option>
          ))}
        </select>
        <button type="submit" className={BTN_QUIET}>
          Apply
        </button>
        <Link href="/admin/catalog" className="px-1 text-[12.5px] font-semibold text-wf-muted hover:text-wf-primary">
          Reset
        </Link>
      </FilterForm>

      {total === 0 ? (
        <Card>
          <EmptyState title="Nothing matches" body="Try a different name, or widen the coverage filter." />
        </Card>
      ) : (
        <Card bodyClassName="">
          <div className={TABLE_SCROLL}>
            <table className={TABLE}>
              <thead>
                <tr>
                  <th className={TH}>Venue</th>
                  <th className={TH}>Coverage</th>
                  <th className={`${TH} text-right`}>Floors</th>
                  <th className={`${TH} text-right`}>Plans</th>
                  <th className={`${TH} text-right`}>Places</th>
                  <th className={`${TH} text-right`}>Corridors</th>
                  <th className={TH}>Source</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => {
                  const tierInfo = tierLabel(e.tier)
                  return (
                    <tr key={e.id} className="transition-colors hover:bg-wf-surface-2">
                      <td className={TD}>
                        <p className="font-medium text-wf-ink">
                          {e.name}
                          {e.verified ? (
                            <BadgeCheck size={14} className="ml-1 inline align-text-top text-wf-primary" aria-label="Verified" />
                          ) : null}
                        </p>
                        <p className="mt-0.5 text-[11.5px] text-wf-faint">
                          {[e.subtitle, e.postcode, e.odsCode].filter(Boolean).join(" · ") || e.slug}
                        </p>
                      </td>
                      <td className={TD}>
                        <Badge tone={tierInfo.tone}>{tierInfo.label}</Badge>
                      </td>
                      <td className={`${TD} text-right tabular-nums`}>{e.floors || "—"}</td>
                      <td className={`${TD} text-right tabular-nums`}>{e.floorPlans || "—"}</td>
                      <td className={`${TD} text-right tabular-nums`}>{formatNumber(e.waypoints) || "—"}</td>
                      <td className={`${TD} text-right tabular-nums`}>{e.trails || "—"}</td>
                      <td className={`${TD} text-[12px] text-wf-faint`}>{e.dataSource ?? "Hand-built"}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            page={currentPage}
            pageSize={pageSize}
            total={total}
            baseHref="/admin/catalog"
            params={{ q, tier, category }}
          />
        </Card>
      )}

      <div className="mt-6">
        <Notice tone="info" title="Changing what is in here">
          <p>
            The catalogue is rebuilt by the pipeline in <code>scripts/nhs/</code> — <code>npm run nhs:refresh</code> for
            the directory, <code>npm run nhs:ingest</code> to turn newly-found site plans into mapped venues. A monthly
            GitHub Action opens the refresh as a pull request, so thousands of moved pins always get a human review.
          </p>
        </Notice>
      </div>
    </>
  )
}
