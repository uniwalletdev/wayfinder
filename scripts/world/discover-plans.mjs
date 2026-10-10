// Find the maps hospitals publish on their own websites, outside the UK.
//
// There is no national dataset of hospital floor plans anywhere, and outside
// the UK there is not even a register that says which website belongs to which
// hospital. What there is: OpenStreetMap's `website` tag on the hospital
// (kept by scripts/world/fetch-hospitals.mjs), filled in by mappers for some
// hospitals and not others, and a crawl of each of those sites for the PDFs
// hospitals routinely publish under "Maps & directions", "Patient & visitor
// information" or "Getting here" — the same crawl scripts/nhs/discover-plans.mjs
// runs across NHS trust websites, through the same lib/crawl-site.mjs.
//
// Like the NHS one, this stage imports nothing. It writes a TRIAGE QUEUE,
// data/world/plan-candidates.json, listing what it found and how confident it
// is; the maps are the hospitals' copyright, and which of them to use is a
// decision for a person. Maps found by hand go in data/world/known-maps.json
// and are merged in, classified the same way.
//
// A health system runs many hospitals on one website, so sites are crawled
// once each and every document is attributed to the hospital it names; one that
// names none on a shared site is kept with the site's hospitals listed for a
// person to choose from. A full run checkpoints as it goes and resumes.
//
// Run: node scripts/world/discover-plans.mjs [--countries US,CA] [--limit N] [--restart] [--retry-failed] [--known-only]
// --known-only merges data/world/known-maps.json and crawls nothing: the way to
// refresh the queue from a machine with no outbound network.
import { readdirSync, existsSync } from "fs"
import { CRAWLER_VERSION, classifyDocument, decodeEntities } from "../nhs/lib/discovery-match.mjs"
import { crawlSite } from "../nhs/lib/crawl-site.mjs"
import { readJson, writeJson, repoPath, log } from "../nhs/lib/paths.mjs"
import { sitesOf, candidateFrom, knownMapCandidates, sortCandidates } from "./lib/plans.mjs"

const STAGE = "world-discover"
const HOSPITALS_DIR = repoPath("data", "world", "hospitals")
const OUT = repoPath("data", "world", "plan-candidates.json")
const KNOWN = repoPath("data", "world", "known-maps.json")
// How many sites to crawl at once. Politeness is per host and these are all
// different hosts, so this costs no site any extra load.
const SITE_CONCURRENCY = 6
const CHECKPOINT_EVERY = 10

const arg = (name, def) => {
  const i = process.argv.indexOf(name)
  return i > -1 ? process.argv[i + 1] : def
}
const only = arg("--countries", null)?.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
const LIMIT = Number(arg("--limit", Infinity))
const RESTART = process.argv.includes("--restart")
const RETRY_FAILED = process.argv.includes("--retry-failed")
const KNOWN_ONLY = process.argv.includes("--known-only")

// The UK's hospitals come from the NHS register and are crawled by the NHS
// script; every other country file is in scope.
const countries = existsSync(HOSPITALS_DIR)
  ? readdirSync(HOSPITALS_DIR)
      .filter((f) => /^[A-Z]{2}\.json$/.test(f))
      .map((f) => f.slice(0, 2))
      .filter((c) => c !== "GB" && (!only || only.includes(c)))
      .sort()
  : []

const hospitalsById = new Map()
const sites = []
let hospitalsInScope = 0
for (const country of countries) {
  const rows = readJson(`${HOSPITALS_DIR}/${country}.json`, { hospitals: [] }).hospitals ?? []
  hospitalsInScope += rows.length
  for (const row of rows) hospitalsById.set(row.id, { ...row, country })
  for (const site of sitesOf(rows)) sites.push({ ...site, country })
}
const withWebsite = sites.reduce((n, s) => n + s.hospitals.length, 0)
log(STAGE, `${hospitalsInScope} hospitals in ${countries.length} countr${countries.length === 1 ? "y" : "ies"}; ${withWebsite} record a website, on ${sites.length} sites`)
if (!KNOWN_ONLY && hospitalsInScope && !withWebsite) {
  log(STAGE, "no hospital records a website: the lists were fetched before websites were kept — run node scripts/world/fetch-hospitals.mjs --countries " + countries.join(",") + " first")
}

const inScope = sites.slice(0, LIMIT === Infinity ? undefined : LIMIT)

// Site origin -> how its crawl ended. Resuming skips anything recorded here.
const crawled = new Map()
let candidates = []

if (!RESTART) {
  const prior = readJson(OUT)
  if (prior?.candidates && (prior.crawlerVersion ?? 1) !== CRAWLER_VERSION) {
    log(STAGE, `previous results came from crawler v${prior.crawlerVersion ?? 1}, this is v${CRAWLER_VERSION} — re-crawling so the improvements apply (previous candidates are kept)`)
    candidates = prior.candidates.map((c) => {
      const url = decodeEntities(c.url)
      const signal = classifyDocument(decodeEntities(c.linkText ?? ""), url)
      return signal ? { ...c, url, kind: signal.kind, confidence: signal.confidence, format: signal.format } : { ...c, url }
    })
  } else if (prior?.candidates) {
    candidates = prior.candidates
    for (const [origin, outcome] of Object.entries(prior.crawled ?? {})) {
      if (RETRY_FAILED && outcome === "failed") continue
      crawled.set(origin, outcome)
    }
    log(STAGE, `resuming — ${candidates.length} candidate(s) and ${crawled.size} site(s) already done`)
  }
}

