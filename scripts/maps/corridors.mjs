#!/usr/bin/env node
// Extract a walkable corridor network from a traced floor plan.
//
// This is the step that turns a picture of a hospital into somewhere you can be
// navigated through. routing.ts follows `trails` — corridor centre-lines — and
// falls back to a straight line flagged `approximate` when a floor has none.
// 71 of 72 venues have none, so 71 of 72 draw a dashed line through the walls.
//
// The traced sheets already hold what is needed. pdf2svg.mjs rebuilds the
// trust's PDF as vector geometry, so a floor arrives as a filled building mass
// with its walls drawn on top as stroked lines. Scan-convert that into an
// occupancy grid, thin the free space to its medial axis, and the result is the
// middle of every corridor — the same construction indoor-mapping tools use to
// derive a navigation mesh from CAD.
//
//   node scripts/maps/corridors.mjs --venue princess-anne-hospital --debug out/
//   node scripts/maps/corridors.mjs --all --write
//
// --write edits the venue module's `trails` field in place. Without it, nothing
// is written and the report says what would have been.

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs"
import { join, dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { readSvgGeometry, isWhite, fillBounds, planRegion } from "./lib/svg-geom.mjs"
import {
  makeGrid, fillPolygon, strokeLine, distanceTransform, thin, traceSkeleton,
  simplify, pruneSpurs, BLOCKED,
} from "./lib/skeleton.mjs"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const VENUE_DIR = join(ROOT, "src", "lib", "venues")
const PUBLIC_DIR = join(ROOT, "public")
const M_PER_LAT = 111320

// Grid resolution. A hospital corridor is 1.5–3 m wide, so half a metre per
// cell keeps three or more cells across the narrowest one — below that, thinning
// starts breaking corridors into dashes.
const METRES_PER_CELL = 0.5
// Below this the "corridor" is a doorway or a drafting gap, not a route.
const MIN_CORRIDOR_M = 0.9
// Above it, the free space is a courtyard or the page margin; its medial axis is
// not a corridor and would route people across open ground.
const MAX_CORRIDOR_M = 14
// A dead end shorter than this is the whisker thinning leaves at every corner.
const MIN_SPUR_M = 4
// A disconnected fragment shorter than this is noise.
const MIN_COMPONENT_M = 12
// Simplification tolerance: a corridor centre-line is straight runs, and every
// retained point becomes a node buildTrailGraph() compares pairwise.
const SIMPLIFY_M = 0.75
// Thinning is iterative over every cell, so grid size sets the runtime. Above
// this many cells, resolution is coarsened rather than the sheet refused.
const MAX_GRID_CELLS = 1.6e6

const args = process.argv.slice(2)
const flag = (n) => args.includes(n)
const opt = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : null)

// --- Venue module reading (same approach as audit-venues.mjs) ---------------

function loadVenue(src) {
  const js = src
    .replace(/^\s*import\s[^\n]*\n/gm, "")
    .replace(/:\s*Venue\[\]\s*=/g, " =")
    .replace(/:\s*Venue\s*=/g, " =")
    .replace(/:\s*\[\[number,\s*number\],\s*\[number,\s*number\]\]\s*=/g, " =")
    .replace(/\bas\s+const\b/g, "")
    .replace(/\bas\s+"[^"]*"/g, "")
    .replace(/^\s*export\s+const\s+/gm, "const ")
  const names = [...src.matchAll(/^export const (\w+)\s*:\s*Venue\s*=/gm)].map((m) => m[1])
  if (!names.length) return null
  return new Function(`${js}\nreturn ${names[0]}`)()
}

// --- Extraction ------------------------------------------------------------

