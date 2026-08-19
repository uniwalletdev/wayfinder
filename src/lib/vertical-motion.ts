"use client"

import { StepCounter } from "./step-counter"

// Detecting that the walker has changed FLOOR — the one piece of indoor
// position a map cannot guess and the walker keeps having to tell it by hand.
//
// What the hardware could tell us, and what it actually will:
//
//   * A barometer is the right sensor for this. One storey is roughly 0.4 hPa,
//     which phone pressure sensors resolve easily, and it needs no maths beyond
//     a baseline. Android exposes it as Sensor.TYPE_PRESSURE and iOS as
//     CMAltimeter — but NO browser exposes it. It was drafted for the Generic
//     Sensor API and never shipped, and Chrome's "Compute Pressure" API is CPU
//     load, not air. So a web app cannot have it, and this file exists because
//     of that. If Wayfinder is ever wrapped natively, read the barometer and
//     demote everything here to a fallback.
//   * GPS altitude is reported by the Geolocation API, but indoors its
//     altitudeAccuracy runs to tens of metres — many storeys of error for a
//     three-metre question. Useless for this.
//   * The accelerometer IS available, via DeviceMotionEvent, and already
//     powers dead-reckoning here. That is what this module uses.
//
// The accelerometer approach, in short: estimate which way is down, project
// acceleration onto that axis, and watch for the two vertical signatures a
// building produces.
//
//   Lift. Unmistakable: a sustained push of 0.3–1.5 m/s² for a second or two as
//   the car accelerates, a weightless cruise at exactly 1 g, then an equal and
//   opposite push as it brakes — all of it while the walker stands still, so
//   there are no footsteps to drown it out. Integrating that twice gives the
//   distance travelled. Double integration normally drifts hopelessly, but a
//   lift ride has a property that rescues it: the car is stationary at both
//   ends, so the true velocity at the end is zero. Whatever velocity the
//   integral has accumulated by then is pure sensor bias, and subtracting the
//   displacement that bias implies (ZUPT — zero-velocity update) leaves an
//   estimate good to well under a storey.
//
//   Stairs. Much harder, and this module does not pretend otherwise. Steady
//   climbing has, by definition, no average acceleration — the walker is moving
//   at a constant rate — so nothing about the mean says "up". What IS reliable
//   is the step count: a storey is about twenty risers whichever way you are
//   going. So stairs are sized by counting footsteps, and the DIRECTION is left
//   as "unknown" unless the double integration commits to a sign clearly enough
//   to be worth reporting.
//
// Which is fine, because the strongest evidence is not a sensor at all — it is
// the route. When guidance has already said "take the lift to Level 3", the
// detector only has to answer "did a vertical transit just happen", and
// resolveFloorChange() snaps to the floor the route was expecting. That turns a
// hard estimation problem into an easy detection one. Sensors alone only have
// to carry the case where nobody is navigating, and there the caller is
// expected to confirm rather than assert — see the confidence field.

export type VerticalActivity = "still" | "walking" | "riding" | "climbing"

/** One DeviceMotionEvent.accelerationIncludingGravity reading, in m/s². */
export interface MotionSample {
  t: number
  x: number
  y: number
  z: number
}

export interface VerticalTransit {
  via: "lift" | "stairs"
  // "unknown" is a real answer, not a failure: on stairs the sensors often
  // cannot tell up from down, and saying so lets the caller ask the route (or
  // the walker) instead of guessing and being wrong half the time.
  direction: "up" | "down" | "unknown"
  /** Estimated vertical distance travelled, in metres. Always positive. */
  metres: number
  /** Whole storeys, at least 1. */
  floors: number
  /** 0..1. Treat anything under CONFIDENT_ENOUGH as "ask, don't assert". */
  confidence: number
  durationMs: number
  /** Timestamp of the sample that closed the transit. */
  at: number
}

// Typical hospital storey. Taller than a house (3.0 m) because of the services
// void above the ceiling — an NHS ward floor-to-floor is usually 3.4–4.0 m.
export const DEFAULT_FLOOR_HEIGHT_M = 3.5
// Risers per storey at a regulation ~0.17 m rise. Two flights of ten.
export const DEFAULT_STEPS_PER_STOREY = 20
// Above this a caller may act on a transit silently; below it, confirm first.
export const CONFIDENT_ENOUGH = 0.7

