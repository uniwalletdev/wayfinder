// Stage 2b — what is mapped on each hospital's grounds: named buildings,
// entrances, car parks, facilities and footpaths.
//
// Most hospitals have no indoor mapping in OpenStreetMap, but most large ones
// have their grounds mapped, and scripts/world/lib/campus.mjs turns that into a
// site-map venue. This stage fetches it, country by country — state by state
// for countries with thousands of hospitals, where one query would be too much
// for Overpass — and attributes every element to the smallest hospital outline
// around it (data/world/hospitals/<CC>.json, stage 1).
//
// Writes data/world/campus-raw/<CC>.json: { country, hospitals: { "<osm id>":
// [elements] } }. Not committed — it is large and build.mjs consumes it in the
// same run.
//
// Run: node scripts/world/fetch-campus.mjs [--countries US,DE] [--areas US-CO,US-NY]
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "fs"
import { overpass, pointOf } from "./lib/overpass.mjs"

const arg = (name) => {
  const i = process.argv.indexOf(name)
  return i > -1 ? process.argv[i + 1] : null
}
const only = arg("--countries")?.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
const onlyAreas = arg("--areas")?.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
const OUT = "data/world/campus-raw"
mkdirSync(OUT, { recursive: true })

// Above this many hospitals a country is fetched by first-level subdivision
// (US states, German Länder): the response for the whole country would be
// hundreds of megabytes and time out.
const SPLIT_ABOVE = 1000

// Named buildings only: the unnamed ones were most of the response and the
// base map already draws them under the plan.
const WHAT = (area) => `(
  way${area}["building"]["name"];
  relation${area}["building"]["name"];
  way${area}["building:part"]["name"];
  node${area}["entrance"];
  node${area}["emergency"="emergency_ward_entrance"];
  nwr${area}["amenity"~"^(parking|parking_entrance|pharmacy|cafe|restaurant|fast_food|toilets|reception_desk|bicycle_parking|shelter|atm|bank|place_of_worship|drinking_water|bus_station|taxi|charging_station|clinic|doctors)$"];
  nwr${area}["healthcare"]["name"];
  nwr${area}["shop"]["name"];
  nwr${area}["aeroway"="helipad"];
  node${area}["highway"="bus_stop"];
  way${area}["highway"~"^(footway|path|pedestrian|steps|corridor|cycleway|living_street)$"];
);
out geom qt;`

const HOSPITALS = (selector) => `(
  way${selector}["amenity"="hospital"];
  relation${selector}["amenity"="hospital"];
  way${selector}["healthcare"="hospital"];
  relation${selector}["healthcare"="hospital"];
)->.h;
.h map_to_area->.ha;`

// A state's grounds in one query. The server gets five minutes and one try
// per instance on two instances: a state too heavy for that is skipped and
// logged, rather than holding the run for hours.
async function fetchArea(areaFilter) {
  return overpass(`[out:json][timeout:300];
${areaFilter}
${HOSPITALS("(area.c)")}
${WHAT("(area.ha)")}`, { timeoutMs: 360_000, retries: 0, endpoints: 2 })
}

async function subdivisions(code) {
  const els = await overpass(`[out:json][timeout:180];
relation["boundary"="administrative"]["admin_level"="4"]["ISO3166-2"~"^${code}-"];
out tags bb;`)
  const seen = new Map()
  for (const e of els) {
    const iso = e.tags["ISO3166-2"]
    if (!iso || seen.has(iso)) continue
    const b = e.bounds
    seen.set(iso, { name: iso, filter: `area["ISO3166-2"="${iso}"]->.c;`, bbox: b ? [b.minlat, b.minlon, b.maxlat, b.maxlon] : null })
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name))
}

// When the server cannot answer for a whole state or country at once (504s
// under load are common), the same question is asked for each cell of a grid
// over its bounding box, which is a fraction of the work per query. A cell
// that still fails is skipped; the rest are kept. One area gets twenty
// minutes in all: past that the remaining cells are left for the next run
// rather than holding the whole job.
const GRID = 3
const AREA_BUDGET_MS = 20 * 60_000
async function fetchGrounds(a) {
  let firstErr
  try {
    return await fetchArea(a.filter)
  } catch (err) {
    firstErr = err
    if (!a.bbox) throw err
  }
  console.warn(`  ${a.name}: whole area failed (${String(firstErr.message ?? firstErr).slice(0, 80)}); trying ${GRID}×${GRID} cells`)
  const [s, w, n, e] = a.bbox
  const out = []
  const seen = new Set()
  let failed = 0
  const started = Date.now()
  for (let i = 0; i < GRID; i++) {
    for (let j = 0; j < GRID; j++) {
      if (Date.now() - started > AREA_BUDGET_MS) {
        failed++
        console.warn(`  ${a.name} cell ${i},${j}: out of time, left for the next run`)
        continue
      }
      const cs = s + ((n - s) * i) / GRID
      const cn = s + ((n - s) * (i + 1)) / GRID
      const cw = w + ((e - w) * j) / GRID
      const ce = w + ((e - w) * (j + 1)) / GRID
      try {
        const t0 = Date.now()
        const els = await overpass(`[out:json][timeout:180];
${HOSPITALS(`(${cs},${cw},${cn},${ce})`)}
${WHAT("(area.ha)")}`, { timeoutMs: 200_000, retries: 0, endpoints: 2, gapMs: 4000 })
        console.log(`  ${a.name} cell ${i},${j}: ${els.length} elements in ${Math.round((Date.now() - t0) / 1000)}s`)
        for (const el of els) {
          const k = `${el.type}${el.id}`
          if (!seen.has(k)) {
            seen.add(k)
            out.push(el)
          }
        }
      } catch (err) {
        failed++
        console.warn(`  ${a.name} cell ${i},${j}: failed (${String(err.message ?? err).slice(0, 60)})`)
      }
    }
  }
  if (failed === GRID * GRID) throw new Error("every cell failed")
  if (failed) console.warn(`  ${a.name}: ${failed} of ${GRID * GRID} cells failed`)
  return out
}

