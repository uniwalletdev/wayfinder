// Stage 2 — which hospitals have their insides mapped in OpenStreetMap, and
// the full indoor geometry of those that do.
//
// OSM's Simple Indoor Tagging describes rooms, corridors and levels
// (indoor=room|corridor|area, level=*), with doors, lifts and stairs. Most
// hospitals have none of it; some, mostly in continental Europe, have a lot.
// This stage finds them, country by country, then downloads everything inside
// each one so scripts/world/build-indoor-venues.mjs can turn it into a venue.
//
// Reads data/world/hospitals/<CC>.json (stage 1) to know the hospital outlines.
// Writes data/world/indoor-candidates.json and data/world/indoor-raw/<id>.json.
//
// Run: node scripts/world/fetch-indoor.mjs [--countries LU,DE] [--min-rooms 6] [--max-detail 400] [--reuse-days N]
// --reuse-days keeps the candidate scan and the downloaded geometry when they
// are younger than N days.
import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from "fs"
import { overpass, pointOf } from "./lib/overpass.mjs"
import pg from "pg"

const arg = (name, def) => {
  const i = process.argv.indexOf(name)
  return i > -1 ? process.argv[i + 1] : def
}
const only = arg("--countries", null)?.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
const MIN_ROOMS = Number(arg("--min-rooms", 6))
const MAX_DETAIL = Number(arg("--max-detail", 400))
const reuseDays = Number(arg("--reuse-days", 0))
const freshAt = (at) => !!reuseDays && !!at && Date.now() - Date.parse(at) < reuseDays * 86_400_000
const RAW = "data/world/indoor-raw"
mkdirSync(RAW, { recursive: true })

const files = readdirSync("data/world/hospitals").filter((f) => f.endsWith(".json"))
const countries = files.map((f) => f.slice(0, 2)).filter((c) => !only || only.includes(c))

const levelsOf = (v) =>
  String(v ?? "")
    .split(";")
    .flatMap((part) => {
      const m = part.trim().match(/^(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)$/)
      if (m) {
        const out = []
        for (let x = Math.ceil(Number(m[1])); x <= Number(m[2]); x++) out.push(String(x))
        return out
      }
      return part.trim() ? [part.trim()] : []
    })

// A scan from the last few days covering these countries is reused.
let previous = null
if (existsSync("data/world/indoor-candidates.json")) {
  const p = JSON.parse(readFileSync("data/world/indoor-candidates.json", "utf8"))
  if (freshAt(p.generatedAt) && Array.isArray(p.countries) && countries.every((c) => p.countries.includes(c))) previous = p
}
const candidates = previous ? previous.candidates.filter((c) => countries.includes(c.country)) : []
if (previous) console.log(`reusing the indoor scan from ${previous.generatedAt}`)
for (const code of previous ? [] : countries) {
  const { hospitals } = JSON.parse(readFileSync(`data/world/hospitals/${code}.json`, "utf8"))
  const outlined = hospitals.filter((h) => h.bbox && /^osm-[wr]/.test(h.id))
  if (outlined.length === 0) continue
  let els
  try {
    els = await overpass(`[out:json][timeout:900];
area["ISO3166-1"="${code}"]["admin_level"="2"]->.c;
(way(area.c)["amenity"="hospital"];relation(area.c)["amenity"="hospital"];way(area.c)["healthcare"="hospital"];relation(area.c)["healthcare"="hospital"];)->.h;
.h map_to_area->.ha;
nwr(area.ha)["indoor"~"^(room|corridor|area|level)$"];
out tags center qt;`)
  } catch (err) {
    console.warn(`${code}: indoor search failed (${String(err.message ?? err).slice(0, 120)})`)
    continue
  }
  // Each indoor element belongs to the smallest hospital outline around it.
  const stats = new Map()
  for (const el of els) {
    const p = pointOf(el)
    if (!p) continue
    let best = null
    let bestArea = Infinity
    for (const h of outlined) {
      const [s, w, n, e] = h.bbox
      if (p.lat < s || p.lat > n || p.lng < w || p.lng > e) continue
      const area = (n - s) * (e - w)
      if (area < bestArea) {
        best = h
        bestArea = area
      }
    }
    if (!best) continue
    const st = stats.get(best.id) ?? { rooms: 0, named: 0, corridors: 0, levels: new Set() }
    const t = el.tags ?? {}
    if (t.indoor === "room" || t.indoor === "area") {
      st.rooms++
      if (t.name || t.ref) st.named++
    }
    if (t.indoor === "corridor") st.corridors++
    for (const l of levelsOf(t.level ?? t["repeat_on"])) st.levels.add(l)
    stats.set(best.id, st)
  }
  let n = 0
  for (const [id, st] of stats) {
    const h = outlined.find((x) => x.id === id)
    candidates.push({ id, country: code, name: h.name, city: h.city, lat: h.lat, lng: h.lng, bbox: h.bbox, rooms: st.rooms, named: st.named, corridors: st.corridors, levels: [...st.levels].sort((a, b) => Number(a) - Number(b)) })
    n++
  }
  console.log(`${code}: ${els.length} indoor features in ${n} hospitals`)
}

