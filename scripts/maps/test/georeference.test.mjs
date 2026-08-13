// Checks for solving a plan's placement from control points
// (src/lib/plan-georeference.ts).
//
// This is the maths that decides where a hospital's map is drawn on the world,
// and it is verified by construction: build a plan whose true placement is
// chosen in advance, hand the solver two or three points from it, and require
// the answer back. There is no other way to check it — on a real sheet the true
// placement is exactly the unknown being solved for.
//
// The signs are what these tests are really for. Image y runs down and world y
// runs north; screen rotation runs clockwise and the fit's rotation runs
// counter-clockwise. Each of those is a sign flip, and any one of them wrong
// still produces a confident placement — mirrored, or turned the wrong way,
// which is worse than none because the app then asserts a heading from it.
//
// Run: node scripts/maps/test/georeference.test.mjs
import { solvePlanPlacement, placedPlanPoint, placementBounds } from "../../../src/lib/plan-georeference.ts"
import { projector, fitSimilarity, applyTransform } from "../../signals/lib/registration.mjs"
import { solveFloorPlacement, waypointsFrom } from "../build-venues.mjs"
import { group, check, report } from "../../nhs/test/harness.mjs"

const M_PER_LAT = 111320
const near = (a, b, tol) => Math.abs(a - b) <= tol

// Angles are checked to a hundredth of a degree, not to floating-point exactness.
// The projection is equirectangular — metres per degree of longitude are taken at
// one reference latitude — so a fit spread across a site carries a few
// ten-thousandths of a degree of shear. That is about 7 mm across a 480 m sheet,
// and demanding better would be testing the projection rather than the solver.
const DEG = 0.01

// A plan placed for real: centre, width on the ground, and a clockwise turn.
// Generates the world coordinate of any point on the image, so a test can pick
// control points from a placement it already knows the answer to.
function truth({ center, spanM, rotation, aspectRatio }) {
  const theta = (-rotation * Math.PI) / 180 // clockwise on screen -> ccw in world
  const mPerLng = M_PER_LAT * Math.cos((center.lat * Math.PI) / 180)
  return (x, y) => {
    const px = x - 0.5, py = (0.5 - y) / aspectRatio
    const east = (Math.cos(theta) * px - Math.sin(theta) * py) * spanM
    const north = (Math.sin(theta) * px + Math.cos(theta) * py) * spanM
    return { lat: center.lat + north / M_PER_LAT, lng: center.lng + east / mPerLng }
  }
}

const metresApart = (a, b) => {
  const mPerLng = M_PER_LAT * Math.cos((a.lat * Math.PI) / 180)
  return Math.hypot((a.lng - b.lng) * mPerLng, (a.lat - b.lat) * M_PER_LAT)
}

// St George's Tooting, near enough: a 480 m sheet whose drawing sits about 18°
// off square, which is the case the current placement model cannot express.
const SITE = { center: { lat: 51.4271, lng: -0.1749 }, spanM: 480, rotation: 18, aspectRatio: 1.08 }

group("solving a placement")
{
  const at = truth(SITE)
  // Two points a mapper could actually pick out: opposite corners of the site.
  const solved = solvePlanPlacement(
    [
      { plan: { x: 0.2, y: 0.25 }, world: at(0.2, 0.25), note: "NW block corner" },
      { plan: { x: 0.8, y: 0.75 }, world: at(0.8, 0.75), note: "SE car park corner" },
    ],
    SITE.aspectRatio
  )

  check("two points are enough", solved !== null)
  check("the width comes back", near(solved.spanM, SITE.spanM, 0.01))
  check("and the turn", near(solved.rotation, SITE.rotation, DEG))
  check("and the centre, to a centimetre", metresApart(solved.center, SITE.center) < 0.01)
  check("a two-point fit has nothing to disagree with", near(solved.residualM, 0, 1e-6))
  check("it reports how many points it used", solved.points === 2)
}

group("the direction of the turn")
{
  // The one that matters: a plan turned clockwise on screen must put a point on
  // its northern edge to the EAST of the centre, not the west. Get this
  // backwards and every plan is turned twice as wrong as leaving it alone.
  const at = truth({ ...SITE, rotation: 30 })
  const top = at(0.5, 0)
  const centre = at(0.5, 0.5)
  check("turning clockwise swings the top of the sheet east", top.lng > centre.lng)
  check("and it stays north of centre", top.lat > centre.lat)

  const solved = solvePlanPlacement(
    [
      { plan: { x: 0.5, y: 0 }, world: top },
      { plan: { x: 0.5, y: 1 }, world: at(0.5, 1) },
    ],
    SITE.aspectRatio
  )
  check("and the solver reads it as clockwise", near(solved.rotation, 30, DEG))

  const anticlockwise = solvePlanPlacement(
    [
      { plan: { x: 0.5, y: 0 }, world: truth({ ...SITE, rotation: -25 })(0.5, 0) },
      { plan: { x: 0.5, y: 1 }, world: truth({ ...SITE, rotation: -25 })(0.5, 1) },
    ],
    SITE.aspectRatio
  )
  check("a counter-clockwise plan reads negative", near(anticlockwise.rotation, -25, DEG))
}

