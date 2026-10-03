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
// Writes data/world/campus-raw/<CC>.json: { country, complete, hospitals:
// { "<osm id>": [elements] } }, assembled from one file per area (a country,
// or a state of a large one) under data/world/campus-raw/areas/. An area's
// file is written only when the area came in whole, and is reused for
// --reuse-days, so a run that runs out of time carries on where the last one
// stopped; the workflow caches that directory between runs. A country is
// `complete` only when every one of its areas is, and publish.mjs holds a
// country back until then: a complete answer late is preferred to a partial
// one on time. data/world/campus-raw/status.json sums it up. None of it is
// committed — it is large, and build.mjs consumes it in the same run.
//
// Run: node scripts/world/fetch-campus.mjs [--countries US,DE] [--areas US-CO,US-NY] [--reuse-days 7] [--budget-min 270]
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "fs"
import { AREA_PROBE, areaDataCheck, lastHost, overpass, pointOf, splitCounts } from "./lib/overpass.mjs"

const arg = (name) => {
  const i = process.argv.indexOf(name)
  return i > -1 ? process.argv[i + 1] : null
}
const only = arg("--countries")?.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
const onlyAreas = arg("--areas")?.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
const OUT = "data/world/campus-raw"
const AREAS = `${OUT}/areas`
mkdirSync(AREAS, { recursive: true })

// An area fetched whole within this many days is reused rather than asked for
// again; 0 asks for everything afresh.
const reuseDays = Number(arg("--reuse-days")) || 0
const freshSince = Date.now() - reuseDays * 86_400_000

// An overall limit for the stage: a margin under the job's own timeout, not a
// cap on the answer. Past it, the areas not yet fetched are left for the next
// run, which reuses the ones already written, and a country with areas left
// is not published until a run completes it. None by default.
const budgetMin = Number(arg("--budget-min")) || 0
const deadline = budgetMin ? Date.now() + budgetMin * 60_000 : Infinity
const msLeft = () => deadline - Date.now()
// Not worth starting a query with less than this left.
const MIN_QUERY_MS = 60_000
// Two instances are tried in turn, so each gets half of what is left.
const perTry = (ms, capMs) => Math.min(capMs, Math.floor(ms / 2))
const serverSeconds = (ms, capSec) => Math.max(30, Math.min(capSec, Math.floor(ms / 2000) - 10))

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

// Every query first asks the server whether it has area data at all, then
// counts the hospitals it found and the areas made of them, and the answer is
// checked (areaDataCheck): a server without area data would otherwise hand
// back a complete, empty answer.
const HOSPITALS = (selector) => `${AREA_PROBE}
(
  way${selector}["amenity"="hospital"];
  relation${selector}["amenity"="hospital"];
  way${selector}["healthcare"="hospital"];
  relation${selector}["healthcare"="hospital"];
)->.h;
.h map_to_area->.ha;
.h out count;
.ha out count;`

