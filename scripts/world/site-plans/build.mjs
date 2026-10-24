// Build the final Venue JSON for each drafted sheet and publish it where
// build.mjs (one directory up) and publish.mjs already look: public/world/
// venues/<id>.json and public/floorplans/osm/<id>/<planId>.svg. Placement
// logic (waypoints land on their labels, from the same PDF text-layer
// extraction used to draft the sheet) is unchanged from backup/legacy-
// world-pipeline's scripts/world/build-venues.mjs.
//
// What's new here, not carried over: the final id must be osm-<cc>-<osm id>
// (publish.mjs deletes anything else), and a hospital with several drafted
// sheets — different buildings, or just several documents on its site — must
// resolve to ONE winner (the richest, by waypoint count) before anything is
// written, since the schema has room for exactly one venue per hospital.
// Run this AFTER ../build.mjs: that script deletes any venue file under
// public/world/venues/ it doesn't recognise, so writing here first would be
// wiped immediately. Writing after means these — real crawled floor plans —
// simply overwrite whatever sparse OSM indoor/campus venue build.mjs wrote
// for the same hospital, which is the right way round: a real PDF beats a
// same-hospital fallback.
//
// Run: node scripts/world/site-plans/build.mjs
import { extractLabels } from "../../maps/extract.mjs"
import { normaliseFloors } from "../../maps/sheets.mjs"
import { writeFileSync, readFileSync, mkdirSync, rmSync } from "fs"
import { dataPath, readJson, log } from "../../nhs/lib/paths.mjs"
import { venueIdFor, keepRichestPerHospital } from "./lib.mjs"

const STAGE = "site-plans-build"
const R = 111320 // metres per degree latitude
// A PDF that rasterises into thousands of pixel-sized individual shapes
// instead of clean vector paths (seen in production, once, during the
// legacy-venue migration this session: a single floor plan came out to
// ~96MB) is unusable — and likely to crash a phone's browser as an image
// overlay — not something to publish just because pdf2svg.mjs didn't error.
// A real floor plan is tens to low hundreds of KB.
const MAX_SVG_BYTES = 5 * 1024 * 1024

const esc = (s) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t")
const r6 = (n) => Number(n.toFixed(6))
const slugify = (s) => s.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "wp"

async function placeFloor(v, floor, usedIds) {
  const { labels, W, H } = await extractLabels(floor.file, floor.page)
  const [px0, py0, px1, py1] = floor.plan
  const inPlan = labels.filter((l) => l.nx >= px0 && l.nx <= px1 && l.ny >= py0 && l.ny <= py1)

  const [lat0, lng0] = v.center
  const dLng = v.spanM / (R * Math.cos((lat0 * Math.PI) / 180))
  const dLat = (v.spanM * (H / W)) / R
  const pcx = (px0 + px1) / 2, pcy = (py0 + py1) / 2
  const lngW = lng0 - pcx * dLng
  const latN = lat0 + pcy * dLat
  const toLatLng = (nx, ny) => [r6(latN - ny * dLat), r6(lngW + nx * dLng)]

  const wps = inPlan.map((l) => {
    const base = `${slugify(l.text)}-f${floor.floor}`
    const n = usedIds[base] || 0
    usedIds[base] = n + 1
    const id = n === 0 ? base : `${base}-${n + 1}`
    const [lat, lng] = toLatLng(l.nx, l.ny)
    return { id, name: l.text, type: l.type, lat, lng, floor: floor.floor }
  })

  const [bS, bW] = toLatLng(0, 1)
  const [bN, bE] = toLatLng(1, 0)
  return { wps, bounds: [bS, bW, bN, bE] }
}

