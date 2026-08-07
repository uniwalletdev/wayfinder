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
import { classifyPdf, rankPages, scorePage, decodeEntities, canonicalUrl, CRAWLER_VERSION } from "./lib/discovery-match.mjs"
import { fetchSitemapUrls } from "./lib/sitemap.mjs"
import { dataPath, readJson, writeJson, updateManifest, log } from "./lib/paths.mjs"

const STAGE = "discover-plans"
const ORD_API = "https://directory.spineservices.nhs.uk/ORD/2-0-0/organisations"
const WEBSITE_CACHE = dataPath("trust-websites.json")
const MIN_PAUSE_MS = 1500
// Pages fetched per trust, across both hops. Six was too few and, worse, was
// spent on whichever nav links happened to come first in the markup.
const MAX_PAGES_PER_TRUST = 12
// Hospital maps are routinely two hops from the homepage — Salisbury's sits at
// /our-locations/our-locations, under a section landing page. One hop could
// never reach it.
const MAX_DEPTH = 2
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
  return res.text()
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

let sinceCheckpoint = 0
for (const [i, trust] of trusts.entries()) {
  if (crawled.has(trust.odsCode)) continue
  // Website lookups are cached: they change far less often than the maps do,
  // and re-asking ORD for 215 organisations every month is pointless load.
  if (!(trust.odsCode in websites)) {
    try {
      websites[trust.odsCode] = await websiteForTrust(trust.odsCode)
    } catch (err) {
      websites[trust.odsCode] = null
      console.warn(`[${STAGE}] ${trust.odsCode}: website lookup failed — ${err.message}`)
    }
    await sleep(500)
  }
  const origin = websites[trust.odsCode]
  if (!origin) {
    crawled.set(trust.odsCode, "no-website")
    // Log it. These used to `continue` before the progress line, so the run
    // printed [3] [4] [6] [7] and looked like it was skipping at random.
    log(STAGE, `[${i + 1}/${trusts.length}] ${trust.name} — no website recorded in ODS`)
    continue
  }

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
      // same document twice — a real run banked one map under two `?t=` values.
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
      crawled.set(trust.odsCode, "robots-blocked")
      log(STAGE, `[${i + 1}/${trusts.length}] ${trust.name} — robots.txt disallows crawling`)
      continue
    }

    const host = new URL(origin).host

    // Ask the site for its own index first. Where a sitemap exists this finds
    // pages — and often PDFs — that no amount of following navigation would
    // reach, for one or two requests instead of a dozen.
    const sitemapUrls = await fetchSitemapUrls(origin, { log: (m) => log(STAGE, m) })
    if (sitemapUrls.length) {
      via = "sitemap"
      collect(sitemapUrls.map((url) => ({ url, text: "", host })))
    }

    const home = await fetchHtml(origin)
    if (!home && !sitemapUrls.length) {
      crawled.set(trust.odsCode, "failed")
      log(STAGE, `[${i + 1}/${trusts.length}] ${trust.name} — homepage unreadable`)
      continue
    }
    visited.add(origin)

    const homeLinks = home ? extractLinks(home, origin) : []
    collect(homeLinks)

    // Seed the queue from the homepage's links and from any promising sitemap
    // URLs, ranked by how likely they are to hold a map rather than by the order
    // they happen to appear in the markup.
    const seeds = [
      ...homeLinks,
      ...sitemapUrls.filter((url) => scorePage("", url) > 0).map((url) => ({ url, text: "", host })),
    ]
    const queue = rankPages(seeds, { host, limit: MAX_PAGES_PER_TRUST }).map((p) => ({ ...p, depth: 1 }))

    let fetched = 0
    while (queue.length && fetched < MAX_PAGES_PER_TRUST) {
      const page = queue.shift()
      if (visited.has(page.url)) continue
      visited.add(page.url)
      await sleep(pause)
      fetched++
      try {
        const html = await fetchHtml(page.url)
        if (!html) continue
        const links = extractLinks(html, page.url)
        collect(links)

        // One more hop. Section landing pages ("Our locations") list the pages
        // that actually carry the maps, so stopping at depth 1 misses them.
        if (page.depth < MAX_DEPTH) {
          const next = rankPages(links, { host, limit: MAX_PAGES_PER_TRUST - fetched })
            .filter((l) => !visited.has(l.url) && l.score >= 8)
            .map((l) => ({ ...l, depth: page.depth + 1 }))
          queue.push(...next)
          // Best-scoring pages first regardless of which hop they came from.
          queue.sort((a, b) => b.score - a.score)
        }
      } catch {
        // A single dead sub-page is not worth failing the trust over.
      }
    }
  } catch (err) {
    // A Cloudflare interstitial ("Just a moment…") is a JavaScript challenge, not
    // a refusal we can talk our way past with headers — it needs a real browser.
    // Recording it separately keeps the failure count honest about what is a
    // transient problem and what is a wall.
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
  crawled.set(trust.odsCode, outcome)

  const high = [...found.values()].filter((c) => c.confidence === "high").length
  log(
    STAGE,
    `[${i + 1}/${trusts.length}] ${trust.name} — ${found.size} candidate(s)` +
      (high ? ` (${high} high)` : "") +
      ` [via ${via}]`
  )

  if (++sinceCheckpoint >= CHECKPOINT_EVERY) {
    writeCheckpoint()
    sinceCheckpoint = 0
    log(STAGE, `  … saved (${candidates.length} candidates so far)`)
  }
  await sleep(pause)
}

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
