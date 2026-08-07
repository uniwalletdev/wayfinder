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
// Run: node scripts/nhs/discover-plans.mjs [--limit N]
import { fetchRetry } from "./lib/net.mjs"
import { isAllowed, crawlDelayFor } from "./lib/robots.mjs"
import { loadOdsRecords } from "./lib/sites.mjs"
import { dataPath, readJson, writeJson, updateManifest, log } from "./lib/paths.mjs"

const STAGE = "discover-plans"
const ORD_API = "https://directory.spineservices.nhs.uk/ORD/2-0-0/organisations"
const WEBSITE_CACHE = dataPath("trust-websites.json")
const MIN_PAUSE_MS = 1500
const MAX_PAGES_PER_TRUST = 6

const limitArg = process.argv.indexOf("--limit")
const LIMIT = limitArg > -1 ? Number(process.argv[limitArg + 1]) : Infinity

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// A link is worth following if it looks like the part of a hospital website
// where a map would live.
const NAV_PAGE = /getting[- ]here|how[- ]to[- ]find|find[- ]us|visiting|visitor|your[- ]visit|contact|location|travel|patient[- ]information|our[- ]hospitals|site[- ]map/i

// A PDF is a candidate if its link text or filename says so. Ordered by how
// specific the signal is — that ordering becomes the confidence score.
const PDF_SIGNALS = [
  { re: /floor[- ]?plan/i, confidence: "high", kind: "floor-plan" },
  { re: /site[- ]?map|campus[- ]?map|hospital[- ]?map/i, confidence: "high", kind: "site-map" },
  { re: /\bmap\b.*\b(hospital|site|campus|ward|department)\b|\b(hospital|site|campus)\b.*\bmap\b/i, confidence: "medium", kind: "site-map" },
  { re: /ward[- ]?(map|guide|directory)|department[- ]?(map|directory)/i, confidence: "medium", kind: "directory" },
  { re: /\bmap\b/i, confidence: "low", kind: "unknown" },
]

function classify(text, href) {
  const haystack = `${text} ${decodeURIComponent(href)}`
  for (const signal of PDF_SIGNALS) {
    if (signal.re.test(haystack)) return signal
  }
  return null
}

// Deliberately regex-based rather than a DOM parser: this repo has no HTML
// parsing dependency, and all we need is href plus link text. Malformed markup
// costs us a missed candidate, which a human reviewing the queue can live with.
const LINK_RE = /<a\b[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi

function extractLinks(html, baseUrl) {
  const links = []
  for (const m of html.matchAll(LINK_RE)) {
    const text = m[2].replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
    try {
      const url = new URL(m[1], baseUrl)
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
  const res = await fetchRetry(url, { headers: { accept: "text/html" } }, { retries: 1, timeoutMs: 30_000 })
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
log(STAGE, `${trusts.length} trusts to check`)

const websites = readJson(WEBSITE_CACHE, {})
const candidates = []
const stats = { noWebsite: 0, crawlFailed: 0, robotsBlocked: 0, withCandidates: 0 }

for (const [i, trust] of trusts.entries()) {
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
  if (!origin) { stats.noWebsite++; continue }

  const pause = Math.max(MIN_PAUSE_MS, await crawlDelayFor(origin))
  const found = new Map()
  const visited = new Set()

  try {
    if (!(await isAllowed(origin))) { stats.robotsBlocked++; continue }
    const home = await fetchHtml(origin)
    if (!home) { stats.crawlFailed++; continue }
    visited.add(origin)

    const homeLinks = extractLinks(home, origin)
    // Same-host only. Following a trust's link to a third-party site would turn
    // a polite two-page visit into an unbounded crawl of the internet.
    const host = new URL(origin).host
    const toVisit = homeLinks
      .filter((l) => l.host === host && !/\.pdf(\?|$)/i.test(l.url) && NAV_PAGE.test(`${l.text} ${l.url}`))
      .slice(0, MAX_PAGES_PER_TRUST)

    const collect = (links) => {
      for (const link of links) {
        if (!/\.pdf(\?|$)/i.test(link.url)) continue
        const signal = classify(link.text, link.url)
        if (!signal) continue
        if (!found.has(link.url)) {
          found.set(link.url, {
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
    collect(homeLinks)

    for (const page of toVisit) {
      if (visited.has(page.url)) continue
      visited.add(page.url)
      await sleep(pause)
      try {
        const html = await fetchHtml(page.url)
        if (html) collect(extractLinks(html, page.url))
      } catch {
        // A single dead sub-page is not worth failing the trust over.
      }
    }
  } catch (err) {
    stats.crawlFailed++
    console.warn(`[${STAGE}] ${trust.odsCode} (${trust.name}): crawl failed — ${err.message}`)
  }

  if (found.size) {
    stats.withCandidates++
    candidates.push(...found.values())
  }
  log(STAGE, `${i + 1}/${trusts.length} ${trust.name}: ${found.size} candidate(s)`)
  await sleep(pause)
}

writeJson(WEBSITE_CACHE, Object.fromEntries(Object.keys(websites).sort().map((k) => [k, websites[k]])))

const order = { high: 0, medium: 1, low: 2 }
candidates.sort((a, b) => order[a.confidence] - order[b.confidence] || a.trustName.localeCompare(b.trustName))

writeJson(dataPath("plan-candidates.json"), {
  generatedAt: new Date().toISOString(),
  description:
    "Candidate site-map / floor-plan PDFs found on NHS trust websites. THIS IS A TRIAGE QUEUE, NOT AN IMPORT LIST. " +
    "These PDFs are the trusts' copyright. Move an entry into data/plan-sources.json only after checking it is the right " +
    "map and that reuse is acceptable; scripts/nhs/fetch-plans.mjs downloads only what is listed there.",
  stats,
  count: candidates.length,
  candidates,
})

updateManifest("plans.candidates", {
  description: "Floor-plan PDF discovery queue",
  trustsChecked: trusts.length,
  candidates: candidates.length,
  ...stats,
})

log(STAGE, `${candidates.length} candidates across ${stats.withCandidates} trusts`)
log(STAGE, `high confidence: ${candidates.filter((c) => c.confidence === "high").length}`)
log(STAGE, `no website: ${stats.noWebsite}, crawl failed: ${stats.crawlFailed}, robots-blocked: ${stats.robotsBlocked}`)
log(STAGE, "done — review data/plan-candidates.json before running fetch-plans.mjs")
