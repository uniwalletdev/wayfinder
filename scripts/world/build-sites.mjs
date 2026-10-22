// Stage W2 — merge the per-country world hospital lists into one canonical,
// reviewable directory. Plays the same role scripts/nhs/build-sites.mjs plays
// for NHS England.
//
// Unlike NHS's ets.csv (every trust SITE a trust operates — clinics, dental
// surgeries, ~38,000 of them, hence looksLikeHospital() to filter down to
// hospitals), the source list here is already hospitals only: Overpass was
// queried for amenity=hospital specifically. So there is no name-based
// hospital filter to apply — the filtering happened at the OSM tag, not a
// heuristic over free text. (A handful of non-hospitals slip through anyway —
// a dental practice or therapy clinic mistagged amenity=hospital by a mapper —
// which is the honest cost of crowd-sourced data, not a bug here.)
//
// Run: node scripts/world/build-sites.mjs
import { readMappedVenues } from "../nhs/lib/mapped.mjs"
import { metresBetween } from "../nhs/lib/sites.mjs"
import { nameTokens, tokenOverlap } from "../nhs/lib/match.mjs"
import { dataPath, readJson, writeJson, updateManifest, log } from "../nhs/lib/paths.mjs"
import { countriesFromArgs } from "./lib/osm.mjs"

const STAGE = "world-build-sites"
const COUNTRIES = countriesFromArgs()
// Same radius NHS's build-sites.mjs uses. Distance alone is what makes this
// safe against false positives: a US "St Mary's Hospital" sharing a name with
// the UK's mapped one is thousands of kilometres away, so it only has to be
// name-checked against venues that are actually nearby.
const NEAR_M = 600

const mapped = readMappedVenues().map((v) => ({ ...v, tokens: nameTokens(v.name) }))

const records = []
const seen = new Set()
let excludedAlreadyMapped = 0
let droppedNoPosition = 0

for (const cc of COUNTRIES) {
  const path = dataPath("world", `hospitals-${cc.toLowerCase()}.json`)
  const doc = readJson(path)
  if (!doc) {
    log(STAGE, `${cc}: no hospitals-${cc.toLowerCase()}.json — run discover-plans.mjs --country ${cc} (or the osm fetch) first`)
    continue
  }

  for (const h of doc.hospitals ?? []) {
    if (seen.has(h.code)) continue
    seen.add(h.code)
    if (!Number.isFinite(h.lat) || !Number.isFinite(h.lng)) {
      droppedNoPosition++
      continue
    }

    const tokens = nameTokens(h.name)
    const covered = mapped.some((v) => {
      const m = metresBetween(h.lat, h.lng, v.lat, v.lng)
      return m <= NEAR_M && tokenOverlap(tokens, v.tokens) >= 0.5
    })
    if (covered) {
      excludedAlreadyMapped++
      continue
    }

    records.push({
      code: h.code,
      name: h.name,
      countryCode: h.countryCode,
      lat: Number(h.lat.toFixed(6)),
      lng: Number(h.lng.toFixed(6)),
    })
  }
}

records.sort((a, b) => a.countryCode.localeCompare(b.countryCode) || a.name.localeCompare(b.name, "en"))

const problems = []
const codes = new Set()
for (const r of records) {
  if (codes.has(r.code)) problems.push(`duplicate code ${r.code}`)
  codes.add(r.code)
  if (!r.name) problems.push(`${r.code} has no name`)
}
if (problems.length) {
  console.error(`[${STAGE}] FAILED with ${problems.length} data problems:`)
  for (const p of problems.slice(0, 20)) console.error(`  - ${p}`)
  process.exit(1)
}

writeJson(dataPath("world", "world-sites.json"), {
  generatedAt: new Date().toISOString(),
  attribution: {
    osm: "Hospital locations © OpenStreetMap contributors, ODbL 1.0 (https://www.openstreetmap.org/copyright)",
  },
  count: records.length,
  byCountry: Object.fromEntries(COUNTRIES.map((cc) => [cc, records.filter((r) => r.countryCode === cc).length])),
  sites: records,
})

updateManifest("world.sites", {
  description: "Merged world hospital directory (located pins, OSM-sourced) outside NHS England",
  count: records.length,
  excludedAlreadyMapped,
  droppedNoPosition,
})

log(STAGE, `wrote ${records.length} hospital(s) across ${COUNTRIES.length} countries`)
log(STAGE, `(${excludedAlreadyMapped} excluded as already fully mapped, ${droppedNoPosition} dropped for no usable position)`)
