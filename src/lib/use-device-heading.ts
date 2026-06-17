"use client"

import { useCallback, useEffect, useRef, useState } from "react"

// Reading the phone's compass is unavoidably platform-specific:
//
//  • iOS Safari exposes a ready-made `webkitCompassHeading` (degrees clockwise
//    from true north) on the `deviceorientation` event, but only after the user
//    grants motion access via `DeviceOrientationEvent.requestPermission()` —
//    which must be called from a tap.
//  • Android/Chrome has no permission gate but no `webkitCompassHeading`; we
//    derive the heading from the absolute `alpha` angle instead.
//
// This hook hides that split behind a single `heading` (0–359°, or null when
// unavailable) plus an `enableCompass()` to call from a user gesture on iOS.

type Permission = "unknown" | "granted" | "denied" | "unsupported"

interface DeviceOrientationEventiOS extends DeviceOrientationEvent {
  webkitCompassHeading?: number
}

interface DeviceOrientationEventCtoriOS {
  requestPermission?: () => Promise<"granted" | "denied">
}

function screenAngle(): number {
  if (typeof window === "undefined") return 0
  const o = window.screen?.orientation
  return typeof o?.angle === "number" ? o.angle : 0
}

export function useDeviceHeading() {
  const [heading, setHeading] = useState<number | null>(null)
  const [permission, setPermission] = useState<Permission>("unknown")
  const listeningRef = useRef(false)

  const onOrientation = useCallback((e: DeviceOrientationEvent) => {
    const iosHeading = (e as DeviceOrientationEventiOS).webkitCompassHeading
    let raw: number | null = null

    if (typeof iosHeading === "number" && !Number.isNaN(iosHeading)) {
      // Already a compass heading, clockwise from north.
      raw = iosHeading
    } else if (e.absolute && typeof e.alpha === "number") {
      // `alpha` is counter-clockwise from north, so invert it.
      raw = 360 - e.alpha
    }

    if (raw === null) return
    // The sensor reports relative to the device's natural orientation; fold in
    // the current screen rotation so the arrow stays true in landscape too.
    const h = ((raw + screenAngle()) % 360 + 360) % 360
    setHeading(h)
  }, [])

  const start = useCallback(() => {
    if (listeningRef.current || typeof window === "undefined") return
    listeningRef.current = true
    // `deviceorientationabsolute` carries true-north data where supported
    // (Chrome); `deviceorientation` is the fallback and the iOS path.
    window.addEventListener("deviceorientationabsolute", onOrientation as EventListener)
    window.addEventListener("deviceorientation", onOrientation as EventListener)
  }, [onOrientation])

  const enableCompass = useCallback(async () => {
    if (typeof window === "undefined") return
    const Ctor = window.DeviceOrientationEvent as unknown as DeviceOrientationEventCtoriOS | undefined
    if (!Ctor) {
      setPermission("unsupported")
      return
    }
    if (typeof Ctor.requestPermission === "function") {
      try {
        const res = await Ctor.requestPermission()
        setPermission(res)
        if (res === "granted") start()
      } catch {
        setPermission("denied")
      }
    } else {
      // No permission gate (Android/desktop) — just begin listening.
      setPermission("granted")
      start()
    }
  }, [start])

  useEffect(() => {
    if (typeof window === "undefined") return
    const Ctor = window.DeviceOrientationEvent as unknown as DeviceOrientationEventCtoriOS | undefined
    if (!Ctor) {
      setPermission("unsupported")
      return
    }
    // Where no explicit grant is required, start listening immediately so the
    // arrow appears without any extra tap.
    if (typeof Ctor.requestPermission !== "function") {
      setPermission("granted")
      start()
    }
    return () => {
      window.removeEventListener("deviceorientationabsolute", onOrientation as EventListener)
      window.removeEventListener("deviceorientation", onOrientation as EventListener)
      listeningRef.current = false
    }
  }, [start, onOrientation])

  return { heading, permission, enableCompass }
}
