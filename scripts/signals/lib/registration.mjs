// Fitting a floor plan's placement to the paths people actually walked.
//
// The sheets are pinned to the map as north-up rectangles (build-venues.mjs
// computes bounds from a span and a page aspect, with no rotation term), and
// trusts do not draw site maps north-up. So a plan sits at whatever angle its
// drawing happened to have, and everything arriving from the real world — the
// live position, every route bearing, the AR overlay — disagrees with it.
//
// Nobody has to measure that angle. Navigators emit it for free: the trail
// signals recorded while they walk are in real-world coordinates, and the
// corridor network extracted from the drawing (scripts/maps/corridors.mjs) is
// the same building in the drawing's coordinates. The rotation, scale and shift
// between the two point sets IS the placement error.
//
// This module is the maths, kept pure so it can be tested against synthetic
// data with a known answer — which is the only way to check it, since a real
// venue's true placement is exactly the unknown being solved for.

const M_PER_LAT = 111320

// Work in metres on a plane around a reference point. Same equirectangular
// convention as schematic.ts and plan-georeference.ts — fine over the hundreds
// of metres a hospital site spans.
export function projector(ref) {
  const mPerLng = M_PER_LAT * Math.cos((ref.lat * Math.PI) / 180)
  return {
    toLocal: (c) => ({ x: (c.lng - ref.lng) * mPerLng, y: (c.lat - ref.lat) * M_PER_LAT }),
    toCoord: (v) => ({ lat: ref.lat + v.y / M_PER_LAT, lng: ref.lng + v.x / mPerLng }),
  }
}

// Closed-form 2D similarity fit (Procrustes/Umeyama) over corresponding points:
// the rotation, uniform scale and translation taking `from` onto `to` with least
// squared error. 2D needs no SVD — the rotation falls out of the summed dot and
// cross products.
export function fitSimilarity(from, to) {
  const n = Math.min(from.length, to.length)
  if (n < 2) return null

  let fx = 0, fy = 0, tx = 0, ty = 0
  for (let i = 0; i < n; i++) {
    fx += from[i].x; fy += from[i].y
    tx += to[i].x; ty += to[i].y
  }
  fx /= n; fy /= n; tx /= n; ty /= n

  // a = Σ dot, b = Σ cross, varFrom = Σ |from|²  (all about the centroids)
  let a = 0, b = 0, varFrom = 0
  for (let i = 0; i < n; i++) {
    const ax = from[i].x - fx, ay = from[i].y - fy
    const bx = to[i].x - tx, by = to[i].y - ty
    a += ax * bx + ay * by
    b += ax * by - ay * bx
    varFrom += ax * ax + ay * ay
  }
  if (varFrom < 1e-9) return null

  const rotation = Math.atan2(b, a)
  const scale = Math.hypot(a, b) / varFrom
  if (!Number.isFinite(scale) || scale <= 0) return null

  const cos = Math.cos(rotation) * scale
  const sin = Math.sin(rotation) * scale
  return {
    rotation,
    scale,
    // Translation applied AFTER rotating and scaling about the origin.
    tx: tx - (cos * fx - sin * fy),
    ty: ty - (sin * fx + cos * fy),
  }
}

export function applyTransform(t, p) {
  const cos = Math.cos(t.rotation) * t.scale
  const sin = Math.sin(t.rotation) * t.scale
  return { x: cos * p.x - sin * p.y + t.tx, y: sin * p.x + cos * p.y + t.ty }
}

export const IDENTITY = { rotation: 0, scale: 1, tx: 0, ty: 0 }

// Compose two transforms: apply `first`, then `second`.
export function compose(second, first) {
  const rotation = second.rotation + first.rotation
  const scale = second.scale * first.scale
  const moved = applyTransform(second, { x: first.tx, y: first.ty })
  return { rotation, scale, tx: moved.x, ty: moved.y }
}

