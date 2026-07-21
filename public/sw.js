// Offline support for Wayfinder.
//
// The point of this file is a specific, concrete failure: someone deep inside a
// building with no signal, trying to find a ward — GOSH's Level 6 Octav Botnar
// Wing is the example that prompted it, but this applies to every mapped venue.
// Hospitals are exactly where phone reception dies and exactly where wayfinding
// matters most, so the core journey has to survive losing the network.
//
// This is NOT a full offline app, deliberately. Nothing is precached — pages and
// floor plans are cached as they are visited. So a venue you have opened at
// least once while online stays usable when the signal drops, and one you have
// never opened does not. That trades a little coverage for a much smaller,
// simpler worker and no download forced on install.
//
// Strategy:
//   * /api/* and Clerk     — never cached. Auth and writes must always be live;
//                            a stale session or replayed POST is worse than an
//                            honest failure.
//   * navigations          — network-first, falling back to whatever has been
//                            cached, so a reachable network always wins but
//                            losing it mid-visit doesn't blank the screen.
//   * static + floor plans — cache-first with background revalidate. These are
//                            content-hashed or regenerated wholesale, so a
//                            slightly stale copy is harmless and instant.

const VERSION = "wayfinder-v1"
const SHELL_CACHE = `${VERSION}-shell`
const ASSET_CACHE = `${VERSION}-assets`

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))
      await self.clients.claim()
    })()
  )
})

function isAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/floorplans/") ||
    /\.(?:css|js|woff2?|ttf|svg|png|jpe?g|webp|gif|ico)$/.test(url.pathname)
  )
}

// Anything that must stay live: writes, auth, and Clerk's own traffic.
function isNeverCached(url) {
  return (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/__clerk/") ||
    url.hostname.includes("clerk.")
  )
}

self.addEventListener("fetch", (event) => {
  const req = event.request
  if (req.method !== "GET") return

  const url = new URL(req.url)
  if (isNeverCached(url)) return

  // Cross-origin (map tiles, Clerk, fonts served elsewhere) is left to the
  // browser — caching third-party responses opaquely wastes quota and can pin
  // stale tiles.
  if (url.origin !== self.location.origin) return

  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req)
          const cache = await caches.open(SHELL_CACHE)
          cache.put(req, fresh.clone())
          return fresh
        } catch {
          // Offline: this exact page, then the wayfinding shell, then the root.
          return (
            (await caches.match(req)) ||
            (await caches.match("/navigate")) ||
            (await caches.match("/")) ||
            Response.error()
          )
        }
      })()
    )
    return
  }

  if (isAsset(url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req)
        if (cached) {
          // Refresh in the background so the next load is current, but never
          // make the user wait on it.
          event.waitUntil(
            (async () => {
              try {
                const fresh = await fetch(req)
                const cache = await caches.open(ASSET_CACHE)
                await cache.put(req, fresh)
              } catch {
                /* offline — the cached copy stands */
              }
            })()
          )
          return cached
        }
        try {
          const fresh = await fetch(req)
          const cache = await caches.open(ASSET_CACHE)
          cache.put(req, fresh.clone())
          return fresh
        } catch {
          return Response.error()
        }
      })()
    )
  }
})
