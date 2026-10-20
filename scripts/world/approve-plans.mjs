// Promote discovered map PDFs into the approved download list, for hospitals
// outside NHS England.
//
// Mirrors scripts/nhs/approve-plans.mjs exactly in policy — same two checks,
// same reasoning — the only difference is where "the hospital's own website"
// comes from: NHS looks it up in data/trust-websites.json, this reads it
// straight off the OSM record the candidate was crawled from.
//
//   - only "high" confidence signals (an explicit floor-plan or site-map
//     match, not the loose "contains the word map" fallback)
//   - only URLs on the hospital's OWN website host. A PDF on a random CDN
//     can't be attributed to the hospital with any confidence, and
//     attribution is the whole basis on which this material is used.
//
// This runs with no human looking at each PDF, same as the NHS stage — that
// was already true there; it isn't a new risk introduced for going
// international, just the same two guardrails applied to a wider list.
//
// Run: node scripts/world/approve-plans.mjs --country US [--dry-run] [--limit N]
import { dataPath, readJson, writeJson, log } from "../nhs/lib/paths.mjs"
import { onTrustDomain } from "../nhs/lib/discovery-match.mjs"
import { mappedVenueNames, mappedVenueFor } from "../nhs/lib/mapped.mjs"

const STAGE = "world-approve"
const DRY_RUN = process.argv.includes("--dry-run")
const limitArg = process.argv.indexOf("--limit")
const LIMIT = limitArg > -1 ? Number(process.argv[limitArg + 1]) : Infinity
const countryArg = process.argv.indexOf("--country")
const COUNTRIES = countryArg > -1 ? [process.argv[countryArg + 1].toUpperCase()] : ["US", "CA", "AU", "IE"]

const APPROVED_KINDS = new Set(["floor-plan", "site-map"])
const USABLE_FORMATS = new Set(["pdf"])

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

function informativeFilename(slug) {
  return (
    slug.length >= 6 &&
    /[a-z]{4}/.test(slug) &&
    !/^[0-9-]+$/.test(slug) &&
    !/^[0-9a-f]{16,}$/.test(slug.replace(/-/g, ""))
  )
}

function slugFor(candidate) {
  const fromFile = slugify(fileNameOf(candidate.url))
  const slug = informativeFilename(fromFile) ? fromFile : `${slugify(candidate.hospitalName)}-map`
  return /^[0-9]/.test(slug) ? `site-${slug}` : slug
}

function hostOf(url) {
  try {
    return new URL(url).host.replace(/^www\./i, "").toLowerCase()
  } catch {
    return null
  }
}