// A uniform grid for nearest-neighbour lookup. The alternative is comparing
// every observed point against every model point, and both sets run to
// thousands — routing.ts already carries one O(n²) loop (REVIEW.md #10) and
// this is not the place to add another.
function spatialIndex(points, cell) {
  const buckets = new Map()
  const key = (ix, iy) => `${ix},${iy}`
  for (let i = 0; i < points.length; i++) {
    const ix = Math.floor(points[i].x / cell)
    const iy = Math.floor(points[i].y / cell)
    const k = key(ix, iy)
    let list = buckets.get(k)
    if (!list) buckets.set(k, (list = []))
    list.push(i)
  }
  return {
    nearest(p, maxDist) {
      const r = Math.ceil(maxDist / cell)
      const ix = Math.floor(p.x / cell)
      const iy = Math.floor(p.y / cell)
      let best = -1
      let bestD = maxDist * maxDist
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const list = buckets.get(key(ix + dx, iy + dy))
          if (!list) continue
          for (const i of list) {
            const ex = points[i].x - p.x
            const ey = points[i].y - p.y
            const d = ex * ex + ey * ey
            if (d < bestD) {
              bestD = d
              best = i
            }
          }
        }
      }
      return best < 0 ? null : { index: best, dist: Math.sqrt(bestD) }
    },
  }
}

// Iterative closest point.
//
// There are no correspondences to start from — one walked trace does not say
// which corridor it is in — so they are guessed from proximity, fitted, and
// re-guessed. `maxMatchDistance` shrinks over the run: generous early so a badly
// rotated plan can still find its footing, tight later so the fit is driven by
// points that genuinely correspond rather than by whatever was nearby.
//
// `model` is the corridor network read off the drawing; `observed` is where
// people actually walked. The returned transform maps model onto observed.
export function icp(model, observed, options = {}) {
  const {
    iterations = 60,
    startMatchDistance = 60,
    endMatchDistance = 6,
    minMatchRatio = 0.55,
    initial = IDENTITY,
    // Left free, a similarity fit over guessed correspondences will shrink the
    // model onto a knot of observed points: residual goes to nearly zero and the
    // answer is meaningless. Two guards. The step clamp stops any single
    // iteration lurching, so the fit has to earn scale gradually; the absolute
    // band says what a placement error can plausibly be — the sheets are
    // mis-scaled by tens of percent (defect 2), not by an order of magnitude.
    // Iterations before the match-ratio guard starts applying.
    graceIterations = 25,
    maxStepScale = 1.2,
    minScale = 0.5,
    maxScale = 2,
  } = options

  if (model.length < 3 || observed.length < 3) {
    return { transform: null, reason: "too few points to register" }
  }
  const observedCount = observed.length

  let transform = initial
  let lastRms = Infinity
  let matched = 0

  for (let iter = 0; iter < iterations; iter++) {
    // Geometric taper from the generous starting radius to the tight one.
    const t = iter / Math.max(1, iterations - 1)
    const maxMatch = startMatchDistance * Math.pow(endMatchDistance / startMatchDistance, t)

    // Correspondences are driven from the OBSERVED side: every walked point
    // looks for the nearest bit of transformed model. Driving it the other way
    // — each model point finding its nearest walked point — quietly rewards
    // shrinking the plan, because a model collapsed to a knot puts every one of
    // its points next to something. Asked this way round, a collapsed model
    // leaves most of the walking unexplained and is rejected on match ratio.
    const moved = model.map((m) => applyTransform(transform, m))
    const index = spatialIndex(moved, Math.max(2, endMatchDistance))

    const from = []
    const to = []
    let sumSq = 0
    for (const o of observed) {
      const hit = index.nearest(o, maxMatch)
      if (!hit) continue
      from.push(moved[hit.index])
      to.push(o)
      sumSq += hit.dist * hit.dist
    }

    matched = from.length
    if (matched < 3) {
      return { transform: null, reason: "correspondences ran out" }
    }
    // The match-ratio guard is about the fit that comes OUT, not the one going
    // in. Applied from iteration zero it kills every restart that begins far
    // from the answer — which is exactly the restart that would have found a
    // large rotation, so a badly placed plan looks unfittable and, worse, an
    // ambiguous one looks certain. Give the fit room to travel, then judge it.
    if (iter >= graceIterations && matched / observedCount < minMatchRatio) {
      return { transform: null, reason: `only ${matched}/${observedCount} walked points landed on the plan` }
    }

    const step = fitSimilarity(from, to)
    if (!step) return { transform: null, reason: "degenerate correspondence set" }

    const clampedStep = {
      ...step,
      scale: Math.min(maxStepScale, Math.max(1 / maxStepScale, step.scale)),
    }
    let next = compose(clampedStep, transform)
    if (next.scale < minScale || next.scale > maxScale) {
      // Re-fit the translation and rotation at the clamped scale rather than
      // abandoning the iteration: the rotation estimate is usually sound even
      // when the scale estimate has run away.
      const held = Math.min(maxScale, Math.max(minScale, next.scale))
      next = { ...next, scale: held }
    }
    transform = next
    const rms = Math.sqrt(sumSq / matched)
    // Converged: the residual stopped improving meaningfully.
    if (Math.abs(lastRms - rms) < 0.01 && iter > 5) {
      lastRms = rms
      break
    }
    lastRms = rms
  }

  const matchRatio = matched / observedCount
  if (matchRatio < minMatchRatio) {
    return { transform: null, reason: `only ${matched}/${observedCount} walked points landed on the plan` }
  }
  return { transform, rms: lastRms, matched, matchRatio }
}

