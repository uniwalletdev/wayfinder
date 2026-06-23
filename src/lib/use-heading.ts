"use client"

import { useCallback, useEffect, useRef, useState } from "react"

// Reads the device's compass heading so the map can show which way the user is
// facing — the single biggest cue for "where am I and which way am I going"
// indoors, where GPS alone can't tell you your orientation.
//
// Heading is degrees clockwise from north (0 = north, 90 = east). iOS exposes it
// directly as `webkitCompassHeading`; elsewhere we derive it from an absolute
// orientation event's alpha. iOS 13+ also gates the sensor behind an explicit
// permission prompt that must be triggered from a user gesture, so the caller
// invokes `enable()` from a tap (e.g. Start navigation).

type OrientationEvent = DeviceOrientationEvent & { webkitCompassHeading?: number }
type PermissionCapableCtor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied" | "default">
}

// Shortest signed angular difference a→b, in (-180, 180]. Lets us smooth across
// the 360°/0° wrap without the cone snapping all the way around.
function angleDelta(a: number, b: number): number {
  return ((((b - a) % 360) + 540) % 360) - 180
}

export function useDeviceHeading() {
  const [heading, setHeading] = useState<number | null>(null)
  const enabledRef = useRef(false)
  const smoothRef = useRef<number | null>(null)

  const handle = useCallback((event: Event) => {
    const e = event as OrientationEvent
    let raw: number | null = null
    if (typeof e.webkitCompassHeading === "number" && !Number.isNaN(e.webkitCompassHeading)) {
      raw = e.webkitCompassHeading
    } else if (e.absolute && typeof e.alpha === "number") {
      // alpha increases counter-clockwise, so flip it to a clockwise compass bearing.
      raw = (360 - e.alpha) % 360
    }
    if (raw == null) return
    // Light exponential smoothing (wrap-aware) so the on-screen cone glides
    // instead of jittering with raw magnetometer noise.
    const prev = smoothRef.current
    const next = prev == null ? raw : (prev + angleDelta(prev, raw) * 0.2 + 360) % 360
    smoothRef.current = next
    setHeading(next)
  }, [])

  const enable = useCallback(async () => {
    if (enabledRef.current || typeof window === "undefined") return
    const Ctor = window.DeviceOrientationEvent as PermissionCapableCtor | undefined
    if (!Ctor) return
    try {
      if (typeof Ctor.requestPermission === "function") {
        const result = await Ctor.requestPermission()
        if (result !== "granted") return
      }
    } catch {
      // Permission call can throw if not triggered by a gesture — fail quietly
      // and leave heading off rather than breaking navigation.
      return
    }
    enabledRef.current = true
    window.addEventListener("deviceorientationabsolute", handle, true)
    window.addEventListener("deviceorientation", handle, true)
  }, [handle])

  useEffect(() => {
    return () => {
      if (typeof window === "undefined") return
      window.removeEventListener("deviceorientationabsolute", handle, true)
      window.removeEventListener("deviceorientation", handle, true)
    }
  }, [handle])

  return { heading, enable }
}
