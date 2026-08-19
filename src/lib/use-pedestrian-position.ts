"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Coordinates } from "./types"
import { enableDeviceMotion, onDeviceMotion } from "./device-motion"
import { StepCounter } from "./step-counter"

// Pedestrian dead-reckoning (PDR) for indoor positioning, where GPS is useless.
//
// The idea: anchor on a trusted fix (a QR "scan to locate me", or an accurate
// outdoor GPS fix), then carry the position forward by counting footsteps from
// the accelerometer and stepping along the live compass heading. Each detected
// step advances the estimate by one stride; a fresh trusted fix re-anchors and
// clears the accumulated drift.
//
// Sources feed in via setAnchor(); the fused estimate comes out as `position`.
// When the motion sensor isn't enabled (or no heading is available) the estimate
// simply stays at the last anchor — i.e. it degrades to the old GPS/QR behaviour.

export type FixSource = "gps" | "qr" | "demo"

interface Anchor {
  position: Coordinates
  source: FixSource
}

interface Fix {
  position: Coordinates
  accuracy: number // metres; pass 0 for the demo fix
  source: FixSource
}

// Average human stride. Good enough for corridor-scale indoor legs; a future
// improvement is to estimate it per-user from step cadence.
const STEP_LENGTH_M = 0.72
// Re-anchor to GPS only when it's at least this accurate. Indoor GPS is far
// worse, so it's ignored and dead-reckoning carries the position instead.
const GPS_ANCHOR_MAX_ACCURACY_M = 18

const M_PER_LAT = 111320

export function usePedestrianPosition(heading: number | null) {
  const [position, setPosition] = useState<Coordinates | null>(null)
  const [accuracy, setAccuracy] = useState(0)
  const [source, setSource] = useState<FixSource | null>(null)

  const anchorRef = useRef<Anchor | null>(null)
  // Displacement accumulated from the anchor since it was set, in metres
  // (x = east, y = north).
  const offsetRef = useRef({ x: 0, y: 0 })
  const headingRef = useRef<number | null>(heading)
  headingRef.current = heading

  // Step detection is shared with floor detection so both features agree on
  // what a stride is — see step-counter.ts.
  const stepsRef = useRef(new StepCounter())

  const recompute = useCallback(() => {
    const a = anchorRef.current
    if (!a) return
    const { x, y } = offsetRef.current
    const mPerLng = M_PER_LAT * Math.cos((a.position.lat * Math.PI) / 180)
    setPosition({
      lat: a.position.lat + y / M_PER_LAT,
      lng: a.position.lng + x / mPerLng,
    })
  }, [])

  // Accept a fresh trusted fix as the new anchor and clear the dead-reckoning
  // offset. QR and demo are always trusted; GPS only when it's accurate enough
  // (and a poor fix is ignored once we already have an anchor to carry forward).
  const setAnchor = useCallback((fix: Fix) => {
    const current = anchorRef.current
    if (fix.source === "gps" && current) {
      // A demo fix is the user deliberately saying "treat me as being there"
      // (GPS denied, or previewing a route at a venue they haven't reached
      // yet) — background GPS fixes must not yank the position back to
      // wherever their body actually is. A QR scan, being another deliberate
      // act, still re-anchors over it.
      if (current.source === "demo") return
      if (fix.accuracy > GPS_ANCHOR_MAX_ACCURACY_M) return
    }
    anchorRef.current = { position: fix.position, source: fix.source }
    offsetRef.current = { x: 0, y: 0 }
    setAccuracy(fix.source === "qr" ? 1 : fix.accuracy)
    setSource(fix.source)
    setPosition(fix.position)
  }, [])

  const onMotion = useCallback(
    (e: DeviceMotionEvent) => {
      const acc = e.accelerationIncludingGravity
      if (!acc) return
      const mag = Math.hypot(acc.x ?? 0, acc.y ?? 0, acc.z ?? 0)
      if (!stepsRef.current.push(mag, Date.now())) return

      // A step only moves the estimate when we know which way it's pointing and
      // have something to move from.
      const h = headingRef.current
      if (h == null || !anchorRef.current) return
      const rad = (h * Math.PI) / 180
      offsetRef.current.x += STEP_LENGTH_M * Math.sin(rad)
      offsetRef.current.y += STEP_LENGTH_M * Math.cos(rad)
      recompute()
    },
    [recompute]
  )

  // Permission-gated on iOS and must be triggered from a user gesture, like the
  // compass — the caller unlocks both together from a tap. The prompt itself is
  // owned by device-motion.ts, so asking twice costs nothing.
  const enableMotion = useCallback(() => enableDeviceMotion(), [])

  useEffect(() => onDeviceMotion(onMotion), [onMotion])

  return { position, accuracy, source, setAnchor, enableMotion }
}
