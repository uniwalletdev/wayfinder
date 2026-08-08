// Stage 6 — find candidate site-map and floor-plan PDFs on trust websites.
//
// THE HONEST PART OF THIS PIPELINE. There is no national dataset of NHS indoor
// floor plans. Sites, coordinates and building outlines all automate to full
// national coverage; interiors do not, because each trust publishes its own maps
// as PDFs on its own website, in its own layout, under its own copyright.
//
// So this stage does not import anything. It produces a TRIAGE QUEUE —
// data/plan-candidates.json — listing what it found and how confident it is.
// A human decides what to actually use, and stage 7 downloads only those. That
// boundary is deliberate: trust site maps are the trusts' copyright, not open
// data, and auto-ingesting them across all of England is not a decision a script
// should be making.
//
// Trust websites come from the ODS ORD API, which exposes each organisation's
// contacts including its website — so even this doesn't require a hand-kept list.
//
// A full run takes hours, so it checkpoints as it goes and a re-run resumes from
// where it stopped. Interrupting it is safe.
//
// Run: node scripts/nhs/discover-plans.mjs [--limit N] [--restart] [--retry-failed]
import { fetchRetry, BROWSER_HEADERS } from "./lib/net.mjs"
import { isAllowed, crawlDelayFor } from "./lib/robots.mjs"
import { loadOdsRecords } from "./lib/sites.mjs"
import { classifyPdf, rankPages, decodeEntities, canonicalUrl, CRAWLER_VERSION } from "./lib/discovery-match.mjs"
import { fetchSitemapUrls } from "./lib/sitemap.mjs"
import { dataPath, readJson, writeJson, updateManifest, log } from "./lib/paths.mjs"

const STAGE = "discover-plans"
const ORD_API = "https://directory.spineservices.nhs.uk/ORD/2-0-0/organisations"
const WEBSITE_CACHE = dataPath("trust-websites.json")
const MIN_PAUSE_MS = 1500
// Pages fetched per trust, across both hops. Six was too few and, worse, was
// spent on whichever nav links happened to come first in the markup.
const MAX_PAGES_PER_TRUST = 20
// Hospital maps are routinely two hops from the homepage — Sunderland Royal's
// sits at /our-locations/our-locations, under a section landing page. One hop
// could never reach it.
const MAX_DEPTH = 2
// A separate allowance for pages the sitemap pointed at, so they never compete
// with the homepage's own navigation for slots.
const MAX_SITEMAP_PAGES = 40
// Fetches held back for the second hop. The maps that matter sit under a section
// page rather than on it, so the deeper pass must be guaranteed a share.
const RESERVED_FOR_DEEPER = 15
// How many trusts to crawl at once. Politeness is per host and these are 247
// different hosts, so this costs no site any extra load — it just stops the
// wall clock being the reason the page budget has to be small.
const TRUST_CONCURRENCY = 6
// Every ten trusts is roughly every few minutes of crawling — often enough that
// an interruption costs almost nothing, rare enough not to thrash the disk.
const CHECKPOINT_EVERY = 10

const limitArg = process.argv.indexOf("--limit")
const LIMIT = limitArg > -1 ? Number(process.argv[limitArg + 1]) : Infinity
const RESTART = process.argv.includes("--restart")
const RETRY_FAILED = process.argv.includes("--retry-failed")

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Which links are worth following and which PDFs are worth keeping now lives in
// lib/discovery-match.mjs, where it can be tested without a network. The old
// patterns matched on raw hrefs, so "SRH_Map_update.pdf" was invisible: `_` is a
// word character, leaving no boundary around "Map".

