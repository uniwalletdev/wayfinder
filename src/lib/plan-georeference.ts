import type { Coordinates } from "./types"

// Metres per degree of latitude. Defined here rather than imported so this
// module has no runtime dependency on any other: the build pipeline
// (scripts/maps/build-venues.mjs) imports it directly under plain node, which
// erases type-only imports but cannot resolve a value import without an
// extension. One placement solver shared by the app and the pipeline is worth
// more than one fewer copy of a constant — schematic.ts, geo-local.ts and
// use-pedestrian-position.ts each keep their own already.
const M_PER_LAT = 111320

// Turns a point normalised to an uploaded floor-plan image (x, y in 0..1, with
// (0,0) at the image's top-left and (1,1) at its bottom-right) into a real-world
// coordinate, given where the mapper has dragged those two corners on the live
// map. The plan is treated as an upright, non-rotated rectangle — enough to
// place most floor plans; a tilted building needs the source image rotated
// before upload.

export interface PlanCorners {
  topLeft: Coordinates
  bottomRight: Coordinates
}

export function projectPlanPoint(corners: PlanCorners, x: number, y: number): Coordinates {
  const { topLeft, bottomRight } = corners
  return {
    lat: topLeft.lat + (bottomRight.lat - topLeft.lat) * y,
    lng: topLeft.lng + (bottomRight.lng - topLeft.lng) * x,
  }
}

export function cornersToBounds(corners: PlanCorners): [[number, number], [number, number]] {
  return [
    [corners.topLeft.lat, corners.topLeft.lng],
    [corners.bottomRight.lat, corners.bottomRight.lng],
  ]
}

// Metres spanned by the longer edge of the default placement rectangle, before
// the mapper drags it into position — roughly a small building footprint. A
// whole-site map sheet passes a larger span instead.
const DEFAULT_SPAN_M = 40

// A starting rectangle around `center`, sized to the plan image's aspect ratio,
// for the mapper to then drag into alignment with the real building.
export function defaultPlanCorners(center: Coordinates, aspectRatio: number, spanM: number = DEFAULT_SPAN_M): PlanCorners {
  const mPerLng = M_PER_LAT * Math.cos((center.lat * Math.PI) / 180)
  const halfWidthM = aspectRatio >= 1 ? spanM / 2 : (spanM * aspectRatio) / 2
  const halfHeightM = aspectRatio >= 1 ? spanM / 2 / aspectRatio : spanM / 2
  return {
    topLeft: {
      lat: center.lat + halfHeightM / M_PER_LAT,
      lng: center.lng - halfWidthM / mPerLng,
    },
    bottomRight: {
      lat: center.lat - halfHeightM / M_PER_LAT,
      lng: center.lng + halfWidthM / mPerLng,
    },
  }
}

// --- Placement with rotation ------------------------------------------------
//
// Everything above treats a plan as an upright rectangle: drag two opposite
// corners onto the map and the image stretches between them. That can express a
// position and a size, and nothing else — which is why a hospital site map laid
// over the basemap sits at whatever angle it was drawn at, its roads crossing
// the real roads, its buildings over the gardens next door.
//
// Trusts draw site maps to fit the page, not to face north, so the angle is
// almost never zero. What follows solves for it, from pairs of points a mapper
// can actually identify: *this corner of the drawing is that corner of the
// building*. Two pairs are enough to fix rotation, scale and position together —
// which is the whole transform, since a scale drawing has no shear and no
// separate vertical scale. A third pair adds nothing to the answer but a way to
// check it: `residualM` is how far the fit misses the control points by, and it
// is the only honest measure of whether a plan is placed or merely put
// somewhere.

// A point identified on both the drawing and the world.
export interface PlanControlPoint {
  // Normalised position on the plan image: (0,0) top-left, (1,1) bottom-right —
  // the same convention as projectPlanPoint().
  plan: { x: number; y: number }
  world: Coordinates
  // What the mapper matched, e.g. "NE corner of the tower block". Carried so a
  // later reviewer can re-find the point rather than re-guess it.
  note?: string
}

export interface PlanPlacement {
  // Where the centre of the whole image lands.
  center: Coordinates
  // The image's full width on the ground, in metres.
  spanM: number
  // Clockwise degrees to turn the image about that centre, for
  // FloorPlan.rotation. Positive turns the drawing's north toward the east.
  rotation: number
  // RMS distance, in metres, between where the fit puts each control point and
  // where the mapper said it was. Zero for a two-point fit by construction:
  // two points determine the transform exactly, so they cannot disagree with
  // it. Only a third point onward can.
  residualM: number
  points: number
}

