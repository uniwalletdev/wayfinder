// Checks for the placement fitter (scripts/signals/lib/registration.mjs).
//
// A real venue's true placement is precisely the unknown being solved for, so
// there is nothing to check a real fit against. Instead every case here starts
// from a known answer: take a corridor network, move it by a rotation and scale
// chosen in advance, sample noisy "walks" along it, and require the fitter to
// recover the numbers it was moved by. If it can do that through drift and
// outliers, it can do it on a hospital.
//
// Run: node scripts/signals/test/registration.test.mjs
import {
  fitSimilarity, applyTransform, compose, icp, registerWithRestarts, projector,
  degrees, IDENTITY,
} from "../lib/registration.mjs"
import { group, check, report } from "../../nhs/test/harness.mjs"

// Deterministic noise — a flaky test on a statistical fit teaches nothing.
function rng(seed) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}
const gauss = (rand, sd) => {
  const u = Math.max(rand(), 1e-9)
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand()) * sd
}

// An H-shaped corridor network with one wing extended — the shape of most
// hospital blocks, and deliberately NOT symmetric. A plain H is unchanged by a
// 180-degree turn, so the walking cannot say which way round it goes; that
// ambiguity is real and is tested for separately below.
function corridorNetwork(step = 2) {
  const pts = symmetricNetwork(step)
  // A long wing off one corner only. It has to be a substantial fraction of the
  // building or noise drowns it and the shape is symmetric again in practice.
  for (let x = 60; x <= 150; x += step) pts.push({ x, y: 80 })
  for (let y = 80; y <= 140; y += step) pts.push({ x: 150, y })
  return pts
}

// The same wing without the stub: 180-degree symmetric, and so genuinely
// ambiguous to fit.
function symmetricNetwork(step = 2) {
  const pts = []
  for (let y = 0; y <= 80; y += step) {
    pts.push({ x: 0, y })
    pts.push({ x: 60, y })
  }
  for (let x = 0; x <= 60; x += step) pts.push({ x, y: 40 })
  return pts
}

const move = (t, pts) => pts.map((p) => applyTransform(t, p))

group("similarity fit with known correspondences")
{
  const src = corridorNetwork()
  const truth = { rotation: Math.PI / 6, scale: 1.25, tx: 120, ty: -45 }
  const dst = move(truth, src)
  const fit = fitSimilarity(src, dst)

  check("recovers the rotation", Math.abs(degrees(fit.rotation) - 30) < 0.01)
  check("recovers the scale", Math.abs(fit.scale - 1.25) < 0.001)
  check("recovers the translation", Math.abs(fit.tx - 120) < 0.01 && Math.abs(fit.ty + 45) < 0.01)

  check("two points are enough", fitSimilarity([{ x: 0, y: 0 }, { x: 1, y: 0 }], [{ x: 0, y: 0 }, { x: 0, y: 2 }]) !== null)
  check("one point is not", fitSimilarity([{ x: 0, y: 0 }], [{ x: 1, y: 1 }]) === null)
  check("coincident points are degenerate", fitSimilarity([{ x: 5, y: 5 }, { x: 5, y: 5 }], [{ x: 0, y: 0 }, { x: 1, y: 1 }]) === null)
}

group("transform algebra")
{
  const a = { rotation: 0.3, scale: 1.1, tx: 5, ty: -2 }
  const b = { rotation: -0.7, scale: 0.8, tx: -3, ty: 9 }
  const p = { x: 12, y: 7 }
  const viaCompose = applyTransform(compose(a, b), p)
  const viaSteps = applyTransform(a, applyTransform(b, p))
  check("compose(a,b) is a after b", Math.hypot(viaCompose.x - viaSteps.x, viaCompose.y - viaSteps.y) < 1e-9)
  const q = applyTransform(IDENTITY, p)
  check("identity moves nothing", q.x === p.x && q.y === p.y)
}

group("ICP recovers placement from noisy walks")
{
  // The realistic case: a plan pinned 25 degrees off and 15% too small, and
  // people walking its corridors with a few metres of indoor drift.
  const model = corridorNetwork()
  const truth = { rotation: (25 * Math.PI) / 180, scale: 1.15, tx: 40, ty: -30 }
  const rand = rng(7)
  const walked = move(truth, corridorNetwork(1)).map((p) => ({
    x: p.x + gauss(rand, 2.5),
    y: p.y + gauss(rand, 2.5),
  }))

  const fit = registerWithRestarts(model, walked)
  check("a fit is found", fit.transform !== null)
  check(
    `rotation recovered within 3 degrees (got ${degrees(fit.transform.rotation).toFixed(1)})`,
    Math.abs(degrees(fit.transform.rotation) - 25) < 3
  )
  check(
    `scale recovered within 5% (got ${fit.transform.scale.toFixed(3)})`,
    Math.abs(fit.transform.scale - 1.15) < 0.06
  )
  check(`residual is small (rms ${fit.rms.toFixed(2)} m)`, fit.rms < 5)
  check("most model points found a match", fit.matchRatio > 0.8)
}

