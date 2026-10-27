import type { Venue, Waypoint } from "../types"
import { scoreWaypoint } from "../search"
import { WAYPOINT_TYPE_LABELS } from "../waypoint-meta"
import {
  countsPhrase,
  directionsLinks,
  hasFloors,
  hasHospitalPage,
  hospitalAddress,
  hospitalPages,
  hospitalPath,
  navigatePath,
  placeCounts,
  placeGroups,
  placeWhere,
} from "../hospital-pages"

// What the Findway app in ChatGPT (or any MCP client) can ask: which hospital,
// where a place is inside it, and what its map lists. Answers come from the
// same venue data as the app and the hospital pages (src/lib/hospital-pages.ts),
// with links that open the hospital's page or directions in Findway. Plain data
// in, plain data out: src/lib/mcp/server.ts turns these into MCP tool results.
//
// Only what a map says about where a place is: never why someone is going.

export interface HospitalResult {
  id: string
  name: string
  address?: string
  trust?: string
  // Findway has a map of the inside (a hospital page and directions to places).
  mapped: boolean
  // "29 wards, 68 departments and clinics, and 4 entrances", for a mapped one.
  mapSummary?: string
  pageUrl?: string
  openInFindwayUrl: string
  directionsThere: { appleMaps: string; googleMaps: string }
}

export interface PlaceResult {
  name: string
  kind: string
  where?: string
  directionsUrl: string
}

const MAX_QUERY_CHARS = 120