// --- Filter time constants (first-order low-pass, in ms) --------------------
// Which way is down. Slow, because orientation changes slowly and we want the
// walker's own bouncing filtered out — but not so slow it cannot follow a phone
// being taken out of a pocket.
const GRAVITY_TAU_MS = 1500
// The 1 g baseline that vertical acceleration is measured against. Slower
// still, and frozen outright during a transit: left running it would quietly
// absorb the very acceleration we are trying to measure.
const BASELINE_TAU_MS = 4000
// Smoothing for the vertical channel before it is compared against thresholds.
const SMOOTH_TAU_MS = 250
// Window over which "how much is this person moving" is judged.
const ENERGY_TAU_MS = 1200

// --- Lift thresholds -------------------------------------------------------
// A lift car pulls 0.3–1.5 m/s²; below this is noise from a shifting grip.
const LIFT_ONSET_MS2 = 0.3
// How long that push must hold before it counts as a departure rather than a
// jolt. Real cars ramp for a second or more.
const LIFT_ONSET_HOLD_MS = 500
// A ride cannot be shorter than this, however quiet things go.
const LIFT_MIN_MS = 2500
// Nor longer. Past this the integral is worthless and whatever is happening is
// not a lift ride.
const LIFT_MAX_MS = 120_000
// The car has stopped when it has braked — a sustained push opposite to the one
// that launched it — and the vertical channel has then been quiet for
// LIFT_SETTLE_MS. Deliberately not "the integrated velocity is near zero": that
// number carries whatever bias the accelerometer has, and on a biased sensor it
// sails past zero and keeps going, so a real arrival never registers. The brake
// is a signature, and signatures do not drift.
const LIFT_QUIET_MS2 = 0.12
const LIFT_BRAKE_HOLD_MS = 400
const LIFT_SETTLE_MS = 1000
// Standing in a lift is calm; this is the ceiling on movement energy for a ride
// to still look like one.
const RIDE_CALM_RMS = 0.9
// And a lift rider is not walking. This is the decisive separator between a car
// pulling away and someone starting up a staircase, because a climber puts a
// foot down every half second and a passenger does not put one down at all.
// Energy thresholds alone cannot do it: for the first second of a climb the
// energy filter is still catching up from standing, and the body's rise off the
// first riser looks exactly like a launch.
const LIFT_STEP_QUIET_MS = 1200

// --- Walking and stairs ----------------------------------------------------
// Movement energy that means "on foot" rather than "standing".
const WALK_RMS = 1.5
// Vertical energy that separates stairs from level walking. Climbing throws the
// body up and down far harder than a flat corridor does.
const STAIR_RMS = 2.6
const STAIR_MIN_MS = 4000
const STAIR_MIN_STEPS = 10
const STAIR_MAX_MS = 180_000
// Stairs are over once the vertical thrashing subsides, even if the walker
// carries straight on down the corridor.
const STAIR_END_MS = 1800
// Walking hard enough for long enough ends a lift ride: they have stepped out.
const WALKED_OUT_MS = 1200

// Anything shorter than this is a lift door settling, a bus pulling away, or
// someone sitting down — not a change of floor.
const MIN_TRANSIT_M = 1.5

export interface VerticalMotionOptions {
  /** Floor-to-floor height, if the venue knows better than the default. */
  floorHeightM?: number
  stepsPerStorey?: number
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

// First-order low-pass step. Expressed as a time constant rather than a fixed
// alpha because DeviceMotionEvent's rate is not guaranteed and varies by device
// (Safari throttles to 60 Hz, some Androids deliver 100 Hz+); a fixed alpha
// would mean a different filter on every phone.
const lowPass = (prev: number, next: number, dtMs: number, tauMs: number) =>
  prev + (dtMs / (tauMs + dtMs)) * (next - prev)

type State = "idle" | "lift-onset" | "lift" | "stairs"

export class VerticalMotionDetector {
  private readonly floorHeightM: number
  private readonly stepsPerStorey: number
  private readonly steps = new StepCounter()

  private state: State = "idle"
  private lastT = 0
  private started = false
  // Sentinel far enough in the past that the step-quiet gate passes before any
  // step has ever been seen.
  private lastStepAt = -1e9

  // Gravity direction estimate, and the 1 g baseline it is measured against.
  private gx = 0
  private gy = 0
  private gz = 0
  private baseline = 9.81