// Hand-found maps are re-read on every run, so a corrected entry corrects the
// queue; the copy a previous run merged is dropped first.
candidates = candidates.filter((c) => !c.addedByHand)
const known = readJson(KNOWN, { maps: [] }).maps ?? []
const fromKnown = knownMapCandidates(known, hospitalsById, { warn: (m) => console.warn(`[${STAGE}] ${m}`) })
candidates.push(...fromKnown)
if (fromKnown.length) log(STAGE, `${fromKnown.length} map(s) added from data/world/known-maps.json`)

function summarise() {
  const stats = { countries: countries.length, hospitals: hospitalsInScope, withWebsite, sites: sites.length, crawled: crawled.size, crawlFailed: 0, botChallenged: 0, robotsBlocked: 0, withCandidates: 0, hospitalsWithCandidates: 0 }
  for (const outcome of crawled.values()) {
    if (outcome === "robots-blocked") stats.robotsBlocked++
    else if (outcome === "bot-challenge") stats.botChallenged++
    else if (outcome === "failed") stats.crawlFailed++
  }
  stats.withCandidates = new Set(candidates.map((c) => c.website ?? c.url)).size
  stats.hospitalsWithCandidates = new Set(candidates.map((c) => c.hospitalId).filter(Boolean)).size
  return stats
}

function writeCheckpoint() {
  candidates = sortCandidates(candidates)
  writeJson(OUT, {
    generatedAt: new Date().toISOString(),
    description:
      "Candidate site-map / floor-plan documents found on hospitals' own websites outside the UK, plus the ones in data/world/known-maps.json. " +
      "THIS IS A TRIAGE QUEUE, NOT AN IMPORT LIST: the documents are the hospitals' copyright. " +
      "hospitalId is the OpenStreetMap hospital the document names; null with siteHospitals means the site serves several hospitals and the document named none.",
    crawlerVersion: CRAWLER_VERSION,
    stats: summarise(),
    count: candidates.length,
    crawled: Object.fromEntries([...crawled.entries()].sort()),
    candidates,
  })
  return candidates
}

async function crawlOne(site) {
  const result = await crawlSite(site.origin, { seeds: site.seeds, label: site.origin, log: (m) => log(STAGE, m) })
  if (result.error) {
    console.warn(
      `[${STAGE}] ${site.origin} (${site.hospitals.map((h) => h.name).slice(0, 3).join(", ")}): ` +
        (result.outcome === "bot-challenge" ? "blocked by a bot challenge (needs a real browser) — skipping" : `crawl failed — ${result.error}`)
    )
  }
  const found = result.documents.map((doc) => candidateFrom(doc, site, site.country))
  if (found.length) candidates.push(...found)
  return { outcome: result.outcome, found: found.length, via: result.via, note: result.note, high: found.filter((c) => c.confidence === "high").length }
}

const pending = KNOWN_ONLY ? [] : inScope.filter((s) => !crawled.has(s.origin))
log(STAGE, `${inScope.length} site(s) in scope, ${pending.length} still to crawl`)
if (pending.length > 100) {
  log(STAGE, "this will take hours — it honours every site's robots.txt and crawl delay; safe to interrupt and re-run")
}

let completed = 0
let sinceCheckpoint = 0
async function worker(queue) {
  for (const { site, index } of queue) {
    const result = await crawlOne(site)
    crawled.set(site.origin, result.outcome)
    completed++
    const who = site.hospitals.length === 1 ? site.hospitals[0].name : `${site.origin} (${site.hospitals.length} hospitals)`
    log(STAGE, `[${index + 1}/${inScope.length}] ${who} — ` + (result.note ?? `${result.found} candidate(s)${result.high ? ` (${result.high} high)` : ""} [via ${result.via}]`))
    if (++sinceCheckpoint >= CHECKPOINT_EVERY) {
      sinceCheckpoint = 0
      writeCheckpoint()
      log(STAGE, `  … saved (${completed}/${pending.length} sites, ${candidates.length} candidates so far)`)
    }
  }
}

const queues = Array.from({ length: SITE_CONCURRENCY }, () => [])
pending.forEach((site, i) => queues[i % SITE_CONCURRENCY].push({ site, index: inScope.indexOf(site) }))
await Promise.all(queues.map(worker))

const sorted = writeCheckpoint()
const stats = summarise()
const high = sorted.filter((c) => c.confidence === "high").length
const floorPlans = sorted.filter((c) => c.kind === "floor-plan").length
log(STAGE, `${sorted.length} candidates for ${stats.hospitalsWithCandidates} hospitals (${sorted.filter((c) => !c.hospitalId).length} not yet attributed to one)`)
log(STAGE, `high confidence: ${high} (of which ${floorPlans} look like indoor floor plans)`)
if (crawled.size) log(STAGE, `crawl failed: ${stats.crawlFailed}, bot-challenged: ${stats.botChallenged}, robots-blocked: ${stats.robotsBlocked}`)
if (stats.crawlFailed) log(STAGE, `re-run with --retry-failed to have another go at the ${stats.crawlFailed} that failed`)
log(STAGE, `written: data/world/plan-candidates.json`)