group("placing points on the solved plan")
{
  const at = truth(SITE)
  const solved = solvePlanPlacement(
    [
      { plan: { x: 0.1, y: 0.1 }, world: at(0.1, 0.1) },
      { plan: { x: 0.9, y: 0.9 }, world: at(0.9, 0.9) },
    ],
    SITE.aspectRatio
  )

  // Every waypoint on the sheet has to land where the drawing says it is —
  // including points nowhere near the control points, which is where a wrong
  // scale or angle shows up.
  for (const [x, y] of [[0, 0], [1, 0], [0.5, 0.5], [0.37, 0.82], [1, 1]]) {
    check(
      `a waypoint at (${x}, ${y}) lands within a centimetre`,
      metresApart(placedPlanPoint(solved, SITE.aspectRatio, x, y), at(x, y)) < 0.01
    )
  }

  const centre = placedPlanPoint(solved, SITE.aspectRatio, 0.5, 0.5)
  check("the middle of the image is the placement centre", metresApart(centre, solved.center) < 0.01)
}

group("bounds for the image overlay")
{
  const solved = solvePlanPlacement(
    [
      { plan: { x: 0.2, y: 0.2 }, world: truth(SITE)(0.2, 0.2) },
      { plan: { x: 0.8, y: 0.8 }, world: truth(SITE)(0.8, 0.8) },
    ],
    SITE.aspectRatio
  )
  const [[south, west], [north, east]] = placementBounds(solved, SITE.aspectRatio)
  const width = (east - west) * M_PER_LAT * Math.cos((solved.center.lat * Math.PI) / 180)
  const height = (north - south) * M_PER_LAT

  check("the rectangle is the sheet's width", near(width, SITE.spanM, 0.5))
  check("and its page aspect", near(width / height, SITE.aspectRatio, 1e-3))
  // The renderer turns the pane about the centre of these bounds, so the bounds
  // must be centred on the placement or the plan pivots around the wrong point
  // and slides off its own pins as it turns.
  check(
    "centred on the placement",
    near((south + north) / 2, solved.center.lat, 1e-9) && near((west + east) / 2, solved.center.lng, 1e-9)
  )
}

group("more points than the answer needs")
{
  const at = truth(SITE)
  const exact = [
    { plan: { x: 0.15, y: 0.2 }, world: at(0.15, 0.2) },
    { plan: { x: 0.85, y: 0.3 }, world: at(0.85, 0.3) },
    { plan: { x: 0.5, y: 0.9 }, world: at(0.5, 0.9) },
  ]
  const clean = solvePlanPlacement(exact, SITE.aspectRatio)
  check("three consistent points still solve exactly", clean.residualM < 0.01)
  check("and agree on the turn", near(clean.rotation, SITE.rotation, DEG))

  // A mapper clicking 12 m off on one of three points. The fit absorbs it, and
  // the residual is what says the placement is worth 12 m of doubt — which is
  // the number the app should show instead of `verified: false`.
  const slipped = exact.map((p, i) =>
    i === 2 ? { ...p, world: { lat: p.world.lat + 12 / M_PER_LAT, lng: p.world.lng } } : p
  )
  const noisy = solvePlanPlacement(slipped, SITE.aspectRatio)
  check("a slipped point shows up in the residual", noisy.residualM > 1)
  check("but does not wreck the placement", metresApart(noisy.center, SITE.center) < 12)
}

group("what cannot be solved")
{
  check("one point is not a placement", solvePlanPlacement([{ plan: { x: 0.5, y: 0.5 }, world: SITE.center }], 1) === null)
  check("no points either", solvePlanPlacement([], 1) === null)
  check(
    "two points at the same spot on the drawing give no scale",
    solvePlanPlacement(
      [
        { plan: { x: 0.4, y: 0.4 }, world: { lat: 51.4, lng: -0.17 } },
        { plan: { x: 0.4, y: 0.4 }, world: { lat: 51.5, lng: -0.16 } },
      ],
      1
    ) === null
  )
  check("a nonsense aspect ratio is refused", solvePlanPlacement([
    { plan: { x: 0, y: 0 }, world: SITE.center },
    { plan: { x: 1, y: 1 }, world: { lat: 51.43, lng: -0.17 } },
  ], 0) === null)
}

