#!/usr/bin/env node
// Is each floor plan placed where its hospital actually is?
//
// audit-venues.mjs grades what a venue CONTAINS. This grades where it SITS,
// which is a different failure and an invisible one: a sheet can have perfect
// waypoints, correct names and a full corridor network and still be pinned
// across the road at the wrong angle, because pins and picture come from the
// same transform and therefore always agree with each other. The existing QA
// overlay (overlay.mjs) draws pins on the sheet, so it can only ever show that
// extraction was self-consistent — never that placement was right.
//
// Placement today is two numbers per sheet (data/mapped-sites.json): a `center`
// and a `spanM`. That is a translation and a uniform scale — three of the four
// numbers a similarity transform needs, and the missing one is the angle. So a
// sheet drawn at 30° to north is nailed to the basemap at 30° to north.
//
// What this reports, and how much to trust each part:
//
//   SHEET SIDE (always available, self-consistency only)
//     span source  measured from an OpenStreetMap footprint, or the 450 m
//                  default — a constant standing in for a hospital's real size.
//     fill         how much of the sheet's width the drawing occupies. `spanM`
//                  is applied to the WHOLE page, margins and title block and
//                  legend included, so a drawing filling 0.75 of the page is
//                  rendered 33% too big for the ground it covers.
//     anchor off   distance from the venue's anchor to the middle of its own
//                  waypoints. The anchor is asserted to be the centre of the
//                  plan; this is how wrong that assertion is on the sheet's own
//                  terms, before the real world is consulted at all.
//     rotation     whether any angle is set. FloorPlan.rotation is supported by
//                  the renderer (FloorPlanMap.tsx) and set by nothing.
//
//   GROUND TRUTH (only with data/footprints.geojson — OpenStreetMap's outline
//   of the same estate, written by scripts/nhs/fetch-osm.mjs)
//     centroid off  how far the anchor is from the buildings themselves. This
//                   is the number that shows up as "the hospital is across the
//                   road from where the map draws it".
//     scale         drawn extent ÷ real extent, per axis.
//     turn          the angle between the sheet's grid and the estate's grid,
//                   mod 90° — see dominantAngle() in lib/placement.mjs.
//
// Run: node scripts/maps/audit-placement.mjs [--json] [--venue <slug>]
//                                            [--footprints <path>]
//
// Exit code is always 0: this reports, it does not gate.

