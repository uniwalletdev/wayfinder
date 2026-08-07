// Stage 4 — merge everything into one canonical, reviewable dataset.
//
// Takes the ODS register (stage 1), the coordinates (stage 2) and the OSM
// footprints (stage 3) and writes data/nhs-sites.json: one record per open NHS
// site, each carrying enough provenance to answer "where did this pin come
// from?" without re-running anything.
//
// It also decides, once, which sites are already covered by a fully-mapped venue
// so that the venue generator downstream doesn't have to repeat the judgement.
//
// Run: node scripts/nhs/build-sites.mjs
import { loadLocatedSites, metresBetween, inUk } from "./lib/sites.mjs"
import { nameTokens, tokenOverlap } from "./lib/match.mjs"
import { readMappedVenues } from "./lib/mapped.mjs"
import { dataPath, readJson, writeJson, updateManifest, log } from "./lib/paths.mjs"

const STAGE = "build-sites"

// Two hospitals can legitimately sit inside a few hundred metres of each other
// on a shared campus — Hammersmith and Queen Charlotte's share an address, and
// Birmingham Women's is a few hundred metres from the QEHB. So proximity alone
// must never exclude a site; the names have to agree too. Only at very close
// range (the same building) is proximity allowed to carry a weaker name match.
const NEAR_M = 600
const SAME_BUILDING_M = 120

// Name matching lives in lib/match.mjs — draft-sheets.mjs asks the same question
// about the same names, and two answers to "are these the same hospital" is one
// too many.

const { sites, dropped, trusts } = loadLocatedSites()
log(STAGE, `${sites.length} located sites (dropped ${JSON.stringify(dropped)}, ${trusts.size} trusts)`)

// Sites without a usable position are dropped rather than mapped to nowhere —
// but dropping them QUIETLY is the dangerous failure here. A geocoding upstream
// returning junk would shrink the national directory with nothing to show for it
// except a smaller number in a log nobody reads. A few percent is normal (new
// builds, retired postcodes); a tenth means something is wrong.
const geocodeFailures = dropped.noGeocode + dropped.outsideUk
const candidates = sites.length + geocodeFailures
if (candidates && geocodeFailures / candidates > 0.1) {
  console.error(
    `[${STAGE}] FAILED: ${geocodeFailures}/${candidates} sites (${Math.round((geocodeFailures / candidates) * 100)}%) ` +
      `had no usable position — ${dropped.noGeocode} ungeocoded, ${dropped.outsideUk} outside the UK. ` +
      `Re-run the geocode stage before trusting this.`
  )
  process.exit(1)
}

// Footprints are optional — the site list is still useful without them, and a
// rate-limited Overpass run shouldn't block a data refresh.
const footprintCollection = readJson(dataPath("footprints.geojson"))
const footprintsBySite = new Map()
if (footprintCollection) {
  for (const f of footprintCollection.features ?? []) {
    const code = f.properties?.odsCode
    if (!code) continue
    footprintsBySite.set(code, (footprintsBySite.get(code) ?? 0) + 1)
  }
  log(STAGE, `${footprintCollection.features?.length ?? 0} footprints, covering ${footprintsBySite.size} sites`)
} else {
  log(STAGE, "no footprints.geojson yet — continuing without building outlines")
}

// A venue's display name is often not the name ODS knows it by — "GOSH
// Wayfinder" shares no words at all with "Great Ormond Street Hospital For
// Children". Aliases close that gap, and are also how one venue covering a whole
// campus (the MFT Oxford Road site) claims each of the ODS hospitals on it.
const aliasDoc = readJson(dataPath("venue-aliases.json"), { aliases: {} })
const mapped = readMappedVenues().map((v) => ({
  ...v,
  // Each name gets its own token set, compared independently: merging them
  // would dilute every set and make weak matches look strong.
  // Wrapped rather than passed by reference: map() supplies the index as a
  // second argument, which nameTokens takes as its stopword set.
  tokenSets: [v.name, ...(aliasDoc.aliases?.[v.slug] ?? [])].map((n) => nameTokens(n)),
}))
log(STAGE, `${mapped.length} fully-mapped venues to reconcile against`)

const records = []
const seen = new Map()
const exclusions = []

