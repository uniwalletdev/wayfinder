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
// them; parse-plan is a deliberate, occasional mapping action whose per-call cost
// is orders of magnitude higher, so it is much tighter.
export const LIMITS = {
  parsePlan: { limit: 10, windowMs: 60 * 60 * 1000 }, // 10/hour
  geocode: { limit: 60, windowMs: 60 * 1000 }, // 60/min
  directions: { limit: 60, windowMs: 60 * 1000 }, // 60/min
} as const