async function build(v) {
  const [lat0, lng0] = v.center
  const usedIds = {}
  const placed = []
  for (const floor of normaliseFloors(v)) placed.push({ floor, ...(await placeFloor(v, floor, usedIds)) })
  const waypoints = placed.flatMap((p) =>
    p.wps.map((w) => ({ id: w.id, name: w.name, type: w.type, coordinates: { lat: w.lat, lng: w.lng }, floor: w.floor }))
  )

  const floorPlans = placed.map(({ floor, bounds: [bS, bW, bN, bE] }) => ({
    id: floor.id,
    floor: floor.floor,
    label: floor.label,
    imageUrl: `/floorplans/${v.slug}/${floor.image}.svg`, // rewritten once the final id is known, below
    bounds: [[r6(bS), r6(bW)], [r6(bN), r6(bE)]],
  }))

  return {
    id: v.id,
    slug: v.slug,
    name: v.name,
    subtitle: v.subtitle,
    category: "hospital",
    center: { lat: r6(lat0), lng: r6(lng0) },
    defaultZoom: 17,
    visibility: "public",
    verified: false,
    accessibility: { stepFreeRoute: true, accessibleToilets: true, notes: v.notes },
    quickAccess: v.quick,
    floorPlans,
    waypoints,
    __waypointCount: waypoints.length,
    __hospitalCode: v.hospitalCode,
    __countryCode: v.countryCode,
    __rasterSlug: v.slug,
  }
}

const sheetsDoc = readJson(dataPath("world", "mapped-sites.json"), { sheets: [] })
const built = []
for (const v of sheetsDoc.sheets) {
  try {
    built.push(await build(v))
  } catch (err) {
    console.error(`[${STAGE}] ${v.slug}: build failed — ${err.message}`)
  }
}

// One venue slot per hospital: keep only the richest sheet for each.
for (const b of built) b.__venueId = venueIdFor(b.__countryCode, b.__hospitalCode)
const winners = keepRichestPerHospital(built, (b) => b.__waypointCount)
const superseded = built.length - winners.length
if (superseded) log(STAGE, `${superseded} sheet(s) superseded by a richer sheet for the same hospital`)

const OUT = "public/world/venues"
const PLANS = "public/floorplans/osm"
mkdirSync(OUT, { recursive: true })
mkdirSync(PLANS, { recursive: true })

for (const b of winners) {
  const id = b.__venueId
  const { __waypointCount, __hospitalCode, __countryCode, __rasterSlug, __venueId, ...venue } = b
  venue.id = id
  venue.country = __countryCode

  rmSync(`${PLANS}/${id}`, { recursive: true, force: true })
  mkdirSync(`${PLANS}/${id}`, { recursive: true })
  const usable = []
  for (const p of venue.floorPlans) {
    const raster = `public/floorplans/${__rasterSlug}/${p.id}.svg`
    let svg
    try {
      svg = readFileSync(raster)
    } catch (err) {
      console.error(`[${STAGE}] ${id} plan ${p.id}: missing rasterised SVG at ${raster} — ${err.message}`)
      continue
    }
    if (svg.length > MAX_SVG_BYTES) {
      console.error(`[${STAGE}] ${id} plan ${p.id}: SVG is ${(svg.length / 1024 / 1024).toFixed(1)}MB — likely a degenerate rasterization, skipping`)
      continue
    }
    writeFileSync(`${PLANS}/${id}/${p.id}.svg`, svg)
    usable.push({ ...p, imageUrl: `/floorplans/osm/${id}/${p.id}.svg` })
  }
  if (!usable.length) {
    console.error(`[${STAGE}] ${id}: no usable plan survived, not publishing (${venue.name}, ${__countryCode})`)
    rmSync(`${PLANS}/${id}`, { recursive: true, force: true })
    continue
  }
  venue.floorPlans = usable
  writeFileSync(`${OUT}/${id}.json`, JSON.stringify(venue) + "\n")
  log(STAGE, `${id}: ${__waypointCount} waypoints (${venue.name}, ${__countryCode})`)
}

log(STAGE, `done — ${winners.length} venue(s) written`)
