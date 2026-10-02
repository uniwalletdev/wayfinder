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
// Run: node scripts/world/fetch-indoor.mjs [--countries LU,DE] [--min-rooms 8] [--max-detail 400]
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "fs"
import { overpass, pointOf } from "./lib/overpass.mjs"

const arg = (name, def) => {
  const i = process.argv.indexOf(name)
  return i > -1 ? process.argv[i + 1] : def
}
const only = arg("--countries", null)?.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
const MIN_ROOMS = Number(arg("--min-rooms", 8))
const MAX_DETAIL = Number(arg("--max-detail", 400))
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

const candidates = []
for (const code of countries) {
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
    candidates.push({ id, country: code, name: h.name, city: h.city, lat: h.lat, lng: h.lng, rooms: st.rooms, named: st.named, corridors: st.corridors, levels: [...st.levels].sort((a, b) => Number(a) - Number(b)) })
    n++
  }
  console.log(`${code}: ${els.length} indoor features in ${n} hospitals`)
}

candidates.sort((a, b) => b.named - a.named || b.rooms - a.rooms)
writeFileSync("data/world/indoor-candidates.json", JSON.stringify({ generatedAt: new Date().toISOString(), minRooms: MIN_ROOMS, candidates }, null, 1) + "\n")
const worth = candidates.filter((c) => c.rooms >= MIN_ROOMS && c.named >= Math.ceil(MIN_ROOMS / 2))
console.log(`\n${candidates.length} hospitals have some indoor mapping; ${worth.length} have enough to build (>= ${MIN_ROOMS} rooms)`)

// Full geometry for the ones worth building.
let fetched = 0
for (const c of worth.slice(0, MAX_DETAIL)) {
  const [, kind, num] = c.id.match(/^osm-([wr])(\d+)$/)
  const sel = kind === "w" ? `way(${num})` : `relation(${num})`
  try {
    const els = await overpass(`[out:json][timeout:300];
${sel};
out geom;
map_to_area->.a;
(
  nwr(area.a)["indoor"];
  nwr(area.a)["door"];
  nwr(area.a)["entrance"];
  nwr(area.a)["highway"="elevator"];
  nwr(area.a)["elevator"="yes"];
  nwr(area.a)["stairs"="yes"];
  nwr(area.a)["highway"~"^(corridor|steps|footway|path|elevator)$"]["level"];
  nwr(area.a)["level"]["name"];
  nwr(area.a)["level"]["amenity"];
  nwr(area.a)["level"]["healthcare"];
  nwr(area.a)["level"]["shop"];
  nwr(area.a)["building"];
  nwr(area.a)["building:part"];
);
out geom;`)
    writeFileSync(`${RAW}/${c.id}.json`, JSON.stringify({ hospital: c, elements: els }) + "\n")
    fetched++
    console.log(`  ${c.country} ${c.name}: ${els.length} elements`)
  } catch (err) {
    console.warn(`  ${c.name}: detail failed (${String(err.message ?? err).slice(0, 120)})`)
  }
}
console.log(`Fetched indoor geometry for ${fetched} hospitals`)
