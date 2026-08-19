"use client"

// Footstep detection from raw accelerometer magnitude.
//
// A stride shows up as an acceleration-magnitude peak above the ~9.8 m/s²
// gravity baseline. Fire on the upward crossing with hysteresis and a
// refractory gap so one footfall counts once rather than chattering across the
// noisy shoulder of the peak.
//
// This lives on its own because two features now need the same definition of
// "a step": dead-reckoning moves the position estimate one stride per step
// (use-pedestrian-position), and stair detection counts steps to work out how
// many storeys were climbed (vertical-motion). Two copies of these thresholds
// would drift apart, and a stride that counts for one feature but not the other
// would be a genuinely confusing bug to chase.

export const STEP_PEAK = 12.5
export const STEP_RESET = 10.2
export const STEP_MIN_INTERVAL_MS = 280

export class StepCounter {
  // Whether the magnitude has fallen back below STEP_RESET since the last peak.
  // Without this a single footfall whose peak is bumpy counts several times.
  private armed = true
  private lastStepAt = 0

  /**
   * Feed one accelerometer sample. `magnitude` is |accelerationIncludingGravity|
   * in m/s². Returns true on the sample that completes a step.
   */
  push(magnitude: number, now: number): boolean {
    if (magnitude < STEP_RESET) {
      this.armed = true
      return false
    }
    if (!this.armed || magnitude < STEP_PEAK || now - this.lastStepAt < STEP_MIN_INTERVAL_MS) {
      return false
    }
    this.armed = false
    this.lastStepAt = now
    return true
  }

  reset(): void {
    this.armed = true
    this.lastStepAt = 0
  }
}