import { readFileSync, readdirSync, existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { loadVenues } from "./lib/venue-source.mjs"
import { readSvgGeometry, planRegion, fillBounds } from "./lib/svg-geom.mjs"
import {
  M_PER_LAT, mPerLng, toLocal, bboxOfPoints, segmentsOfRing, dominantAngle, angleGap, trimToCore, cellIndex,
} from "./lib/placement.mjs"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const VENUE_DIR = join(ROOT, "src", "lib", "venues")

const argv = process.argv.slice(2)
const flag = (name) => {
  const i = argv.indexOf(name)
  return i > -1 ? argv[i + 1] : null
}
const AS_JSON = argv.includes("--json")
const ONLY = flag("--venue")
const FOOTPRINTS = flag("--footprints") ?? join(ROOT, "data", "footprints.geojson")

// Segments shorter than this are label serifs and hatching, not walls. In sheet
// units (PDF points, ~0.35 mm) 6 is about 2 mm of drawn line.
const MIN_SEGMENT = 6
// A hospital's own grid is drawn in its buildings and roads. The page frame and
// the legend's rules are long, dead straight and axis-aligned, and there are
// enough of them to drag the estimate to 0° on their own — so anything spanning
// more than half the page is treated as furniture.
const MAX_SEGMENT_FRACTION = 0.5

// --- inputs ----------------------------------------------------------------

const sheets = JSON.parse(readFileSync(join(ROOT, "data", "mapped-sites.json"), "utf8")).sheets
const sheetBySlug = new Map(sheets.map((s) => [s.slug, s]))

function readFootprints(path) {
  if (!existsSync(path)) return null
  const doc = JSON.parse(readFileSync(path, "utf8"))
  const byOds = new Map()
  for (const f of doc.features ?? []) {
    const code = f.properties?.odsCode
    if (!code) continue
    const list = byOds.get(code)
    if (list) list.push(f)
    else byOds.set(code, [f])
  }
  return byOds
}

// Every ring of every footprint, as [lng, lat] point arrays.
function ringsOf(features) {
  const rings = []
  for (const f of features) {
    const g = f?.geometry
    if (!g) continue
    if (g.type === "Polygon") rings.push(...g.coordinates)
    else if (g.type === "MultiPolygon") for (const poly of g.coordinates) rings.push(...poly)
  }
  return rings
}

// --- sheet-side measurement ------------------------------------------------

// Where the site plan sits on the page, and what angle it is drawn at.
//
// "Where the plan sits" is not the bounding box of the ink: the page frame, the
// title rule and the legend's borders all reach the edges, so an ink box is the
// page box on nearly every sheet and says nothing. What is wanted is the extent
// of the DRAWING — the buildings and zones — which planRegion() already knows
// how to separate from margin and branding, because the corridor extractor
// needs the same distinction.
//
// The extent is trimmed to the box holding 95% of the drawn area rather than
// all of it, so a colour swatch in a legend corner cannot stretch the plan
// across the page. A raster plan returns null: a PNG carries no geometry to
// measure, which is itself the finding.
function measureDrawing(imageUrl, spanM) {
  const path = join(ROOT, "public", imageUrl)
  if (!imageUrl.endsWith(".svg") || !existsSync(path)) return null
  const geom = readSvgGeometry(readFileSync(path, "utf8"))
  const { w: W, h: H } = geom.viewBox
  if (!W || !H) return null
  const { mass, walls } = planRegion(geom, W / spanM)
  if (!mass.length) return { W, H, plan: null, grid: { angle: null, strength: 0 } }

  // Drawn area per cell of a coarse grid over the page.
  const N = 100
  const cells = new Float64Array(N * N)
  let total = 0
  for (const f of mass) {
    const b = fillBounds(f)
    // Spread each shape's area over the cells its box covers. Exact coverage
    // would need scan conversion; for deciding which tenth of the page the
    // plan occupies, the box is indistinguishable and far cheaper.
    const x0 = cellIndex(b.x0, W, N), x1 = cellIndex(b.x1, W, N)
    const y0 = cellIndex(b.y0, H, N), y1 = cellIndex(b.y1, H, N)
    const share = f.area / ((x1 - x0 + 1) * (y1 - y0 + 1))
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) cells[y * N + x] += share
    total += f.area
  }
  const plan = trimToCore(cells, N, total, 0.05)

  // Orientation from the plan's own lines: building outlines, wall bars and
  // stroked roads. Text and symbols are already gone; the page frame is
  // excluded by length, since nothing real on a hospital site runs half a page.
  const segments = []
  const longest = Math.max(W, H) * MAX_SEGMENT_FRACTION
  // SVG is y-down and dominantAngle wants y-up, so the sign of y flips here.
  const add = (ring, closed) => {
    for (const s of segmentsOfRing(ring, { closed })) segments.push([s[0], -s[1], s[2], -s[3]])
  }
  for (const f of [...mass, ...walls]) for (const ring of f.rings) add(ring, true)
  for (const s of geom.strokes) add(s.points, s.closed)

  return {
    W, H,
    plan: plan && { x0: (plan.x0 / N) * W, y0: (plan.y0 / N) * H, x1: (plan.x1 / N) * W, y1: (plan.y1 / N) * H },
    grid: dominantAngle(segments, { minLength: MIN_SEGMENT, maxLength: longest }),
  }
}