function extractFloor(svgPath, spanM) {
  const svg = readFileSync(svgPath, "utf8")
  const geom = readSvgGeometry(svg)
  const { viewBox } = geom
  // Metres per viewBox unit, from the sheet's real-world width.
  const mPerUnit = spanM / viewBox.w
  const { mass, walls: wallFills } = planRegion(geom, 1 / mPerUnit)
  if (!mass.length) return { reason: "no filled plan area in the drawing" }

  // Half a metre a cell on a 900 m campus sheet is a 1800x1300 grid, and
  // thinning iterates over every cell until nothing changes — the run stops
  // looking slow and starts looking hung. Coarsen for big sheets rather than
  // refusing them: a site that large is a campus, where the network worth
  // having is roads and paths metres wide, not a 2 m corridor.
  let metresPerCell = METRES_PER_CELL
  let unitsPerCell = metresPerCell / mPerUnit
  while ((viewBox.w / unitsPerCell) * (viewBox.h / unitsPerCell) > MAX_GRID_CELLS) {
    metresPerCell *= 1.5
    unitsPerCell = metresPerCell / mPerUnit
  }
  const gw = Math.max(16, Math.round(viewBox.w / unitsPerCell))
  const gh = Math.max(16, Math.round(viewBox.h / unitsPerCell))

  const toCell = (x, y) => [(x - viewBox.x) / unitsPerCell, (y - viewBox.y) / unitsPerCell]

  // 1. The floor: everywhere the building is painted.
  const floor = makeGrid(gw, gh)
  for (const f of mass) fillPolygon(floor, f.rings.map((r) => r.map(([x, y]) => toCell(x, y))), 1)

  // 2. The walls, punched out of it — in both the forms a tracer draws them.
  //    Stroked outlines are the obvious one; the majority are actually long
  //    thin FILLED rectangles, which is why they have to be told from room
  //    labels by shape (see classifyFill) rather than by area. Treating those
  //    as text leaves the floor one open region whose medial axis reads 10 m
  //    wide where a hospital corridor is 2 to 3.
  const walls = makeGrid(gw, gh)
  for (const s of geom.strokes) {
    if (isWhite(s.rgb)) continue
    const widthCells = Math.max(1, s.width / unitsPerCell)
    strokeLine(walls, s.points.map(([x, y]) => toCell(x, y)), widthCells, 1)
  }
  for (const f of wallFills) {
    fillPolygon(walls, f.rings.map((r) => r.map(([x, y]) => toCell(x, y))), 1)
    // A wall thinner than one cell scan-converts to nothing, and a one-cell gap
    // is a doorway the thinning will happily walk through. Stamp the
    // rectangle's spine too, so a hairline wall still blocks.
    const b = fillBounds(f)
    const spine = b.w >= b.h
      ? [[b.x0, (b.y0 + b.y1) / 2], [b.x1, (b.y0 + b.y1) / 2]]
      : [[(b.x0 + b.x1) / 2, b.y0], [(b.x0 + b.x1) / 2, b.y1]]
    strokeLine(walls, spine.map(([x, y]) => toCell(x, y)), 1, 1)
  }

  // 3. Walkable = floor and not wall.
  const walkable = new Uint8Array(gw * gh)
  for (let i = 0; i < walkable.length; i++) walkable[i] = floor.cells[i] && !walls.cells[i] ? 1 : 0

  // 4. How far each walkable cell is from the nearest wall — the local half
  //    width. Used to reject the parts of the free space that are not corridors.
  const blockGrid = { w: gw, h: gh, cells: new Uint8Array(gw * gh) }
  for (let i = 0; i < blockGrid.cells.length; i++) blockGrid.cells[i] = walkable[i] ? 0 : BLOCKED
  const dist = distanceTransform(blockGrid)

  const skel = thin(walkable, gw, gh)

  // 5. Keep skeleton cells whose corridor half-width is plausible. A cell in the
  //    middle of a car park or a courtyard is 20 m from anything and is not a
  //    corridor; a cell in a drafting sliver is half a metre from both walls.
  const minHalf = MIN_CORRIDOR_M / 2 / metresPerCell
  const maxHalf = MAX_CORRIDOR_M / 2 / metresPerCell
  let kept = 0
  for (let i = 0; i < skel.length; i++) {
    if (!skel[i]) continue
    if (dist[i] < minHalf || dist[i] > maxHalf) skel[i] = 0
    else kept++
  }
  if (!kept) return { reason: "no free space of corridor width" }

  // 6. Skeleton → polylines, in cells.
  let lines = traceSkeleton(skel, gw, gh)
  lines = pruneSpurs(lines, MIN_SPUR_M / metresPerCell)
  lines = lines
    .map((l) => simplify(l, SIMPLIFY_M / metresPerCell))
    .filter((l) => {
      let len = 0
      for (let i = 0; i + 1 < l.length; i++) len += Math.hypot(l[i + 1][0] - l[i][0], l[i + 1][1] - l[i][1])
      return len >= MIN_COMPONENT_M / metresPerCell
    })

  const widths = []
  for (let i = 0; i < skel.length; i++) if (skel[i]) widths.push(dist[i] * 2 * metresPerCell)
  widths.sort((a, b) => a - b)

  let totalM = 0
  for (const l of lines) {
    for (let i = 0; i + 1 < l.length; i++) {
      totalM += Math.hypot(l[i + 1][0] - l[i][0], l[i + 1][1] - l[i][1]) * metresPerCell
    }
  }

  let floorCells = 0
  for (let i = 0; i < floor.cells.length; i++) if (floor.cells[i]) floorCells++
  const floorAreaM2 = floorCells * metresPerCell * metresPerCell
  const medianWidthM = widths.length ? Number(widths[Math.floor(widths.length / 2)].toFixed(1)) : 0

  const stats = {
    lines: lines.length,
    totalM: Math.round(totalM),
    medianWidthM,
    nodes: lines.reduce((n, l) => n + l.length, 0),
    floorAreaM2: Math.round(floorAreaM2),
    // Square metres of floor served per metre of corridor. A hospital floor
    // runs roughly 20–80; far above that and most of the floor has no route to
    // it, far below and the "corridors" are really the rooms.
    m2PerCorridorM: totalM > 0 ? Math.round(floorAreaM2 / totalM) : Infinity,
    metresPerCell: Number(metresPerCell.toFixed(2)),
  }

  // The gate. A wrong corridor network is worse than none: routing believes
  // `trails` absolutely, so a bad one sends someone confidently through a wall,
  // where an absent one at least draws a dashed line and says to follow the
  // signs. Anything that does not look like a building's circulation is
  // reported and dropped rather than written.
  const fail = []
  if (medianWidthM < 1.2) fail.push(`median width ${medianWidthM} m — too narrow to be a corridor`)
  if (medianWidthM > 6) fail.push(`median width ${medianWidthM} m — that is open ground, not a corridor`)
  if (totalM < 40) fail.push(`only ${Math.round(totalM)} m of network`)
  if (stats.m2PerCorridorM > 250) fail.push(`${stats.m2PerCorridorM} m² of floor per metre of corridor — most of the floor is unreachable`)
  if (stats.m2PerCorridorM < 8) fail.push(`${stats.m2PerCorridorM} m² per metre — the rooms have been traced as corridors`)

  return { lines, grid: { w: gw, h: gh, unitsPerCell, viewBox }, stats, fail }
}