// Deliberately regex-based rather than a DOM parser: this repo has no HTML
// parsing dependency, and all we need is href plus link text. Malformed markup
// costs us a missed candidate, which a human reviewing the queue can live with.
const LINK_RE = /<a\b[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi

function extractLinks(html, baseUrl) {
  const links = []
  for (const m of html.matchAll(LINK_RE)) {
    const text = decodeEntities(m[2].replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim())
    try {
      // Decode entities before parsing. An href written as
      // "…?ver=42880&amp;doc=…" is a corrupt query string once taken literally,
      // and a real run produced four such URLs — every one of which would have
      // 404'd at download time, long after the crawl looked successful.
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
    // Several trust sites refuse or reset a request that doesn't look like a
    // browser — the same filtering that blocked the ODS download host. Worth one
    // more attempt before writing the whole trust off.
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
  // The final URL matters as much as the body: a trust recorded in ODS under one
  // domain may redirect to another, and its sitemap will list the new one. Read
  // through the redirect and everything downstream agrees on which host this is.
  return { html: await res.text(), finalUrl: res.url || url }
}

// The ORD API gives per-organisation detail including contact records; a website
// arrives as a contact of type "http".
async function websiteForTrust(code) {
  const res = await fetchRetry(`${ORD_API}/${encodeURIComponent(code)}`, { headers: { accept: "application/json" } }, { retries: 2, timeoutMs: 30_000 })
  const body = await res.json()
  const contacts = body?.Organisation?.Contacts?.Contact ?? []
  const site = contacts.find((c) => String(c?.type).toLowerCase() === "http")?.value
  if (!site) return null
  try {
    return new URL(/^https?:\/\//i.test(site) ? site : `https://${site}`).origin
  } catch {
    return null
  }
}

const trusts = loadOdsRecords("etr").slice(0, LIMIT === Infinity ? undefined : LIMIT)

const websites = readJson(WEBSITE_CACHE, {})
// Hosts recorded by hand where the ODS one has gone stale. See
// data/trust-website-overrides.json for what belongs in there and why.
const overrideOrigins = Object.fromEntries(
  Object.entries(readJson(dataPath("trust-website-overrides.json"), { overrides: {} }).overrides ?? {})
    .map(([code, entry]) => [code, entry?.websites ?? []])
)
let candidates = []
// ODS code -> how the crawl of that trust ended. Resuming skips anything already
// recorded here, so an interrupted run continues rather than starting over.
const crawled = new Map()

// A full run visits ~215 trusts at a deliberately polite pace and takes hours.
// Writing the results only at the end would mean a dropped connection, a closed
// window or a sleeping laptop at trust 180 threw away all of it — so state goes
// to disk as we go, and a re-run picks up where it stopped.
if (!RESTART) {
  const prior = readJson(dataPath("plan-candidates.json"))
  if (prior?.candidates && (prior.crawlerVersion ?? 1) !== CRAWLER_VERSION) {
    log(
      STAGE,
      `previous results came from crawler v${prior.crawlerVersion ?? 1}, this is v${CRAWLER_VERSION} — ` +
        `re-crawling so the improvements actually apply (previous candidates are kept)`
    )
    // Keep what was found; discard the "already visited" marks so every trust is
    // looked at again. Duplicates are collapsed on canonical URL below.
    //
    // Re-classify as they are loaded: a trust that fails on the re-crawl would
    // otherwise keep its old label for good, and the labels are the whole point
    // — the previous version called five indoor floor plans "site-map".
    candidates = prior.candidates.map((c) => {
      const url = decodeEntities(c.url)
      const signal = classifyPdf(decodeEntities(c.linkText ?? ""), url)
      return signal ? { ...c, url, kind: signal.kind, confidence: signal.confidence } : { ...c, url }
    })
  } else if (prior?.candidates) {
    candidates = prior.candidates
    for (const [code, outcome] of Object.entries(prior.crawled ?? {})) {
      // A failed trust is usually a site that was down or too slow. Keep it
      // marked so a resume converges instead of retrying forever, unless the
      // run explicitly asks for another go at them.
      if (RETRY_FAILED && outcome === "failed") continue
      crawled.set(code, outcome)
    }
    log(STAGE, `resuming — ${candidates.length} candidate(s) and ${crawled.size} trust(s) already done`)
  }
}

const remaining = trusts.filter((t) => !crawled.has(t.odsCode))
log(STAGE, `${trusts.length} trusts in scope, ${remaining.length} still to crawl`)
if (remaining.length > 100) {
  log(STAGE, "this will take a few hours — it honours every site's robots.txt and crawl delay")
  log(STAGE, "safe to interrupt: re-run the same command and it continues from here")
}

// Outcomes are counted from `crawled` rather than incremented as we go, so the
// totals stay correct across any number of resumed runs.
function summarise() {
  const stats = { noWebsite: 0, crawlFailed: 0, botChallenged: 0, robotsBlocked: 0, withCandidates: 0, crawled: crawled.size }
  for (const outcome of crawled.values()) {
    if (outcome === "no-website") stats.noWebsite++
    else if (outcome === "robots-blocked") stats.robotsBlocked++
    else if (outcome === "bot-challenge") stats.botChallenged++
    else if (outcome === "failed") stats.crawlFailed++
  }
  stats.withCandidates = new Set(candidates.map((c) => c.trustCode)).size
  return stats
}

function writeCheckpoint() {
  // Collapse on the canonical URL. A re-crawl re-finds what the previous run
  // already banked, and trust CMSs hand out the same document under different
  // cache-busting parameters, so without this the list grows copies.
  const unique = new Map()
  for (const c of candidates) {
    const key = canonicalUrl(c.url)
    if (!unique.has(key)) unique.set(key, c)
  }
  candidates = [...unique.values()]

  // Indoor plans first: they are what the app actually needs and the rarest
  // thing the crawl finds, so they should be at the top of the queue to triage.
  const order = { high: 0, medium: 1, low: 2 }
  const kindOrder = { "floor-plan": 0, "site-map": 1, directory: 2, unknown: 3 }
  const sorted = [...candidates].sort(
    (a, b) =>
      (kindOrder[a.kind] ?? 9) - (kindOrder[b.kind] ?? 9) ||
      order[a.confidence] - order[b.confidence] ||
      a.trustName.localeCompare(b.trustName)
  )
  writeJson(WEBSITE_CACHE, Object.fromEntries(Object.keys(websites).sort().map((k) => [k, websites[k]])))
  writeJson(dataPath("plan-candidates.json"), {
    generatedAt: new Date().toISOString(),
    description:
      "Candidate site-map / floor-plan PDFs found on NHS trust websites. THIS IS A TRIAGE QUEUE, NOT AN IMPORT LIST. " +
      "These PDFs are the trusts' copyright. scripts/nhs/approve-plans.mjs promotes eligible entries into " +
      "data/plan-sources.json, which is the only list scripts/nhs/fetch-plans.mjs will download.",
    // Which crawler produced this. A later version re-crawls rather than
    // resuming, so improvements to matching actually reach the results.
    crawlerVersion: CRAWLER_VERSION,
    stats: summarise(),
    count: candidates.length,
    // Which trusts have been visited, so an interrupted run can resume.
    crawled: Object.fromEntries([...crawled.entries()].sort()),
    candidates: sorted,
  })
  return sorted
}

// One trust, start to finish. Returns how it ended; the caller records it.
//
// Per-trust work stays strictly sequential with its pause, so a single site
// never sees more than one request per MIN_PAUSE_MS however many trusts run at
// once.
async function crawlTrust(trust) {
  if (!(trust.odsCode in websites)) {
    try {
      websites[trust.odsCode] = await websiteForTrust(trust.odsCode)
    } catch (err) {
      websites[trust.odsCode] = null
      console.warn(`[${STAGE}] ${trust.odsCode}: website lookup failed — ${err.message}`)
    }
    await sleep(500)
  }
  // A hand-recorded host wins over the one ODS holds. ODS keeps a trust's old
  // address after it rebrands, and a dead address is worth nothing: Tameside's
  // recorded site stopped answering while its live one carried the map all
  // along. Where there is no override this is exactly the ODS value.
  const origin = overrideOrigins[trust.odsCode]?.[0] ?? websites[trust.odsCode]
  if (!origin) return { outcome: "no-website", found: 0, via: "-", note: "no website recorded in ODS" }

  const pause = Math.max(MIN_PAUSE_MS, await crawlDelayFor(origin))
  const found = new Map()
  const visited = new Set()
  let outcome = "ok"
  let via = "links"

  const collect = (links) => {
    for (const link of links) {
      if (!/\.pdf(\?|$)/i.test(link.url)) continue
      const signal = classifyPdf(link.text, link.url)
      if (!signal) continue
      // Key on the canonical URL so a cache-busting parameter can't present the
      // same document twice.
      const key = canonicalUrl(link.url)
      if (!found.has(key)) {
        found.set(key, {
          trustCode: trust.odsCode,
          trustName: trust.name,
          url: link.url,
          linkText: link.text.slice(0, 200),
          kind: signal.kind,
          confidence: signal.confidence,
        })
      }
    }
  }

  try {
    if (!(await isAllowed(origin))) {
      return { outcome: "robots-blocked", found: 0, via: "-", note: "robots.txt disallows crawling" }
    }

    // Load the homepage first, because it settles which host this trust really
    // is. Solent is recorded in ODS under one domain and serves its sitemap
    // listing another; comparing against the ODS host discarded all 424 of its
    // URLs and the crawl quietly fell back to following links.
    const home = await fetchHtml(origin)
    const effectiveOrigin = home ? new URL(home.finalUrl).origin : origin
    const host = new URL(effectiveOrigin).host
    if (effectiveOrigin !== origin) {
      log(STAGE, `  ${trust.odsCode}: redirects to ${host}`)
    }

    // Ask the site for its own index. Where a sitemap exists it finds pages —
    // and often PDFs — that no amount of following navigation reaches.
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

    // Two separate budgets. Pooling them let hundreds of sitemap entries crowd
    // out the homepage's own navigation, and trusts whose maps had been found
    // via links started returning nothing.
    const fromLinks = rankPages(homeLinks, { host, limit: MAX_PAGES_PER_TRUST })
    const fromSitemap = rankPages(
      sitemapUrls.map((url) => ({ url, text: "", host })),
      { host, limit: MAX_SITEMAP_PAGES }
    )
    const queue = [...fromLinks, ...fromSitemap]
      .filter((p, idx, all) => all.findIndex((o) => o.url === p.url) === idx)
      .map((p) => ({ ...p, depth: 1 }))

    const budget = MAX_PAGES_PER_TRUST + (sitemapUrls.length ? MAX_SITEMAP_PAGES : 0)
    // Slots the first hop may not touch, so the second hop can happen at all.
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
            // A child of a page we already rated highly is a more targeted lead
            // than an untried seed, so it outranks one of equal raw score.
            .map((l) => ({ ...l, score: l.score + 3, depth: page.depth + 1 }))
          queue.push(...next)
          queue.sort((a, b) => b.score - a.score)
        }
      } catch {
        // A single dead sub-page is not worth failing the trust over.
      }
    }
  } catch (err) {
    // A Cloudflare interstitial ("Just a moment…") is a JavaScript challenge, not
    // a refusal headers can talk past — it needs a real browser. Recording it
    // separately keeps the failure count honest.
    const challenged = /just a moment|cf-browser-verification|challenge-platform|attention required/i.test(err.message ?? "")
    outcome = challenged ? "bot-challenge" : "failed"
    console.warn(
      `[${STAGE}] ${trust.odsCode} (${trust.name}): ` +
        (challenged
          ? "blocked by a bot challenge (needs a real browser) — skipping"
          : `crawl failed — ${err.message}`)
    )
  }

  if (found.size) candidates.push(...found.values())
  return { outcome, found: found.size, via, high: [...found.values()].filter((c) => c.confidence === "high").length }
}

// Crawl several trusts at once.
//
// This is what makes a useful page budget affordable. Politeness is per host,
// and these are 247 different hosts, so running a handful concurrently leaves
// every individual site at one request per pause while cutting the wall clock by
// the same factor. Tuning the budget downwards to save time was solving the
// wrong problem — and each downward tweak lost a trust that the previous one had
// found.
// Maps added by hand, for the sites a crawler cannot reach.
//
// Some trusts sit behind a JavaScript bot challenge; some build their navigation
// in script; and on a site with thousands of pages a single map page can lose
// the ranking no matter how it is tuned. Six revisions failed to reach
// Sunderland Royal's, so rather than keep adjusting heuristics against one
// example it is recorded in data/known-maps.json and merged here. approve-plans
// still applies its own rules to these, so this gets a URL reviewed rather than
// around review.
const knownMaps = readJson(dataPath("known-maps.json"), { maps: [] }).maps ?? []
let knownAdded = 0
for (const entry of knownMaps) {
  if (!entry?.url) continue
  const url = decodeEntities(entry.url)
  const signal = classifyPdf(decodeEntities(entry.linkText ?? ""), url)
  if (!signal) {
    console.warn(`[${STAGE}] known map does not look like a map, skipping: ${url}`)
    continue
  }
  const key = canonicalUrl(url)
  if (candidates.some((c) => canonicalUrl(c.url) === key)) continue
  candidates.push({
    trustCode: entry.trustCode ?? null,
    trustName: entry.trustName ?? "(added by hand)",
    url,
    linkText: entry.linkText ?? "",
    kind: signal.kind,
    confidence: signal.confidence,
    addedByHand: true,
  })
  knownAdded++
}
if (knownAdded) log(STAGE, `${knownAdded} map(s) added from data/known-maps.json`)

const pending = trusts.filter((t) => !crawled.has(t.odsCode))
let completed = 0
let sinceCheckpoint = 0

async function worker(queue) {
  for (const { trust, index } of queue) {
    const result = await crawlTrust(trust)
    crawled.set(trust.odsCode, result.outcome)
    completed++

    log(
      STAGE,
      `[${index + 1}/${trusts.length}] ${trust.name} — ` +
        (result.note ?? `${result.found} candidate(s)${result.high ? ` (${result.high} high)` : ""} [via ${result.via}]`)
    )

    if (++sinceCheckpoint >= CHECKPOINT_EVERY) {
      sinceCheckpoint = 0
      writeCheckpoint()
      log(STAGE, `  … saved (${completed}/${pending.length} trusts, ${candidates.length} candidates so far)`)
    }
  }
}

// Deal trusts round-robin so the workers finish at roughly the same time.
const queues = Array.from({ length: TRUST_CONCURRENCY }, () => [])
pending.forEach((trust, i) => {
  queues[i % TRUST_CONCURRENCY].push({ trust, index: trusts.indexOf(trust) })
})
await Promise.all(queues.map(worker))

const sorted = writeCheckpoint()
const stats = summarise()

updateManifest("plans.candidates", {
  description: "Floor-plan PDF discovery queue",
  trustsInScope: trusts.length,
  candidates: sorted.length,
  ...stats,
})

const high = sorted.filter((c) => c.confidence === "high").length
const floorPlans = sorted.filter((c) => c.kind === "floor-plan").length
log(STAGE, `${sorted.length} candidates across ${stats.withCandidates} trusts`)
log(STAGE, `high confidence: ${high} (of which ${floorPlans} look like indoor floor plans)`)
log(
  STAGE,
  `no website: ${stats.noWebsite}, crawl failed: ${stats.crawlFailed}, ` +
    `bot-challenged: ${stats.botChallenged}, robots-blocked: ${stats.robotsBlocked}`
)
if (stats.botChallenged) {
  log(STAGE, `${stats.botChallenged} trust(s) sit behind a JavaScript bot challenge — those need a browser, not a fix here`)
}
if (stats.crawlFailed) {
  log(STAGE, `re-run with --retry-failed to have another go at the ${stats.crawlFailed} that failed`)
}
log(STAGE, "done — next: node scripts/nhs/approve-plans.mjs --dry-run")