function measure(venue, sheet, footprints) {
  const plan = venue.floorPlans?.[0]
  if (!plan) return null
  const [[south, west], [north, east]] = plan.bounds
  const anchor = venue.center
  const perLng = mPerLng(anchor.lat)
  const sheetW = (east - west) * perLng
  const sheetH = (north - south) * M_PER_LAT

  const row = {
    slug: venue.slug,
    name: venue.name,
    odsCode: sheet?.odsCode ?? null,
    spanM: sheet?.spanM ?? Math.round(sheetW),
    spanSource: sheet?.auto?.spanSource ?? (sheet ? "manual" : "hand-built"),
    crop: sheet?.floors?.[0]?.plan ?? sheet?.plan ?? null,
    raster: !plan.imageUrl.endsWith(".svg"),
    rotation: plan.rotation ?? 0,
    floors: venue.floorPlans.length,
    waypoints: venue.waypoints?.length ?? 0,
    sheetW: Math.round(sheetW),
    sheetH: Math.round(sheetH),
  }

  // Where the waypoints sit inside the sheet, in metres from its NW corner.
  const wps = venue.waypoints?.filter((w) => (w.floor ?? 0) === (plan.floor ?? 0)) ?? []
  if (wps.length >= 3) {
    const pts = wps.map((w) => [(w.coordinates.lng - west) * perLng, (north - w.coordinates.lat) * M_PER_LAT])
    const box = bboxOfPoints(pts)
    row.labelFill = round2(box.width / sheetW)
    row.anchorOffsetM = Math.round(
      Math.hypot((box.minX + box.maxX) / 2 - (anchor.lng - west) * perLng,
                 (box.minY + box.maxY) / 2 - (north - anchor.lat) * M_PER_LAT)
    )
  }

  const drawing = measureDrawing(plan.imageUrl, row.spanM)
  if (drawing) {
    row.sheetGrid = drawing.grid.angle == null ? null : round1(drawing.grid.angle)
    row.sheetGridStrength = round2(drawing.grid.strength)
    if (drawing.plan) {
      row.planFillW = round2((drawing.plan.x1 - drawing.plan.x0) / drawing.W)
      row.planFillH = round2((drawing.plan.y1 - drawing.plan.y0) / drawing.H)
      // The drawing's own extent on the ground, as currently placed. This is
      // the number to compare against the estate's real size: the sheet width
      // in metres covers the page, and the plan is only part of the page.
      row.drawnW = Math.round(sheetW * row.planFillW)
      row.drawnH = Math.round(sheetH * row.planFillH)
      // How far the middle of the drawing is from the middle of the page. The
      // anchor is applied to the page centre (or the crop's centre), so a plan
      // drawn off to one side is translated by this much.
      row.planOffCentreM = Math.round(Math.hypot(
        ((drawing.plan.x0 + drawing.plan.x1) / 2 / drawing.W - 0.5) * sheetW,
        ((drawing.plan.y0 + drawing.plan.y1) / 2 / drawing.H - 0.5) * sheetH,
      ))
    }
  }

  const features = footprints && row.odsCode ? footprints.get(row.odsCode) : null
  if (features?.length) {
    const rings = ringsOf(features)
    const local = rings.map((r) => r.map(([lng, lat]) => {
      const p = toLocal(anchor, lat, lng)
      return [p.x, p.y]
    }))
    const box = bboxOfPoints(local.flat())
    row.truth = {
      buildings: features.length,
      // Anchor to the middle of the real estate. The anchor is an ODS registry
      // point — a postal address — and the register does not promise it is
      // anywhere near the middle of the site, or even on it.
      centroidOffsetM: Math.round(Math.hypot((box.minX + box.maxX) / 2, (box.minY + box.maxY) / 2)),
      realW: Math.round(box.width),
      realH: Math.round(box.height),
      // How much bigger the drawing is than the ground it claims to cover.
      scaleX: box.width ? round2((row.drawnW ?? sheetW) / box.width) : null,
      scaleY: box.height ? round2((row.drawnH ?? sheetH) / box.height) : null,
    }
    const estateGrid = dominantAngle(local.flatMap((r) => segmentsOfRing(r)), { minLength: 2 })
    row.truth.estateGrid = estateGrid.angle == null ? null : round1(estateGrid.angle)
    row.truth.estateGridStrength = round2(estateGrid.strength)
    const turn = angleGap(row.sheetGrid, row.truth.estateGrid)
    row.truth.turnDeg = turn == null ? null : round1(turn)
  }
  return row
}

