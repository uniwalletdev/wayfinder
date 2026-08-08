// Promote discovered map PDFs into the approved download list.
//
// discover-plans.mjs produces a queue of everything it found; fetch-plans.mjs
// downloads only what is in data/plan-sources.json. This is the step between
// them, and it is the step that decides what gets republished.
//
// The selection is deliberately narrow, because it runs without a human looking
// at each PDF:
//   - only "high" confidence signals (an explicit floor-plan or site-map match,
//     not the loose "contains the word map" fallback)
//   - only URLs on the trust's OWN website host, as recorded in
//     data/trust-websites.json. A PDF on a random CDN or a third-party mirror
//     can't be attributed to the trust with any confidence, and attribution is
//     the whole basis on which this material is being used.
//
// Everything selected records where it came from, so any sheet in the app can be
// traced back to a URL and a discovery run.
//
// Run: node scripts/nhs/approve-plans.mjs [--dry-run] [--limit N]
import { dataPath, readJson, writeJson, log } from "./lib/paths.mjs"
import { onTrustDomain } from "./lib/discovery-match.mjs"
import { mappedVenueNames, mappedVenueFor } from "./lib/mapped.mjs"

const STAGE = "approve-plans"
const DRY_RUN = process.argv.includes("--dry-run")
const limitArg = process.argv.indexOf("--limit")
const LIMIT = limitArg > -1 ? Number(process.argv[limitArg + 1]) : Infinity

// Auto-approval is restricted to the signals that named a map explicitly.
const APPROVED_KINDS = new Set(["floor-plan", "site-map"])

function fileNameOf(url) {
  try {
    return decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "")
  } catch {
    return ""
  }
}

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/\.pdf$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

// Filenames that are hashes, dates or bare numbers are common on CMS upload
// paths, useless as a venue URL, and too generic to identify a document by.
function informativeFilename(slug) {
  return (
    slug.length >= 6 &&
    /[a-z]{4}/.test(slug) &&
    !/^[0-9-]+$/.test(slug) &&
    !/^[0-9a-f]{16,}$/.test(slug.replace(/-/g, ""))
  )
}

// Prefer a slug that names the hospital over one that names the trust: the PDF's
// own filename usually does ("wythenshawe-hospital-sitemap.pdf"), and it becomes
// the venue's URL. Falls back to the trust when the filename is uninformative.
function slugFor(candidate) {
  const fromFile = slugify(fileNameOf(candidate.url))
  const slug = informativeFilename(fromFile) ? fromFile : `${slugify(candidate.trustName)}-map`
  // build-venues.mjs turns the slug into a TypeScript identifier
  // (`WYTHENSHAWE_VENUE`), so one starting with a digit — "2024-site-map.pdf" is
  // a real filename shape — would emit a module that doesn't parse.
  return /^[0-9]/.test(slug) ? `site-${slug}` : slug
}

function hostOf(url) {
  try {
    return new URL(url).host.replace(/^www\./i, "").toLowerCase()
  } catch {
    return null
  }
}

const candidatesDoc = readJson(dataPath("plan-candidates.json"))
if (!candidatesDoc) {
  console.error(
    `[${STAGE}] missing data/plan-candidates.json.\n` +
      `        Run the crawl on a machine with internet access:\n` +
      `          npm run nhs:fetch && npm run nhs:discover\n` +
      `        then commit data/plan-candidates.json.`
  )
  process.exit(1)
}

const websites = readJson(dataPath("trust-websites.json"), {})
// Hosts a trust also answers to, where the one ODS recorded has gone stale. Both
// count as its own — see data/trust-website-overrides.json.
const overrides = readJson(dataPath("trust-website-overrides.json"), { overrides: {} }).overrides ?? {}
const websitesFor = (code) => [websites[code], ...(overrides[code]?.websites ?? [])].filter(Boolean)
const sourcesDoc = readJson(dataPath("plan-sources.json"), { sources: [] })
const existingUrls = new Set(sourcesDoc.sources.filter((s) => s.url).map((s) => s.url))
// Slugs already spoken for. plan-sources.json is not enough on its own: a venue
// built by hand has a slug and a module but no entry here, so a candidate whose
// filename slugified to the same thing would have build-venues overwrite it.
const usedSlugs = new Set(sourcesDoc.sources.map((s) => s.slug))

// Hospitals that already ship as full venues, read from the venue modules
// themselves so a newly built one starts protecting itself with no bookkeeping.
const mappedVenues = mappedVenueNames()
for (const venue of mappedVenues) usedSlugs.add(venue.slug)

