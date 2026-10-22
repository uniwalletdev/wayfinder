// Stage W1 — find candidate site-map / floor-plan PDFs on hospital websites
// outside NHS England.
//
// Same approach as scripts/nhs/discover-plans.mjs, reusing its matching,
// robots.txt and sitemap logic unchanged, but keyed off OpenStreetMap's
// amenity=hospital + website records (lib/osm.mjs) instead of the NHS ORD
// directory — there is no national API once you leave England. This produces
// a TRIAGE QUEUE, not an import list: see approve-plans.mjs in this directory
// for what actually gets promoted.
//
// Run: node scripts/world/discover-plans.mjs --country US [--limit N] [--restart] [--retry-failed]
import { fetchRetry, BROWSER_HEADERS } from "../nhs/lib/net.mjs"
import { isAllowed, crawlDelayFor } from "../nhs/lib/robots.mjs"
import { classifyDocument, rankPages, decodeEntities, canonicalUrl, CRAWLER_VERSION } from "../nhs/lib/discovery-match.mjs"
import { fetchSitemapUrls } from "../nhs/lib/sitemap.mjs"
import { dataPath, readJson, writeJson, updateManifest, log } from "../nhs/lib/paths.mjs"
import { loadOrFetchHospitals, countriesFromArgs } from "./lib/osm.mjs"

const STAGE = "world-discover"

// Node's built-in fetch (undici) has a known crash: a socket that ends while
// its HTTP parser is paused trips `assert(!this.paused)` inside undici itself,
// as an uncaught exception that kills the whole process — not something a
// try/catch around an individual request can intercept, since it fires from
// a socket event handler, not from the fetch() promise chain. Across
// thousands of requests to thousands of different servers, over a long run,
// this reliably eventually happens. One flaky request should not take down a
// crawl that has otherwise visited hundreds of hospitals cleanly, so this
// logs it and keeps going rather than letting the default behaviour (crash)
// stand.
process.on("uncaughtException", (err) => {
  console.error(`[${STAGE}] uncaught exception, continuing: ${err.stack || err}`)
})

const MIN_PAUSE_MS = 1500
const MAX_PAGES_PER_TRUST = 20
const MAX_DEPTH = 2
const MAX_SITEMAP_PAGES = 40
const RESERVED_FOR_DEEPER = 15
const SITE_CONCURRENCY = 6
// Checkpointing every 3 rather than every 10 shrinks how much work the next
// crash (see above) or external interruption throws away.
const CHECKPOINT_EVERY = 3

const COUNTRIES = countriesFromArgs()
const limitArg = process.argv.indexOf("--limit")
const LIMIT = limitArg > -1 ? Number(process.argv[limitArg + 1]) : Infinity
const RESTART = process.argv.includes("--restart")
const RETRY_FAILED = process.argv.includes("--retry-failed")
const REFRESH_HOSPITALS = process.argv.includes("--refresh-hospitals")

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

let candidatesForCountry = []