  // Vertical channel and the two energy measures derived from it.
  private aVert = 0
  private aVertSmooth = 0
  private energyVar = 0 // mean square of overall acceleration deviation
  private vertVar = 0 // mean square of the vertical channel alone

  // Transit accumulators.
  private startT = 0
  private holdMs = 0
  private settleMs = 0
  private brakeMs = 0
  private brakeSeen = false
  private walkingMs = 0
  private quietMs = 0
  private onsetSign = 0
  private velocity = 0
  private displacement = 0
  private stepsInTransit = 0
  // Steps counted at the moment a stair segment first went quiet, so the
  // corridor the walker carries on down after the last riser is not counted as
  // more stairs.
  private stepsAtQuiet = 0
  private peakRms = 0

  constructor(options: VerticalMotionOptions = {}) {
    this.floorHeightM = options.floorHeightM ?? DEFAULT_FLOOR_HEIGHT_M
    this.stepsPerStorey = options.stepsPerStorey ?? DEFAULT_STEPS_PER_STOREY
  }

  get activity(): VerticalActivity {
    if (this.state === "lift") return "riding"
    if (this.state === "stairs") return "climbing"
    return Math.sqrt(this.energyVar) >= WALK_RMS ? "walking" : "still"
  }

  reset(): void {
    this.state = "idle"
    this.started = false
    this.lastStepAt = -1e9
    this.steps.reset()
    this.clearTransit()
  }

  /**
   * Feed one accelerometer sample. Returns a transit on the sample that
   * completes one, and null every other time — so the caller can treat a
   * non-null result as an event.
   */
  push(sample: MotionSample): VerticalTransit | null {
    const { t, x, y, z } = sample
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null

    if (!this.started) {
      this.started = true
      this.lastT = t
      this.gx = x
      this.gy = y
      this.gz = z
      this.baseline = Math.hypot(x, y, z) || 9.81
      return null
    }

    // Guard the integrator against a stalled or rewound clock: a backgrounded
    // tab resumes with a huge gap, and integrating across it would invent
    // hundreds of metres of travel.
    const dt = t - this.lastT
    this.lastT = t
    if (dt <= 0 || dt > 500) {
      if (dt > 500) this.abort()
      return null
    }

    this.updateFilters(x, y, z, dt)
    const stepped = this.steps.push(Math.hypot(x, y, z), t)
    if (stepped) {
      this.stepsInTransit++
      this.lastStepAt = t
    }

    switch (this.state) {
      case "idle":
        this.watchForOnset(t)
        return null
      case "lift-onset":
        return this.trackOnset(dt, stepped)
      case "lift":
        return this.trackLift(t, dt)
      case "stairs":
        return this.trackStairs(t, dt)
    }
  }

  // --- filters -------------------------------------------------------------

  private updateFilters(x: number, y: number, z: number, dt: number) {
    this.gx = lowPass(this.gx, x, dt, GRAVITY_TAU_MS)
    this.gy = lowPass(this.gy, y, dt, GRAVITY_TAU_MS)
    this.gz = lowPass(this.gz, z, dt, GRAVITY_TAU_MS)

    // At rest the accelerometer reads +1 g along whichever device axis points
    // UP (it measures the reaction to gravity, not gravity), so the low-passed
    // vector points up in the world frame and a positive projection is upward.
    const gMag = Math.hypot(this.gx, this.gy, this.gz)
    const magnitude = Math.hypot(x, y, z)

    if (gMag > 1e-3) {
      this.aVert = (x * this.gx + y * this.gy + z * this.gz) / gMag - this.baseline
    }
    this.aVertSmooth = lowPass(this.aVertSmooth, this.aVert, dt, SMOOTH_TAU_MS)

    // The baseline is deliberately NOT updated mid-transit, nor while anything
    // vertical is happening at all. A lift ride is a sustained one-sided
    // acceleration — exactly what a slow low-pass mistakes for a new resting
    // value and then subtracts away. Freezing only on state ("idle" or not) is
    // half a second too late: by the time the onset is confirmed the baseline
    // has already crept up the launch ramp, and the few centimetres per second
    // squared it gains become a bias that runs for the whole ride. A ten-second
    // ride turns that into more than a metre of phantom travel, and leaves the
    // integrated velocity drifting so far from zero that the car never looks
    // like it stopped.
    const quiet = Math.abs(this.aVertSmooth) < LIFT_ONSET_MS2 / 2 && this.rms <= RIDE_CALM_RMS
    if (this.state === "idle" && quiet) {
      this.baseline = lowPass(this.baseline, magnitude, dt, BASELINE_TAU_MS)
    }

    // Agitation is the HIGH-FREQUENCY part of the vertical channel — what is
    // left once the smooth component is removed. Measuring raw deviation
    // instead would count a lift's own steady push as movement energy and make
    // every strong car look like someone walking, which is precisely the thing
    // this measure exists to rule out. Footsteps, at ~2 Hz, mostly survive the
    // 250 ms smoother and still register.
    const hf = this.aVert - this.aVertSmooth
    this.energyVar = lowPass(this.energyVar, hf * hf, dt, ENERGY_TAU_MS)
    // Total vertical energy, smooth part included: this is what tells stairs
    // from a level corridor.
    this.vertVar = lowPass(this.vertVar, this.aVert * this.aVert, dt, ENERGY_TAU_MS)
  }

