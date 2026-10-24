// Shared helpers for the site-plans stages (discover/approve/fetch/draft/
// rasterize/build), which crawl each hospital's own website for a real
// floor-plan PDF — the complement to fetch-indoor.mjs/fetch-campus.mjs,
// which only ever see what OpenStreetMap volunteers tagged.
//
// Every stage here is adapted from backup/legacy-world-pipeline's
// scripts/world/{discover,approve,fetch,draft,generate-floorplans,
// build-venues}.mjs — that pipeline proved the crawling/extraction logic
// works (it recovered 320 real floor plans for US/AU/CA/IE before this repo
// moved to the database-backed architecture); nothing about the HTML
// crawling, PDF text-layer extraction, or cross-hospital-misattribution
// guard needed to change. What changes is only the seams: where the hospital
// list comes from, and where the finished venue ends up.
import { readFileSync, writeFileSync, readdirSync } from "fs"
import { dataPath } from "../../nhs/lib/paths.mjs"

// Mirrors how the other stages treat COUNTRIES=ALL in world-data.yml: every
// country fetch-hospitals.mjs has written a file for, so this never needs
// its own hardcoded list.
export function countriesFromArgs(argv = process.argv) {
  const i = argv.indexOf("--countries")
  if (i === -1) throw new Error("--countries is required (comma-separated ISO codes, or ALL)")
  const value = argv[i + 1]
  if (value.toUpperCase() !== "ALL") return value.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean)
  return readdirSync(dataPath("world", "hospitals"))
    .map((f) => /^([A-Z]{2})\.json$/.exec(f)?.[1])
    .filter(Boolean)
    .sort()
}

function websiteOrigin(raw) {
  if (!raw) return null
  try {
    return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).origin
  } catch {
    return null
  }
}

// Stage 1 (fetch-hospitals.mjs) already wrote data/world/hospitals/<CC>.json
// with a `website` field where OSM had one. The crawl stages below were
// written against the legacy hospital-cache shape (data/world/hospitals-
// <cc>.json, field name `code` not `id`, website pre-normalised to an
// `origin`) — translating into that shape here, once, means the discover/
// draft stages need no changes at all beyond their own file paths.
export function hospitalsForCrawl(countryCode) {
  const real = JSON.parse(readFileSync(dataPath("world", "hospitals", `${countryCode}.json`), "utf8"))
  const hospitals = []
  for (const h of real.hospitals ?? []) {
    const origin = websiteOrigin(h.website)
    if (!origin) continue
    hospitals.push({ code: h.id, name: h.name, countryCode, origin, lat: h.lat, lng: h.lng })
  }
  const path = dataPath("world", `hospitals-${countryCode.toLowerCase()}.json`)
  writeFileSync(path, JSON.stringify({ countryCode, fetchedAt: new Date().toISOString(), count: hospitals.length, hospitals }) + "\n")
  return hospitals
}

// Final venue id, matching publish.mjs's VENUE_ID_OF_ROW exactly: a hospital
// row's id is osm-<w|r><num>, a venue's is osm-<cc>-<w|r><num>. Anything else
// gets deleted the next time publish.mjs runs for this country.
export function venueIdFor(countryCode, hospitalCode) {
  return `osm-${countryCode.toLowerCase()}-${hospitalCode.replace(/^osm-/, "")}`
}

// One venue slot per hospital (same constraint migrate-legacy-venues.mjs hit
// and fixed): a hospital with several candidate sheets — different
// buildings, or just several documents on its site — must resolve to a
// single winner before anything is written, not collide silently on the
// same id. Richness is waypoint count, the same signal used there.
export function keepRichestPerHospital(drafted, richnessOf) {
  const byId = new Map()
  for (const d of drafted) {
    const id = d.__venueId
    const prev = byId.get(id)
    if (!prev || richnessOf(d) > richnessOf(prev)) byId.set(id, d)
  }
  return [...byId.values()]
}
