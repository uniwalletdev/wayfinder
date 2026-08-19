// Checks the accelerometer floor detector (src/lib/vertical-motion.ts) against
// synthesised sensor traces.
//
// There is no way to unit-test this against a real staircase, so the traces are
// built from the physics the detector claims to rely on: a lift is a symmetric
// accelerate/cruise/brake velocity profile with nobody walking, and a stair
// climb is a footstep oscillation with a net rise. If the detector's model of
// those two things is wrong, these fail; if the model is right but the
// THRESHOLDS are mistuned for real hardware, they will not — that needs field
// data, and docs/floor-change-detection.md says so.
//
// The traces are deliberately honest about the hard case: a symmetric stair
// oscillation carries no net acceleration, so the detector cannot recover the
// direction from it, and the test asserts it says "unknown" rather than
// guessing. Route context is what resolves that, and there is a case for it.
//
// Run: node scripts/lib-test/vertical-motion.test.mjs
import { register } from "node:module"
import { fileURLToPath } from "node:url"

register(new URL("./ts-hooks.mjs", import.meta.url), import.meta.url)

const SRC = new URL("../../src/lib/", import.meta.url)
const { VerticalMotionDetector, resolveFloorChange, DEFAULT_FLOOR_HEIGHT_M } = await import(
  fileURLToPath(new URL("vertical-motion.ts", SRC))
)

const { group, check, report } = await import("../nhs/test/harness.mjs")

const HZ = 60
const DT = 1000 / HZ
const G = 9.81

// Deterministic pseudo-noise, so a failure is always reproducible.
let seed = 12345
const noise = (amp) => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff
  return ((seed / 0x7fffffff) * 2 - 1) * amp
}

// A trace is a list of samples for a phone held flat, screen up: gravity and
// every vertical acceleration land on z, which is what a phone in a coat pocket
// or a hand at waist height approximates. Orientation independence is the
// detector's job (it projects onto its own gravity estimate), not the fixture's.
function trace() {
  const samples = []
  let t = 0
  return {
    /** Quiet standing. */
    still(seconds) {
      for (let i = 0; i < seconds * HZ; i++, t += DT) {
        samples.push({ t, x: noise(0.03), y: noise(0.03), z: G + noise(0.05) })
      }
      return this
    },
    /** Constant vertical acceleration, as a lift car ramps or brakes. */
    accelerate(seconds, a) {
      for (let i = 0; i < seconds * HZ; i++, t += DT) {
        samples.push({ t, x: noise(0.03), y: noise(0.03), z: G + a + noise(0.05) })
      }
      return this
    },
    /**
     * Footsteps. `amp` sets how hard the body is thrown about (a level corridor
     * is gentler than a staircase); `bias` is the net acceleration of a
     * transition into or out of the gait.
     */
    walk(seconds, amp, bias = 0) {
      const f = 1.9 // ~114 steps/min, an ordinary walking cadence
      for (let i = 0; i < seconds * HZ; i++, t += DT) {
        const phase = Math.sin((2 * Math.PI * f * t) / 1000)
        samples.push({ t, x: noise(0.4), y: noise(0.4), z: G + bias + amp * phase + noise(0.1) })
      }
      return this
    },
    done: () => samples,
  }
}

// Run a whole trace through a detector and collect everything it emitted.
function run(samples, options = {}) {
  const detector = new VerticalMotionDetector(options)
  const found = []
  for (const s of samples) {
    const transit = detector.push(s)
    if (transit) found.push(transit)
  }
  return found
}

// A lift ride covering `metres`: ramp to speed, cruise, brake symmetrically.
// Doing it by physics rather than by hand-picked timings is what makes the
// expected floor count something the test derives instead of asserts.
function liftRide(metres, { accel = 0.8, rampSeconds = 1.5, up = true } = {}) {
  const sign = up ? 1 : -1
  const rampDistance = accel * rampSeconds * rampSeconds // both ramps together
  const cruiseSpeed = accel * rampSeconds
  const cruiseSeconds = Math.max(0, (metres - rampDistance) / cruiseSpeed)
  return trace()
    .still(4)
    .accelerate(rampSeconds, sign * accel)
    .accelerate(cruiseSeconds, 0)
    .accelerate(rampSeconds, -sign * accel)
    .still(4)
    .done()
}

group("a lift ride is detected, sized and pointed the right way")
{
  const threeFloors = 3 * DEFAULT_FLOOR_HEIGHT_M
  const found = run(liftRide(threeFloors))
  check("emits exactly one transit", found.length === 1, `got ${found.length}`)
  const t = found[0] ?? {}
  check("recognised as a lift", t.via === "lift", t.via)
  check("direction is up", t.direction === "up", t.direction)
  check("counts three floors", t.floors === 3, `got ${t.floors}`)
  check(
    "distance is within half a storey of the truth",
    Math.abs(t.metres - threeFloors) < DEFAULT_FLOOR_HEIGHT_M / 2,
    `${t.metres?.toFixed(2)}m vs ${threeFloors}m`
  )
  check("confident enough to act on", t.confidence >= 0.7, `${t.confidence?.toFixed(2)}`)
}

group("a descending ride reads as down")
{
  const found = run(liftRide(2 * DEFAULT_FLOOR_HEIGHT_M, { up: false }))
  check("emits one transit", found.length === 1, `got ${found.length}`)
  check("direction is down", found[0]?.direction === "down", found[0]?.direction)
  check("counts two floors", found[0]?.floors === 2, `got ${found[0]?.floors}`)
}