group("ICP survives outliers")
{
  // A quarter of the "walks" are junk — someone crossing a car park, a GPS
  // spike. The fit has to come from the real ones.
  const model = corridorNetwork()
  const truth = { rotation: (-40 * Math.PI) / 180, scale: 0.9, tx: -60, ty: 25 }
  const rand = rng(11)
  const good = move(truth, corridorNetwork(1)).map((p) => ({ x: p.x + gauss(rand, 2), y: p.y + gauss(rand, 2) }))
  const junk = Array.from({ length: Math.floor(good.length / 3) }, () => ({
    x: (rand() - 0.5) * 400,
    y: (rand() - 0.5) * 400,
  }))

  const fit = registerWithRestarts(model, [...good, ...junk])
  check("still fits", fit.transform !== null)
  // The contract that matters is not "always right" — ICP on a nearly
  // symmetric building with a third of the input junk can land on a wrong
  // orientation, and pretending otherwise would be the dangerous claim. The
  // contract is that it is never CONFIDENTLY wrong: a wrong answer must come
  // with the ambiguity flag that stops a caller applying it.
  const angle = degrees(fit.transform.rotation)
  const right = Math.abs(angle + 40) < 5
  check(
    `either right or flagged (angle ${angle.toFixed(1)}, ambiguous ${fit.ambiguous})`,
    right || fit.ambiguous === true
  )
}

group("a symmetric building is reported as ambiguous")
{
  // The safety property behind the asymmetric test shape above. An H-shaped
  // wing fits its own walking equally well either way round, with a low
  // residual both times. Reporting a confident answer there would turn a
  // hospital's map upside down; the fitter has to admit it cannot tell.
  const model = symmetricNetwork()
  const truth = { rotation: (35 * Math.PI) / 180, scale: 1, tx: 20, ty: 10 }
  const rand = rng(23)
  const walked = symmetricNetwork(1)
    .map((p) => applyTransform(truth, p))
    .map((p) => ({ x: p.x + gauss(rand, 1.5), y: p.y + gauss(rand, 1.5) }))

  const fit = registerWithRestarts(model, walked)
  check("a fit is still found", fit.transform !== null)
  check("but it is flagged ambiguous", fit.ambiguous === true)
  check("and names the rival angle", typeof fit.rivalRotation === "number")

  // The asymmetric wing, same conditions, must NOT be flagged.
  const solid = corridorNetwork()
  const rand2 = rng(29)
  const walked2 = corridorNetwork(1)
    .map((p) => applyTransform(truth, p))
    .map((p) => ({ x: p.x + gauss(rand2, 1.5), y: p.y + gauss(rand2, 1.5) }))
  const fit2 = registerWithRestarts(solid, walked2)
  check("an asymmetric building is not", fit2.ambiguous === false)
}

group("ICP refuses when there is nothing to fit")
{
  const model = corridorNetwork()
  const rand = rng(3)
  // Pure noise over a wide area: no structure to lock onto.
  const noise = Array.from({ length: 300 }, () => ({ x: (rand() - 0.5) * 4000, y: (rand() - 0.5) * 4000 }))
  const fit = registerWithRestarts(model, noise, { minMatchRatio: 0.6 })
  const unusable = fit.transform === null || fit.rms > 20
  check("noise does not yield a confident fit", unusable)

  check("too few points is refused", icp([{ x: 0, y: 0 }], [{ x: 1, y: 1 }]).transform === null)
}

group("projection")
{
  const ref = { lat: 51.5221, lng: -0.1212 }
  const { toLocal, toCoord } = projector(ref)
  const there = { lat: 51.5231, lng: -0.1192 }
  const local = toLocal(there)
  const back = toCoord(local)
  check("round-trips", Math.abs(back.lat - there.lat) < 1e-9 && Math.abs(back.lng - there.lng) < 1e-9)
  check("the reference is the origin", Math.abs(toLocal(ref).x) < 1e-9 && Math.abs(toLocal(ref).y) < 1e-9)
  // 0.001 degrees of latitude is about 111 m.
  check("a metre is a metre", Math.abs(toLocal({ lat: ref.lat + 0.001, lng: ref.lng }).y - 111.32) < 0.1)
}

report()