const round1 = (n) => Number(n.toFixed(1))
const round2 = (n) => Number(n.toFixed(2))

// --- findings --------------------------------------------------------------

// Thresholds are stated in metres on the ground, because that is the unit the
// walker experiences. 25 m is roughly a main road plus its pavements — the
// point at which the plan is visibly over the wrong buildings.
const NEAR_M = 25
const FAR_M = 60

function findingsFor(row) {
  const out = []
  if (!row.rotation) {
    out.push(["rotation", "no rotation set: the sheet is pinned north-up whatever angle it was drawn at"])
  }
  if (row.spanSource === "default") {
    out.push(["scale", `scale is the ${row.spanM} m default, not a measurement of this hospital`])
  }
  if (row.crop && row.crop.join() === "0,0,1,1") {
    out.push(["crop", "full-page crop: title block, key and directory table are inside the mapped area"])
  }
  if (row.planFillW != null && row.planFillW < 0.9) {
    out.push(["scale", `the plan fills ${Math.round(row.planFillW * 100)}% of the page width, but spanM is applied to 100% of it — the site is drawn ${Math.round((1 / row.planFillW - 1) * 100)}% larger than the scale claims`])
  }
  if (row.planOffCentreM != null && row.planOffCentreM >= NEAR_M) {
    out.push([row.planOffCentreM >= FAR_M ? "anchor" : "anchor-minor",
      `the plan is drawn ${row.planOffCentreM} m off the centre of the page it is anchored by`])
  }
  if (row.raster) {
    out.push(["source", "raster plan: no geometry to align, and nothing to reproject later"])
  }
  if (row.anchorOffsetM != null && row.anchorOffsetM >= NEAR_M) {
    out.push([row.anchorOffsetM >= FAR_M ? "anchor" : "anchor-minor",
      `the anchor sits ${row.anchorOffsetM} m from the middle of the sheet's own waypoints`])
  }
  const t = row.truth
  if (t) {
    if (t.centroidOffsetM >= NEAR_M) {
      out.push([t.centroidOffsetM >= FAR_M ? "anchor" : "anchor-minor",
        `the anchor is ${t.centroidOffsetM} m from the middle of the real buildings`])
    }
    for (const [axis, v] of [["x", t.scaleX], ["y", t.scaleY]]) {
      if (v != null && (v < 0.75 || v > 1.35)) {
        out.push(["scale", `drawn ${v}× the estate's real ${axis} extent`])
      }
    }
    if (t.turnDeg != null && Math.abs(t.turnDeg) >= 5 && row.sheetGridStrength >= 0.3 && t.estateGridStrength >= 0.3) {
      out.push(["rotation", `the sheet's grid is ${t.turnDeg}° off the estate's grid`])
    }
  }
  return out
}

// --- report ----------------------------------------------------------------