  private get rms() {
    return Math.sqrt(this.energyVar)
  }

  private get vertRms() {
    return Math.sqrt(this.vertVar)
  }

  // --- state machine -------------------------------------------------------

  private watchForOnset(t: number) {
    // A lift first: it is the cleaner signature, and it requires stillness that
    // stairs by definition cannot produce, so the two can never both fire.
    const stepQuiet = t - this.lastStepAt >= LIFT_STEP_QUIET_MS
    if (stepQuiet && Math.abs(this.aVertSmooth) >= LIFT_ONSET_MS2 && this.rms <= RIDE_CALM_RMS) {
      this.clearTransit()
      this.state = "lift-onset"
      this.startT = t
      this.onsetSign = Math.sign(this.aVertSmooth)
      return
    }
    if (this.rms >= WALK_RMS && this.vertRms >= STAIR_RMS) {
      this.clearTransit()
      this.state = "stairs"
      this.startT = t
    }
  }

  // The onset is provisional: hold the acceleration for LIFT_ONSET_HOLD_MS in a
  // consistent direction and it is a departing car; break early and it was a
  // jolt. Integration runs throughout so a confirmed ride does not start its
  // sums half a second late, having already missed the launch.
  private trackOnset(dt: number, stepped: boolean): null {
    this.integrate(dt)
    const consistent =
      Math.abs(this.aVertSmooth) >= LIFT_ONSET_MS2 && Math.sign(this.aVertSmooth) === this.onsetSign
    if (stepped || !consistent || this.rms > RIDE_CALM_RMS) {
      this.abort()
      return null
    }
    this.holdMs += dt
    if (this.holdMs >= LIFT_ONSET_HOLD_MS) this.state = "lift"
    return null
  }

  private trackLift(t: number, dt: number): VerticalTransit | null {
    this.integrate(dt)
    this.peakRms = Math.max(this.peakRms, this.rms)

    const elapsed = t - this.startT
    if (elapsed > LIFT_MAX_MS) {
      this.abort()
      return null
    }

    // Walking again means they are out of the car and down the corridor, so the
    // ride ended a moment ago whether or not it settled cleanly.
    this.walkingMs = this.rms >= WALK_RMS ? this.walkingMs + dt : 0
    if (this.walkingMs >= WALKED_OUT_MS) return this.finishLift(t, elapsed)

    // Braking: a sustained push against the direction of the launch.
    const braking =
      Math.abs(this.aVertSmooth) >= LIFT_ONSET_MS2 && Math.sign(this.aVertSmooth) === -this.onsetSign
    this.brakeMs = braking ? this.brakeMs + dt : 0
    if (this.brakeMs >= LIFT_BRAKE_HOLD_MS) this.brakeSeen = true

    const settled = this.brakeSeen && Math.abs(this.aVertSmooth) <= LIFT_QUIET_MS2
    this.settleMs = settled ? this.settleMs + dt : 0
    if (elapsed >= LIFT_MIN_MS && this.settleMs >= LIFT_SETTLE_MS) return this.finishLift(t, elapsed)

    return null
  }

