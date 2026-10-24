// Find candidate floor-plan / site-map PDFs on hospital websites. Adapted
// from backup/legacy-world-pipeline's scripts/world/discover-plans.mjs — the
// crawl logic (robots.txt, sitemap discovery, link ranking, document
// classification) is unchanged; only the hospital list's source differs (see
// ./lib.mjs's hospitalsForCrawl, reading the real pipeline's
// data/world/hospitals/<CC>.json instead of its own separate OSM query).
//
// Run: node scripts/world/site-plans/discover.mjs --countries US,CA
import { fetchRetry, BROWSER_HEADERS } from "../../nhs/lib/net.mjs"
import { isAllowed, crawlDelayFor } from "../../nhs/lib/robots.mjs"
import { classifyDocument, rankPages, decodeEntities, canonicalUrl, CRAWLER_VERSION } from "../../nhs/lib/discovery-match.mjs"
import { fetchSitemapUrls } from "../../nhs/lib/sitemap.mjs"
import { dataPath, writeJson, log } from "../../nhs/lib/paths.mjs"
import { countriesFromArgs, hospitalsForCrawl } from "./lib.mjs"

const STAGE = "site-plans-discover"

// Same undici bug noted in the original: an uncaught exception from a socket
// event handler, not interceptable by a try/catch around fetch(), kills the
// whole process across enough requests to enough different servers.
process.on("uncaughtException", (err) => {
  console.error(`[${STAGE}] uncaught exception, continuing: ${err.stack || err}`)
})

const MIN_PAUSE_MS = 1500
const MAX_PAGES_PER_TRUST = 20
const MAX_DEPTH = 2
const MAX_SITEMAP_PAGES = 40
const RESERVED_FOR_DEEPER = 15
const SITE_CONCURRENCY = 6

