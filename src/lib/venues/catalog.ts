import type { Venue, VenueSummary } from "../types"
import { DEFAULT_VENUE } from "./core"
import { MAPPED_VENUE_SUMMARIES, VENUE_LOADERS } from "./catalog-data"

// The client's view of the seed venues: summaries up front, interiors on
// demand.
//
// Before this, WayfinderApp imported the registry (index.ts) and with it every
// mapped hospital's floor plans, waypoints and corridor networks — plus the
// 2,000-row NHS directory — on first load. Now the default venue ships with the
// app, the mapped-venue summaries are a few kilobytes, the directory arrives
// when the places list or a directory link first needs it, and a hospital's
// module is fetched the moment someone opens it. Everything is cached for the
// life of the page, so a venue is never fetched twice.

export function summaryOf(v: Venue): VenueSummary {
  return {
    id: v.id,
    slug: v.slug,
    name: v.name,
    subtitle: v.subtitle,
    category: v.category,
    center: v.center,
    defaultZoom: v.defaultZoom,
    visibility: v.visibility,
    verified: v.verified,
    illustrative: v.illustrative,
    odsCode: v.odsCode,
    mapped: v.floorPlans.length > 0 || v.waypoints.length > 0,
  }
}

const DIRECTORY_PREFIX = "nhs-"

let directoryPromise: Promise<Venue[]> | null = null
function loadDirectory(): Promise<Venue[]> {
  if (!directoryPromise) {
    directoryPromise = import("./nhs-hospitals")
      .then((m) => m.NHS_HOSPITAL_VENUES)
      .catch((err) => {
        // A failed chunk (offline, first visit) is retried on the next call
        // rather than remembered as "no directory".
        directoryPromise = null
        throw err
      })
  }
  return directoryPromise
}

let catalogPromise: Promise<VenueSummary[]> | null = null
let catalogCache: VenueSummary[] | null = null

// Every public seed venue as a summary: the mapped hospitals first (registry
// order), then the located directory. The directory chunk is fetched on the
// first call.
export function loadCatalog(): Promise<VenueSummary[]> {
  if (!catalogPromise) {
    catalogPromise = loadDirectory()
      .then((directory) => {
        catalogCache = [...MAPPED_VENUE_SUMMARIES, ...directory.map(summaryOf)]
        return catalogCache
      })
      .catch((err) => {
        catalogPromise = null
        throw err
      })
  }
  return catalogPromise
}

// What is known without waiting: the mapped venues always, the directory too
// once it has loaded.
export function catalogSnapshot(): VenueSummary[] {
  return catalogCache ?? MAPPED_VENUE_SUMMARIES
}

const venueCache = new Map<string, Promise<Venue | null>>()

// A seed venue by id, fetching its module if this is the first time it is
// opened. null for an id no seed venue has (a user-created or server venue —
// the caller checks those itself — or a stale link).
export function loadVenue(id: string): Promise<Venue | null> {
  if (id === DEFAULT_VENUE.id) return Promise.resolve(DEFAULT_VENUE)
  const cached = venueCache.get(id)
  if (cached) return cached
  let p: Promise<Venue | null>
  const loader = VENUE_LOADERS[id]
  if (loader) p = loader()
  else if (id.startsWith(DIRECTORY_PREFIX)) p = loadDirectory().then((list) => list.find((v) => v.id === id) ?? null)
  else return Promise.resolve(null)
  const guarded = p.catch((err) => {
    venueCache.delete(id)
    throw err
  })
  venueCache.set(id, guarded)
  return guarded
}

// Whether an id names a seed venue this client could load, without loading
// it. Directory ids are only knowable once the directory is in, so they are
// assumed possible.
export function isSeedVenueId(id: string): boolean {
  return id === DEFAULT_VENUE.id || id in VENUE_LOADERS || id.startsWith(DIRECTORY_PREFIX)
}