  private trackStairs(t: number, dt: number): VerticalTransit | null {
    this.integrate(dt)

    const elapsed = t - this.startT
    if (elapsed > STAIR_MAX_MS) {
      this.abort()
      return null
    }

    // Over when the vertical thrashing stops — either they stood still, or they
    // reached a landing and walked on along the flat.
    const quiet = this.vertRms < STAIR_RMS * 0.8 || this.rms < WALK_RMS
    if (quiet && this.quietMs === 0) this.stepsAtQuiet = this.stepsInTransit
    this.quietMs = quiet ? this.quietMs + dt : 0
    if (this.quietMs < STAIR_END_MS) return null

    // Subtract the quiet tail: it was corridor, not staircase, and counting its
    // footsteps as risers would inflate the storey count.
    const climbMs = elapsed - this.quietMs
    if (climbMs < STAIR_MIN_MS || this.stepsAtQuiet < STAIR_MIN_STEPS) {
      this.abort()
      return null
    }
    return this.finishStairs(t, climbMs)
  }

  private integrate(dt: number) {
    const dts = dt / 1000
    // Trapezoid on velocity: at 60 Hz the difference from a rectangle is small,
    // but it is free and the whole estimate rests on this sum.
    const dv = this.aVert * dts
    this.displacement += (this.velocity + dv / 2) * dts
    this.velocity += dv
  }

  // --- emitting ------------------------------------------------------------

  // Zero-velocity update. The car (or the walker) is stationary at both ends of
  // a transit, so the true final velocity is zero and everything the integral
  // has accumulated is bias. A constant bias b over T seconds shows up as
  // v(T) = bT and inflates displacement by ½bT² — which, substituting, is
  // exactly ½·v(T)·T, whatever b actually was.
  private correctedDisplacement(elapsedMs: number): number {
    const T = elapsedMs / 1000
    if (T <= 0) return this.displacement
    return this.displacement - 0.5 * this.velocity * T
  }

  private finishLift(t: number, elapsed: number): VerticalTransit | null {
    const d = this.correctedDisplacement(elapsed)
    const metres = Math.abs(d)
    // Read before settling — settle() clears both.
    const onsetSign = this.onsetSign
    const peakRms = this.peakRms
    this.settle()
    if (metres < MIN_TRANSIT_M) return null

    const storeys = metres / this.floorHeightM
    const floors = Math.max(1, Math.round(storeys))
    // Three independent ways of being wrong, each docking confidence:
    // the launch and the integral disagreeing about which way the car went;
    // a distance that lands between floors rather than on one; and the walker
    // having been too fidgety for the integral to mean much.
    const agrees = Math.sign(d) === onsetSign ? 1 : 0
    const snap = 1 - Math.abs(storeys - floors)
    const calm = 1 - Math.min(1, peakRms / WALK_RMS)
    const confidence = clamp01(0.25 + 0.35 * agrees + 0.2 * clamp01(snap) + 0.2 * clamp01(calm))

    return {
      via: "lift",
      direction: onsetSign > 0 ? "up" : "down",
      metres,
      floors,
      confidence,
      durationMs: elapsed,
      at: t,
    }
  }

  private finishStairs(t: number, climbMs: number): VerticalTransit | null {
    // Risers, not integration: a storey is about twenty of them, and counting
    // footsteps survives the per-step acceleration spikes that make the
    // integral so noisy on stairs.
    const storeys = this.stepsAtQuiet / this.stepsPerStorey
    const floors = Math.max(1, Math.round(storeys))
    const metres = floors * this.floorHeightM
    const d = this.correctedDisplacement(climbMs)
    this.settle()

    // The integral is only worth a direction if it committed to one — half the
    // step-derived distance is the bar. Below that, say "unknown" and let the
    // route or the walker settle it.
    const committed = Math.abs(d) >= 0.5 * metres
    const direction: VerticalTransit["direction"] = committed ? (d > 0 ? "up" : "down") : "unknown"
    const snap = clamp01(1 - Math.abs(storeys - floors))
    // Capped well below certainty on purpose. Stairs are the weak case, and a
    // caller reading this number should be asking, not asserting.
    const confidence = clamp01(0.2 + 0.2 * snap + (committed ? 0.15 : 0))

    return { via: "stairs", direction, metres, floors, confidence, durationMs: climbMs, at: t }
  }

  private abort() {
    this.state = "idle"
    this.clearTransit()
  }

  // End a transit without throwing away the gravity and baseline estimates.
  // Re-seeding them from the single next sample — which is usually taken mid
  // stride as the walker leaves the lift — would leave the filters worse than
  // the warm ones they replaced.
  private settle() {
    this.state = "idle"
    this.steps.reset()
    this.clearTransit()
  }