// Cells → lat/lng, using the floor plan's own bounds. The plan image is placed
// on the map by those bounds, so a network derived in image space lands exactly
// where the drawing does — including any error in the placement itself, which is
// a separate defect (see docs/mapping-review.md).
function toCoords(lines, grid, bounds) {
  const [[latS, lngW], [latN, lngE]] = bounds
  const { w, h, unitsPerCell, viewBox } = grid
  return lines.map((l) =>
    l.map(([cx, cy]) => {
      const ux = (cx + 0.5) * unitsPerCell + viewBox.x
      const uy = (cy + 0.5) * unitsPerCell + viewBox.y
      const fx = ux / viewBox.w
      const fy = uy / viewBox.h
      return {
        lat: Number((latN - fy * (latN - latS)).toFixed(6)),
        lng: Number((lngW + fx * (lngE - lngW)).toFixed(6)),
      }
    })
  )
}

function spanMetres(bounds) {
  const [[latS, lngW], [latN, lngE]] = bounds
  const mid = ((latS + latN) / 2) * (Math.PI / 180)
  return Math.abs(lngE - lngW) * M_PER_LAT * Math.cos(mid)
}

// A rendering of what was found, drawn over the plan it came from. The only
// honest way to judge a corridor network is to look at it on the drawing.
function debugSvg(svgPath, lines, grid) {
  const svg = readFileSync(svgPath, "utf8")
  const { unitsPerCell, viewBox } = grid
  const paths = lines
    .map((l) => {
      const d = l
        .map(([cx, cy], i) => {
          const x = (cx + 0.5) * unitsPerCell + viewBox.x
          const y = (cy + 0.5) * unitsPerCell + viewBox.y
          return `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`
        })
        .join("")
      return `<path d="${d}" fill="none" stroke="#e11d48" stroke-width="2" stroke-opacity="0.85" stroke-linecap="round" stroke-linejoin="round"/>`
    })
    .join("")
  return svg.replace("</svg>", `<g>${paths}</g></svg>`)
}

// --- Writing trails back into the venue module ------------------------------

