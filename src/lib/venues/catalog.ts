import type { Venue, VenueSummary } from "../types"
import { DEFAULT_VENUE, slugify } from "./core"
import { HOME_COUNTRY, countryName } from "../country"
import { apiUrl } from "../app-shell"
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
// bundle. Every other country's comes from /api/world/<CC>, served from the
// shared database the World hospital data workflow publishes into, so a
// visitor in Luxembourg downloads Luxembourg's hospitals and nobody else's —
// and a hospital opened by id is fetched on its own, without the list.

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

// One row of a country's directory, as /api/world/<CC> serves it.
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
  // Set when the hospital has a map (indoor or of its grounds):
  // /api/world/venues/<app id> holds the full venue.
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

// null for what is not there (a country never published, a hospital with no
// map). A deployment without the database answers 404 for everything, which
// reads the same way: nothing listed yet.
async function fetchJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`${url}: ${res.status}`)
  if (!(res.headers.get("content-type") ?? "").includes("json")) return null
  return (await res.json()) as T
}

// A world venue's plans are served by the API; inside the apps that is the
// website's API, so the paths need its origin.
function withPlanUrls(v: Venue): Venue {
  return { ...v, floorPlans: v.floorPlans.map((p) => ({ ...p, imageUrl: p.imageUrl.startsWith("/") ? apiUrl(p.imageUrl) : p.imageUrl })) }
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
    : fetchJson<WorldCountryFile>(apiUrl(`/api/world/${country}`)).then((file) =>
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
    // By id, without the country's list: the built venue (indoor or grounds)
    // when there is one, else the hospital's row as a location-only pin.
    p = (async () => {
      const full = await fetchJson<Venue>(apiUrl(`/api/world/venues/${id}`))
      if (full) return withPlanUrls({ ...full, country })
      const one = await fetchJson<{ hospital: WorldHospitalRow }>(apiUrl(`/api/world/hospitals/${id}`))
      return one?.hospital ? worldVenueOf(country, one.hospital) : null
    })()
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