// One document, published at several URLs.
//
// A trust reaches its own files by more than one route: www and the bare domain,
// http and https, a media subdomain, the same PDF with a different cache-busting
// query. Whiston's floor map came back twice, Derriford's three times, and each
// copy would have become its own venue on the same hospital.
//
// A trust does not publish two different maps under one filename, so the trust
// and the filename together identify the document. Of the URLs that carry it,
// prefer https and then the plainest — the fewest query parameters, then the
// shortest — so the recorded source is the one most likely to keep working.
// Two keys, because the copies arrive two ways. Within a trust, the filename is
// enough. Across trusts, it is not — but an identical path AND query is: when
// Basildon and Thurrock and Mid Essex both serve
// /download/southend-hospital-ground-floor-map-pdf.pdf?ver=31231&doc=…1240.pdf
// they are one merged organisation behind one CMS, and it is one document.
// Sharing a bare filename would prove nothing, so that key is only used when the
// filename is distinctive enough to be a slug in its own right.
function documentKeys(candidate) {
  const name = fileNameOf(candidate.url).toLowerCase()
  if (!name) return []
  const keys = [`${candidate.trustCode}::${name}`]
  try {
    const { pathname, search } = new URL(candidate.url)
    if (informativeFilename(slugify(name))) keys.push(`any-trust::${pathname}${search}`)
  } catch {
    // A URL that won't parse can't be compared by path; the filename key stands.
  }
  return keys
}

const preferredUrl = new Map()
for (const candidate of candidatesDoc.candidates ?? []) {
  for (const key of documentKeys(candidate)) {
    const held = preferredUrl.get(key)
    if (!held || betterUrl(candidate.url, held)) preferredUrl.set(key, candidate.url)
  }
}

function betterUrl(a, b) {
  const rank = (url) => {
    let parsed
    try {
      parsed = new URL(url)
    } catch {
      return [1, 99, 9999]
    }
    return [parsed.protocol === "https:" ? 0 : 1, [...parsed.searchParams].length, url.length]
  }
  const [aSecure, aParams, aLength] = rank(a)
  const [bSecure, bParams, bLength] = rank(b)
  if (aSecure !== bSecure) return aSecure < bSecure
  if (aParams !== bParams) return aParams < bParams
  return aLength < bLength
}

const approved = []
const rejected = { lowConfidence: 0, wrongKind: 0, offDomain: 0, alreadyApproved: 0, badUrl: 0, alreadyMapped: 0, duplicateDocument: 0 }
// Which venue each refusal was taken for, so an over-eager match is visible and
// arguable rather than a silently missing hospital.
const coveredBy = []

for (const candidate of candidatesDoc.candidates ?? []) {
  if (approved.length >= LIMIT) break

  if (candidate.confidence !== "high") { rejected.lowConfidence++; continue }
  if (!APPROVED_KINDS.has(candidate.kind)) { rejected.wrongKind++; continue }
  if (existingUrls.has(candidate.url)) { rejected.alreadyApproved++; continue }

  const host = hostOf(candidate.url)
  if (!host) { rejected.badUrl++; continue }

  if (!onTrustDomain(candidate.url, websitesFor(candidate.trustCode))) { rejected.offDomain++; continue }

  // Both the link text and the filename, because either one alone names the
  // hospital on plenty of sites and neither does on all of them.
  if (documentKeys(candidate).some((key) => preferredUrl.get(key) !== candidate.url)) {
    rejected.duplicateDocument++
    continue
  }

  const covered = mappedVenueFor(
    `${candidate.linkText ?? ""} ${fileNameOf(candidate.url)}`,
    mappedVenues,
    candidate.trustCode
  )
  if (covered) {
    rejected.alreadyMapped++
    coveredBy.push({ url: candidate.url, trustName: candidate.trustName, venue: covered.slug, matchedName: covered.matchedName })
    continue
  }

  let slug = slugFor(candidate)
  // Slugs address venues by URL and name the floor-plan asset directory, so a
  // collision would have one hospital silently overwrite another's plan.
  if (usedSlugs.has(slug)) {
    let n = 2
    while (usedSlugs.has(`${slug}-${n}`)) n++
    slug = `${slug}-${n}`
  }
  usedSlugs.add(slug)

  approved.push({
    slug,
    // Auto-fetched PDFs live apart from the ten that were collected by hand, so
    // it stays obvious which sheets nobody has ever looked at.
    file: `map/auto/${slug}.pdf`,
    url: candidate.url,
    sha256: null,
    trustCode: candidate.trustCode,
    trustName: candidate.trustName,
    linkText: candidate.linkText,
    kind: candidate.kind,
    approvedAt: new Date().toISOString(),
    approvedBy: "auto:high-confidence-official-domain",
  })
}

log(STAGE, `${candidatesDoc.candidates?.length ?? 0} candidates -> ${approved.length} approved`)
log(STAGE, `rejected: ${JSON.stringify(rejected)}`)
for (const a of approved.slice(0, 30)) log(STAGE, `  + ${a.slug}  (${a.kind}, ${a.trustName})`)
if (approved.length > 30) log(STAGE, `  … and ${approved.length - 30} more`)

// Named individually rather than counted. Every one of these is a hospital the
// app already covers, and if the match is wrong it is a hospital being kept out
// — so it has to be readable in the log without opening a file.
for (const c of coveredBy) {
  log(STAGE, `  – ${fileNameOf(c.url)}  (already mapped as ${c.venue}, matched "${c.matchedName}")`)
}

if (DRY_RUN) {
  log(STAGE, "dry run — data/plan-sources.json not written")
  process.exit(0)
}

sourcesDoc.sources = [...sourcesDoc.sources, ...approved]
writeJson(dataPath("plan-sources.json"), sourcesDoc)
log(STAGE, `data/plan-sources.json now lists ${sourcesDoc.sources.length} source(s)`)
log(STAGE, "done — next: npm run nhs:plans")
