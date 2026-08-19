"use client"

// One devicemotion subscription, shared.
//
// Two features read the accelerometer now — dead-reckoning counts footsteps to
// carry the position forward (use-pedestrian-position), and floor detection
// watches the vertical channel for lift rides and stairs (use-vertical-motion).
// Left to themselves each would run its own permission dance and its own window
// listener, which on iOS means two permission prompts racing out of a single
// tap. Neither is a thing the app should be doing twice, so both go through
// here: one prompt, one listener, however many readers.

type Handler = (event: DeviceMotionEvent) => void

type PermissionCapableCtor = typeof DeviceMotionEvent & {
  requestPermission?: () => Promise<"granted" | "denied" | "default">
}

const handlers = new Set<Handler>()
let attached = false
// The in-flight (or settled) permission request, so simultaneous callers from
// the same tap await one prompt instead of queueing several.
let permission: Promise<boolean> | null = null

function dispatch(event: DeviceMotionEvent) {
  // A throwing reader must not silence the others, and there is nothing useful
  // to do about it here — this is a sensor feed, not a request path.
  handlers.forEach((h) => {
    try {
      h(event)
    } catch {}
  })
}

function attach() {
  if (attached || typeof window === "undefined") return
  attached = true
  window.addEventListener("devicemotion", dispatch)
}

/**
 * Ask for motion access. Safe and cheap to call repeatedly — the prompt only
 * ever appears once. iOS 13+ gates the sensor behind a permission request that
 * must originate in a user gesture, so callers invoke this from a tap.
 * Resolves true when samples will flow.
 */
export function enableDeviceMotion(): Promise<boolean> {
  if (permission) return permission
  permission = (async () => {
    if (typeof window === "undefined") return false
    const Ctor = window.DeviceMotionEvent as PermissionCapableCtor | undefined
    if (!Ctor) return false
    try {
      if (typeof Ctor.requestPermission === "function") {
        if ((await Ctor.requestPermission()) !== "granted") return false
      }
    } catch {
      return false
    }
    attach()
    return true
  })()
  // A denial is not permanent — the walker may grant it on a later tap — so
  // don't cache a false and lock the app out of ever asking again.
  void permission.then((ok) => {
    if (!ok) permission = null
  })
  return permission
}

/** Subscribe to motion samples. Returns the unsubscribe function. */
export function onDeviceMotion(handler: Handler): () => void {
  handlers.add(handler)
  // Subscribing before the prompt is answered is normal — a hook mounts long
  // before the walker taps anything — and costs nothing: attach() has not run,
  // so no samples arrive until access is granted.
  return () => {
    handlers.delete(handler)
  }
}
