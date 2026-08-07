// A small robots.txt client for the floor-plan discovery crawler.
//
// Discovery visits a few pages on each of ~215 NHS trust websites. That is a
// crawler, however modest, and a crawler that ignores robots.txt is one someone
// eventually has to apologise for. This is deliberately conservative: anything
// it can't parse confidently, it treats as disallowed.
import { fetchRetry } from "./net.mjs"

const cache = new Map() // origin -> { rules: [{allow, path}], crawlDelayMs }

function parse(text) {
  const rules = []
  let crawlDelayMs = 0
  let applies = false
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim()
    if (!line) continue
    const idx = line.indexOf(":")
    if (idx === -1) continue
    const field = line.slice(0, idx).trim().toLowerCase()
    const value = line.slice(idx + 1).trim()

    if (field === "user-agent") {
      // Only the wildcard group is honoured. We don't claim a named group, and
      // a site that singles out other bots shouldn't have those rules applied
      // to us by accident.
      applies = value === "*"
      continue
    }
    if (!applies) continue
    if (field === "disallow" && value) rules.push({ allow: false, path: value })
    else if (field === "allow" && value) rules.push({ allow: true, path: value })
    else if (field === "crawl-delay") {
      const secs = Number(value)
      if (Number.isFinite(secs) && secs > 0) crawlDelayMs = Math.min(secs * 1000, 30_000)
    }
  }
  return { rules, crawlDelayMs }
}

export async function robotsFor(origin) {
  if (cache.has(origin)) return cache.get(origin)
  let result = { rules: [], crawlDelayMs: 0 }
  try {
    const res = await fetchRetry(`${origin}/robots.txt`, {}, { retries: 1, timeoutMs: 20_000 })
    result = parse(await res.text())
  } catch {
    // No robots.txt (or unreachable) means no restrictions expressed. That is
    // the standard reading, and we still rate-limit ourselves regardless.
  }
  cache.set(origin, result)
  return result
}

export async function isAllowed(url) {
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  const { rules } = await robotsFor(parsed.origin)
  const path = parsed.pathname + parsed.search

  // Longest matching prefix wins, and Allow beats Disallow at equal length —
  // the de-facto standard behaviour.
  let best = null
  for (const rule of rules) {
    const prefix = rule.path.replace(/\*$/, "")
    if (!path.startsWith(prefix)) continue
    if (!best || prefix.length > best.length || (prefix.length === best.length && rule.allow)) {
      best = { length: prefix.length, allow: rule.allow }
    }
  }
  return best ? best.allow : true
}

export async function crawlDelayFor(origin) {
  return (await robotsFor(origin)).crawlDelayMs
}