function documentKeys(candidate) {
  const name = fileNameOf(candidate.url).toLowerCase()
  if (!name) return []
  const keys = [`${candidate.hospitalCode}::${name}`]
  try {
    const { pathname, search } = new URL(candidate.url)
    if (informativeFilename(slugify(name))) keys.push(`any-hospital::${pathname}${search}`)
  } catch {
    // A URL that won't parse can't be compared by path; the filename key stands.
  }
  return keys
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

function approveCountry(countryCode, mappedVenues) {
  const candidatesPath = dataPath("world", `plan-candidates-${countryCode.toLowerCase()}.json`)
  const sourcesPath = dataPath("world", `plan-sources-${countryCode.toLowerCase()}.json`)

  const candidatesDoc = readJson(candidatesPath)
  if (!candidatesDoc) {
    log(STAGE, `${countryCode}: no data/world/plan-candidates-${countryCode.toLowerCase()}.json — run discover-plans.mjs --country ${countryCode} first`)
    return
  }

  const sourcesDoc = readJson(sourcesPath, { sources: [] })
  const existingUrls = new Set(sourcesDoc.sources.filter((s) => s.url).map((s) => s.url))
  const usedSlugs = new Set(sourcesDoc.sources.map((s) => s.slug))
  for (const venue of mappedVenues) usedSlugs.add(venue.slug)

  const preferredUrl = new Map()
  for (const candidate of candidatesDoc.candidates ?? []) {
    for (const key of documentKeys(candidate)) {
      const held = preferredUrl.get(key)
      if (!held || betterUrl(candidate.url, held)) preferredUrl.set(key, candidate.url)
    }
  }

  const approved = []
  const rejected = { lowConfidence: 0, wrongKind: 0, offDomain: 0, alreadyApproved: 0, badUrl: 0, alreadyMapped: 0, duplicateDocument: 0, unusableFormat: 0 }
  const coveredBy = []
  const unusable = []

  for (const candidate of candidatesDoc.candidates ?? []) {
    if (approved.length >= LIMIT) break

    if (candidate.confidence !== "high") { rejected.lowConfidence++; continue }
    if (!APPROVED_KINDS.has(candidate.kind)) { rejected.wrongKind++; continue }
    const format = candidate.format ?? "pdf"
    if (!USABLE_FORMATS.has(format)) {
      rejected.unusableFormat++
      unusable.push({ url: candidate.url, hospitalName: candidate.hospitalName, format })
      continue
    }
    if (existingUrls.has(candidate.url)) { rejected.alreadyApproved++; continue }

    const host = hostOf(candidate.url)
    if (!host) { rejected.badUrl++; continue }

    if (!onTrustDomain(candidate.url, [candidate.website])) { rejected.offDomain++; continue }

    if (documentKeys(candidate).some((key) => preferredUrl.get(key) !== candidate.url)) {
      rejected.duplicateDocument++
      continue
    }

    const covered = mappedVenueFor(
      `${candidate.linkText ?? ""} ${fileNameOf(candidate.url)}`,
      mappedVenues,
      null
    )
    if (covered) {
      rejected.alreadyMapped++
      coveredBy.push({ url: candidate.url, hospitalName: candidate.hospitalName, venue: covered.slug, matchedName: covered.matchedName })
      continue
    }

    let slug = slugFor(candidate)
    if (usedSlugs.has(slug)) {
      let n = 2
      while (usedSlugs.has(`${slug}-${n}`)) n++
      slug = `${slug}-${n}`
    }
    usedSlugs.add(slug)

    approved.push({
      slug,
      file: `map/world/auto/${countryCode.toLowerCase()}/${slug}.pdf`,
      url: candidate.url,
      sha256: null,
      hospitalCode: candidate.hospitalCode,
      hospitalName: candidate.hospitalName,
      countryCode,
      linkText: candidate.linkText,
      kind: candidate.kind,
      approvedAt: new Date().toISOString(),
      approvedBy: "auto:high-confidence-official-domain",
    })
  }

  log(STAGE, `${countryCode}: ${candidatesDoc.candidates?.length ?? 0} candidates -> ${approved.length} approved`)
  log(STAGE, `${countryCode}: rejected: ${JSON.stringify(rejected)}`)
  for (const a of approved.slice(0, 30)) log(STAGE, `  + ${a.slug}  (${a.kind}, ${a.hospitalName})`)
  if (approved.length > 30) log(STAGE, `  … and ${approved.length - 30} more`)
  for (const c of coveredBy) log(STAGE, `  – ${fileNameOf(c.url)}  (already mapped as ${c.venue}, matched "${c.matchedName}")`)
  if (unusable.length) {
    log(STAGE, `${countryCode}: ${unusable.length} map(s) found in a format the ingest can't place yet:`)
    for (const u of unusable.slice(0, 20)) log(STAGE, `  ? ${fileNameOf(u.url)}  (${u.format}, ${u.hospitalName})`)
  }

  if (DRY_RUN) {
    log(STAGE, `${countryCode}: dry run — plan-sources-${countryCode.toLowerCase()}.json not written`)
    return
  }

  sourcesDoc.sources = [...sourcesDoc.sources, ...approved]
  writeJson(sourcesPath, sourcesDoc)
  log(STAGE, `${countryCode}: data/world/plan-sources-${countryCode.toLowerCase()}.json now lists ${sourcesDoc.sources.length} source(s)`)
}

const mappedVenues = mappedVenueNames()
for (const countryCode of COUNTRIES) {
  approveCountry(countryCode, mappedVenues)
}
log(STAGE, "done — next: node scripts/world/fetch-plans.mjs --country <CC>")
