// Stage 3 — the files the app reads, from the data stages 1 and 2 fetched.
//
//   public/world/<CC>.json        a country's hospitals (src/lib/venues/catalog.ts)
//   public/world/index.json       which countries have data, and how much
//   public/world/venues/<id>.json a hospital whose inside OpenStreetMap maps
//   public/floorplans/osm/<id>/   its floor plans, one SVG per level
//   data/world/indoor-report.json what was built and what was refused, and why
//
// Ids: a hospital is osm-<cc>-<w|n|r><osm id> in the app, so the id alone
// says which country file lists it. Data © OpenStreetMap contributors, ODbL.
//
// Run: node scripts/world/build.mjs
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync } from "node:fs"
import { buildIndoorVenue, OSM_ATTRIBUTION } from "./lib/indoor.mjs"

const HOSPITALS = "data/world/hospitals"
const RAW = "data/world/indoor-raw"
const OUT = "public/world"
const PLANS = "public/floorplans/osm"
const generatedAt = new Date().toISOString()

const appId = (country, rowId) => `osm-${country.toLowerCase()}-${rowId.replace(/^osm-/, "")}`

mkdirSync(`${OUT}/venues`, { recursive: true })
mkdirSync(PLANS, { recursive: true })

// 1. Indoor venues.
const report = { generatedAt, built: [], refused: [] }
const mapped = new Set()
if (existsSync(RAW)) {
  for (const file of readdirSync(RAW).filter((f) => f.endsWith(".json")).sort()) {
    const raw = JSON.parse(readFileSync(`${RAW}/${file}`, "utf8"))
    const country = raw.hospital?.country
    if (!country) continue
    const id = appId(country, raw.hospital.id)
    let built
    try {
      built = buildIndoorVenue(raw, { id, country, generatedAt })
    } catch (err) {
      built = { reason: `build error: ${err.message}` }
    }
    if (!built.venue) {
      report.refused.push({ id, country, name: raw.hospital.name, reason: built.reason })
      continue
    }
    rmSync(`${PLANS}/${id}`, { recursive: true, force: true })
    mkdirSync(`${PLANS}/${id}`, { recursive: true })
    for (const plan of built.venue.floorPlans) {
      const level = plan.floor
      writeFileSync(`${PLANS}/${id}/${plan.id}.svg`, built.plans.get(level))
    }
    writeFileSync(`${OUT}/venues/${id}.json`, JSON.stringify(built.venue) + "\n")
    mapped.add(id)
    report.built.push({ id, country, name: raw.hospital.name, ...built.stats })
    console.log(`${country} ${raw.hospital.name}: ${built.stats.floors} floors, ${built.stats.waypoints} places, ${built.stats.corridorM} m of corridor`)
  }
}
// A venue file from an earlier run whose hospital no longer builds is removed,
// or the directory would still say "walk inside".
for (const f of readdirSync(`${OUT}/venues`)) {
  const id = f.replace(/\.json$/, "")
  if (!mapped.has(id)) {
    rmSync(`${OUT}/venues/${f}`)
    rmSync(`${PLANS}/${id}`, { recursive: true, force: true })
  }
}

// 2. Country files.
const index = { generatedAt, attribution: OSM_ATTRIBUTION, countries: {} }
let total = 0
for (const file of readdirSync(HOSPITALS).filter((f) => f.endsWith(".json")).sort()) {
  const { country, name, hospitals } = JSON.parse(readFileSync(`${HOSPITALS}/${file}`, "utf8"))
  const rows = hospitals.map((h) => {
    const row = { id: h.id, name: h.name, lat: h.lat, lng: h.lng }
    for (const k of ["city", "street", "postcode", "operator"]) if (h[k]) row[k] = h[k]
    if (h.emergency) row.emergency = true
    if (mapped.has(appId(country, h.id))) row.mapped = true
    return row
  })
  // A mapped hospital missing from its country's list (renamed, retagged
  // since stage 1) is still reachable: add it from its venue file.
  for (const id of mapped) {
    if (!id.startsWith(`osm-${country.toLowerCase()}-`)) continue
    const rowId = `osm-${id.slice(7)}`
    if (rows.some((r) => r.id === rowId)) continue
    const v = JSON.parse(readFileSync(`${OUT}/venues/${id}.json`, "utf8"))
    rows.push({ id: rowId, name: v.name, lat: v.center.lat, lng: v.center.lng, mapped: true })
  }
  rows.sort((a, b) => a.name.localeCompare(b.name))
  writeFileSync(`${OUT}/${country}.json`, JSON.stringify({ country, name, generatedAt, attribution: OSM_ATTRIBUTION, hospitals: rows }) + "\n")
  index.countries[country] = { name, hospitals: rows.length, mapped: rows.filter((r) => r.mapped).length }
  total += rows.length
}
writeFileSync(`${OUT}/index.json`, JSON.stringify(index, null, 1) + "\n")
writeFileSync("data/world/indoor-report.json", JSON.stringify(report, null, 1) + "\n")
console.log(`\n${total} hospitals in ${Object.keys(index.countries).length} countries; ${mapped.size} with indoor maps, ${report.refused.length} refused`)
