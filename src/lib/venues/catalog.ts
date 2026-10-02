import type { Venue, VenueSummary } from "../types"
import { DEFAULT_VENUE, slugify } from "./core"
import { HOME_COUNTRY, countryName } from "../country"
import { worldUrl } from "../app-shell"
import { MAPPED_VENUE_SUMMARIES, VENUE_LOADERS } from "./catalog-data"

// The client's view of the seed venues: summaries up front, interiors on
// demand, and only the visitor's own country's directory.
//
// Before this, WayfinderApp imported the registry (index.ts) and with it every
// mapped hospital's floor plans, waypoints and corridor networks — plus the
// 2,000-row NHS directory — on first load. Now the default venue ships with the
// app, the mapped-venue summaries are a few kilobytes, the directory arrives
// when the places list or a directory link first needs it, and a hospital's
// module is fetched the moment someone opens it. Everything is cached for the
// life of the page, so a venue is never fetched twice.
//
// Directories are per country. The UK's is the NHS register, a module in the
// bundle. Every other country's is a file built from OpenStreetMap by
// scripts/world/build.mjs and served from /world/<CC>.json — static on the
// web, fetched from the website by the apps (see worldUrl) — so a visitor in
// Luxembourg downloads Luxembourg's hospitals and nobody else's.

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
    country: v.country,
    mapped: v.floorPlans.length > 0 || v.waypoints.length > 0,
  }
}

const NHS_PREFIX = "nhs-"
// World directory ids carry their country: osm-lu-w123456 is OSM way 123456,
// listed under Luxembourg, so the venue can be found again from the id alone.
const WORLD_PREFIX = "osm-"
const WORLD_ID = /^osm-([a-z]{2})-([nwr]\d+)$/

export const OSM_ATTRIBUTION = "© OpenStreetMap contributors (ODbL)"

// One row of /world/<CC>.json, as scripts/world/build.mjs writes it.
export interface WorldHospitalRow {
  id: string
  name: string
  lat: number
  lng: number
  city?: string
  street?: string
  postcode?: string
  operator?: string
  emergency?: boolean
  // Set when the hospital's inside is mapped: /world/venues/<app id>.json
  // holds the full venue.
  mapped?: boolean
}

export interface WorldCountryFile {
  country: string
  name?: string
  generatedAt?: string
  hospitals: WorldHospitalRow[]
}

export function worldVenueId(country: string, rowId: string): string {
  return `${WORLD_PREFIX}${country.toLowerCase()}-${rowId.replace(/^osm-/, "")}`
}

// A location-only venue for a directory hospital, the same starting point an
// NHS pin or a user-created venue has: a pin to open, an inside to survey.
export function worldVenueOf(country: string, row: WorldHospitalRow, generatedAt?: string): Venue {
  const place = [row.street, row.city].filter(Boolean).join(", ")
  return {
    id: worldVenueId(country, row.id),
    slug: slugify(row.name),
    name: row.name,
    subtitle: place || (row.operator ?? `Hospital · ${countryName(country)}`),
    category: "hospital",
    center: { lat: row.lat, lng: row.lng },
    defaultZoom: 17,
    floorPlans: [],
    waypoints: [],
    visibility: "public",
    verified: false,
    country,
    ...(row.postcode ? { postcode: row.postcode } : {}),
    dataSource: OSM_ATTRIBUTION,
    ...(generatedAt ? { updatedAt: generatedAt } : {}),
  }
}

// null for a file that is not there. Inside the apps a missing path can come
// back as the page itself rather than a 404 (the shell serves index.html for
// unknown paths), so anything that is not JSON counts as missing too.
async function fetchJson<T>(path: string): Promise<T | null> {
  const res = await fetch(path)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`${path}: ${res.status}`)
  if (!(res.headers.get("content-type") ?? "").includes("json")) return null
  return (await res.json()) as T
}

const directoryByCountry = new Map<string, Promise<Venue[]>>()