function main() {
  const footprints = readFootprints(FOOTPRINTS)
  const rows = []
  for (const file of readdirSync(VENUE_DIR)) {
    if (!file.endsWith(".ts") || file === "index.ts" || file === "generated-sheets.ts") continue
    let venues = []
    try {
      venues = loadVenues(readFileSync(join(VENUE_DIR, file), "utf8"))
    } catch {
      continue
    }
    for (const venue of venues) {
      if (ONLY && venue.slug !== ONLY) continue
      if (!venue.floorPlans?.length) continue
      const row = measure(venue, sheetBySlug.get(venue.slug), footprints)
      if (row) rows.push({ ...row, findings: findingsFor(row) })
    }
  }

  const worst = (r) => Math.max(r.truth?.centroidOffsetM ?? 0, r.anchorOffsetM ?? 0, r.planOffCentreM ?? 0)
  rows.sort((a, b) => worst(b) - worst(a))

  if (AS_JSON) {
    console.log(JSON.stringify({ footprints: footprints ? FOOTPRINTS : null, venues: rows }, null, 2))
    return
  }

  if (!footprints) {
    console.log(
      `No footprints at ${FOOTPRINTS} — reporting sheet-side geometry only.\n` +
      `Ground truth needs \`npm run nhs:osm\`, which fetches building outlines from\n` +
      `OpenStreetMap. Without them nothing here can tell you WHERE a sheet is wrong,\n` +
      `only that its own numbers do not describe the drawing on it.\n`
    )
  }

  const pad = (s, n) => String(s).padEnd(n).slice(0, n)
  const num = (v, n) => String(v ?? "-").padStart(n)
  console.log(
    pad("venue", 32) + num("span", 6) + " " + pad("source", 14) +
    num("fill", 5) + num("off-c", 6) + num("grid°", 7) + num("anchor", 7) + num("truth", 6) + num("turn°", 6) + "  flags"
  )
  for (const r of rows) {
    const kinds = [...new Set(r.findings.map((f) => f[0].replace("-minor", "")))]
    console.log(
      pad(r.name, 32) + num(r.spanM, 6) + " " + pad(r.spanSource, 14) +
      num(r.planFillW ?? "-", 5) + num(r.planOffCentreM ?? "-", 6) +
      num(r.sheetGrid ?? "-", 7) + num(r.anchorOffsetM ?? "-", 7) +
      num(r.truth?.centroidOffsetM ?? "-", 6) + num(r.truth?.turnDeg ?? "-", 6) + "  " + kinds.join(",")
    )
  }

  const count = (fn) => rows.filter(fn).length
  const median = (values) => {
    const a = values.filter((v) => v != null).sort((x, y) => x - y)
    return a.length ? a[Math.floor(a.length / 2)] : null
  }
  console.log(`\n${rows.length} venues with a floor plan\n`)
  console.log(`  rotation set                      ${count((r) => r.rotation)}`)
  console.log(`  scale measured from a footprint   ${count((r) => r.spanSource.startsWith("osm"))}`)
  console.log(`  scale is the default constant     ${count((r) => r.spanSource === "default")}`)
  console.log(`  full-page crop                    ${count((r) => r.crop && r.crop.join() === "0,0,1,1")}`)
  console.log(`  raster plan                       ${count((r) => r.raster)}`)
  console.log(`  median plan fill of page width    ${median(rows.map((r) => r.planFillW))}`)
  console.log(`  median plan off-centre (m)        ${median(rows.map((r) => r.planOffCentreM))}`)
  console.log(`  median anchor offset (m)          ${median(rows.map((r) => r.anchorOffsetM))}`)
  console.log(`  anchor offset >= ${FAR_M} m (sheet)     ${count((r) => (r.anchorOffsetM ?? 0) >= FAR_M)}`)
  if (footprints) {
    console.log(`  median offset from buildings (m)  ${median(rows.map((r) => r.truth?.centroidOffsetM))}`)
    console.log(`  offset from buildings >= ${FAR_M} m    ${count((r) => (r.truth?.centroidOffsetM ?? 0) >= FAR_M)}`)
    console.log(`  median |turn| (deg)               ${median(rows.map((r) => r.truth?.turnDeg && Math.abs(r.truth.turnDeg)))}`)
  } else {
    console.log(`  offset from buildings             unmeasured (no footprints)`)
    console.log(`  turn from estate grid             unmeasured (no footprints)`)
  }
}

main()