// Closed-form 2D similarity fit (Procrustes/Umeyama): the rotation, uniform
// scale and translation taking `from` onto `to` with least squared error. In two
// dimensions this needs no SVD — the rotation falls out of the summed dot and
// cross products. The same maths, in the same form, as fitSimilarity() in
// scripts/signals/lib/registration.mjs, which fits a plan to walked trails; the
// tests check the two against each other so they cannot drift apart.
function fitSimilarity(
  from: { x: number; y: number }[],
  to: { x: number; y: number }[]
): { rotation: number; scale: number; tx: number; ty: number } | null {
  const n = Math.min(from.length, to.length)
  if (n < 2) return null

  let fx = 0, fy = 0, tx = 0, ty = 0
  for (let i = 0; i < n; i++) {
    fx += from[i].x; fy += from[i].y
    tx += to[i].x; ty += to[i].y
  }
  fx /= n; fy /= n; tx /= n; ty /= n

  let dot = 0, cross = 0, varFrom = 0
  for (let i = 0; i < n; i++) {
    const ax = from[i].x - fx, ay = from[i].y - fy
    const bx = to[i].x - tx, by = to[i].y - ty
    dot += ax * bx + ay * by
    cross += ax * by - ay * bx
    varFrom += ax * ax + ay * ay
  }
  // Every control point in the same spot on the drawing. No scale or angle can
  // be recovered from that, and guessing one would place the plan confidently
  // nowhere.
  if (varFrom < 1e-12) return null

  const rotation = Math.atan2(cross, dot)
  const scale = Math.hypot(dot, cross) / varFrom
  if (!Number.isFinite(scale) || scale <= 0) return null

  const cos = Math.cos(rotation) * scale
  const sin = Math.sin(rotation) * scale
  return { rotation, scale, tx: tx - (cos * fx - sin * fy), ty: ty - (sin * fx + cos * fy) }
}

// The plan's own frame: metres-like units where the image is exactly 1 wide,
// measured from its centre, with y pointing NORTH. Image coordinates run
// downward, so y is flipped here — the single easiest sign to get wrong, and
// getting it wrong mirrors the building instead of turning it.
function toPlanFrame(x: number, y: number, aspectRatio: number) {
  return { x: x - 0.5, y: (0.5 - y) / aspectRatio }
}

// Solve a plan's placement from control points. `aspectRatio` is the image's
// width ÷ height, as elsewhere in this module. Returns null if fewer than two
// usable points were given.
export function solvePlanPlacement(
  points: PlanControlPoint[],
  aspectRatio: number
): PlanPlacement | null {
  if (points.length < 2 || !(aspectRatio > 0)) return null

  // Work in metres about the first control point. Any origin does; a nearby one
  // keeps the numbers small and the equirectangular approximation honest.
  const ref = points[0].world
  const mPerLng = M_PER_LAT * Math.cos((ref.lat * Math.PI) / 180)

  const from = points.map((p) => toPlanFrame(p.plan.x, p.plan.y, aspectRatio))
  const to = points.map((p) => ({
    x: (p.world.lng - ref.lng) * mPerLng,
    y: (p.world.lat - ref.lat) * M_PER_LAT,
  }))

  const fit = fitSimilarity(from, to)
  if (!fit) return null

  const cos = Math.cos(fit.rotation) * fit.scale
  const sin = Math.sin(fit.rotation) * fit.scale
  let sumSq = 0
  for (let i = 0; i < from.length; i++) {
    const px = cos * from[i].x - sin * from[i].y + fit.tx
    const py = sin * from[i].x + cos * from[i].y + fit.ty
    sumSq += (px - to[i].x) ** 2 + (py - to[i].y) ** 2
  }

  return {
    // The image centre is the origin of the plan frame, so the translation is
    // where the centre lands.
    center: { lat: ref.lat + fit.ty / M_PER_LAT, lng: ref.lng + fit.tx / mPerLng },
    spanM: fit.scale,
    // fit.rotation turns counter-clockwise in a north-up world; screen rotation
    // is clockwise. Same angle, opposite sign.
    rotation: (-fit.rotation * 180) / Math.PI,
    residualM: Math.sqrt(sumSq / from.length),
    points: from.length,
  }
}

// Where a point on the placed plan actually is. The inverse of picking a
// control point, and what the build pipeline runs every waypoint through: the
// pins have to be transformed by the same solution that turns the picture, or
// they slide off it.
export function placedPlanPoint(
  placement: PlanPlacement,
  aspectRatio: number,
  x: number,
  y: number
): Coordinates {
  const theta = (-placement.rotation * Math.PI) / 180
  const cos = Math.cos(theta) * placement.spanM
  const sin = Math.sin(theta) * placement.spanM
  const p = toPlanFrame(x, y, aspectRatio)
  const east = cos * p.x - sin * p.y
  const north = sin * p.x + cos * p.y
  const mPerLng = M_PER_LAT * Math.cos((placement.center.lat * Math.PI) / 180)
  return { lat: placement.center.lat + north / M_PER_LAT, lng: placement.center.lng + east / mPerLng }
}

// The bounds an image overlay is given for a placed plan: the rectangle the
// image would occupy UNROTATED, centred where the plan's centre lands. The
// renderer turns it from there (FloorPlanMap turns the pane about the centre of
// exactly this rectangle), so these bounds describe the picture's extent only
// while `rotation` is zero — anything that needs the plan's true extent on the
// ground has to rotate the corners itself.
export function placementBounds(
  placement: PlanPlacement,
  aspectRatio: number
): [[number, number], [number, number]] {
  const halfW = placement.spanM / 2
  const halfH = placement.spanM / aspectRatio / 2
  const mPerLng = M_PER_LAT * Math.cos((placement.center.lat * Math.PI) / 180)
  return [
    [placement.center.lat - halfH / M_PER_LAT, placement.center.lng - halfW / mPerLng],
    [placement.center.lat + halfH / M_PER_LAT, placement.center.lng + halfW / mPerLng],
  ]
}