function renderTrails(perFloor) {
  const out = ["  trails: ["]
  for (const { floor, coords } of perFloor) {
    coords.forEach((line, i) => {
      const pts = line.map((c) => `{ lat: ${c.lat}, lng: ${c.lng} }`).join(", ")
      out.push(`    { id: "c${floor}-${i + 1}", floor: ${floor}, points: [${pts}] },`)
    })
  }
  out.push("  ],")
  return out.join("\n")
}

function writeTrails(path, block) {
  let src = readFileSync(path, "utf8")
  if (/^ {2}trails: \[/m.test(src)) {
    src = src.replace(/^ {2}trails: \[[\s\S]*?^ {2}\],$/m, block)
  } else {
    // Before `waypoints:` — the field order the hand-built venues use.
    src = src.replace(/^ {2}waypoints: \[/m, `${block}\n  waypoints: [`)
  }
  writeFileSync(path, src)
}

// --- Main ------------------------------------------------------------------

// resolve, not join: an absolute --debug path must be written where it says,
// not appended to the repo root.
const debugDir = opt("--debug") ? resolve(ROOT, opt("--debug")) : null
if (debugDir) mkdirSync(debugDir, { recursive: true })

const only = opt("--venue")
const registry = readFileSync(join(VENUE_DIR, "index.ts"), "utf8") + readFileSync(join(VENUE_DIR, "generated-sheets.ts"), "utf8")
const shipped = new Set([...registry.matchAll(/from "\.\/([a-z0-9-]+)"/g)].map((m) => m[1]))
const files = readdirSync(VENUE_DIR)
  .filter((f) => f.endsWith(".ts") && shipped.has(f.replace(/\.ts$/, "")))
  .filter((f) => !only || f === `${only}.ts`)

if (!files.length) {
  console.error(only ? `no shipped venue module for "${only}"` : "no venue modules found")
  process.exit(1)
}

const report = []
for (const file of files) {
  const path = join(VENUE_DIR, file)
  let venue
  try {
    venue = loadVenue(readFileSync(path, "utf8"))
  } catch {
    continue
  }
  if (!venue?.floorPlans?.length) continue

  const perFloor = []
  const notes = []
  for (const plan of venue.floorPlans) {
    const img = join(PUBLIC_DIR, plan.imageUrl.replace(/^\//, ""))
    if (!existsSync(img) || !img.endsWith(".svg")) {
      notes.push(`${plan.label}: ${img.endsWith(".svg") ? "missing" : "raster plan"}`)
      continue
    }
    const spanM = spanMetres(plan.bounds)
    let res
    try {
      res = extractFloor(img, spanM)
    } catch (err) {
      notes.push(`${plan.label}: ${err.message}`)
      continue
    }
    if (res.reason) {
      notes.push(`${plan.label}: ${res.reason}`)
      continue
    }
    if (!res.lines.length) {
      notes.push(`${plan.label}: REJECTED — nothing survived the width and length gates`)
      continue
    }
    const summary =
      `${res.stats.lines} lines, ${res.stats.totalM} m, median width ${res.stats.medianWidthM} m, ` +
      `${res.stats.m2PerCorridorM} m²/m, ${res.stats.nodes} nodes`
    if (res.fail.length) {
      notes.push(`${plan.label}: REJECTED — ${res.fail.join("; ")} (${summary})`)
      // Still render the debug overlay for a rejected floor: seeing why it was
      // rejected is the point of the overlay.
      if (debugDir) {
        writeFileSync(join(debugDir, `${venue.slug}-f${plan.floor}-rejected.svg`), debugSvg(img, res.lines, res.grid))
      }
      continue
    }
    perFloor.push({ floor: plan.floor, coords: toCoords(res.lines, res.grid, plan.bounds), stats: res.stats })
    notes.push(`${plan.label}: ${summary}`)
    if (debugDir) {
      const out = join(debugDir, `${venue.slug}-f${plan.floor}.svg`)
      writeFileSync(out, debugSvg(img, res.lines, res.grid))
    }
  }

  if (perFloor.length && flag("--write")) writeTrails(path, renderTrails(perFloor))
  report.push({ venue: venue.name, slug: venue.slug, floors: perFloor.length, notes })
}

for (const r of report) {
  console.log(`\n${r.venue} (${r.slug})`)
  for (const n of r.notes) console.log(`  ${n}`)
}
const withNetwork = report.filter((r) => r.floors > 0).length
console.log(
  `\n${withNetwork}/${report.length} venues produced a corridor network` +
    (flag("--write") ? " (written)" : " (dry run — pass --write to save)")
)