candidates.sort((a, b) => b.named - a.named || b.rooms - a.rooms)
if (!previous) writeFileSync("data/world/indoor-candidates.json", JSON.stringify({ generatedAt: new Date().toISOString(), countries, minRooms: MIN_ROOMS, candidates }, null, 1) + "\n")
let worth = candidates.filter((c) => c.rooms >= MIN_ROOMS && c.named >= Math.ceil(MIN_ROOMS / 2))
console.log(`\n${candidates.length} hospitals have some indoor mapping; ${worth.length} have enough to build (>= ${MIN_ROOMS} rooms)`)

// A country can have more "worth" hospitals than MAX_DETAIL covers in one
// run (dense OSM indoor coverage, e.g. parts of Europe). data/world/indoor-raw
// is not cached between separate workflow runs the way campus-raw is, so
// there is nothing on disk a second run could use to know what a first run
// already finished — the published database is the only thing that persists
// across runs, so that is what a second run checks to pick up the next batch
// instead of refetching the same top MAX_DETAIL forever.
const dbUrl = (process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL || "").trim().replace(/^['"]+|['"]+$/g, "")
if (dbUrl) {
  const host = (() => { try { return new URL(dbUrl).hostname } catch { return "" } })()
  const local = host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".railway.internal") || /sslmode=disable/.test(dbUrl)
  const client = new pg.Client({ connectionString: dbUrl, ssl: local ? undefined : { rejectUnauthorized: false } })
  await client.connect()
  const res = await client.query(
    "select id, country from public.world_venues where kind = 'indoor' and country = any($1)",
    [countries]
  )
  await client.end()
  // venue id osm-<cc>-<w123|r123> <-> hospital id osm-<w123|r123>
  const done = new Set(res.rows.map((r) => `${r.country}:osm-${r.id.slice(r.id.indexOf("-", 4) + 1)}`))
  const before = worth.length
  worth = worth.filter((c) => !done.has(`${c.country}:${c.id}`))
  if (before !== worth.length) console.log(`${before - worth.length} already published in an earlier run — continuing with the next ${worth.length}`)
}

// Full geometry for the ones worth building.
let fetched = 0
let kept = 0
for (const c of worth.slice(0, MAX_DETAIL)) {
  if (existsSync(`${RAW}/${c.id}.json`)) {
    try {
      if (freshAt(JSON.parse(readFileSync(`${RAW}/${c.id}.json`, "utf8")).fetchedAt)) {
        kept++
        continue
      }
    } catch {}
  }
  const [, kind, num] = c.id.match(/^osm-([wr])(\d+)$/)
  const sel = kind === "w" ? `way(${num})` : `relation(${num})`
  const inside = (where) => `(
  nwr${where}["indoor"];
  nwr${where}["door"];
  nwr${where}["entrance"];
  nwr${where}["highway"="elevator"];
  nwr${where}["elevator"="yes"];
  nwr${where}["stairs"="yes"];
  nwr${where}["highway"~"^(corridor|steps|footway|path|elevator)$"]["level"];
  nwr${where}["level"]["name"];
  nwr${where}["level"]["amenity"];
  nwr${where}["level"]["healthcare"];
  nwr${where}["level"]["shop"];
  nwr${where}["building"];
  nwr${where}["building:part"];
);
out geom;`
  try {
    let els = await overpass(`[out:json][timeout:300];
${sel};
out geom;
map_to_area->.a;
${inside("(area.a)")}`)
    // A site relation Overpass has no area for (AKH Wien) answers with the
    // outline alone; its bounding box finds the inside instead.
    if (els.length <= 1 && c.bbox) {
      const [s, w, n, e] = c.bbox
      els = await overpass(`[out:json][timeout:300];
${sel};
out geom;
${inside(`(${s},${w},${n},${e})`)}`)
    }
    writeFileSync(`${RAW}/${c.id}.json`, JSON.stringify({ hospital: c, fetchedAt: new Date().toISOString(), elements: els }) + "\n")
    fetched++
    console.log(`  ${c.country} ${c.name}: ${els.length} elements`)
  } catch (err) {
    console.warn(`  ${c.name}: detail failed (${String(err.message ?? err).slice(0, 120)})`)
  }
}
console.log(`Fetched indoor geometry for ${fetched} hospitals${kept ? `, kept ${kept} from the last ${reuseDays} days` : ""}`)