for (const site of sites) {
  // ODS occasionally carries the same site under two codes after a
  // reorganisation. Keep the first and record the collision rather than
  // emitting two pins on the same spot.
  const dupeKey = `${site.name.toLowerCase()}|${site.postcode}`
  if (seen.has(dupeKey)) continue
  seen.set(dupeKey, site.odsCode)

  const tokens = nameTokens(site.name)
  // Keep the best match rather than the first: on a shared campus several
  // mapped venues are in range, and the one whose name actually matches is the
  // right one to credit in mapped-coverage.json.
  let cover = null
  for (const venue of mapped) {
    const m = metresBetween(site.lat, site.lng, venue.lat, venue.lng)
    if (m > NEAR_M) continue
    const overlap = Math.max(...venue.tokenSets.map((set) => tokenOverlap(tokens, set)))
    if (overlap >= 0.5 || (m <= SAME_BUILDING_M && overlap > 0)) {
      if (!cover || overlap > cover.overlap) {
        cover = { slug: venue.slug, distanceM: Math.round(m), overlap: Number(overlap.toFixed(2)) }
      }
    }
  }
  if (cover) exclusions.push({ site: site.name, odsCode: site.odsCode, ...cover })

  records.push({
    odsCode: site.odsCode,
    name: site.name,
    trustCode: site.trustCode,
    trustName: site.trustName,
    address: site.address,
    postcode: site.postcode,
    lat: Number(site.lat.toFixed(6)),
    lng: Number(site.lng.toFixed(6)),
    geocodeSource: site.geocodeSource,
    footprints: footprintsBySite.get(site.odsCode) ?? 0,
    // Non-null means a fully-mapped venue already covers this site, so the
    // directory generator must not emit a duplicate pin for it.
    mappedVenueSlug: cover?.slug ?? null,
  })
}

records.sort((a, b) => a.odsCode.localeCompare(b.odsCode))

// Guard rails. These are the checks that make committing generated data safe:
// if any of them trip, the dataset is wrong in a way a reviewer skimming a
// 2,500-row diff would never spot.
const problems = []
const codes = new Set()
for (const r of records) {
  if (codes.has(r.odsCode)) problems.push(`duplicate ODS code ${r.odsCode}`)
  codes.add(r.odsCode)
  if (!inUk(r.lat, r.lng)) problems.push(`${r.odsCode} (${r.name}) is outside the UK: ${r.lat},${r.lng}`)
  if (!r.name) problems.push(`${r.odsCode} has no name`)
}
if (problems.length) {
  console.error(`[${STAGE}] FAILED with ${problems.length} data problems:`)
  for (const p of problems.slice(0, 20)) console.error(`  - ${p}`)
  process.exit(1)
}

writeJson(dataPath("nhs-sites.json"), {
  generatedAt: new Date().toISOString(),
  attribution: {
    ods: "Contains public sector information licensed under the Open Government Licence v3.0",
    osm: "Building footprints © OpenStreetMap contributors, ODbL 1.0",
    postcodes: "Postcode coordinates via postcodes.io (ONS Postcode Directory, OGL v3.0)",
  },
  count: records.length,
  sites: records,
})

writeJson(dataPath("mapped-coverage.json"), {
  generatedAt: new Date().toISOString(),
  description:
    "ODS sites already covered by a fully-mapped venue module, so the directory generator skips them. Derived, not hand-maintained — check this when a mapped venue's pin looks wrong.",
  count: exclusions.length,
  exclusions: exclusions.sort((a, b) => a.slug.localeCompare(b.slug)),
})

updateManifest("nhs.sites", {
  description: "Canonical merged NHS site list",
  count: records.length,
  withFootprints: records.filter((r) => r.footprints > 0).length,
  coveredByMappedVenue: exclusions.length,
  trusts: trusts.size,
})

log(STAGE, `wrote ${records.length} sites (${records.filter((r) => r.footprints > 0).length} with footprints)`)
log(STAGE, `${exclusions.length} sites excluded as already fully mapped:`)
for (const e of exclusions) log(STAGE, `  ${e.slug} <- ${e.site} (${e.distanceM}m, overlap ${e.overlap})`)
log(STAGE, "done")
