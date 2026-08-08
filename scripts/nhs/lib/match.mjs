// Deciding whether two NHS names refer to the same hospital, and how big a site
// is on the ground.
//
// Three stages need this and were growing their own copies: build-sites.mjs
// (does a mapped venue already cover this site?), draft-sheets.mjs (which of a
// trust's hospitals is this a map of?), and the tests. Three implementations of
// "are these the same hospital" would drift, and the failure when they do is a
// map pin on the wrong building.
import { metresBetween } from "./sites.mjs"

// Words in so many NHS names that their presence says nothing. Matching on these
// would make "Royal United Hospital" and "Royal Free Hospital" look alike.
export const BASE_STOPWORDS = new Set([
  "hospital", "hospitals", "nhs", "trust", "foundation", "the", "and", "of", "site",
  "centre", "center", "university", "general", "royal", "community", "health", "care",
])

// Additionally meaningless when the string being matched is a filename or link
// text rather than an organisation name.
export const DOCUMENT_STOPWORDS = new Set([
  ...BASE_STOPWORDS,
  "map", "maps", "sitemap", "plan", "plans", "floor", "pdf", "location", "getting",
  "here", "find", "visiting", "visitor", "directions", "download", "final", "new",
])

export function nameTokens(value, stopwords = BASE_STOPWORDS) {
  return new Set(
    String(value ?? "")
      .toLowerCase()
      .replace(/['’]/g, "")
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 2 && !stopwords.has(t))
  )
}

// Containment, not Jaccard. "Queen Elizabeth Hospital Birmingham" in ODS and
// "Queen Elizabeth Hospital" as a venue name should score as a match even though
// one carries an extra token; Jaccard would penalise exactly the case we want.
export function tokenOverlap(a, b) {
  if (!a.size || !b.size) return 0
  let shared = 0
  for (const token of a) if (b.has(token)) shared++
  return shared / Math.min(a.size, b.size)
}

// How much of a DOCUMENT's name a site accounts for.
//
// tokenOverlap divides by the smaller set, which is right for "is this venue the
// same hospital as this site" but wrong for "which of these sites is this sheet
// a map of": it lets a short name win by being short. Asked which hospital
// "site-1253769-hull-teaching-castle-hill-map" belongs to, it scored "York
// Teaching Hospital" (2 tokens, 1 shared → 0.50) above "Castle Hill Hospital
// Elective Surgical Hub" (5 tokens, 2 shared → 0.40) and put Hull's map on York.
//
// Dividing by the document's tokens instead asks how much of what the sheet
// names this site actually explains — 2/5 against 1/5, and Castle Hill wins.
export function documentContainment(documentTokens, siteTokens) {
  if (!documentTokens.size || !siteTokens.size) return 0
  let shared = 0
  for (const token of documentTokens) if (siteTokens.has(token)) shared++
  return shared / documentTokens.size
}

// The bounding box of a set of GeoJSON polygon features.
export function bboxOf(features) {
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity
  for (const feature of features) {
    const geometry = feature?.geometry
    if (!geometry) continue
    const rings =
      geometry.type === "Polygon"
        ? geometry.coordinates
        : geometry.type === "MultiPolygon"
          ? geometry.coordinates.map((polygon) => polygon[0])
          : []
    for (const ring of rings) {
      for (const [lng, lat] of ring) {
        if (lat < minLat) minLat = lat
        if (lat > maxLat) maxLat = lat
        if (lng < minLng) minLng = lng
        if (lng > maxLng) maxLng = lng
      }
    }
  }
  return Number.isFinite(minLat) ? { minLat, maxLat, minLng, maxLng } : null
}

// How wide a hospital site is, in metres — the larger of its two bounding-box
// dimensions, since a site plan covers the whole campus. This is what lets a
// downloaded sheet be scaled onto the map without anyone measuring it by hand.
export function footprintSpanM(features) {
  const box = bboxOf(features)
  if (!box) return null
  const midLat = (box.minLat + box.maxLat) / 2
  const widthM = metresBetween(midLat, box.minLng, midLat, box.maxLng)
  const heightM = metresBetween(box.minLat, box.minLng, box.maxLat, box.minLng)
  return Math.max(widthM, heightM)
}
