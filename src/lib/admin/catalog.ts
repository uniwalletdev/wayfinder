import { SEED_VENUES } from "@/lib/venues"
import type { Venue } from "@/lib/types"

// The venues that ship with the build, as an inventory an operator can audit.
//
// These are not rows in a database and nothing in the back office can edit them
// — they are TypeScript modules under src/lib/venues/, most of them written by
// the ingestion pipeline in scripts/nhs/. What the portal can do is *measure*
// them, which is the question that actually gets asked: of the hundreds of
// hospitals this app claims to cover, how many can someone genuinely navigate
// inside? A venue with a located pin and no floor plan is a dot on a map; a
// venue with plans, waypoints and a corridor network is a working map. The
// difference is invisible from the picker and obvious here.

export type CoverageTier = "navigable" | "sheet" | "located"

export interface CatalogEntry {
  id: string
  slug: string
  name: string
  subtitle?: string
  category: string
  visibility: string
  verified: boolean
  lat: number
  lng: number
  floorPlans: number
  waypoints: number
  trails: number
  assets: number
  /** Distinct floors that have a plan image. */
  floors: number
  odsCode?: string
  postcode?: string
  dataSource?: string
  tier: CoverageTier
}

/**
 * How complete a shipped venue is, in the terms that decide what a person can do
 * with it:
 *
 *   navigable — has floor plans AND places to route between. Someone can search
 *               a ward and be walked to it.
 *   sheet     — has a plan image but nothing named on it yet. You can see the
 *               site; you cannot ask for a destination.
 *   located   — a pin and nothing else. The starting point for surveying.
 */
export function coverageTier(v: Venue): CoverageTier {
  const plans = v.floorPlans?.length ?? 0
  const waypoints = v.waypoints?.length ?? 0
  if (plans > 0 && waypoints > 0) return "navigable"
  if (plans > 0) return "sheet"
  return "located"
}

function toEntry(v: Venue): CatalogEntry {
  return {
    id: v.id,
    slug: v.slug,
    name: v.name,
    subtitle: v.subtitle,
    category: v.category,
    visibility: v.visibility,
    verified: v.verified,
    lat: v.center.lat,
    lng: v.center.lng,
    floorPlans: v.floorPlans?.length ?? 0,
    waypoints: v.waypoints?.length ?? 0,
    trails: v.trails?.length ?? 0,
    assets: v.assets?.length ?? 0,
    floors: new Set((v.floorPlans ?? []).map((p) => p.floor)).size,
    odsCode: v.odsCode,
    postcode: v.postcode,
    dataSource: v.dataSource,
    tier: coverageTier(v),
  }
}

// Built once per process: SEED_VENUES is a module-level constant, so nothing
// here can go stale, and the NHS directory is large enough that re-deriving it
// per request would be wasteful.
let cached: CatalogEntry[] | null = null

export function catalogEntries(): CatalogEntry[] {
  if (!cached) cached = SEED_VENUES.map(toEntry)
  return cached
}

export interface CatalogSummary {
  total: number
  navigable: number
  sheet: number
  located: number
  verified: number
  floorPlans: number
  waypoints: number
  trails: number
  byCategory: { category: string; count: number }[]
}

export function catalogSummary(): CatalogSummary {
  const entries = catalogEntries()
  const byCategory = new Map<string, number>()
  let navigable = 0
  let sheet = 0
  let located = 0
  let verified = 0
  let floorPlans = 0
  let waypoints = 0
  let trails = 0

  for (const e of entries) {
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + 1)
    if (e.tier === "navigable") navigable++
    else if (e.tier === "sheet") sheet++
    else located++
    if (e.verified) verified++
    floorPlans += e.floorPlans
    waypoints += e.waypoints
    trails += e.trails
  }

  return {
    total: entries.length,
    navigable,
    sheet,
    located,
    verified,
    floorPlans,
    waypoints,
    trails,
    byCategory: [...byCategory.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count),
  }
}

export interface CatalogQuery {
  q?: string
  tier?: CoverageTier | "all"
  category?: string
  page?: number
  pageSize?: number
}

export function queryCatalog(params: CatalogQuery): {
  rows: CatalogEntry[]
  total: number
  page: number
  pageSize: number
} {
  const q = (params.q ?? "").trim().toLowerCase()
  const tier = params.tier ?? "all"
  const category = params.category ?? "all"
  const pageSize = Math.min(Math.max(params.pageSize ?? 50, 10), 200)

  let rows = catalogEntries()
  if (q) {
    rows = rows.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        (e.subtitle ?? "").toLowerCase().includes(q) ||
        (e.postcode ?? "").toLowerCase().includes(q) ||
        (e.odsCode ?? "").toLowerCase().includes(q) ||
        e.slug.includes(q)
    )
  }
  if (tier !== "all") rows = rows.filter((e) => e.tier === tier)
  if (category !== "all") rows = rows.filter((e) => e.category === category)

  // Most-mapped first: the venues worth looking at are the ones with something
  // in them, and an operator scanning for gaps can sort by filtering to
  // "located" instead.
  rows = [...rows].sort(
    (a, b) => b.floorPlans - a.floorPlans || b.waypoints - a.waypoints || a.name.localeCompare(b.name)
  )

  const total = rows.length
  const page = Math.max(1, Math.min(params.page ?? 1, Math.max(1, Math.ceil(total / pageSize))))
  const start = (page - 1) * pageSize
  return { rows: rows.slice(start, start + pageSize), total, page, pageSize }
}

/** Name for a venue id that ships with the build, for labelling pooled data. */
export function catalogLabel(id: string): string | null {
  return catalogEntries().find((e) => e.id === id)?.name ?? null
}

export function catalogById(id: string): CatalogEntry | null {
  return catalogEntries().find((e) => e.id === id) ?? null
}
