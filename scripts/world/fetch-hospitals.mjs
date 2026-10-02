// Stage 1 — every named hospital in each country, from OpenStreetMap.
//
// Writes data/world/hospitals/<CC>.json, one file per ISO 3166-1 country, and
// data/world/countries.json with each country's name. The app shows a visitor
// the hospitals of the country they are in (src/lib/countries.ts), so the data
// is split the same way the app reads it.
//
// The UK is skipped: its hospitals come from the NHS Organisation Data Service
// (scripts/nhs/), which is authoritative and already reconciled with the
// mapped venues.
//
// Run: node scripts/world/fetch-hospitals.mjs [--countries LU,DE] [--skip GB] [--reuse-days N]
// --reuse-days keeps a country's file when it was fetched within N days, so a
// run that only changes a later stage does not spend half an hour here.
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "fs"
import { overpass, pointOf, osmId } from "./lib/overpass.mjs"

const OUT = "data/world/hospitals"
const arg = (name) => {
  const i = process.argv.indexOf(name)
  return i > -1 ? process.argv[i + 1] : null
}
const only = arg("--countries")?.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
const skip = new Set((arg("--skip") ?? "GB").split(",").map((s) => s.trim().toUpperCase()))
const reuseDays = Number(arg("--reuse-days") ?? 0)
const fresh = (file) => {
  if (!reuseDays || !existsSync(file)) return false
  try {
    const at = JSON.parse(readFileSync(file, "utf8")).generatedAt
    return !!at && Date.now() - Date.parse(at) < reuseDays * 86_400_000
  } catch {
    return false
  }
}

mkdirSync(OUT, { recursive: true })

// The country list comes from OSM too: every national boundary with an ISO
// code. Territories with their own code (Jersey, Puerto Rico…) are included,
// because a visitor there expects that territory's hospitals.
async function countries() {
  const els = await overpass(`[out:json][timeout:180];
relation["boundary"="administrative"]["admin_level"="2"]["ISO3166-1"~"^[A-Z]{2}$"];
out tags;`)
  const byCode = {}
  for (const el of els) {
    const code = el.tags["ISO3166-1"]
    const name = el.tags["name:en"] || el.tags.int_name || el.tags.name
    if (!byCode[code]) byCode[code] = name
  }
  return byCode
}

const r5 = (n) => Number(n.toFixed(5))

function hospitalRow(el) {
  const t = el.tags ?? {}
  const p = pointOf(el)
  if (!p) return null
  const name = (t["name:en"] && !t.name ? t["name:en"] : t.name)?.trim()
  if (!name) return null
  // Clinics tagged amenity=hospital by mistake are common; a hospital with
  // healthcare=clinic or a "clinic" name is left out rather than shown as one.
  if (t.healthcare === "clinic" || t.healthcare === "doctor") return null
  const city = t["addr:city"] || t["addr:town"] || t["addr:village"] || t["addr:suburb"] || ""
  const row = { id: `osm-${osmId(el)}`, name, lat: r5(p.lat), lng: r5(p.lng) }
  if (city) row.city = city
  if (t.operator && t.operator !== name) row.operator = t.operator
  if (t["addr:street"]) row.street = [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" ")
  if (t["addr:postcode"]) row.postcode = t["addr:postcode"]
  if (t.emergency === "yes") row.emergency = true
  if (el.bounds) row.bbox = [r5(el.bounds.minlat), r5(el.bounds.minlon), r5(el.bounds.maxlat), r5(el.bounds.maxlon)]
  return row
}

const all = await countries()
writeFileSync("data/world/countries.json", JSON.stringify(Object.fromEntries(Object.entries(all).sort()), null, 1) + "\n")
const codes = Object.keys(all).sort().filter((c) => !skip.has(c) && (!only || only.includes(c)))
console.log(`${Object.keys(all).length} countries in OSM; fetching ${codes.length}`)

let total = 0
let reused = 0
const failed = []
for (const code of codes) {
  if (fresh(`${OUT}/${code}.json`)) {
    reused++
    total += JSON.parse(readFileSync(`${OUT}/${code}.json`, "utf8")).hospitals.length
    continue
  }
  try {
    const els = await overpass(`[out:json][timeout:600];
area["ISO3166-1"="${code}"]["admin_level"="2"]->.c;
(
  nwr(area.c)["amenity"="hospital"]["name"];
  nwr(area.c)["healthcare"="hospital"]["name"];
);
out tags center bb qt;`)
    const seen = new Set()
    const rows = []
    for (const el of els) {
      const row = hospitalRow(el)
      if (!row || seen.has(row.id)) continue
      seen.add(row.id)
      rows.push(row)
    }
    // A hospital mapped as both a site outline and a building, or as a point
    // inside its own outline, appears twice under the same name; keep the one
    // with an outline.
    rows.sort((a, b) => (b.bbox ? 1 : 0) - (a.bbox ? 1 : 0))
    const kept = []
    for (const r of rows) {
      const dup = kept.find((k) => k.name.toLowerCase() === r.name.toLowerCase() && Math.abs(k.lat - r.lat) < 0.004 && Math.abs(k.lng - r.lng) < 0.006)
      if (!dup) kept.push(r)
    }
    kept.sort((a, b) => a.name.localeCompare(b.name))
    writeFileSync(`${OUT}/${code}.json`, JSON.stringify({ country: code, name: all[code], generatedAt: new Date().toISOString(), hospitals: kept }) + "\n")
    total += kept.length
    console.log(`${code} ${all[code]}: ${kept.length} hospitals`)
  } catch (err) {
    failed.push(code)
    console.warn(`${code}: failed (${String(err.message ?? err).slice(0, 120)})`)
    // Keep the previous run's file rather than losing the country.
    if (!existsSync(`${OUT}/${code}.json`)) continue
    console.warn(`${code}: keeping the previous data`)
  }
}
console.log(`\n${total} hospitals across ${codes.length - failed.length} countries${reused ? ` (${reused} reused from the last ${reuseDays} days)` : ""}${failed.length ? `; failed: ${failed.join(", ")}` : ""}`)
if (failed.length > codes.length / 2) process.exit(1)
