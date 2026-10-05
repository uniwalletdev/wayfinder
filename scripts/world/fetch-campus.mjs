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
// file holds the area whole once it has all come in, or until then the cells
// of it that have (`partial`); either is reused for --reuse-days, so a run
// that runs out of time carries on where the last one stopped, cell by cell;
// the workflow caches that directory between runs. A country is `complete`
// only when every one of its areas is, and publish.mjs holds a country back
// until then: a complete answer late is preferred to a partial one on time.
// data/world/campus-raw/status.json sums it up. None of it is committed — it
// is large, and build.mjs consumes it in the same run.
//
// Run: node scripts/world/fetch-campus.mjs [--countries US,DE] [--first NG,KE] [--areas US-CO,US-NY] [--reuse-days 7] [--budget-min 270]
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "fs"
import { AREA_PROBE, areaDataCheck, lastHost, overpass, pointOf, splitCounts } from "./lib/overpass.mjs"
import { cellKey, freshCells, gridCells, orderCountries, quarters } from "./lib/grounds-cells.mjs"

const arg = (name) => {
  const i = process.argv.indexOf(name)
  return i > -1 ? process.argv[i + 1] : null
}
const only = arg("--countries")?.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
const onlyAreas = arg("--areas")?.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
// Countries to take first, in this order, before the rest smallest-first.
const first = arg("--first")?.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean) ?? []
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
// over, before it counts as failed. One area gets twenty minutes of a run, or
// what is left of the stage's limit if that is less. The cells that came in
// are kept in the area's file (`partial`, cells by their bounds), so the next
// run asks only for the ones still missing — a county the servers answer at
// three cells a run still comes in, over a few runs — and the area counts as
// fetched, and is reused whole, only once every cell is in.
const GRID = 3
const SPLIT_DEPTH = 2
const AREA_BUDGET_MS = 20 * 60_000

// `c` is the area's state for this run: `cells` its cache (key → {fetchedAt,
// elements}), `touched` the keys reused or fetched this run, `out` and `seen`
// the elements gathered, and `save` writes the file after every cell that
// comes in, so a run cancelled mid-area loses one cell at most.
async function fetchCell(name, bbox, depth, areaDeadline, c) {
  const key = cellKey(bbox)
  const take = (els) => {
    for (const el of els) {
      const k = `${el.type}${el.id}`
      if (!c.seen.has(k)) {
        c.seen.add(k)
        c.out.push(el)
      }
    }
  }
  const kept = c.cells[key]
  if (kept) {
    c.touched.add(key)
    c.reused++
    take(kept.elements)
    console.log(`  ${name}: ${kept.elements.length} elements, kept from ${kept.fetchedAt.slice(0, 16).replace("T", " ")}`)
    return { failed: 0, left: 0 }
  }
  const parts = depth < SPLIT_DEPTH ? quarters(bbox) : null
  const split = async () => {
    const r = { failed: 0, left: 0 }
    for (let q = 0; q < parts.length; q++) {
      const sub = await fetchCell(`${name}.${q}`, parts[q], depth + 1, areaDeadline, c)
      r.failed += sub.failed
      r.left += sub.left
    }
    return r
  }
  // A cell an earlier run already split, with quarters in: straight to the
  // quarters, rather than failing on the whole cell again first.
  if (parts && parts.some((q) => c.cells[cellKey(q)])) return split()
  const left = areaDeadline - Date.now()
  if (left < MIN_QUERY_MS) return { failed: 0, left: 1 }
  const [s, w, n, e] = bbox
  try {
    const t0 = Date.now()
    const answer = await overpass(`[out:json][timeout:${serverSeconds(left, 180)}];
${HOSPITALS(`(${s},${w},${n},${e})`)}
${WHAT("(area.ha)")}`, { timeoutMs: perTry(left, 200_000), retries: 0, endpoints: 2, gapMs: 4000, validate: areaDataCheck() })
    const els = splitCounts(answer).elements
    console.log(`  ${name}: ${els.length} elements in ${Math.round((Date.now() - t0) / 1000)}s via ${lastHost}`)
    c.cells[key] = { fetchedAt: new Date().toISOString(), elements: els }
    c.touched.add(key)
    c.fetched++
    c.save()
    take(els)
    return { failed: 0, left: 0 }
  } catch (err) {
    const why = String(err.message ?? err).slice(0, 60)
    if (!parts) {
      console.warn(`  ${name}: failed (${why})`)
      return { failed: 1, left: 0 }
    }
    console.warn(`  ${name}: failed (${why}); splitting in four`)
    return split()
  }
}