group("ordinary movement is not a floor change")
{
  check("standing still emits nothing", run(trace().still(40).done()).length === 0)
  check(
    "walking a corridor emits nothing",
    run(trace().still(3).walk(30, 3.2).still(3).done()).length === 0
  )
  // A door jolt, a bus pulling away, sitting down heavily: real vertical
  // acceleration, far too little travel to be a storey.
  const jolt = trace().still(4).accelerate(0.8, 0.6).accelerate(0.8, -0.6).still(4).done()
  check("a short vertical jolt emits nothing", run(jolt).length === 0)
}

group("a stair climb is sized by footsteps, and admits it cannot see direction")
{
  // Two storeys at ~20 risers each ≈ 40 steps; at 1.9 steps/s that is ~21 s.
  const climb = trace().still(3).walk(21, 4.6, 0).still(4).done()
  const found = run(climb)
  check("emits one transit", found.length === 1, `got ${found.length}`)
  const t = found[0] ?? {}
  check("recognised as stairs", t.via === "stairs", t.via)
  check("counts two floors", t.floors === 2, `got ${t.floors}`)
  check(
    "does not guess a direction it cannot see",
    t.direction === "unknown",
    t.direction
  )
  check("reports itself as uncertain", t.confidence < 0.7, `${t.confidence?.toFixed(2)}`)
}

group("the route resolves what the sensors cannot")
{
  const stairs = { via: "stairs", direction: "unknown", metres: 7, floors: 2, confidence: 0.4, durationMs: 21000, at: 0 }
  const resolved = resolveFloorChange(stairs, 1, [0, 1, 2, 3], { from: 1, to: 3, via: "stairs" })
  check("lands on the floor the route expected", resolved?.floor === 3, `${resolved?.floor}`)
  check("credited to the route", resolved?.fromRoute === true)
  check("confidence is raised accordingly", (resolved?.confidence ?? 0) >= 0.85)

  // Without the route there is nothing to break the tie, and saying so beats a
  // coin flip that sends the walker to the wrong floor.
  check(
    "an unknown direction alone resolves to nothing",
    resolveFloorChange(stairs, 1, [0, 1, 2, 3], null) === null
  )
}

group("the route is trusted, but not blindly")
{
  const up1 = { via: "lift", direction: "up", metres: 3.5, floors: 1, confidence: 0.8, durationMs: 5000, at: 0 }
  // The route said go up; the sensors clearly saw the car go down. They took a
  // different lift, so the route no longer describes where they are — fall back
  // to what was actually measured.
  const down1 = { ...up1, direction: "down" }
  const contradicted = resolveFloorChange(down1, 1, [0, 1, 2, 3], { from: 1, to: 2, via: "lift" })
  check("a contradicted route is not followed", contradicted?.floor === 0, `${contradicted?.floor}`)
  check("and the answer is not credited to the route", contradicted?.fromRoute === false)

  // One storey of disagreement is ordinary estimator error; four is someone
  // getting out early.
  const short = { ...up1, floors: 1 }
  const early = resolveFloorChange(short, 1, [0, 1, 2, 3, 4, 5], { from: 1, to: 5, via: "lift" })
  check("a wildly short ride does not claim the route's floor", early?.floor === 2, `${early?.floor}`)
}

group("floors the building does not have are snapped away")
{
  const up2 = { via: "lift", direction: "up", metres: 7, floors: 2, confidence: 0.8, durationMs: 8000, at: 0 }
  // A venue with no mapped floor 2: the ride went up, so the answer must be
  // above where they started, never back below it.
  const snapped = resolveFloorChange(up2, 0, [0, 1, 3], null)
  check("snaps to a floor that exists", [1, 3].includes(snapped?.floor), `${snapped?.floor}`)
  check("stays on the side it travelled to", (snapped?.floor ?? 0) > 0, `${snapped?.floor}`)
  check("and is less sure for having been corrected", (snapped?.confidence ?? 1) < 0.8)
}

group("a biased accelerometer still lands on the right floor")
{
  // No real sensor reads a true zero at rest; a few hundredths of a m/s² of
  // offset is ordinary. Integrated over a ten-second ride that alone is metres
  // of phantom travel, which is the whole reason the zero-velocity update
  // exists — the car is stationary at both ends, so whatever velocity the
  // integral has by the end is bias and can be subtracted back out.
  const clean = liftRide(3 * DEFAULT_FLOOR_HEIGHT_M)
  const biased = clean.map((s) => ({ ...s, z: s.z + 0.06 }))
  const found = run(biased)
  check("still emits one transit", found.length === 1, `got ${found.length}`)
  check("still counts three floors", found[0]?.floors === 3, `got ${found[0]?.floors}`)
  check("still reads as up", found[0]?.direction === "up", found[0]?.direction)
}

group("holding the phone another way changes nothing")
{
  // Same ride, phone upright in a pocket: gravity and the car's push now land
  // on y instead of z. The detector estimates its own down-axis rather than
  // assuming one, so the answer must not move.
  const upright = liftRide(3 * DEFAULT_FLOOR_HEIGHT_M).map((s) => ({ t: s.t, x: s.x, y: s.z, z: -s.y }))
  const found = run(upright)
  check("emits one transit", found.length === 1, `got ${found.length}`)
  check("counts three floors", found[0]?.floors === 3, `got ${found[0]?.floors}`)
  check("reads as up", found[0]?.direction === "up", found[0]?.direction)
}

group("a backgrounded tab does not invent a journey")
{
  // Suspended mid-ride: the phone locks, samples stop, and the next one arrives
  // a minute later. Integrating across that gap would manufacture hundreds of
  // metres of travel and teleport the walker up the building.
  const samples = liftRide(3 * DEFAULT_FLOOR_HEIGHT_M)
  const cut = Math.floor(samples.length / 2)
  const gapped = [
    ...samples.slice(0, cut),
    ...samples.slice(cut).map((s) => ({ ...s, t: s.t + 60_000 })),
  ]
  check("no transit survives the gap", run(gapped).length === 0)
}

report()
