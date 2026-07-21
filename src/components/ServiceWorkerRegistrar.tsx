"use client"

// Registers public/sw.js, which is what lets wayfinding keep working when the
// signal dies inside a building. See that file for the caching strategy.
//
// Production only. In development a service worker serves stale JS chunks after
// an edit, which looks exactly like a broken hot reload and wastes a lot of time
// before anyone suspects the cache.

import { useEffect } from "react"

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return
    if (!("serviceWorker" in navigator)) return

    // Wait for load so registration never competes with first paint.
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // A failed registration costs offline support, nothing else. The app is
        // fully usable online, so this must never surface to a navigator.
      })
    }

    if (document.readyState === "complete") register()
    else {
      window.addEventListener("load", register)
      return () => window.removeEventListener("load", register)
    }
  }, [])

  return null
}
