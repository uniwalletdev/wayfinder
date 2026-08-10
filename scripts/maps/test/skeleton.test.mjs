// Checks for the corridor-extraction primitives (scripts/maps/lib/).
//
// These run on synthetic geometry, where the right answer is known: an H-shaped
// building has a corridor down each arm and one across the middle, and its
// medial axis has to come back as three lines meeting at two junctions. On a
// real traced sheet there is nothing to check the output against except the eye,
// so the maths is pinned here instead.
//
// Run: node scripts/maps/test/skeleton.test.mjs
import {
  makeGrid, fillPolygon, strokeLine, distanceTransform, thin, traceSkeleton,
  simplify, pruneSpurs, BLOCKED,
} from "../lib/skeleton.mjs"
import { parsePathData, readSvgGeometry, classifyFill, isWhite } from "../lib/svg-geom.mjs"
import { group, check, report } from "../../nhs/test/harness.mjs"

const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]

group("path parsing")
{
  const subs = parsePathData("M10 10L20 10L20 20Z")
  check("one closed subpath", subs.length === 1 && subs[0].closed)
  check("three corners", subs[0].points.length === 3)

  // The tessellated triangle strips pdf2svg emits use repeated Z and implicit
  // lineto after moveto — both have to survive.
  const strip = parsePathData("M0 0L10 0L0 10ZM10 0L0 10L10 10ZZ")
  check("a triangle strip yields both triangles", strip.length === 2)

  const rel = parsePathData("m5 5 l10 0 l0 10 z")
  check("relative commands are absolute afterwards", rel[0].points[1][0] === 15)

  const curve = parsePathData("M0 0C10 0 20 0 30 0")
  check("a flat cubic flattens to few points", curve[0].points.length < 6)
  check("and ends where it should", curve[0].points.at(-1)[0] === 30)
}

group("fill classification")
{
  const limits = { wallMinLength: 20, wallMaxThickness: 6, massMinArea: 5000 }
  const mk = (x0, y0, x1, y1) => ({ rings: [rect(x0, y0, x1, y1)], area: (x1 - x0) * (y1 - y0) })

  // The distinction the whole extraction rests on: a wall and a letter of a
  // room label are both small, both black, and only their shape tells them
  // apart. Judging by area alone treats every wall as text and leaves the floor
  // one open region.
  check("a long thin rectangle is a wall", classifyFill(mk(0, 0, 100, 2), limits) === "wall")
  check("a vertical one too", classifyFill(mk(0, 0, 2, 100), limits) === "wall")
  check("a glyph-sized square is detail", classifyFill(mk(0, 0, 6, 8), limits) === "detail")
  check("a big shape is the building mass", classifyFill(mk(0, 0, 200, 200), limits) === "mass")
  check("a short thin sliver is not a wall", classifyFill(mk(0, 0, 8, 2), limits) === "detail")

  check("near-white counts as white", isWhite(0xfefefe))
  check("a pale room fill does not", !isWhite(0xeec2d4))
}

group("rasterising")
{
  const g = makeGrid(40, 40)
  fillPolygon(g, [rect(10, 10, 30, 30)])
  check("the inside is filled", g.cells[20 * 40 + 20] === BLOCKED)
  check("the outside is not", g.cells[5 * 40 + 5] !== BLOCKED)

  // Even-odd: a ring inside a ring is a hole.
  const donut = makeGrid(40, 40)
  fillPolygon(donut, [rect(5, 5, 35, 35), rect(15, 15, 25, 25)])
  check("an inner ring cuts a hole", donut.cells[20 * 40 + 20] !== BLOCKED)
  check("the ring itself is solid", donut.cells[10 * 40 + 20] === BLOCKED)

  const line = makeGrid(40, 40)
  strokeLine(line, [[5, 20], [35, 20]], 3)
  check("a stroke lands on its path", line.cells[20 * 40 + 20] === BLOCKED)
  check("and has width", line.cells[21 * 40 + 20] === BLOCKED)
  check("but not unbounded width", line.cells[26 * 40 + 20] !== BLOCKED)
}

group("distance transform")
{
  // A 21-cell-wide free corridor between two walls: the centre is 10 from each.
  const g = makeGrid(60, 60)
  strokeLine(g, [[0, 10], [59, 10]], 1)
  strokeLine(g, [[0, 32], [59, 32]], 1)
  const d = distanceTransform(g)
  const mid = d[21 * 60 + 30]
  check("the middle of a corridor is half its width from a wall", mid >= 10 && mid <= 11.5)
  check("a cell beside a wall is close to it", d[12 * 60 + 30] < 2.5)
}

group("skeleton of an H-shaped floor")
{
  // Two vertical corridors joined by a horizontal one. Walls are implicit: the
  // walkable mask is the corridor itself, which is what the extractor hands to
  // thin() after punching walls out of the floor.
  const W = 120
  const H = 120
  const mask = new Uint8Array(W * H)
  const paint = (x0, y0, x1, y1) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) mask[y * W + x] = 1
  }
  paint(20, 10, 28, 110) // left arm
  paint(92, 10, 100, 110) // right arm
  paint(20, 56, 100, 64) // crossbar

  const skel = thin(mask, W, H)
  let cells = 0
  for (const v of skel) if (v) cells++
  check("thinning leaves a thin skeleton", cells > 0 && cells < 600)

  const lines = traceSkeleton(skel, W, H)
  check("it traces into lines", lines.length >= 3)

  // The arms run the height of the plan; the crossbar its width. Total length
  // should be near 100 + 100 + 72 = 272, well above any single arm.
  const total = lines.reduce((s, l) => {
    let d = 0
    for (let i = 0; i + 1 < l.length; i++) d += Math.hypot(l[i + 1][0] - l[i][0], l[i + 1][1] - l[i][1])
    return s + d
  }, 0)
  check(`total length is about the sum of the corridors (got ${Math.round(total)})`, total > 230 && total < 330)

  const pruned = pruneSpurs(lines, 8)
  check("pruning keeps the through-routes", pruned.length >= 3)
  check("and never adds any", pruned.length <= lines.length)
}

group("simplify")
{
  const straight = Array.from({ length: 50 }, (_, i) => [i, 0])
  check("a straight run collapses to its ends", simplify(straight, 0.5).length === 2)

  const corner = [...Array.from({ length: 25 }, (_, i) => [i, 0]), ...Array.from({ length: 25 }, (_, i) => [24, i])]
  check("a right angle keeps its corner", simplify(corner, 0.5).length === 3)

  const two = [[0, 0], [1, 1]]
  check("a two-point line is returned as is", simplify(two, 0.5).length === 2)
}

group("reading a whole SVG")
{
  const svg = `<svg viewBox="0 0 100 100">
    <rect x="0" y="0" width="100" height="100" fill="#ffffff"/>
    <path d="M10 10L90 10L90 12L10 12Z" fill="#000000" stroke="#000000" stroke-width="0.3"/>
    <path d="M20 20L80 20L80 80L20 80Z" fill="#eec2d4"/>
    <path d="M30 30L70 30" fill="none" stroke="#000000" stroke-width="1"/>
  </svg>`
  const g = readSvgGeometry(svg)
  check("the viewBox is read", g.viewBox.w === 100 && g.viewBox.h === 100)
  check("filled shapes are collected", g.fills.length === 3)
  check("the background rect is among them", g.fills.some((f) => isWhite(f.rgb)))
  check("a fill-none path is a stroke, not a fill", g.strokes.length === 1)
  check("and keeps its width", g.strokes[0].width === 1)
}

report()
