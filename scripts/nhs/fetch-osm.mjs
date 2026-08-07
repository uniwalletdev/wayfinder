// Stage 3 — hospital building footprints from OpenStreetMap.
//
// ODS says where a hospital is; OSM says what shape it is. A footprint is what
// turns a pin into a map: it shows the walker the actual building outline before
// anyone has surveyed the interior, and gives a floor-plan overlay something
// real to be anchored against.
//
// Queries are `around` the known site coordinates rather than tiling the UK —
// Overpass charges by area searched, and we only care about a few hundred metres
// round each of ~2,500 known points. Sites are batched because `around` accepts a
// coordinate list, so one request covers a whole batch.
//
// Licence: OpenStreetMap data is © OpenStreetMap contributors, ODbL 1.0.
// Attribution is REQUIRED wherever these footprints are displayed — the map
// surfaces it in src/components/FloorPlanMap.tsx.
//
// Run: node scripts/nhs/fetch-osm.mjs
import { fetchRetry } from "./lib/net.mjs"
import { loadLocatedSites, metresBetween } from "./lib/sites.mjs"
import { dataPath, writeJson, updateManifest, log } from "./lib/paths.mjs"

const STAGE = "fetch-osm"
const ENDPOINT = "https://overpass-api.de/api/interpreter"
const SEARCH_RADIUS_M = 300
const SITES_PER_QUERY = 60
// Overpass is a free, shared, heavily-loaded service. Pausing between queries is
// not politeness theatre — hammering it earns a temporary ban that would break
// the scheduled workflow for everyone using this endpoint.
const PAUSE_MS = 3000

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const r6 = (n) => Number(n.toFixed(6))

function buildQuery(batch) {
  const coords = batch.map((s) => `${r6(s.lat)},${r6(s.lng)}`).join(",")
  const around = `(around:${SEARCH_RADIUS_M},${coords})`
  return `[out:json][timeout:180];
(
  way["amenity"="hospital"]${around};
  way["building"="hospital"]${around};
  way["healthcare"="hospital"]${around};
  relation["amenity"="hospital"]${around};
);
out geom;`
}

// Overpass `out geom` inlines coordinates on each way, and on each member of a
// relation, so no second round-trip is needed to resolve node references.
function ringFrom(geometry) {
  if (!Array.isArray(geometry) || geometry.length < 4) return null
  const ring = geometry.map((p) => [r6(p.lon), r6(p.lat)])
  const [fx, fy] = ring[0]
  const [lx, ly] = ring[ring.length - 1]
  // Only closed ways are areas; an open way here is a wall or a fence line.
  if (fx !== lx || fy !== ly) return null
  return ring
}

function elementToFeature(el) {
  const tags = el.tags ?? {}
  const props = {
    osmId: `${el.type}/${el.id}`,
    name: tags.name ?? null,
    operator: tags.operator ?? null,
    amenity: tags.amenity ?? null,
    building: tags.building ?? null,
    // Simple Indoor Tagging: where a mapper has recorded storeys, that is a
    // strong hint the interior is worth surveying.
    levels: tags["building:levels"] ?? null,
  }

  if (el.type === "way") {
    const ring = ringFrom(el.geometry)
    if (!ring) return null
    return { type: "Feature", properties: props, geometry: { type: "Polygon", coordinates: [ring] } }
  }

  if (el.type === "relation") {
    // Multipolygon: each outer member becomes its own polygon. Inner rings
    // (courtyards) are dropped — for showing a site's extent the outline is
    // what matters, and keeping holes would double the committed file size.
    const outers = (el.members ?? [])
      .filter((m) => m.role === "outer" || m.role === "")
      .map((m) => ringFrom(m.geometry))
      .filter(Boolean)
    if (!outers.length) return null
    return {
      type: "Feature",
      properties: props,
      geometry:
        outers.length === 1
          ? { type: "Polygon", coordinates: [outers[0]] }
          : { type: "MultiPolygon", coordinates: outers.map((o) => [o]) },
    }
  }
  return null
}

