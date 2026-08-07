// Deciding which links are worth following, and which PDFs are worth keeping.
//
// Extracted from discover-plans.mjs so it can be tested without a network: the
// crawl found 1 candidate in 15 trusts while a person found a real hospital map
// by hand in seconds, and every one of those misses was a matching bug rather
// than a fetching one.
//
// The example that drove this: Salisbury publishes
//   https://www.stsft.nhs.uk/application/files/6417/7382/2879/SRH_Map_update.pdf
// linked from /our-locations/our-locations.

// Turn a URL or filename into something the word-based patterns can read.
//
// `\bmap\b` does NOT match "SRH_Map_update.pdf", because `_` is a word character
// so there is no boundary either side of "Map". Separators, percent-encoding and
// camelCase all hide words from the patterns, so flatten them all to spaces
// before matching. Without this, any map whose link text is unhelpful — and
// plenty are just "Download" or an icon — is invisible.
export function normaliseForMatching(value) {
  let s = String(value ?? "")
  try {
    s = decodeURIComponent(s)
  } catch {
    // Malformed escapes: match against the raw string rather than giving up.
  }
  return s
    .replace(/https?:\/\/[^/]+/i, " ") // the host contributes noise, not signal
    .replace(/([a-z])([A-Z])/g, "$1 $2") // siteMap -> site Map
    .replace(/[_\-.+%/\\]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

// A PDF is a candidate if its link text or filename says so. Ordered by how
// specific the signal is — that ordering becomes the confidence score.
export const PDF_SIGNALS = [
  { re: /floor\s?plans?\b/i, confidence: "high", kind: "floor-plan" },
  { re: /\b(site|campus|hospital|ward|department)\s?maps?\b/i, confidence: "high", kind: "site-map" },
  { re: /\bmaps?\b.*\b(hospital|site|campus|ward|department|entrance|parking)\b/i, confidence: "medium", kind: "site-map" },
  { re: /\b(hospital|site|campus)\b.*\bmaps?\b/i, confidence: "medium", kind: "site-map" },
  { re: /\bward\s?(map|guide|directory)|department\s?(map|directory)\b/i, confidence: "medium", kind: "directory" },
  // Bare "map" anywhere. Weak on its own, which is what `low` records — but a
  // file literally called "map" usually is one, and these are triaged later.
  { re: /\bmaps?\b/i, confidence: "low", kind: "unknown" },
]

// Things called "map" that are never a building map. Without these, a national
// crawl returns a pile of strategy documents.
const NOT_A_PLACE_MAP =
  /\b(road\s?map|roadmap|strategy|curriculum|competenc|career|journey\s?map|process\s?map|heat\s?map|mind\s?map|value\s?stream)\b/i

export function classifyPdf(text, href) {
  const haystack = `${normaliseForMatching(text)} ${normaliseForMatching(href)}`
  if (NOT_A_PLACE_MAP.test(haystack)) return null
  for (const signal of PDF_SIGNALS) {
    if (signal.re.test(haystack)) return signal
  }
  return null
}

// How promising a page is as somewhere a hospital map would live.
//
// This used to be a yes/no test and the first six matches in document order were
// kept. NHS homepages carry large navigation and footer menus, so six slots were
// routinely spent on "Contact us" and cookie notices before anything about
// locations appeared. Scoring keeps the same request budget and spends it far
// better.
const PAGE_SIGNALS = [
  { re: /\b(our\s?)?locations?\b/i, score: 10 },
  { re: /\b(our\s?)?hospitals?\b/i, score: 10 },
  { re: /\bsite\s?maps?\b|\bcampus\b/i, score: 10 },
  { re: /\bgetting\s?(here|to|around)\b|\bhow\s?to\s?find\b|\bfind\s?us\b/i, score: 9 },
  { re: /\bmaps?\s?(and|&)?\s?(directions?|parking)?\b/i, score: 8 },
  { re: /\bvisit(ing|or)?s?\b|\byour\s?visit\b/i, score: 6 },
  { re: /\btravel|parking|directions?\b/i, score: 5 },
  { re: /\bpatient\s?information\b|\bwards?\b|\bdepartments?\b/i, score: 4 },
  { re: /\bcontact\b|\babout\s?us\b/i, score: 2 },
]

export function scorePage(text, href) {
  const haystack = `${normaliseForMatching(text)} ${normaliseForMatching(href)}`
  let score = 0
  for (const signal of PAGE_SIGNALS) {
    if (signal.re.test(haystack)) score = Math.max(score, signal.score)
  }
  // Deep URLs are usually specific pages rather than section landing pages, and
  // the specific ones are where the maps hang.
  const depth = (href.match(/\//g) ?? []).length
  if (score > 0 && depth >= 5) score += 1
  return score
}

// Pages worth spending a request on, best first.
export function rankPages(links, { host, limit }) {
  const seen = new Set()
  return links
    .filter((l) => l.host === host && !/\.(pdf|jpe?g|png|gif|zip|docx?|xlsx?)(\?|$)/i.test(l.url))
    .map((l) => ({ ...l, score: scorePage(l.text, l.url) }))
    .filter((l) => {
      if (l.score <= 0 || seen.has(l.url)) return false
      seen.add(l.url)
      return true
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}
