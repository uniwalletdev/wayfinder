// Checks for the placement primitives (scripts/maps/lib/placement.mjs).
//
// These decide whether a hospital's map is reported as sitting in the right
// place, and every one of them has a sign or a fold that is easy to get wrong:
// SVG's y runs downward, a rectangular grid repeats every quarter turn, and a
// legend swatch in a page corner must not count as part of the site plan. On a
// real sheet there is nothing to check the answer against except the eye, so the
// maths is pinned here against geometry whose answer is known by construction.
//
// Run: node scripts/maps/test/placement.test.mjs
import {
  M_PER_LAT, mPerLng, toLocal, bboxOfPoints, segmentsOfRing,
  dominantAngle, angleGap, trimToCore, cellIndex,
} from "../lib/placement.mjs"
import { group, check, report } from "../../nhs/test/harness.mjs"

const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol

// A rectangle's corners, rotated by `deg` about the origin. Rotation is
// counter-clockwise in a y-up frame, which is what dominantAngle expects.
function rotatedRect(w, h, deg) {
  const r = (deg * Math.PI) / 180
  const cos = Math.cos(r), sin = Math.sin(r)
  return [[0, 0], [w, 0], [w, h], [0, h]].map(([x, y]) => [x * cos - y * sin, x * sin + y * cos])
}

group("local tangent plane")
{
  const origin = { lat: 51.5, lng: -0.2 }
  const north = toLocal(origin, 51.501, -0.2)
  check("a thousandth of a degree north is ~111 m", near(north.y, 111.32, 0.01))
  check("and no metres east", near(north.x, 0, 1e-9))

  const east = toLocal(origin, 51.5, -0.199)
  // Longitude degrees are shorter than latitude degrees away from the equator,
  // by cos(lat) — at London that is about 0.62.
  check("the same step east is shorter", east.x < north.y)
  check("by cos(latitude)", near(east.x / 69.3, 1, 0.01))
  check("mPerLng agrees with the shrink factor", near(mPerLng(51.5) / M_PER_LAT, Math.cos((51.5 * Math.PI) / 180)))

  const back = toLocal(origin, 51.499, -0.201)
  check("south and west are negative", back.x < 0 && back.y < 0)
}

group("bounding boxes and segments")
{
  const box = bboxOfPoints([[1, 2], [5, 2], [5, 9]])
  check("width and height", box.width === 4 && box.height === 7)
  check("empty input has no box", bboxOfPoints([]) === null)

  const square = [[0, 0], [10, 0], [10, 10], [0, 10]]
  check("a closed ring has as many segments as corners", segmentsOfRing(square).length === 4)
  check("an open polyline has one fewer", segmentsOfRing(square, { closed: false }).length === 3)
  const closing = segmentsOfRing(square).at(-1)
  check("and the closing segment returns to the start", closing[2] === 0 && closing[3] === 0)
}

group("dominant angle")
{
  const grid = (deg) => segmentsOfRing(rotatedRect(40, 20, deg))
  check("a page-square building reads 0°", near(dominantAngle(grid(0)).angle, 0, 1e-9))
  check("turned 30°, it reads 30°", near(dominantAngle(grid(30)).angle, 30, 1e-9))

  // The fold is the point of the whole measure: a rectangle turned 60° is the
  // same rectangle turned -30°, because its own corners are square.
  check("turned 60°, it reads -30° — a quarter turn is the same grid", near(dominantAngle(grid(60)).angle, -30, 1e-9))
  check("turned 90°, it is back to 0°", near(dominantAngle(grid(90)).angle, 0, 1e-9))
  check("turned 45°, it reads 45 and not -45", near(Math.abs(dominantAngle(grid(45)).angle), 45, 1e-9))

  check("a rectangular grid is maximally concentrated", near(dominantAngle(grid(17)).strength, 1, 1e-9))

  // A circle has no grid. The angle it returns is noise, and `strength` is the
  // only thing that says so — which is why callers must check it.
  const circle = []
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * 2 * Math.PI, b = ((i + 1) / 72) * 2 * Math.PI
    circle.push([Math.cos(a), Math.sin(a), Math.cos(b), Math.sin(b)])
  }
  check("a circle has no dominant angle", dominantAngle(circle).strength < 0.05)

  // Length weighting is what stops a hundred label serifs outvoting a wall.
  const mixed = [
    ...Array.from({ length: 50 }, () => [0, 0, 1, 0]),        // 50 short, square
    [0, 0, 100 * Math.cos(Math.PI / 6), 100 * Math.sin(Math.PI / 6)], // one long, 30°
  ]
  check("one long line outweighs fifty short ones", dominantAngle(mixed).angle > 15)
  check("but the disagreement shows in the strength", dominantAngle(mixed).strength < 0.9)

  const filtered = dominantAngle(mixed, { minLength: 5 })
  check("a minimum length drops the short ones entirely", near(filtered.angle, 30, 1e-9))
  check("and a maximum drops the long one", dominantAngle(mixed, { maxLength: 5 }).angle === 0)

  check("nothing measurable returns no angle", dominantAngle([]).angle === null)
  check("a zero-length segment is not a direction", dominantAngle([[5, 5, 5, 5]]).angle === null)
}

