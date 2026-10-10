// The maps hospitals publish on their own websites, outside the UK.
//
// The NHS has a register that says which website belongs to which trust, so
// scripts/nhs/discover-plans.mjs knows where to look. Elsewhere the only list
// of hospitals with websites is OpenStreetMap's `website` tag, which a health
// system fills in with one site for all its hospitals, sometimes with the
// hospital's own page, sometimes with the system's homepage, sometimes with
// nothing. These helpers turn that into sites to crawl and decide which
// hospital a map found on a shared site belongs to. They are pure, so
// scripts/world/test/discover-plans.test.mjs can check them without a network.
import { classifyDocument, decodeEntities, canonicalUrl, normaliseForMatching } from "../../nhs/lib/discovery-match.mjs"

// The website recorded for a hospital, as the origin to crawl plus the page
// the tag pointed at. Mappers use `website`, `contact:website` or `url`,
// occasionally several separated by ";", and not always with a scheme.
export function websiteOf(row) {
  const raw = String(row?.website ?? "")
    .split(";")[0]
    .trim()
  if (!raw) return null
  // A mail address or another scheme is not a website; neither is a host
  // with credentials in it, which is how "mailto:a@b" would otherwise parse.
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^https?:\/\//i.test(raw)) return null
  let parsed
  try {
    parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
  } catch {
    return null
  }
  if (!/^https?:$/.test(parsed.protocol) || !parsed.hostname.includes(".") || parsed.username || parsed.password) return null
  parsed.hash = ""
  // A tag that points below the homepage names the page to read first.
  const belowHome = parsed.pathname.replace(/\/+$/, "") !== "" || parsed.search !== ""
  return { origin: parsed.origin, page: belowHome ? parsed.href : null }
}

// Hospitals grouped by website. A health system runs dozens of hospitals on
// one site, and that site is crawled once however many hospitals it lists; the
// pages the tags pointed at become the crawl's seeds.
//
// Hosts that differ only by "www.", or by http against https, are one site:
// mappers write the same system's address every way, and the crawl reads
// through the redirect to whichever the site really is. The https address is
// the one crawled when both were recorded.
export function sitesOf(hospitals) {
  const byHost = new Map()
  for (const row of hospitals) {
    const site = websiteOf(row)
    if (!site) continue
    const key = new URL(site.origin).hostname.toLowerCase().replace(/^www\./, "")
    const entry = byHost.get(key) ?? { origin: site.origin, seeds: [], hospitals: [] }
    if (entry.origin.startsWith("http:") && site.origin.startsWith("https:")) entry.origin = site.origin
    if (site.page && !entry.seeds.includes(site.page)) entry.seeds.push(site.page)
    entry.hospitals.push(row)
    byHost.set(key, entry)
  }
  return [...byHost.values()]
}

// Words that say nothing about which hospital a document is about.
const COMMON = new Set([
  "hospital", "hospitals", "medical", "center", "centre", "health", "healthcare", "care", "the", "of", "and",
  "at", "for", "campus", "regional", "community", "memorial", "general", "university", "clinic", "system",
  "saint", "st", "inc", "llc",
])

export function distinctiveWords(name) {
  return normaliseForMatching(name)
    .toLowerCase()
    .replace(/['’]s?\b/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !COMMON.has(w))
}

// Which of a site's hospitals a document is about.
//
// Every distinctive word of the hospital's name has to appear in the link text
// or the URL — the same containment rule approve-plans uses for the NHS, which
// is strict enough not to hand Hull Royal Infirmary's map to Manchester Royal
// Infirmary. Where several hospitals match, the longest name wins; where none
// does and the site lists only one hospital, it is that one; otherwise null,
// and the candidate records the site's hospitals for a person to choose from.
export function attribute(hospitals, text, url) {
  const haystack = `${normaliseForMatching(text)} ${normaliseForMatching(url)}`.toLowerCase().replace(/['’]s?\b/g, "")
  const matches = hospitals
    .map((row) => ({ row, words: distinctiveWords(row.name) }))
    .filter(({ words }) => words.length && words.every((w) => new RegExp(`\\b${w}\\b`).test(haystack)))
    .sort((a, b) => b.words.length - a.words.length)
  if (matches.length) return matches[0].row
  return hospitals.length === 1 ? hospitals[0] : null
}

const summary = (row) => ({ id: row.id, name: row.name, ...(row.city ? { city: row.city } : {}) })

// One candidate per document found on a site.
export function candidateFrom(doc, site, country) {
  const owner = attribute(site.hospitals, doc.linkText, doc.url)
  const candidate = {
    country,
    hospitalId: owner?.id ?? null,
    hospitalName: owner?.name ?? null,
    website: site.origin,
    url: doc.url,
    linkText: doc.linkText,
    kind: doc.kind,
    confidence: doc.confidence,
    format: doc.format,
  }
  if (!owner) candidate.siteHospitals = site.hospitals.map(summary)
  return candidate
}

// Maps added by hand (data/world/known-maps.json) as candidates. Each is
// classified the same way a discovered one is, so an entry that does not look
// like a map is reported rather than smuggled in, and each is checked against
// the hospital list so a wrong id is caught now rather than when a venue is
// placed at the wrong coordinates.
export function knownMapCandidates(known, hospitalsById, { warn = () => {} } = {}) {
  const out = []
  for (const entry of known) {
    if (!entry?.url) continue
    const url = decodeEntities(entry.url)
    const signal = classifyDocument(decodeEntities(entry.linkText ?? ""), url)
    if (!signal) {
      warn(`known map does not look like a map, skipping: ${url}`)
      continue
    }
    const row = entry.hospitalId ? hospitalsById.get(entry.hospitalId) : null
    if (entry.hospitalId && !row) warn(`known map names a hospital id the list does not have: ${entry.hospitalId} (${url})`)
    out.push({
      country: entry.country ?? row?.country ?? null,
      hospitalId: row?.id ?? entry.hospitalId ?? null,
      hospitalName: row?.name ?? entry.hospitalName ?? "(added by hand)",
      website: entry.website ?? null,
      url,
      linkText: entry.linkText ?? "",
      kind: signal.kind,
      confidence: signal.confidence,
      format: signal.format,
      addedByHand: true,
      ...(entry.note ? { note: entry.note } : {}),
    })
  }
  return out
}

// Collapse copies of one document, then put what the app needs first: indoor
// floor plans, then the confident finds, then alphabetically so the diff of a
// re-run is readable.
const CONFIDENCE = { high: 0, medium: 1, low: 2 }
const KIND = { "floor-plan": 0, "site-map": 1, directory: 2, unknown: 3 }

export function sortCandidates(candidates) {
  const unique = new Map()
  for (const c of candidates) {
    const key = canonicalUrl(c.url)
    if (!unique.has(key)) unique.set(key, c)
  }
  return [...unique.values()].sort(
    (a, b) =>
      (KIND[a.kind] ?? 9) - (KIND[b.kind] ?? 9) ||
      (CONFIDENCE[a.confidence] ?? 9) - (CONFIDENCE[b.confidence] ?? 9) ||
      String(a.country ?? "").localeCompare(String(b.country ?? "")) ||
      String(a.hospitalName ?? "").localeCompare(String(b.hospitalName ?? "")) ||
      a.url.localeCompare(b.url)
  )
}