// A state's grounds in one query. The server gets five minutes (less when
// the stage's limit is closer) and one try per instance on two instances: a
// state too heavy for that is asked for in pieces instead.
async function fetchArea(areaFilter, ms, minHospitals) {
  const answer = await overpass(`[out:json][timeout:${serverSeconds(ms, 300)}];
${areaFilter}
${HOSPITALS("(area.c)")}
${WHAT("(area.ha)")}`, { timeoutMs: perTry(ms, 360_000), retries: 0, endpoints: 2, validate: areaDataCheck({ minHospitals }) })
  return splitCounts(answer).elements
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
// under load are common), the same question is asked for each cell of a 3×3
// grid over its bounding box; a cell that still fails is split in four, twice
// over, before it counts as failed. One area gets twenty minutes in all, or
// what is left of the stage's limit if that is less. The answer is whole or
// nothing: an area with a cell failed or out of time is not kept, and is asked
// for again next run.
const GRID = 3
const SPLIT_DEPTH = 2
const AREA_BUDGET_MS = 20 * 60_000

async function fetchCell(name, [s, w, n, e], depth, areaDeadline, out, seen) {
  const left = areaDeadline - Date.now()
  if (left < MIN_QUERY_MS) return { failed: 0, left: 1 }
  try {
    const t0 = Date.now()
    const answer = await overpass(`[out:json][timeout:${serverSeconds(left, 180)}];
${HOSPITALS(`(${s},${w},${n},${e})`)}
${WHAT("(area.ha)")}`, { timeoutMs: perTry(left, 200_000), retries: 0, endpoints: 2, gapMs: 4000, validate: areaDataCheck() })
    const els = splitCounts(answer).elements
    console.log(`  ${name}: ${els.length} elements in ${Math.round((Date.now() - t0) / 1000)}s via ${lastHost}`)
    for (const el of els) {
      const k = `${el.type}${el.id}`
      if (!seen.has(k)) {
        seen.add(k)
        out.push(el)
      }
    }
    return { failed: 0, left: 0 }
  } catch (err) {
    const why = String(err.message ?? err).slice(0, 60)
    if (depth >= SPLIT_DEPTH) {
      console.warn(`  ${name}: failed (${why})`)
      return { failed: 1, left: 0 }
    }
    console.warn(`  ${name}: failed (${why}); splitting in four`)
    const ms = (s + n) / 2
    const me = (w + e) / 2
    const quarters = [
      [s, w, ms, me],
      [s, me, ms, e],
      [ms, w, n, me],
      [ms, me, n, e],
    ]
    const r = { failed: 0, left: 0 }
    for (let q = 0; q < quarters.length; q++) {
      const sub = await fetchCell(`${name}.${q}`, quarters[q], depth + 1, areaDeadline, out, seen)
      r.failed += sub.failed
      r.left += sub.left
    }
    return r
  }
}

async function fetchGrounds(a) {
  let firstErr
  try {
    return { elements: await fetchArea(a.filter, msLeft(), a.minHospitals), failed: 0, left: 0 }
  } catch (err) {
    firstErr = err
    if (!a.bbox) throw err
  }
  console.warn(`  ${a.name}: whole area failed (${String(firstErr.message ?? firstErr).slice(0, 80)}); trying ${GRID}×${GRID} cells`)
  const [s, w, n, e] = a.bbox
  const out = []
  const seen = new Set()
  const areaDeadline = Math.min(Date.now() + AREA_BUDGET_MS, deadline)
  const r = { failed: 0, left: 0 }
  for (let i = 0; i < GRID; i++) {
    for (let j = 0; j < GRID; j++) {
      const cell = [s + ((n - s) * i) / GRID, w + ((e - w) * j) / GRID, s + ((n - s) * (i + 1)) / GRID, w + ((e - w) * (j + 1)) / GRID]
      const sub = await fetchCell(`${a.name} cell ${i},${j}`, cell, 0, areaDeadline, out, seen)
      r.failed += sub.failed
      r.left += sub.left
    }
  }
  return { elements: out, ...r }
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

// An area's file from this or an earlier run, if it is fresh enough to reuse
// and was fetched with the area-data probe. Files from before the probe are
// asked for again: an area pieced together from cells then may hold empty
// answers from a server without area data. A probed empty answer is real.
const CHECKED = 2
function cachedArea(name) {
  const path = `${AREAS}/${name}.json`
  if (!existsSync(path)) return null
  try {
    const c = JSON.parse(readFileSync(path, "utf8"))
    return c.checked === CHECKED && Date.parse(c.fetchedAt) >= freshSince ? c : null
  } catch {
    return null
  }
}

// How many outlined hospitals an area is known to hold: those inside its
// bounding box, which overlaps the neighbours', so an answer is held to at
// least one only when the box holds a handful.
function knownHospitals(a, outlined) {
  if (!a.bbox) return 0
  const [s, w, n, e] = a.bbox
  const inBox = outlined.filter((h) => h.lat >= s && h.lat <= n && h.lng >= w && h.lng <= e).length
  return inBox >= 5 ? 1 : 0
}

const files = readdirSync("data/world/hospitals").filter((f) => f.endsWith(".json"))
const lists = new Map(
  files.map((f) => f.slice(0, 2)).filter((c) => !only || only.includes(c)).map((c) => [c, JSON.parse(readFileSync(`data/world/hospitals/${c}.json`, "utf8")).hospitals])
)
// Smallest countries first: under a time limit the many quick ones finish,
// and the United States gets what is left, state by state.
const countries = [...lists.keys()].sort((a, b) => lists.get(a).length - lists.get(b).length || a.localeCompare(b))
const status = { generatedAt: new Date().toISOString(), reuseDays, budgetMin, countries: {} }
let totalHospitals = 0

function finish(code, { areas, failed, left, byHospital, elements = 0, reused = 0, note }) {
  const complete = !failed && !left
  writeFileSync(
    `${OUT}/${code}.json`,
    JSON.stringify({ country: code, generatedAt: new Date().toISOString(), areas, failed, left, complete, hospitals: Object.fromEntries(byHospital ?? []) })
  )
  status.countries[code] = { areas, failed, left, complete, ...(note ? { note } : {}) }
  totalHospitals += byHospital?.size ?? 0
  const notes = [reused ? `${reused} reused` : "", failed ? `${failed} failed` : "", left ? `${left} left for the next run` : "", note ?? ""].filter(Boolean)
  console.log(
    `${code}: ${elements} elements on the grounds of ${byHospital?.size ?? 0} hospitals, ${areas} ${areas === 1 ? "area" : "areas"}${notes.length ? ` (${notes.join("; ")})` : ""}${complete ? "" : " — incomplete, held back from publishing"}`
  )
}

for (const code of countries) {
  const hospitals = lists.get(code)
  const outlined = hospitals.filter((h) => h.bbox && /^osm-[wr]/.test(h.id))
  if (!outlined.length) {
    finish(code, { areas: 0, failed: 0, left: 0, note: "no hospital outlines" })
    continue
  }
  const attribute = outlineIndex(outlined)
  const byHospital = new Map()
  let areas
  if (hospitals.length > SPLIT_ABOVE) {
    if (msLeft() < MIN_QUERY_MS) {
      finish(code, { areas: 0, failed: 0, left: 1, note: "out of time before its states could be listed" })
      continue
    }
    try {
      areas = await subdivisions(code)
    } catch (err) {
      finish(code, { areas: 0, failed: 1, left: 0, note: `could not list subdivisions (${String(err.message ?? err).slice(0, 100)})` })
      continue
    }
    // --areas narrows only the countries it names: a list of US states must
    // not empty Germany's Länder.
    const mine = onlyAreas?.filter((x) => x.startsWith(`${code}-`))
    if (mine?.length) areas = areas.filter((a) => mine.includes(a.name))
    for (const a of areas) a.minHospitals = knownHospitals(a, outlined)
  } else {
    // The country's own hospitals bound the fallback grid; no extra query.
    const lats = outlined.map((h) => h.lat)
    const lngs = outlined.map((h) => h.lng)
    areas = [
      {
        name: code,
        filter: `area["ISO3166-1"="${code}"]["admin_level"="2"]->.c;`,
        bbox: [Math.min(...lats) - 0.05, Math.min(...lngs) - 0.05, Math.max(...lats) + 0.05, Math.max(...lngs) + 0.05],
        minHospitals: outlined.length >= 5 ? 1 : 0,
      },
    ]
  }
  let elements = 0
  let failed = 0
  let left = 0
  let reused = 0
  for (const a of areas) {
    let els
    const cached = cachedArea(a.name)
    if (cached) {
      els = cached.elements
      reused++
      console.log(`  ${a.name}: ${els.length} elements, fetched ${cached.fetchedAt.slice(0, 16).replace("T", " ")}`)
    } else if (msLeft() < MIN_QUERY_MS) {
      left++
      console.warn(`  ${a.name}: out of time, left for the next run`)
      continue
    } else {
      const t0 = Date.now()
      let r
      try {
        r = await fetchGrounds(a)
      } catch (err) {
        failed++
        console.warn(`  ${a.name}: failed (${String(err.message ?? err).slice(0, 100)})`)
        continue
      }
      if (r.left) {
        left++
        console.warn(`  ${a.name}: ${r.left} cells out of time; the whole area is asked for again next run`)
        continue
      }
      if (r.failed) {
        failed++
        console.warn(`  ${a.name}: ${r.failed} cells failed; the whole area is asked for again next run`)
        continue
      }
      els = r.elements
      writeFileSync(`${AREAS}/${a.name}.json`, JSON.stringify({ name: a.name, country: code, checked: CHECKED, fetchedAt: new Date().toISOString(), elements: els }))
      console.log(`  ${a.name}: ${els.length} elements in ${Math.round((Date.now() - t0) / 1000)}s via ${lastHost}`)
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
  }
  finish(code, { areas: areas.length, failed, left, byHospital, elements, reused })
}
const incomplete = Object.entries(status.countries).filter(([, c]) => !c.complete).map(([k]) => k)
status.complete = incomplete.length === 0
writeFileSync(`${OUT}/status.json`, JSON.stringify(status, null, 1) + "\n")
if (incomplete.length) console.warn(`\nGrounds incomplete for ${incomplete.join(", ")}: held back from publishing until a run completes them`)
console.log(`\nGrounds fetched for ${totalHospitals} hospitals`)
