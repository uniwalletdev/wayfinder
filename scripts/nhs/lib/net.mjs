// HTTP for the NHS ingestion pipeline.
//
// Everything here runs in CI (or on a laptop), never in the app — the Next.js
// runtime must not depend on any of these hosts being reachable. Two upstreams
// we hit are rate-limited and occasionally flaky (postcodes.io in bulk, and
// Overpass, which will happily return 429 for minutes at a time), so every
// request goes through one retry policy rather than each stage inventing its own.
//
// Note for local runs behind an HTTP proxy: Node's built-in fetch ignores
// HTTPS_PROXY unless you run with NODE_USE_ENV_PROXY=1 (Node >= 22.21). CI has
// direct egress so it doesn't need it.
import { createHash } from "crypto"

// Retry on transport errors and on the status codes that mean "later, not never".
// 4xx other than 429 are permanent — a wrong URL should fail on the first try
// rather than after a minute of backoff.
const RETRY_STATUS = new Set([408, 425, 429, 500, 502, 503, 504])

// An honest, identifiable agent is the right default for the APIs and the trust
// websites we crawl — it tells an administrator who we are.
export const USER_AGENT =
  "wayfinder-nhs-ingest/1.0 (+https://github.com/uniwalletdev/wayfinder)"

// The exception is NHS Digital's bulk-download host, which sits behind a CDN
// that refuses anything not shaped like a browser: it answers 403 to the agent
// above while the Spine directory API, on the same network, answers 200. These
// headers are what a browser sends when following a download link, which is
// exactly what this request is.
export const BROWSER_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  accept: "application/zip,application/octet-stream,*/*;q=0.8",
  "accept-language": "en-GB,en;q=0.9",
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex")
}

// Overpass and postcodes.io both send Retry-After on 429. Honour it when it's
// present and sane, otherwise fall back to exponential backoff. Capped at 60s so
// a wedged upstream can't stall a CI job indefinitely.
function retryDelayMs(res, attempt, baseMs) {
  const header = res?.headers?.get("retry-after")
  if (header) {
    const secs = Number(header)
    if (Number.isFinite(secs) && secs >= 0) return Math.min(secs * 1000, 60_000)
    const at = Date.parse(header)
    if (Number.isFinite(at)) return Math.min(Math.max(at - Date.now(), 0), 60_000)
  }
  return Math.min(baseMs * 2 ** attempt, 60_000)
}

export async function fetchRetry(url, options = {}, { retries = 4, baseMs = 1000, timeoutMs = 120_000 } = {}) {
  let lastErr
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(retryDelayMs(lastErr?.res, attempt - 1, baseMs))
    // Each attempt gets its own timeout — a hung socket shouldn't consume the
    // whole retry budget.
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), timeoutMs)
    try {
      const res = await fetch(url, {
        ...options,
        signal: ac.signal,
        headers: { "user-agent": USER_AGENT, ...(options.headers ?? {}) },
      })
      if (res.ok) return res
      if (!RETRY_STATUS.has(res.status)) {
        throw new Error(`${options.method ?? "GET"} ${url} -> HTTP ${res.status} ${res.statusText}`)
      }
      lastErr = Object.assign(new Error(`HTTP ${res.status} from ${url}`), { res })
      // Drain the body so the socket can be reused on the retry.
      await res.arrayBuffer().catch(() => {})
    } catch (err) {
      if (err?.res) lastErr = err
      else if (err?.name === "AbortError") lastErr = new Error(`timeout after ${timeoutMs}ms: ${url}`)
      else lastErr = err
      // A non-retryable HTTP status was thrown above; don't spend the budget on it.
      if (!lastErr?.res && /-> HTTP \d/.test(lastErr?.message ?? "")) throw lastErr
    } finally {
      clearTimeout(timer)
    }
  }
  throw new Error(`giving up on ${url} after ${retries + 1} attempts: ${lastErr?.message ?? "unknown"}`)
}

// Download to a Buffer and hash it in one pass. The hash goes into the manifest
// so a later run can tell "the source genuinely changed" from "we re-downloaded
// the same bytes", which is what keeps the generated data reviewable.
export async function fetchBuffer(url, options) {
  const res = await fetchRetry(url, options)
  const buf = Buffer.from(await res.arrayBuffer())
  return { buf, sha256: sha256(buf), contentType: res.headers.get("content-type") ?? "" }
}

// Download a file, retrying once as a browser if the host refuses us.
//
// Worth the extra attempt rather than failing straight to the API fallback: when
// a CDN is doing nothing more than User-Agent filtering, this gets the real
// published file, which is the better source.
export async function fetchFile(url, options = {}) {
  try {
    return await fetchBuffer(url, options)
  } catch (err) {
    if (!/-> HTTP (403|401|429)\b/.test(err.message ?? "")) throw err
    return fetchBuffer(url, { ...options, headers: { ...BROWSER_HEADERS, ...(options.headers ?? {}) } })
  }
}

export async function fetchJson(url, options) {
  const res = await fetchRetry(url, options)
  return res.json()
}