// ICP finds the nearest local minimum, and a plan rotated 90° from its true
// orientation has a perfectly good wrong one available. Restarting from several
// initial rotations and keeping the best fit is what makes a large rotation
// recoverable at all.
export function registerWithRestarts(model, observed, options = {}) {
  const {
    restartDegrees = [0, 30, 60, 90, 120, 150, 180, -30, -60, -90, -120, -150],
    // How close a rival fit at a genuinely different angle has to be before the
    // answer is called ambiguous.
    ambiguityMargin = 1.15,
  } = options
  // Every restart begins with the two point sets centred on each other and the
  // model turned about its OWN middle. Rotating about the origin instead throws
  // a building that does not happen to sit at (0,0) clean off the observed
  // points, so the large-rotation restarts — the only ones that could find a
  // badly placed plan, or the second answer for a symmetric one — die before
  // they start.
  const centroid = (pts) => {
    let x = 0
    let y = 0
    for (const p of pts) {
      x += p.x
      y += p.y
    }
    return { x: x / pts.length, y: y / pts.length }
  }
  const mc = centroid(model)
  const oc = centroid(observed)

  const fits = []
  for (const deg of restartDegrees) {
    const rotation = (deg * Math.PI) / 180
    const cos = Math.cos(rotation)
    const sin = Math.sin(rotation)
    const initial = {
      rotation,
      scale: 1,
      tx: oc.x - (cos * mc.x - sin * mc.y),
      ty: oc.y - (sin * mc.x + cos * mc.y),
    }
    const result = icp(model, observed, { ...options, initial })
    if (!result.transform) continue
    // Prefer the lowest residual, but never buy it by matching fewer points.
    const score = result.rms / Math.max(result.matchRatio, 1e-6)
    fits.push({ ...result, score, startedAt: deg })
  }
  if (!fits.length) return { transform: null, reason: "no restart produced a usable fit" }

  fits.sort((a, b) => a.score - b.score)
  const best = fits[0]

  // A building with a symmetry has more than one placement that fits the
  // walking equally well — an H-shaped wing walked end to end looks the same
  // rotated by 180°. There is no evidence in the traces to choose between them,
  // and picking the wrong one turns the map upside down while reporting a low
  // residual. Say so instead, and let the caller refuse.
  const bestAngle = degrees(best.transform.rotation)
  // Smallest angle between the two orientations, in degrees: the (+540, %360,
  // -180) dance wraps the difference into [-180, 180) so 350° and 10° read as
  // 20° apart rather than 340°. A rival at essentially the best angle is the
  // same answer found twice, not a competing one.
  const angleGap = (a, b) => Math.abs(((a - b + 540) % 360) - 180)
  const rival = fits.find(
    (f) => angleGap(degrees(f.transform.rotation), bestAngle) > 30 && f.score <= best.score * ambiguityMargin
  )

  return {
    ...best,
    ambiguous: !!rival,
    ...(rival ? { rivalRotation: Number(degrees(rival.transform.rotation).toFixed(1)) } : {}),
  }
}

export const degrees = (radians) => (radians * 180) / Math.PI