const COUNTRIES = countriesFromArgs()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const LINK_RE = /<a\b[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi

function extractLinks(html, baseUrl) {
  const links = []
  for (const m of html.matchAll(LINK_RE)) {
    const text = decodeEntities(m[2].replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim())
    try {
      const url = new URL(decodeEntities(m[1]), baseUrl)
      url.hash = ""
      links.push({ url: url.href, text, host: url.host })
    } catch {
      // Relative junk, mailto:, javascript: — not a page we can fetch.
    }
  }
  return links
}

async function fetchHtml(url) {
  if (!(await isAllowed(url))) return null
  let res
  try {
    res = await fetchRetry(url, { headers: { accept: "text/html" } }, { retries: 1, timeoutMs: 30_000 })
  } catch (err) {
    res = await fetchRetry(
      url,
      { headers: { ...BROWSER_HEADERS, accept: "text/html,application/xhtml+xml" } },
      { retries: 1, timeoutMs: 30_000 }
    ).catch(() => {
      throw err
    })
  }
  const type = res.headers.get("content-type") ?? ""
  if (!/text\/html/i.test(type)) return null
  return { html: await res.text(), finalUrl: res.url || url }
}

function candidatesPath(countryCode) {
  return dataPath("world", `plan-candidates-${countryCode.toLowerCase()}.json`)
}

let candidatesForCountry = []

async function crawlHospital(hospital) {
  const origin = hospital.origin
  const pause = Math.max(MIN_PAUSE_MS, await crawlDelayFor(origin))
  const found = new Map()
  const visited = new Set()
  let outcome = "ok"
  let via = "links"

  const collect = (links) => {
    for (const link of links) {
      const signal = classifyDocument(link.text, link.url)
      if (!signal) continue
      const key = canonicalUrl(link.url)
      if (!found.has(key)) {
        found.set(key, {
          hospitalCode: hospital.code,
          hospitalName: hospital.name,
          countryCode: hospital.countryCode,
          website: origin,
          url: link.url,
          linkText: link.text.slice(0, 200),
          kind: signal.kind,
          confidence: signal.confidence,
          format: signal.format,
        })
      }
    }
  }

  try {
    if (!(await isAllowed(origin))) {
      return { outcome: "robots-blocked", found: 0, via: "-", note: "robots.txt disallows crawling" }
    }

    const home = await fetchHtml(origin)
    const effectiveOrigin = home ? new URL(home.finalUrl).origin : origin
    const host = new URL(effectiveOrigin).host

    const sitemapUrls = await fetchSitemapUrls(effectiveOrigin, { log: (m) => log(STAGE, m) })
    if (sitemapUrls.length) {
      via = "sitemap"
      collect(sitemapUrls.map((url) => ({ url, text: "", host })))
    }

    if (!home && !sitemapUrls.length) {
      return { outcome: "failed", found: 0, via: "-", note: "homepage unreadable" }
    }
    visited.add(origin)
    visited.add(effectiveOrigin)

    const homeLinks = home ? extractLinks(home.html, home.finalUrl) : []
    collect(homeLinks)

    const fromLinks = rankPages(homeLinks, { host, limit: MAX_PAGES_PER_TRUST })
    const fromSitemap = rankPages(
      sitemapUrls.map((url) => ({ url, text: "", host })),
      { host, limit: MAX_SITEMAP_PAGES }
    )
    const queue = [...fromLinks, ...fromSitemap]
      .filter((p, idx, all) => all.findIndex((o) => o.url === p.url) === idx)
      .map((p) => ({ ...p, depth: 1 }))

    const budget = MAX_PAGES_PER_TRUST + (sitemapUrls.length ? MAX_SITEMAP_PAGES : 0)
    const depthOneCap = Math.max(6, budget - RESERVED_FOR_DEEPER)

    let fetched = 0
    let fetchedAtDepthOne = 0
    while (queue.length && fetched < budget) {
      let index = 0
      if (fetchedAtDepthOne >= depthOneCap) {
        index = queue.findIndex((p) => p.depth > 1)
        if (index === -1) break
      }
      const [page] = queue.splice(index, 1)
      if (visited.has(page.url)) continue
      visited.add(page.url)
      await sleep(pause)
      fetched++
      if (page.depth === 1) fetchedAtDepthOne++
      try {
        const page_ = await fetchHtml(page.url)
        if (!page_) continue
        const links = extractLinks(page_.html, page_.finalUrl)
        collect(links)

        if (page.depth < MAX_DEPTH) {
          const next = rankPages(links, { host, limit: budget })
            .filter((l) => !visited.has(l.url) && l.score >= 8)
            .map((l) => ({ ...l, score: l.score + 3, depth: page.depth + 1 }))
          queue.push(...next)
          queue.sort((a, b) => b.score - a.score)
        }
      } catch {
        // A single dead sub-page is not worth failing the hospital over.
      }
    }
  } catch (err) {
    const challenged = /just a moment|cf-browser-verification|challenge-platform|attention required/i.test(err.message ?? "")
    outcome = challenged ? "bot-challenge" : "failed"
    console.warn(
      `[${STAGE}] ${hospital.code} (${hospital.name}): ` +
        (challenged
          ? "blocked by a bot challenge (needs a real browser) — skipping"
          : `crawl failed — ${err.message}`)
    )
  }

  if (found.size) candidatesForCountry.push(...found.values())
  return { outcome, found: found.size, via, high: [...found.values()].filter((c) => c.confidence === "high").length }
}

async function runCountry(countryCode) {
  const hospitals = hospitalsForCrawl(countryCode)
  log(STAGE, `${countryCode}: ${hospitals.length} hospital(s) with a usable website`)
  if (!hospitals.length) return

  candidatesForCountry = []
  const crawled = new Map()

  async function worker(queue) {
    for (const { hospital, index } of queue) {
      const result = await crawlHospital(hospital)
      crawled.set(hospital.code, result.outcome)
      log(
        STAGE,
        `${countryCode} [${index + 1}/${hospitals.length}] ${hospital.name} — ` +
          (result.note ?? `${result.found} candidate(s)${result.high ? ` (${result.high} high)` : ""} [via ${result.via}]`)
      )
    }
  }

  const queues = Array.from({ length: SITE_CONCURRENCY }, () => [])
  hospitals.forEach((hospital, i) => {
    queues[i % SITE_CONCURRENCY].push({ hospital, index: i })
  })
  await Promise.all(queues.map(worker))

  const unique = new Map()
  for (const c of candidatesForCountry) {
    const key = canonicalUrl(c.url)
    if (!unique.has(key)) unique.set(key, c)
  }
  const order = { high: 0, medium: 1, low: 2 }
  const kindOrder = { "floor-plan": 0, "site-map": 1, directory: 2, unknown: 3 }
  const sorted = [...unique.values()].sort(
    (a, b) =>
      (kindOrder[a.kind] ?? 9) - (kindOrder[b.kind] ?? 9) ||
      order[a.confidence] - order[b.confidence] ||
      a.hospitalName.localeCompare(b.hospitalName)
  )
  writeJson(candidatesPath(countryCode), {
    generatedAt: new Date().toISOString(),
    countryCode,
    crawlerVersion: CRAWLER_VERSION,
    count: sorted.length,
    crawled: Object.fromEntries([...crawled.entries()].sort()),
    candidates: sorted,
  })

  const high = sorted.filter((c) => c.confidence === "high").length
  const botChallenged = [...crawled.values()].filter((o) => o === "bot-challenge").length
  const robotsBlocked = [...crawled.values()].filter((o) => o === "robots-blocked").length
  const crawlFailed = [...crawled.values()].filter((o) => o === "failed").length
  log(STAGE, `${countryCode}: ${sorted.length} candidates — high confidence: ${high}`)
  log(STAGE, `${countryCode}: bot-challenged: ${botChallenged}, robots-blocked: ${robotsBlocked}, failed: ${crawlFailed}`)
}

for (const countryCode of COUNTRIES) {
  await runCountry(countryCode)
}
log(STAGE, "done")