async function runCountry(countryCode) {
  const hospitals = (await loadOrFetchHospitals(countryCode, { refresh: REFRESH_HOSPITALS })).slice(
    0,
    LIMIT === Infinity ? undefined : LIMIT
  )
  log(STAGE, `${countryCode}: ${hospitals.length} hospital(s) in scope`)

  candidatesForCountry = []
  const crawled = new Map()
  const path = candidatesPath(countryCode)

  if (!RESTART) {
    const prior = readJson(path)
    if (prior?.candidates && (prior.crawlerVersion ?? 1) !== CRAWLER_VERSION) {
      log(STAGE, `${countryCode}: previous results came from crawler v${prior.crawlerVersion ?? 1}, this is v${CRAWLER_VERSION} — re-crawling`)
      candidatesForCountry = prior.candidates.map((c) => {
        const url = decodeEntities(c.url)
        const signal = classifyDocument(decodeEntities(c.linkText ?? ""), url)
        return signal ? { ...c, url, kind: signal.kind, confidence: signal.confidence, format: signal.format } : { ...c, url }
      })
    } else if (prior?.candidates) {
      candidatesForCountry = prior.candidates
      for (const [code, outcome] of Object.entries(prior.crawled ?? {})) {
        if (RETRY_FAILED && outcome === "failed") continue
        crawled.set(code, outcome)
      }
      log(STAGE, `${countryCode}: resuming — ${candidatesForCountry.length} candidate(s), ${crawled.size} hospital(s) already done`)
    }
  }

  function summarise() {
    const stats = { crawlFailed: 0, botChallenged: 0, robotsBlocked: 0, withCandidates: 0, crawled: crawled.size }
    for (const outcome of crawled.values()) {
      if (outcome === "robots-blocked") stats.robotsBlocked++
      else if (outcome === "bot-challenge") stats.botChallenged++
      else if (outcome === "failed") stats.crawlFailed++
    }
    stats.withCandidates = new Set(candidatesForCountry.map((c) => c.hospitalCode)).size
    return stats
  }

  function writeCheckpoint() {
    const unique = new Map()
    for (const c of candidatesForCountry) {
      const key = canonicalUrl(c.url)
      if (!unique.has(key)) unique.set(key, c)
    }
    candidatesForCountry = [...unique.values()]

    const order = { high: 0, medium: 1, low: 2 }
    const kindOrder = { "floor-plan": 0, "site-map": 1, directory: 2, unknown: 3 }
    const sorted = [...candidatesForCountry].sort(
      (a, b) =>
        (kindOrder[a.kind] ?? 9) - (kindOrder[b.kind] ?? 9) ||
        order[a.confidence] - order[b.confidence] ||
        a.hospitalName.localeCompare(b.hospitalName)
    )
    writeJson(path, {
      generatedAt: new Date().toISOString(),
      countryCode,
      description:
        "Candidate site-map / floor-plan PDFs found on hospital websites via OpenStreetMap's amenity=hospital " +
        "directory. THIS IS A TRIAGE QUEUE. approve-plans.mjs in this directory promotes eligible entries into " +
        "data/world/plan-sources-<cc>.json, which is the only list fetch-plans.mjs will download.",
      crawlerVersion: CRAWLER_VERSION,
      stats: summarise(),
      count: candidatesForCountry.length,
      crawled: Object.fromEntries([...crawled.entries()].sort()),
      candidates: sorted,
    })
    return sorted
  }

  const pending = hospitals.filter((h) => !crawled.has(h.code))
  log(STAGE, `${countryCode}: ${pending.length} still to crawl`)
  if (pending.length > 100) {
    log(STAGE, `${countryCode}: this will take a while — it honours every site's robots.txt and crawl delay; safe to interrupt and resume`)
  }

  let completed = 0
  let sinceCheckpoint = 0

  async function worker(queue) {
    for (const { hospital, index } of queue) {
      const result = await crawlHospital(hospital)
      crawled.set(hospital.code, result.outcome)
      completed++
      log(
        STAGE,
        `${countryCode} [${index + 1}/${hospitals.length}] ${hospital.name} — ` +
          (result.note ?? `${result.found} candidate(s)${result.high ? ` (${result.high} high)` : ""} [via ${result.via}]`)
      )
      if (++sinceCheckpoint >= CHECKPOINT_EVERY) {
        sinceCheckpoint = 0
        writeCheckpoint()
        log(STAGE, `  … saved (${completed}/${pending.length}, ${candidatesForCountry.length} candidates so far)`)
      }
    }
  }

  const queues = Array.from({ length: SITE_CONCURRENCY }, () => [])
  pending.forEach((hospital, i) => {
    queues[i % SITE_CONCURRENCY].push({ hospital, index: hospitals.indexOf(hospital) })
  })
  await Promise.all(queues.map(worker))

  const sorted = writeCheckpoint()
  const stats = summarise()
  updateManifest(`world.plans.candidates.${countryCode.toLowerCase()}`, {
    description: `Floor-plan PDF discovery queue — ${countryCode}`,
    hospitalsInScope: hospitals.length,
    candidates: sorted.length,
    ...stats,
  })

  const high = sorted.filter((c) => c.confidence === "high").length
  const floorPlans = sorted.filter((c) => c.kind === "floor-plan").length
  log(STAGE, `${countryCode}: ${sorted.length} candidates — high confidence: ${high} (${floorPlans} look like indoor floor plans)`)
  log(STAGE, `${countryCode}: bot-challenged: ${stats.botChallenged}, robots-blocked: ${stats.robotsBlocked}, failed: ${stats.crawlFailed}`)
}

for (const countryCode of COUNTRIES) {
  await runCountry(countryCode)
}
log(STAGE, `done — next: node scripts/world/approve-plans.mjs --country <CC>`)
