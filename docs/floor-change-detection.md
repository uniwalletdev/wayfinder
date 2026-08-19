# Knowing when someone has changed floor

*What sensors a web app can actually reach for this, what each one is worth, and
what the shipped detector does with the one it gets. Implementation in
[`src/lib/vertical-motion.ts`](../src/lib/vertical-motion.ts); tests in
`scripts/lib-test/vertical-motion.test.mjs`.*

---

## The problem

Every other part of a walker's position, Wayfinder can work out. Where they are
on a floor comes from GPS outdoors, a scanned QR poster indoors, and
dead-reckoning between the two. Which way they are facing comes from the
compass.

Which **floor** they are on, it cannot. Until now that was a question the app
asked the user, by way of the floor pills on the right of the map — and a walker
crossing a hospital with a route on screen, a bag in one hand and a ward to find
does not reliably stop to tell an app they have got out of a lift. When they do
not, everything downstream is wrong at once: the wrong plan is drawn, the wrong
waypoints are listed, and the route recomputes from a floor they are not on.

## What the hardware could tell us

| | resolution on this question | available in a browser |
| --- | --- | --- |
| **Barometer** | one storey ≈ 0.4 hPa, trivially resolvable | **no** |
| **GPS altitude** | ±10–50 m indoors — many storeys of error | yes, but useless here |
| **Accelerometer** | infers movement, not position | **yes** |
| **BLE beacons per floor** | near-exact | needs hardware in every building |
| **Wi-Fi RSSI fingerprinting** | good, after a survey per floor | no scan API on the web |

The barometer is the right sensor and the frustrating one. Android exposes it as
`Sensor.TYPE_PRESSURE` and iOS as `CMAltimeter`, both accurate enough that a
floor change is a threshold check rather than an inference. No browser exposes
it: it was drafted for the Generic Sensor API and never shipped, and Chrome's
similarly-named Compute Pressure API measures CPU load, not air. **If Wayfinder
is ever wrapped natively, read the barometer and demote everything below to a
fallback.** That is the single highest-value change available to this feature,
and it is a packaging decision rather than an algorithmic one.

That leaves the accelerometer, which the app already reads for step counting.

## What the accelerometer can and cannot do

Estimate which way is down, project acceleration onto that axis, and two
building signatures become visible.

**A lift is easy.** The car pushes 0.3–1.5 m/s² for a second or two, cruises at
exactly 1 g, then pushes back equally hard to stop — all while the passenger
stands still, so no footsteps drown it out. Integrating that twice gives the
distance travelled. Double integration normally drifts hopelessly, but a lift
ride has the property that rescues it: the car is stationary at both ends. Any
velocity the integral has accumulated by the end is therefore pure sensor bias,
and subtracting the displacement that bias implies — a zero-velocity update, or
ZUPT — leaves an estimate good to well under a storey. On the test traces it
lands within half a storey over three floors, and stays there when 0.06 m/s² of
bias is added to every sample.

**Stairs are hard, and the code does not pretend otherwise.** Steady climbing
has, by definition, no average acceleration — the walker is moving at a constant
rate — so nothing in the mean says "up". Telling ascent from descent in the
waveform is a trained-classifier problem (the usual feature is the skew from
heel-strike impacts) and there is no training data here. So:

- **Size** comes from counting footsteps. A storey is about twenty risers
  whichever way you are going, and that survives the per-step acceleration
  spikes that make the integral so noisy on stairs.
- **Direction** is reported as `"unknown"` unless the integral commits to a sign
  clearly enough to be worth having. Saying so is the point: it lets the caller
  ask instead of guessing and being wrong half the time.

## The route is the strongest signal, and it is not a sensor

When guidance has already said "take the lift to Level 3", the floor the walker
is heading for is known exactly. All the accelerometer has to establish is
**that** a vertical transit happened — a detection problem, not an estimation
one. `resolveFloorChange()` takes the route's pending `floorChange` and snaps to
it, which is why stair transits that cannot see their own direction still
resolve correctly for anybody actually following directions.

The route is trusted, but not blindly. Two checks can send it back to the raw
sensor reading:

- a **detected direction that contradicts the route** means they did not take
  the ride the route asked for, so the route no longer describes where they are;
- a **distance more than one storey off** what the route expected means they
  probably got out early. One storey of disagreement is ordinary estimator
  error and is allowed.

Sensors alone only have to carry the case where nobody is navigating, and there
the confidence score decides whether the app asserts or asks.

## What the walker sees

Never nothing. The floor decides which plan is drawn and where the route goes,
so a wrong guess applied silently leaves someone in a corridor that does not
match their screen with no idea why.

| detector says | app does |
| --- | --- |
| confident, or the route agrees | changes the floor, shows *Now on Level 3* with **Undo** |
| plausible but unproven | changes nothing, asks *Did you go up to Level 3?* |
| no honest conclusion | says nothing; the floor pills are already there |

Anything more trustworthy than the accelerometer resets the detector outright: a
scanned QR poster, a floor picked by hand, a change of venue.

## What still needs field data

The thresholds in `vertical-motion.ts` are derived from the physics and from
published gait figures, not from measurements taken in an NHS corridor. Two in
particular are worth revisiting with real traces:

- `STAIR_RMS`, which separates a staircase from a level corridor by vertical
  energy. Real distributions for the two overlap more than the constant implies.
- `DEFAULT_STEPS_PER_STOREY` and `DEFAULT_FLOOR_HEIGHT_M`, both estate-wide
  guesses. They vary by building, and a venue that knows better could carry its
  own.

The tests cover the model, not the tuning: they will catch a detector that has
stopped understanding what a lift ride looks like, and will not catch one whose
constants are wrong for a particular hospital. Collecting traces via the
existing `/api/signals` route — which already ingests passive evidence from
navigators — is the natural way to close that gap.
