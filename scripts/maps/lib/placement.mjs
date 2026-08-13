// Geometry for judging whether a sheet is placed where the building actually is.
//
// build-venues.mjs places a floor plan with two numbers — a centre and a width —
// which can express translation and uniform scale and nothing else. The
// questions this module answers are the ones that model cannot ask itself:
//
//   How far is the anchor from the buildings?   → toLocal + centroid distance
//   Is the sheet drawn north-up?                → dominantAngle of both sides
//   Is the scale right?                         → extents compared in metres
//
// Everything here is pure geometry on plain arrays, so it can be checked against
// synthetic input (scripts/maps/test/placement.test.mjs). The only ground truth
// available offline is data/footprints.geojson — OpenStreetMap's outline of the
// same estate — so these are the primitives for comparing a sheet against it.

export const M_PER_LAT = 111320

// Metres per degree of longitude at a latitude. Lines of longitude converge
// toward the poles; at UK latitudes this is about 0.62 of the latitude figure,
// which is far too large a difference to ignore when comparing extents.
export function mPerLng(lat) {
  return M_PER_LAT * Math.cos((lat * Math.PI) / 180)
}

// A lat/lng as metres east and north of an origin, on the local tangent plane.
// Over one hospital estate the curvature error is well under a metre.
export function toLocal(origin, lat, lng) {
  return { x: (lng - origin.lng) * mPerLng(origin.lat), y: (lat - origin.lat) * M_PER_LAT }
}

export function bboxOfPoints(points) {
  if (!points.length) return null
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of points) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY }
}

// Consecutive point pairs of a ring or polyline, as [x0, y0, x1, y1].
export function segmentsOfRing(points, { closed = true } = {}) {
  const out = []
  for (let i = 0; i + 1 < points.length; i++) {
    out.push([points[i][0], points[i][1], points[i + 1][0], points[i + 1][1]])
  }
  if (closed && points.length > 2) {
    const a = points[points.length - 1], b = points[0]
    out.push([a[0], a[1], b[0], b[1]])
  }
  return out
}

// The angle a drawing is built on, and how strongly it holds to it.
//
// Buildings, roads and site boundaries are overwhelmingly drawn on a single
// right-angled grid, so the orientation of a plan is recoverable from its edges
// without recognising anything in it. Direction is meaningless here — a wall
// running 30° is the same wall running 210°, and its perpendicular is the same
// grid — so angles are folded into a quarter turn by taking the length-weighted
// circular mean of 4θ. That is the standard trick for axial data: it makes 0°
// and 90° the same point on the circle, which is exactly the symmetry a
// rectangular grid has.
//
// Returns:
//   angle     the grid's orientation in (-45, 45], degrees counter-clockwise.
//             Folded, so a drawing 2° off square reads as 2 and not as 88 —
//             which matters, because the whole point of the number is how far
//             from square it is.
//   strength  0…1 — how concentrated the edges are around it. A hospital site
//             map lands around 0.5–0.9; a drawing of curves and blobs lands
//             near 0, and its angle means nothing. Never use the angle without
//             checking this.
//
// Segment coordinates must be in a y-UP frame. SVG is y-down, so flip a sheet's
// y before calling or the sign of the answer is inverted.
export function dominantAngle(segments, { minLength = 0, maxLength = Infinity } = {}) {
  let sumCos = 0, sumSin = 0, sumW = 0
  for (const [x0, y0, x1, y1] of segments) {
    const dx = x1 - x0, dy = y1 - y0
    const len = Math.hypot(dx, dy)
    if (len < minLength || len > maxLength || len === 0) continue
    const theta = Math.atan2(dy, dx)
    sumCos += len * Math.cos(4 * theta)
    sumSin += len * Math.sin(4 * theta)
    sumW += len
  }
  if (sumW === 0) return { angle: null, strength: 0, length: 0 }
  // atan2 gives (-180, 180]; a quarter of it is (-45, 45] with no wrapping
  // needed, which is exactly the range a quarter-turn symmetry has.
  const mean = Math.atan2(sumSin, sumCos) / 4
  return {
    angle: (mean * 180) / Math.PI,
    strength: Math.hypot(sumCos, sumSin) / sumW,
    length: sumW,
  }
}

// Rotation from grid `a` onto grid `b`, in (-45, 45].
//
// Bounded by 45° because a quarter turn maps a rectangular grid onto itself:
// two grids 80° apart are 10° apart with the sheet turned the other way. So this
// answers "how far off square is the sheet", not "which way up is it" — the
// remaining choice of 0/90/180/270 has to come from something with a direction
// in it, an entrance name or a north arrow or a human.
export function angleGap(a, b) {
  if (a == null || b == null) return null
  return ((((b - a) % 90) + 135) % 90) - 45
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

// The core of a weight grid: shrink a box until `drop` of the total weight has
// been trimmed away, always taking whichever remaining edge carries the least.
//
// Used to find where a site plan sits on its page, given how much of the
// drawing falls in each cell. A plain bounding box cannot answer that — one
// colour swatch in a legend corner stretches it across the whole sheet — and a
// percentile per axis gets the axes wrong when the plan sits in a corner.
// Trimming the lightest edge each time is the cheap version of the right
// answer, and it degrades gracefully: a drawing that really does fill the page
// loses nothing, because every edge costs more than the budget straight away.
//
// `cells` is a row-major N×N grid, `total` its sum. Returns cell indices with
// x1/y1 exclusive, or null for an empty grid.
export function trimToCore(cells, N, total, drop) {
  if (!total) return null
  let x0 = 0, y0 = 0, x1 = N - 1, y1 = N - 1
  let budget = total * drop
  const line = (kind, i) => {
    let sum = 0
    if (kind === "col") for (let y = y0; y <= y1; y++) sum += cells[y * N + i]
    else for (let x = x0; x <= x1; x++) sum += cells[i * N + x]
    return sum
  }
  for (;;) {
    // Two cells is the floor: below that the "plan" is a point and the ratio it
    // feeds is meaningless.
    if (x1 - x0 < 2 || y1 - y0 < 2) break
    const edges = [
      ["x0", line("col", x0)], ["x1", line("col", x1)],
      ["y0", line("row", y0)], ["y1", line("row", y1)],
    ].sort((a, b) => a[1] - b[1])
    const [which, weight] = edges[0]
    if (weight > budget) break
    budget -= weight
    if (which === "x0") x0++
    else if (which === "x1") x1--
    else if (which === "y0") y0++
    else y1--
  }
  return { x0, y0, x1: x1 + 1, y1: y1 + 1 }
}

// Bounded to a grid's index range. Exported for the same reason trimToCore is:
// callers rasterising into that grid have to clamp identically.
export function cellIndex(value, size, N) {
  return clamp(Math.floor((value / size) * N), 0, N - 1)
}