// Apostrophes, full stops, commas and a leading "The" are spelling, not
// meaning: "St Georges" is St George's, "Royal London" is The Royal London.
const clean = (s: string) =>
  s
    .replace(/['’.,]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^the /i, "")

// src/lib/search.ts falls back to "these letters appear in this order", which
// suits a search box with the results in view and is no basis for an answer:
// "A&E" matches "Neuro Theatres & Recovery" that way. Such a match scores 300
// plus a nudge of at most 4, a band no other kind of match lands in, so here it
// counts as no match, and typos are offered as suggestions instead.
const isLetterOrderMatch = (score: number) => score >= 300 && score < 305

// Words people use for a place that its sign may not: A&E is the Emergency
// Department, an X-ray is Radiology or Imaging. Asking for one also searches
// for the others (terms of three letters or more; "ED" alone matches too much).
const SYNONYMS: string[][] = [
  ["a&e", "a and e", "accident and emergency", "emergency department", "emergency", "casualty"],
  ["x-ray", "xray", "x ray", "radiology", "imaging"],
  ["ent", "ear nose and throat"],
  ["maternity", "labour ward", "delivery suite", "birth centre", "antenatal"],
  ["blood test", "blood tests", "phlebotomy"],
  ["eye clinic", "eyes", "ophthalmology"],
  ["childrens", "children", "paediatrics", "paediatric", "pediatrics"],
  ["cafe", "coffee", "food", "restaurant", "canteen"],
  ["toilet", "toilets", "loo", "wc", "bathroom"],
  ["chemist", "pharmacy"],
  ["heart", "cardiology", "cardiac"],
  ["cancer", "oncology"],
  ["minor injuries", "urgent treatment centre"],
  ["way in", "main entrance"],
]

function variants(query: string): string[] {
  const q = clean(query).toLowerCase()
  const group = SYNONYMS.find((g) => g.includes(q))
  return [q, ...(group ?? []).filter((t) => t !== q && t.length >= 3)]
}

const label = (w: Waypoint) => WAYPOINT_TYPE_LABELS[w.type] ?? "Place"

// Every hospital anyone can look up: public, and a hospital. Directory pins
// (located, nothing inside) take part, so "where is it" still has an answer.
function hospitals(venues: Venue[]): Venue[] {
  return venues.filter((v) => v.visibility === "public" && v.category === "hospital")
}

function pageSlugs(venues: Venue[]): Map<string, string> {
  return new Map(hospitalPages(venues).map((p) => [p.venue.id, p.slug]))
}

// How well a hospital matches what was asked: its name first, then its trust,
// address and postcode. Its id, app slug or page address match exactly. A
// letter-order match only counts when the name is close in spelling too
// ("Adenbrookes"), not when the letters are merely somewhere in it.
function scoreHospital(query: string, v: Venue, pageSlug: string | undefined): number {
  const q = clean(query).toLowerCase()
  const fromUrl = q.match(/\/hospitals\/([a-z0-9-]+)/)?.[1]
  const exact = [v.id, v.slug, pageSlug].filter(Boolean)
  if (exact.includes(fromUrl ?? q)) return 2000
  const extra = [v.subtitle, v.postcode, ...(v.address ?? [])].filter(Boolean).join(" ")
  const score = scoreWaypoint(q, clean(v.name), clean(extra), "hospital")
  if (isLetterOrderMatch(score) && similarity(q, v.name) < 0.6) return 0
  return score
}

// A name match strong enough to trust (a prefix, a whole word, or every word
// of a longer name), as opposed to letters that merely appear in order.
const CONFIDENT = 450

function toResult(v: Venue, base: URL, slugs: Map<string, string>): HospitalResult {
  const at = (path: string) => new URL(path, base).toString()
  const a = hospitalAddress(v)
  const mapped = hasHospitalPage(v)
  const slug = slugs.get(v.id)
  const links = directionsLinks(v)
  return {
    id: v.id,
    name: v.name,
    address: a.line ?? (v.postcode || undefined),
    trust: a.trust,
    mapped,
    mapSummary: mapped ? countsPhrase(placeCounts(v)) || undefined : undefined,
    pageUrl: mapped && slug ? at(hospitalPath(slug)) : undefined,
    openInFindwayUrl: at(navigatePath(v)),
    directionsThere: { appleMaps: links.apple, googleMaps: links.google },
  }
}

// Hospitals matching a name, town or postcode, mapped ones first when they
// match about as well.
export function findHospitals(venues: Venue[], query: string, base: URL, limit = 5): HospitalResult[] {
  const q = query.trim().slice(0, MAX_QUERY_CHARS)
  if (q.length < 2) return []
  const slugs = pageSlugs(venues)
  const rank = (x: { v: Venue; score: number }) => x.score + (hasHospitalPage(x.v) ? 30 : 0)
  const matched = hospitals(venues)
    .map((v) => ({ v, score: scoreHospital(q, v, slugs.get(v.id)) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => rank(b) - rank(a) || a.v.name.localeCompare(b.v.name))
    .map((x) => x.v)
  return (matched.length ? matched : closelySpelt(venues, q))
    .slice(0, Math.max(1, Math.min(limit, 10)))
    .map((v) => toResult(v, base, slugs))
}

// The one hospital a question is about: the best-matching mapped hospital when
// the match is confident, else the best match of any kind (which may have no
// map, and is answered as such).
export function resolveHospital(venues: Venue[], query: string): Venue | null {
  const q = query.trim().slice(0, MAX_QUERY_CHARS)
  if (q.length < 2) return null
  const slugs = pageSlugs(venues)
  const scored = hospitals(venues)
    .map((v) => ({ v, score: scoreHospital(q, v, slugs.get(v.id)) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.v.name.localeCompare(b.v.name))
  const mapped = scored.find((x) => hasHospitalPage(x.v))
  if (mapped && mapped.score >= CONFIDENT) return mapped.v
  return scored[0]?.v ?? closelySpelt(venues, q)[0] ?? null
}

// When nothing matches word for word, hospitals whose names are spelt nearly
// the same ("Great Ormand Street"), closest first, mapped ones first on a tie.
function closelySpelt(venues: Venue[], query: string): Venue[] {
  const q = distinctive(query)
  return hospitals(venues)
    .map((v) => ({ v, s: similarity(q, distinctive(v.name)) }))
    .filter((x) => x.s >= 0.75)
    .sort((a, b) => b.s - a.s || Number(hasHospitalPage(b.v)) - Number(hasHospitalPage(a.v)) || a.v.name.localeCompare(b.v.name))
    .map((x) => x.v)
}

export type FindPlaceAnswer =
  | { status: "found"; hospital: HospitalResult; places: PlaceResult[] }
  | { status: "no_match"; hospital: HospitalResult; suggestions: string[] }
  | { status: "no_map"; hospital: HospitalResult }
  | { status: "no_hospital" }

function placeResult(w: Waypoint, v: Venue, base: URL, multiFloor: boolean): PlaceResult {
  return {
    name: w.name,
    kind: label(w),
    where: placeWhere(w, v, multiFloor) || undefined,
    directionsUrl: new URL(navigatePath(v, w), base).toString(),
  }
}

// A hospital name without the words half of them share, so "Mars General
// Hospital" is compared as "mars" and does not pass for Furness General.
const COMMON_WORDS = /\b(the|hospital|hospitals|general|university|royal|district|community|nhs|trust|foundation|infirmary|and|of|st|saint)\b/gi
function distinctive(name: string): string {
  const rest = clean(name).replace(COMMON_WORDS, " ").replace(/\s+/g, " ").trim()
  return rest || name
}

// Letters only, for "did you mean": "Kangeroo Ward" is still Kangaroo Ward.
function bigrams(s: string): string[] {
  const k = clean(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "")
  return Array.from({ length: Math.max(0, k.length - 1) }, (_, i) => k.slice(i, i + 2))
}
function similarity(a: string, b: string): number {
  const x = bigrams(a)
  const y = bigrams(b)
  if (!x.length || !y.length) return 0
  const pool = [...y]
  let common = 0
  for (const g of x) {
    const i = pool.indexOf(g)
    if (i >= 0) {
      common++
      pool.splice(i, 1)
    }
  }
  return (2 * common) / (x.length + y.length)
}

// Where a ward, clinic, department or facility is inside a hospital.
export function findPlace(venues: Venue[], hospitalQuery: string, placeQuery: string, base: URL, limit = 5): FindPlaceAnswer {
  const v = resolveHospital(venues, hospitalQuery)
  if (!v) return { status: "no_hospital" }
  const hospital = toResult(v, base, pageSlugs(venues))
  if (!hasHospitalPage(v)) return { status: "no_map", hospital }

  const asked = placeQuery.trim().slice(0, MAX_QUERY_CHARS)
  const qs = clean(asked).length >= 2 ? variants(asked) : []
  const multiFloor = hasFloors(v)
  // The best of the words asked and their synonyms, a synonym's match a little
  // behind the same match on the words themselves.
  const scoreOf = (w: Waypoint) =>
    Math.max(
      0,
      ...qs.map((q, i) => {
        const s = scoreWaypoint(q, clean(w.name), w.description ? clean(w.description) : undefined, label(w))
        return isLetterOrderMatch(s) ? 0 : s * (i === 0 ? 1 : 0.95)
      }),
    )
  const ranked = v.waypoints
    .map((w) => ({ w, score: scoreOf(w) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.w.name.localeCompare(b.w.name))
  const seen = new Set<string>()
  const places: PlaceResult[] = []
  for (const { w } of ranked) {
    const key = w.name.trim().toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    places.push(placeResult(w, v, base, multiFloor))
    if (places.length >= Math.max(1, Math.min(limit, 10))) break
  }
  if (places.length) return { status: "found", hospital, places }

  const suggestions = [...new Set(v.waypoints.map((w) => w.name))]
    .map((name) => ({ name, s: similarity(placeQuery, name) }))
    .filter((x) => x.s >= 0.34)
    .sort((a, b) => b.s - a.s || a.name.localeCompare(b.name))
    .slice(0, 3)
    .map((x) => x.name)
  return { status: "no_match", hospital, suggestions }
}

export const PLACE_KINDS = ["entrances", "wards", "departments", "facilities", "other"] as const
export type PlaceKind = (typeof PLACE_KINDS)[number]

export type ListPlacesAnswer =
  | { status: "listed"; hospital: HospitalResult; groups: { kind: PlaceKind; title: string; total: number; places: PlaceResult[] }[] }
  | { status: "no_map"; hospital: HospitalResult }
  | { status: "no_hospital" }

// What a mapped hospital's map lists, by kind; long lists are cut at `perKind`
// and say how many there are in all (the hospital page has every one).
export function listPlaces(venues: Venue[], hospitalQuery: string, base: URL, kind?: PlaceKind, perKind = 60): ListPlacesAnswer {
  const v = resolveHospital(venues, hospitalQuery)
  if (!v) return { status: "no_hospital" }
  const hospital = toResult(v, base, pageSlugs(venues))
  if (!hasHospitalPage(v)) return { status: "no_map", hospital }
  const multiFloor = hasFloors(v)
  const groups = placeGroups(v)
    .filter((g) => !kind || g.key === kind)
    .map((g) => ({
      kind: g.key as PlaceKind,
      title: g.title,
      total: g.places.length,
      places: g.places.slice(0, perKind).map((w) => placeResult(w, v, base, multiFloor)),
    }))
  return { status: "listed", hospital, groups }
}