function centroidOf(feature) {
  const rings =
    feature.geometry.type === "Polygon"
      ? feature.geometry.coordinates
      : feature.geometry.coordinates.map((p) => p[0])
  let x = 0, y = 0, n = 0
  for (const ring of rings) for (const [lng, lat] of ring) { x += lng; y += lat; n++ }
  return n ? { lat: y / n, lng: x / n } : null
}

const { sites, dropped } = loadLocatedSites()
log(STAGE, `${sites.length} located sites to search around (dropped ${JSON.stringify(dropped)})`)

const features = new Map() // osmId -> feature, de-duplicated across overlapping batches
let failedBatches = 0

for (let i = 0; i < sites.length; i += SITES_PER_QUERY) {
  const batch = sites.slice(i, i + SITES_PER_QUERY)
  const n = Math.floor(i / SITES_PER_QUERY) + 1
  const total = Math.ceil(sites.length / SITES_PER_QUERY)
  try {
    const res = await fetchRetry(
      ENDPOINT,
      { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ data: buildQuery(batch) }) },
      { retries: 3, baseMs: 5000, timeoutMs: 200_000 }
    )
    const body = await res.json()
    let added = 0
    for (const el of body?.elements ?? []) {
      const feature = elementToFeature(el)
      if (!feature) continue
      if (!features.has(feature.properties.osmId)) { features.set(feature.properties.osmId, feature); added++ }
    }
    log(STAGE, `batch ${n}/${total}: +${added} footprints (${features.size} total)`)
  } catch (err) {
    // One bad batch shouldn't lose the other 40. Record it and carry on; the
    // threshold check at the end decides whether the run is still trustworthy.
    failedBatches++
    console.warn(`[${STAGE}] WARNING: batch ${n}/${total} failed: ${err.message}`)
  }
  if (i + SITES_PER_QUERY < sites.length) await sleep(PAUSE_MS)
}

// Attach the nearest ODS site to each footprint so the app can look footprints
// up by site without doing spatial work in the browser.
let matched = 0
for (const feature of features.values()) {
  const c = centroidOf(feature)
  if (!c) continue
  let best = null
  let bestM = Infinity
  for (const site of sites) {
    const m = metresBetween(c.lat, c.lng, site.lat, site.lng)
    if (m < bestM) { bestM = m; best = site }
  }
  if (best && bestM <= SEARCH_RADIUS_M * 2) {
    feature.properties.odsCode = best.odsCode
    feature.properties.distanceM = Math.round(bestM)
    matched++
  } else {
    feature.properties.odsCode = null
  }
}

const collection = {
  type: "FeatureCollection",
  // Carried in the file itself so the attribution travels with the data even if
  // it is copied somewhere else.
  attribution: "© OpenStreetMap contributors, ODbL 1.0 (https://www.openstreetmap.org/copyright)",
  features: [...features.values()].sort((a, b) => a.properties.osmId.localeCompare(b.properties.osmId)),
}
writeJson(dataPath("footprints.geojson"), collection)

updateManifest("osm.footprints", {
  url: ENDPOINT,
  description: "Hospital building footprints from OpenStreetMap via Overpass",
  searchRadiusM: SEARCH_RADIUS_M,
  sitesSearched: sites.length,
  footprints: collection.features.length,
  matchedToSite: matched,
  failedBatches,
  licence: "ODbL 1.0 — © OpenStreetMap contributors",
})

log(STAGE, `${collection.features.length} footprints, ${matched} matched to an ODS site, ${failedBatches} failed batches`)

const totalBatches = Math.ceil(sites.length / SITES_PER_QUERY)
if (failedBatches > totalBatches * 0.2) {
  console.error(`[${STAGE}] FAILED: ${failedBatches}/${totalBatches} batches failed — Overpass was probably rate-limiting. Not trusting this run.`)
  process.exit(1)
}
log(STAGE, "done")