function writePartial(path, a, cells) {
  writeFileSync(path, JSON.stringify({ name: a.name, country: a.country, checked: CHECKED, partial: true, fetchedAt: new Date().toISOString(), cells }))
}

// An area's grounds: whole in one query when the server can, else cell by
// cell. Returns the elements with how many cells failed or were left out of
// time, and how many were reused, fetched and kept this run.
async function fetchGrounds(a) {
  const path = `${AREAS}/${a.name}.json`
  const cells = a.bbox ? cachedCells(a.name) : {}
  const had = Object.keys(cells).length
  if (had) {
    // The whole area failed in an earlier run and some of its cells are in:
    // straight to the rest.
    console.log(`  ${a.name}: ${had} cells kept from an earlier run; asking for the rest`)
  } else {
    try {
      return { elements: await fetchArea(a.filter, msLeft(), a.minHospitals), failed: 0, left: 0, reused: 0, fetched: 0, kept: 0 }
    } catch (err) {
      if (!a.bbox) throw err
      console.warn(`  ${a.name}: whole area failed (${String(err.message ?? err).slice(0, 80)}); trying ${GRID}×${GRID} cells`)
    }
  }
  const c = { out: [], seen: new Set(), cells, touched: new Set(), reused: 0, fetched: 0, save: () => writePartial(path, a, c.cells) }
  const areaDeadline = Math.min(Date.now() + AREA_BUDGET_MS, deadline)
  const r = { failed: 0, left: 0 }
  for (const { i, j, bbox } of gridCells(a.bbox, GRID)) {
    const sub = await fetchCell(`${a.name} cell ${i},${j}`, bbox, 0, areaDeadline, c)
    r.failed += sub.failed
    r.left += sub.left
  }
  // Left for the next run: keep the cells this run reused or fetched, and
  // drop any from a grid that no longer applies (the area's bounds moved).
  if (r.failed || r.left) writePartial(path, a, Object.fromEntries([...c.touched].map((k) => [k, c.cells[k]])))
  return { elements: c.out, ...r, reused: c.reused, fetched: c.fetched, kept: c.touched.size }
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
function areaFile(name) {
  const path = `${AREAS}/${name}.json`
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, "utf8"))
  } catch {
    return null
  }
}
function cachedArea(name) {
  const c = areaFile(name)
  return c && !c.partial && c.checked === CHECKED && Date.parse(c.fetchedAt) >= freshSince ? c : null
}
// The cells of an area that came in piecemeal in earlier runs, while the
// rest did not: fresh ones are kept, the rest asked for.
function cachedCells(name) {
  return freshCells(areaFile(name), freshSince, CHECKED)
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
// The countries asked for first (--first) in that order, then the smallest
// first: under a time limit the many quick ones finish, and the United
// States gets what is left, state by state.
const countries = orderCountries([...lists.keys()], (c) => lists.get(c).length, first)
const status = { generatedAt: new Date().toISOString(), reuseDays, budgetMin, countries: {} }
let totalHospitals = 0
// Areas — or, of an area left unfinished, cells — this run fetched and kept,
// as opposed to reused: a run that kept nothing made no progress, and
// scripts/world/carry-on.mjs does not start another.
let fetchedNew = 0

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
  for (const a of areas) a.country = code
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
      if (r.left || r.failed) {
        // Progress all the same: the cells that came in are kept, and count
        // towards carrying on.
        fetchedNew += r.fetched
        if (r.left) left++
        else failed++
        const what = r.left ? `${r.left} cells out of time` : `${r.failed} cells failed`
        console.warn(`  ${a.name}: ${what}; ${r.kept} cells kept, the rest asked for again next run`)
        continue
      }
      els = r.elements
      writeFileSync(`${AREAS}/${a.name}.json`, JSON.stringify({ name: a.name, country: code, checked: CHECKED, fetchedAt: new Date().toISOString(), elements: els }))
      fetchedNew++
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
status.fetchedNew = fetchedNew
writeFileSync(`${OUT}/status.json`, JSON.stringify(status, null, 1) + "\n")
if (incomplete.length) console.warn(`\nGrounds incomplete for ${incomplete.join(", ")}: held back from publishing until a run completes them`)
console.log(`\nGrounds fetched for ${totalHospitals} hospitals`)
