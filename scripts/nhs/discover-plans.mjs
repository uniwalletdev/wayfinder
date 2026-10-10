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
import { fetchRetry } from "./lib/net.mjs"
import { loadOdsRecords } from "./lib/sites.mjs"
import { classifyDocument, decodeEntities, canonicalUrl, CRAWLER_VERSION } from "./lib/discovery-match.mjs"
import { crawlSite } from "./lib/crawl-site.mjs"
import { dataPath, readJson, writeJson, updateManifest, log } from "./lib/paths.mjs"

const STAGE = "discover-plans"
const ORD_API = "https://directory.spineservices.nhs.uk/ORD/2-0-0/organisations"
const WEBSITE_CACHE = dataPath("trust-websites.json")
// How many pages a site gets, how deep, and how fast: lib/crawl-site.mjs,
// which is the crawl itself and is shared with scripts/world/discover-plans.mjs.
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
      const signal = classifyDocument(decodeEntities(c.linkText ?? ""), url)
      return signal ? { ...c, url, kind: signal.kind, confidence: signal.confidence, format: signal.format } : { ...c, url }
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

  const result = await crawlSite(origin, { label: trust.odsCode, log: (m) => log(STAGE, m) })
  if (result.error) {
    console.warn(
      `[${STAGE}] ${trust.odsCode} (${trust.name}): ` +
        (result.outcome === "bot-challenge"
          ? "blocked by a bot challenge (needs a real browser) — skipping"
          : `crawl failed — ${result.error}`)
    )
  }
  const found = result.documents.map((doc) => ({ trustCode: trust.odsCode, trustName: trust.name, ...doc }))
  if (found.length) candidates.push(...found)
  return {
    outcome: result.outcome,
    found: found.length,
    via: result.via,
    note: result.note,
    high: found.filter((c) => c.confidence === "high").length,
  }
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
  const signal = classifyDocument(decodeEntities(entry.linkText ?? ""), url)
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
    format: signal.format,
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
