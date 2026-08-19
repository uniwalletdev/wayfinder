"use client"

import { useCallback, useEffect, useRef } from "react"
import { enableDeviceMotion, onDeviceMotion } from "./device-motion"
import { VerticalMotionDetector, type VerticalTransit } from "./vertical-motion"

// React wrapper around the accelerometer floor detector in vertical-motion.ts.
// The detector is a plain class with no React in it so it can be driven by
// recorded sensor traces in tests; this hook only feeds it samples and calls
// back when it finds something.
//
// Deliberately callback-driven rather than state-driven. A transit is an event
// — one lift ride, once — and holding it in state would mean an effect to
// notice it, another to clear it, and a window in which a re-render could apply
// the same ride twice. Publishing the detector's moment-to-moment activity as
// state would be worse still: it changes many times a second, and this hook is
// mounted in the component that owns the map, so every change would re-render
// the whole map tree to describe something nobody is looking at.

export function useVerticalMotion({
  onTransit,
  floorHeightM,
}: {
  /** Called once per completed lift ride or stair climb. */
  onTransit?: (transit: VerticalTransit) => void
  /** Floor-to-floor height, if the venue knows better than the default. */
  floorHeightM?: number
} = {}) {
  const detectorRef = useRef<VerticalMotionDetector | null>(null)
  if (detectorRef.current === null) {
    detectorRef.current = new VerticalMotionDetector({ floorHeightM })
  }

  // Held in a ref so a caller need not memoise its callback to avoid tearing
  // down the sensor subscription on every render.
  const onTransitRef = useRef(onTransit)
  useEffect(() => {
    onTransitRef.current = onTransit
  })

  const onMotion = useCallback((e: DeviceMotionEvent) => {
    const acc = e.accelerationIncludingGravity
    const detector = detectorRef.current
    if (!acc || !detector) return

    // Some browsers put a timestamp on the event and some do not, and those
    // that do disagree about its epoch. Date.now() is the one clock every
    // device shares, and the detector only ever uses differences.
    const transit = detector.push({ t: Date.now(), x: acc.x ?? 0, y: acc.y ?? 0, z: acc.z ?? 0 })
    if (transit) onTransitRef.current?.(transit)
  }, [])

  useEffect(() => onDeviceMotion(onMotion), [onMotion])

  /**
   * Ask for motion access. Shared with dead-reckoning via device-motion.ts, so
   * whichever feature unlocks it first unlocks it for both.
   */
  const enable = useCallback(() => enableDeviceMotion(), [])

  /**
   * Drop everything in flight. Used when something more trustworthy than the
   * accelerometer says where the walker is — a scanned QR poster, a floor
   * picked by hand, a different building — because a half-integrated ride from
   * before that is worse than no reading at all.
   */
  const reset = useCallback(() => detectorRef.current?.reset(), [])

  return { enable, reset }
}
