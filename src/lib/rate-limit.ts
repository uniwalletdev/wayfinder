// Abuse protection for the endpoints that cost real money.
//
// /api/parse-plan sends an uploaded image to Claude's vision model, and
// /api/geocode and /api/directions both call Mapbox. All three were reachable by
// anyone who knew the URL, with no auth and no limit — so a trivial loop could
// run up an unbounded bill. REVIEW.md flagged this as high priority.
//
// ── What this is, and what it is NOT ────────────────────────────────────────
// This is an in-memory fixed window, per server instance. On Vercel that means
// it resets on cold start and is not shared between concurrent instances, so the
// effective limit under fan-out is (limit × instances). It genuinely stops the
// realistic threat — one script hammering one endpoint — but it is NOT a durable
// quota. If spend needs a hard ceiling, that wants Redis (Upstash) or the
// provider's own budget caps, which are the real backstop: set spend limits in
// the Anthropic and Mapbox consoles regardless of anything in this file.
//
// It fails OPEN. If anything here throws, the request is allowed through. A bug
// in rate limiting must never be what stops someone navigating a hospital.

interface Window {
  count: number
  resetAt: number
}

const buckets = new Map<string, Window>()

// Keep the map from growing without bound on a long-lived instance. Cheap: only
// runs when the map is already large, and only walks expired entries.
const MAX_KEYS = 10_000
function prune(now: number) {
  if (buckets.size < MAX_KEYS) return
  for (const [k, w] of buckets) if (w.resetAt <= now) buckets.delete(k)
}

/**
 * Identify the caller. Behind Vercel/Railway the client IP is the FIRST entry in
 * x-forwarded-for; the rest are proxies. Falls back to a shared bucket when no
 * header is present (local dev), which is fine — it only makes limiting stricter.
 */
export function callerKey(request: Request): string {
  const xff = request.headers.get("x-forwarded-for")
  if (xff) return xff.split(",")[0]!.trim()
  return request.headers.get("x-real-ip")?.trim() || "unknown"
}

/**
 * Fixed-window limiter. Returns null when the request may proceed, or a ready-to
 * -return 429 Response when it may not.
 *
 * @param scope  namespaces the bucket so one endpoint's traffic can't exhaust
 *               another's — "parse-plan" and "geocode" have very different costs
 */
export function rateLimit(
  request: Request,
  scope: string,
  limit: number,
  windowMs: number
): Response | null {
  try {
    const now = Date.now()
    prune(now)
    const key = `${scope}:${callerKey(request)}`
    const w = buckets.get(key)

    if (!w || w.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs })
      return null
    }
    if (w.count < limit) {
      w.count++
      return null
    }

    const retryAfter = Math.max(1, Math.ceil((w.resetAt - now) / 1000))
    return Response.json(
      { error: "rate_limited", message: "Too many requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    )
  } catch {
    // Fail open — see the header comment.
    return null
  }
}

// Per-endpoint budgets. Geocode and directions are on the normal navigation path
// and are set generously so a real person searching and re-routing never trips
// them; the LLM routes are deliberate, occasional mapping actions whose per-call
// cost is orders of magnitude higher, so they are much tighter.
export const LIMITS = {
  parsePlan: { limit: 10, windowMs: 60 * 60 * 1000 }, // 10/hour
  // Survey Mode calls this repeatedly while someone walks a building, so it
  // cannot be as tight as parse-plan without breaking the core mapping flow —
  // but each call is claude-opus-4-8 over 8 frames with adaptive thinking, so it
  // still needs a ceiling. Tune this if real mapping sessions hit it.
  survey: { limit: 20, windowMs: 60 * 60 * 1000 }, // 20/hour
  geocode: { limit: 60, windowMs: 60 * 1000 }, // 60/min
  directions: { limit: 60, windowMs: 60 * 1000 }, // 60/min
  // Venue writes are unauthenticated, and POST /api/venues defaults to
  // visibility:"public" — so without a ceiling an anonymous loop can inject spam
  // straight into the directory every user sees. Generous enough for a real
  // mapper working through a site.
  venueCreate: { limit: 20, windowMs: 60 * 60 * 1000 }, // 20/hour
  venueWrite: { limit: 120, windowMs: 60 * 60 * 1000 }, // 120/hour
} as const

// ── Request body caps ───────────────────────────────────────────────────────
// `await request.json()` buffers the whole body before any validation runs, so
// an oversized POST is a memory-exhaustion vector regardless of how well the
// parsed value is then checked. App Router handlers have no default limit (the
// old Pages `api` routes had 1 MB), so each route must cap for itself.
//
// /api/signals established this pattern; these are the same idea applied
// uniformly. Read as text first, check the length, then parse.

// NOTE: Next.js 16 already imposes a GLOBAL 10 MB ceiling. When a proxy is
// active — and src/proxy.ts is, for Clerk — Next buffers the request body so it
// can be read twice, capping that buffer at `proxyClientMaxBodySize` (default
// 10 MB). Past that it silently truncates and logs a warning, so the handler
// sees malformed JSON rather than an oversized body. Every value here must
// therefore stay UNDER 10 MB to mean anything; a larger cap is dead code that
// turns a clean 413 into a confusing 400.
export const BODY_LIMITS = {
  // 8 frames of base64-encoded JPEG from a phone camera — roughly 3 MB in
  // practice, so this leaves headroom while staying below Next's 10 MB.
  survey: 8 * 1024 * 1024,
  // Up to MAX_WAYPOINTS (500) waypoint objects.
  waypoints: 512 * 1024,
  // A venue is a name, subtitle, category and a centre point.
  venue: 16 * 1024,
  // A venue key plus a search string.
  searchMiss: 8 * 1024,
} as const

export type CappedBody<T> =
  | { ok: true; body: T }
  | { ok: false; reason: "too_large" | "bad_json" }

/**
 * Read and parse a JSON body, rejecting anything over `maxBytes` before parsing.
 * Returns a discriminated result rather than throwing or returning a Response,
 * so each route keeps its own error shape — they differ deliberately (some
 * return `{ ok: false }`, some `{ configured: true, error }`).
 */
export async function readCappedJson<T>(request: Request, maxBytes: number): Promise<CappedBody<T>> {
  let text: string
  try {
    text = await request.text()
  } catch {
    return { ok: false, reason: "bad_json" }
  }
  if (text.length > maxBytes) return { ok: false, reason: "too_large" }
  try {
    return { ok: true, body: JSON.parse(text) as T }
  } catch {
    return { ok: false, reason: "bad_json" }
  }
}