// Grid index of hospital outlines, so attributing a hundred thousand elements
// is not a hundred thousand scans of six thousand boxes.
function outlineIndex(hospitals) {
  const cell = 0.05
  const grid = new Map()
  const key = (lat, lng) => `${Math.floor(lat / cell)}:${Math.floor(lng / cell)}`
  for (const h of hospitals) {
    const [s, w, n, e] = h.bbox
    for (let la = Math.floor(s / cell); la <= Math.floor(n / cell); la++)
      for (let lo = Math.floor(w / cell); lo <= Math.floor(e / cell); lo++) {
        const k = `${la}:${lo}`
        if (!grid.has(k)) grid.set(k, [])
        grid.get(k).push(h)
      }
  }
  return (p) => {
    let best = null
    let bestArea = Infinity
    for (const h of grid.get(key(p.lat, p.lng)) ?? []) {
      const [s, w, n, e] = h.bbox
      if (p.lat < s || p.lat > n || p.lng < w || p.lng > e) continue
      const area = (n - s) * (e - w)
      if (area < bestArea) {
        best = h
        bestArea = area
      }
    }
    return best
  }
}

const files = readdirSync("data/world/hospitals").filter((f) => f.endsWith(".json"))
const countries = files.map((f) => f.slice(0, 2)).filter((c) => !only || only.includes(c))
let totalHospitals = 0
for (const code of countries) {
  const { hospitals } = JSON.parse(readFileSync(`data/world/hospitals/${code}.json`, "utf8"))
  const outlined = hospitals.filter((h) => h.bbox && /^osm-[wr]/.test(h.id))
  if (!outlined.length) continue
  const attribute = outlineIndex(outlined)
  const byHospital = new Map()
  let areas
  if (hospitals.length > SPLIT_ABOVE) {
    try {
      areas = await subdivisions(code)
    } catch (err) {
      console.warn(`${code}: could not list subdivisions (${String(err.message ?? err).slice(0, 100)})`)
      continue
    }
    // --areas narrows only the countries it names: a list of US states must
    // not empty Germany's Länder.
    const mine = onlyAreas?.filter((x) => x.startsWith(`${code}-`))
    if (mine?.length) areas = areas.filter((a) => mine.includes(a.name))
  } else {
    // The country's own hospitals bound the fallback grid; no extra query.
    const lats = outlined.map((h) => h.lat)
    const lngs = outlined.map((h) => h.lng)
    areas = [{ name: code, filter: `area["ISO3166-1"="${code}"]["admin_level"="2"]->.c;`, bbox: [Math.min(...lats) - 0.05, Math.min(...lngs) - 0.05, Math.max(...lats) + 0.05, Math.max(...lngs) + 0.05] }]
  }
  let elements = 0
  let failed = 0
  for (const a of areas) {
    let els
    const t0 = Date.now()
    try {
      els = await fetchGrounds(a)
    } catch (err) {
      failed++
      console.warn(`  ${a.name}: failed (${String(err.message ?? err).slice(0, 100)})`)
      continue
    }
    for (const el of els) {
      const p = pointOf(el)
      if (!p) continue
      const h = attribute(p)
      if (!h) continue
      if (!byHospital.has(h.id)) byHospital.set(h.id, [])
      byHospital.get(h.id).push(el)
      elements++
    }
    console.log(`  ${a.name}: ${els.length} elements in ${Math.round((Date.now() - t0) / 1000)}s`)
  }
  writeFileSync(`${OUT}/${code}.json`, JSON.stringify({ country: code, generatedAt: new Date().toISOString(), areas: areas.length, failed, hospitals: Object.fromEntries(byHospital) }))
  totalHospitals += byHospital.size
  console.log(`${code}: ${elements} elements on the grounds of ${byHospital.size} hospitals${failed ? ` (${failed} of ${areas.length} areas failed)` : ""}`)
}
console.log(`\nGrounds fetched for ${totalHospitals} hospitals`)