group("angle gap")
{
  check("no turn between identical grids", angleGap(10, 10) === 0)
  check("a 5° turn", near(angleGap(10, 15), 5))
  check("and the other way", near(angleGap(15, 10), -5))
  // Folded, so a sheet 40° one way is 50° the other and the shorter turn wins.
  check("across the fold, the short way round", near(angleGap(40, -40), 10))
  check("a quarter turn is no turn at all", near(angleGap(12, 102), 0))
  check("an unmeasurable side gives no answer", angleGap(null, 30) === null && angleGap(30, null) === null)
}

group("trimming a weight grid to its core")
{
  const N = 10
  // A plan filling the middle four columns, plus one stray cell in a corner —
  // the legend swatch that a plain bounding box would stretch the plan onto.
  const cells = new Float64Array(N * N)
  let total = 0
  for (let y = 3; y < 7; y++) {
    for (let x = 3; x < 7; x++) {
      cells[y * N + x] = 100
      total += 100
    }
  }
  cells[0] = 1
  total += 1

  const core = trimToCore(cells, N, total, 0.05)
  check("the stray cell is trimmed away", core.x0 === 3 && core.y0 === 3)
  check("and the plan itself is kept whole", core.x1 === 7 && core.y1 === 7)

  // With no budget to spend, nothing may be dropped — including the outlier.
  const strict = trimToCore(cells, N, total, 0)
  check("a zero budget keeps everything", strict.x0 === 0 && strict.y0 === 0)

  const full = new Float64Array(N * N).fill(1)
  const fullCore = trimToCore(full, N, N * N, 0.05)
  check("a drawing that fills the page loses nothing", fullCore.x0 === 0 && fullCore.x1 === N)

  check("an empty grid has no core", trimToCore(new Float64Array(N * N), N, 0, 0.05) === null)

  check("cell indices are bounded", cellIndex(-5, 100, 10) === 0 && cellIndex(100, 100, 10) === 9)
  check("and land in the right cell", cellIndex(55, 100, 10) === 5)
}

group("a sheet against an estate")
{
  // The whole audit in miniature: the same building, drawn square to its page
  // and standing at 20° on the ground. SVG's y points down, so the sheet's
  // segments are flipped before measuring — get that wrong and the turn comes
  // back with the wrong sign, and the correction would rotate the plan further
  // from the truth rather than onto it.
  const sheetSvg = segmentsOfRing(rotatedRect(200, 90, 0))
  const sheet = sheetSvg.map(([x0, y0, x1, y1]) => [x0, -y0, x1, -y1])
  const estate = segmentsOfRing(rotatedRect(200, 90, 20))

  const sheetGrid = dominantAngle(sheet).angle
  const estateGrid = dominantAngle(estate).angle
  check("the sheet is drawn square to its page", near(sheetGrid, 0, 1e-9))
  check("the estate stands at 20°", near(estateGrid, 20, 1e-9))
  check("so the plan needs turning 20° counter-clockwise", near(angleGap(sheetGrid, estateGrid), 20, 1e-9))
}

report()
