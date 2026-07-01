"use client"

import { useEffect, useState } from "react"

// Whether this device can run immersive WebXR AR — i.e. it has a real
// SLAM-tracked camera pose we can pin world anchors to (Android Chrome with
// ARCore, some XR browsers). Desktops and today's iOS Safari return false, and
// the caller falls back to the compass-based AR overlay.
//
// null = still checking, true/false = known.
export function useArSupport(): boolean | null {
  const [supported, setSupported] = useState<boolean | null>(null)

  useEffect(() => {
    let active = true
    const xr = typeof navigator !== "undefined" ? navigator.xr : undefined
    if (!xr || typeof xr.isSessionSupported !== "function") {
      // One-time feature detection, not a render-driving state loop.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSupported(false)
      return
    }
    xr.isSessionSupported("immersive-ar")
      .then((ok) => { if (active) setSupported(ok) })
      .catch(() => { if (active) setSupported(false) })
    return () => { active = false }
  }, [])

  return supported
}