// The directory of one country: summaries' worth of venues, location-only
// unless the row says its inside is mapped. A country with no file yet is an
// empty directory, not an error. A failed fetch (offline, first visit) is
// retried on the next call rather than remembered.
function loadDirectory(country: string): Promise<Venue[]> {
  const cached = directoryByCountry.get(country)
  if (cached) return cached
  const p = (country === HOME_COUNTRY
    ? import("./nhs-hospitals").then((m) => m.NHS_HOSPITAL_VENUES)
    : fetchJson<WorldCountryFile>(worldUrl(`/world/${country}.json`)).then((file) =>
        (file?.hospitals ?? []).map((row) => {
          const v = worldVenueOf(country, row, file?.generatedAt)
          // The summary must say "walk inside" before the venue is opened, so
          // a mapped row is given a placeholder plan that the real venue
          // file replaces on load (see loadVenue).
          return row.mapped ? { ...v, floorPlans: [MAPPED_PLACEHOLDER] } : v
        })
      )
  ).catch((err) => {
    directoryByCountry.delete(country)
    throw err
  })
  directoryByCountry.set(country, p)
  return p
}

// Stands in for a mapped world venue's plans in its directory entry, so that
// summaryOf() reports it as mapped; never rendered.
const MAPPED_PLACEHOLDER = { id: "mapped", floor: 0, label: "", imageUrl: "", bounds: [[0, 0], [0, 0]] as [[number, number], [number, number]] }

const catalogByCountry = new Map<string, Promise<VenueSummary[]>>()
const catalogCache = new Map<string, VenueSummary[]>()

// Every public seed venue a visitor in `country` can see, as summaries: the
// mapped venues first (registry order; the picker filters them to the country
// too), then the country's directory. The directory is fetched on the first
// call for that country.
export function loadCatalog(country: string = HOME_COUNTRY): Promise<VenueSummary[]> {
  const cached = catalogByCountry.get(country)
  if (cached) return cached
  const p = loadDirectory(country)
    .then((directory) => {
      const list = [...MAPPED_VENUE_SUMMARIES, ...directory.map(summaryOf)]
      catalogCache.set(country, list)
      return list
    })
    .catch((err) => {
      catalogByCountry.delete(country)
      throw err
    })
  catalogByCountry.set(country, p)
  return p
}

// What is known without waiting: the mapped venues always, the country's
// directory too once it has loaded.
export function catalogSnapshot(country: string = HOME_COUNTRY): VenueSummary[] {
  return catalogCache.get(country) ?? MAPPED_VENUE_SUMMARIES
}

const venueCache = new Map<string, Promise<Venue | null>>()

// A seed venue by id, fetching its module or file if this is the first time it
// is opened. null for an id no seed venue has (a user-created or server venue
// — the caller checks those itself — or a stale link).
export function loadVenue(id: string): Promise<Venue | null> {
  if (id === DEFAULT_VENUE.id) return Promise.resolve(DEFAULT_VENUE)
  const cached = venueCache.get(id)
  if (cached) return cached
  let p: Promise<Venue | null>
  const loader = VENUE_LOADERS[id]
  const world = id.match(WORLD_ID)
  if (loader) p = loader()
  else if (id.startsWith(NHS_PREFIX)) p = loadDirectory(HOME_COUNTRY).then((list) => list.find((v) => v.id === id) ?? null)
  else if (world) {
    const country = world[1].toUpperCase()
    p = loadDirectory(country).then(async (list) => {
      const pin = list.find((v) => v.id === id)
      if (!pin) return null
      if (pin.floorPlans.length === 0) return pin
      // Mapped from OpenStreetMap, inside or grounds: the venue file has the
      // plans, places and corridors. Plan images live beside it.
      const full = await fetchJson<Venue>(worldUrl(`/world/venues/${id}.json`))
      if (!full) return { ...pin, floorPlans: [] }
      return { ...full, country, floorPlans: full.floorPlans.map((p) => ({ ...p, imageUrl: worldUrl(p.imageUrl) })) }
    })
  } else return Promise.resolve(null)
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
  return id === DEFAULT_VENUE.id || id in VENUE_LOADERS || id.startsWith(NHS_PREFIX) || WORLD_ID.test(id)
}

// The country a seed venue id belongs to, when the id says: a world directory
// id names its country; an NHS or mapped seed id is home.
export function countryOfVenueId(id: string): string | null {
  const world = id.match(WORLD_ID)
  if (world) return world[1].toUpperCase()
  if (id.startsWith(NHS_PREFIX)) return HOME_COUNTRY
  return MAPPED_VENUE_SUMMARIES.find((v) => v.id === id)?.country ?? null
}