  private clearTransit() {
    this.startT = 0
    this.holdMs = 0
    this.settleMs = 0
    this.brakeMs = 0
    this.brakeSeen = false
    this.walkingMs = 0
    this.quietMs = 0
    this.onsetSign = 0
    this.velocity = 0
    this.displacement = 0
    this.stepsInTransit = 0
    this.stepsAtQuiet = 0
    this.peakRms = 0
  }
}

// --- turning a transit into a floor ----------------------------------------

/** A floor change the active route is expecting, from RouteStep.floorChange. */
export interface ExpectedFloorChange {
  from: number
  to: number
  via: "lift" | "stairs"
}

export interface FloorResolution {
  floor: number
  direction: "up" | "down"
  floors: number
  via: "lift" | "stairs"
  confidence: number
  /** True when the route decided this, rather than the sensors alone. */
  fromRoute: boolean
}

// Pick the floor the walker most plausibly arrived at. `nominal` is what the
// sensors imply; it may not exist in this building (venues skip floors, and a
// mezzanine ride reads as a storey). Prefer the exact floor, then the nearest
// one further along in the direction of travel — a lift that went up did not
// leave anyone below where they started — and only then the nearest of any.
function snapToAvailable(nominal: number, currentFloor: number, availableFloors: number[]): number | null {
  if (availableFloors.length === 0) return null
  if (availableFloors.includes(nominal)) return nominal

  const up = nominal > currentFloor
  const ahead = availableFloors.filter((f) => (up ? f > currentFloor : f < currentFloor))
  const pool = ahead.length > 0 ? ahead : availableFloors.filter((f) => f !== currentFloor)
  if (pool.length === 0) return null
  return pool.reduce((best, f) => (Math.abs(f - nominal) < Math.abs(best - nominal) ? f : best))
}

/**
 * Resolve a detected transit into the floor the walker is now on, or null when
 * the evidence does not support an answer (the caller should ask instead).
 *
 * The route, when there is one, outranks the sensors: guidance that has already
 * said "take the lift to Level 3" knows the destination floor exactly, and all
 * the accelerometer had to establish is that a lift ride happened. That is the
 * difference between a hard estimate and an easy detection, and it is why stair
 * transits — which often cannot tell up from down on their own — still resolve
 * correctly for anyone actually following directions.
 */
export function resolveFloorChange(
  transit: VerticalTransit,
  currentFloor: number,
  availableFloors: number[],
  expected?: ExpectedFloorChange | null
): FloorResolution | null {
  if (expected && expected.from === currentFloor && expected.to !== currentFloor) {
    const expectedDir = expected.to > expected.from ? "up" : "down"
    const expectedFloors = Math.abs(expected.to - expected.from)
    // A detected direction that contradicts the route means they did not take
    // the ride the route asked for, so the route no longer describes where they
    // are. "unknown" contradicts nothing and is happily overruled.
    const directionOk = transit.direction === "unknown" || transit.direction === expectedDir
    // Distance is a sanity check, not the answer: one storey of disagreement is
    // ordinary estimator error, more than that and they probably got out early.
    const distanceOk = Math.abs(transit.floors - expectedFloors) <= 1
    if (directionOk && distanceOk) {
      return {
        floor: expected.to,
        direction: expectedDir,
        floors: expectedFloors,
        // What they actually did, which is worth knowing when the route said
        // lift and the sensors saw stairs.
        via: transit.via,
        confidence: Math.max(transit.confidence, 0.85),
        fromRoute: true,
      }
    }
  }

  // No usable route context — the sensors are on their own, and without a
  // direction there is nothing to say.
  if (transit.direction === "unknown") return null

  const nominal = currentFloor + (transit.direction === "up" ? transit.floors : -transit.floors)
  const floor = snapToAvailable(nominal, currentFloor, availableFloors)
  if (floor === null || floor === currentFloor) return null

  return {
    floor,
    direction: transit.direction,
    floors: Math.abs(floor - currentFloor),
    via: transit.via,
    // Snapping to a floor other than the one implied is a correction, and a
    // correction is a reason to be less sure of the result.
    confidence: floor === nominal ? transit.confidence : transit.confidence * 0.8,
    fromRoute: false,
  }
}