group("agreement with the trail-registration solver")
{
  // scripts/signals/lib/registration.mjs fits the same transform from walked
  // trails instead of clicked points. Two implementations of one piece of maths
  // will drift unless something holds them together; this is that something.
  const at = truth(SITE)
  const picks = [
    [0.15, 0.2], [0.85, 0.3], [0.5, 0.9], [0.25, 0.75],
  ]
  const solved = solvePlanPlacement(
    picks.map(([x, y]) => ({ plan: { x, y }, world: at(x, y) })),
    SITE.aspectRatio
  )

  const ref = at(picks[0][0], picks[0][1])
  const proj = projector(ref)
  const from = picks.map(([x, y]) => ({ x: x - 0.5, y: (0.5 - y) / SITE.aspectRatio }))
  const to = picks.map(([x, y]) => proj.toLocal(at(x, y)))
  const fit = fitSimilarity(from, to)

  check("the same scale", near(fit.scale, solved.spanM, 1e-6))
  check("the same angle, mirrored in sign", near((-fit.rotation * 180) / Math.PI, solved.rotation, 1e-9))
  const centre = proj.toCoord(applyTransform(fit, { x: 0, y: 0 }))
  check("and the same centre", metresApart(centre, solved.center) < 0.01)
}

group("reading control points out of the sheet config")
{
  const at = truth(SITE)
  const gcps = [
    { sheet: [0.2, 0.25], world: [at(0.2, 0.25).lat, at(0.2, 0.25).lng], note: "NW block corner" },
    { sheet: [0.8, 0.75], world: [at(0.8, 0.75).lat, at(0.8, 0.75).lng] },
  ]
  const floor = { id: "f0", floor: 0 }

  const solved = solveFloorPlacement({ slug: "test", gcps }, floor, SITE.aspectRatio)
  check("a sheet's control points solve", solved !== null)
  check("with the drawn angle", near(solved.rotation, SITE.rotation, DEG))
  check("and the drawn width", near(solved.spanM, SITE.spanM, 0.5))

  check("a floor's own points win over the sheet's", (() => {
    const other = truth({ ...SITE, rotation: -40 })
    const perFloor = [
      { sheet: [0.2, 0.25], world: [other(0.2, 0.25).lat, other(0.2, 0.25).lng] },
      { sheet: [0.8, 0.75], world: [other(0.8, 0.75).lat, other(0.8, 0.75).lng] },
    ]
    return near(solveFloorPlacement({ slug: "t", gcps }, { ...floor, gcps: perFloor }, SITE.aspectRatio).rotation, -40, DEG)
  })())

  check("no control points means the old anchoring", solveFloorPlacement({ slug: "t" }, floor, 1) === null)
  check("one is not enough", solveFloorPlacement({ slug: "t", gcps: [gcps[0]] }, floor, 1) === null)

  // Unsolvable points are a config error, not a placement to fall back from:
  // silently reverting to centre-and-width would place the venue wrongly and
  // say nothing, which is the failure mode this whole exercise is about.
  let threw = false
  try {
    solveFloorPlacement(
      { slug: "t", gcps: [{ sheet: [0.4, 0.4], world: [51.4, -0.17] }, { sheet: [0.4, 0.4], world: [51.5, -0.16] }] },
      floor,
      1
    )
  } catch {
    threw = true
  }
  check("two points on the same spot are rejected loudly", threw)
}

group("waypoints go through the same solution as the picture")
{
  const at = truth(SITE)
  const placement = solveFloorPlacement(
    {
      slug: "t",
      gcps: [
        { sheet: [0.1, 0.1], world: [at(0.1, 0.1).lat, at(0.1, 0.1).lng] },
        { sheet: [0.9, 0.9], world: [at(0.9, 0.9).lat, at(0.9, 0.9).lng] },
      ],
    },
    { id: "f0", floor: 0 },
    SITE.aspectRatio
  )
  const toLatLng = (nx, ny) => {
    const c = placedPlanPoint(placement, SITE.aspectRatio, nx, ny)
    return [c.lat, c.lng]
  }
  const labels = [
    { text: "Main Entrance", type: "entrance", nx: 0.42, ny: 0.61 },
    { text: "A&E", type: "emergency", nx: 0.72, ny: 0.34 },
    { text: "Main Entrance", type: "entrance", nx: 0.15, ny: 0.9 },
  ]
  const wps = waypointsFrom(labels, { floor: 0 }, {}, toLatLng)

  check("every label becomes a waypoint", wps.length === 3)
  check("ids stay unique when names repeat", new Set(wps.map((w) => w.id)).size === 3)
  check(
    "and each lands where the drawing puts it",
    wps.every((w, i) => metresApart({ lat: w.lat, lng: w.lng }, at(labels[i].nx, labels[i].ny)) < 0.01)
  )

  // The pins must be turned by the placement, not left north-up beside a turned
  // picture. On an 18° sheet a waypoint near the edge moves tens of metres, so
  // agreeing with the unrotated position would mean the rotation never reached
  // the pins.
  const northUp = { ...placement, rotation: 0 }
  const unturned = placedPlanPoint(northUp, SITE.aspectRatio, 0.15, 0.9)
  check("which is not where a north-up placement would put it", metresApart({ lat: wps[2].lat, lng: wps[2].lng }, unturned) > 20)
}

report()
