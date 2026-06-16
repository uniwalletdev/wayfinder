import { Waypoint } from "./types"

// Smarter on-venue search: rank a venue's own waypoints by how well they match
// what the user typed, instead of a flat substring filter that returns hits in
// arbitrary array order. The aim is that the *closest* match rises to the top
// even when several points share similar names (e.g. "Ward A", "Ward A1",
// "Ward Annexe") — for any venue, not just the seeded one.

// Lowercase, strip accents, collapse whitespace — so "Café"/"cafe" and stray
// spacing compare equal, which matters once places can be mapped worldwide.
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
}

// Is `needle` a subsequence of `haystack` (same chars, in order, gaps allowed)?
// Gives light tolerance for typos and abbreviations ("paeds" → "paediatrics").
function isSubsequence(needle: string, haystack: string): boolean {
  let i = 0
  for (let j = 0; j < haystack.length && i < needle.length; j++) {
    if (haystack[j] === needle[i]) i++
  }
  return i === needle.length
}

// Score how well one field matches the query. 0 means "no match"; larger is
// better. The bands are ordered so an exact/prefix hit always outranks a
// mid-string or fuzzy one.
function scoreField(q: string, tokens: string[], field: string): number {
  const f = normalize(field)
  if (!f) return 0

  if (f === q) return 1000
  if (f.startsWith(q)) return 850 - Math.min(f.length - q.length, 120)

  const words = f.split(" ")
  if (words.some((w) => w.startsWith(q))) return 720

  const idx = f.indexOf(q)
  if (idx >= 0) return 600 - Math.min(idx, 100)

  // Multi-word queries: reward when every token lands — as a word-prefix first
  // ("main lift" → "Main Lobby Lift"), otherwise anywhere in the text.
  if (tokens.length > 1) {
    if (tokens.every((t) => words.some((w) => w.startsWith(t)))) return 560
    if (tokens.every((t) => f.includes(t))) return 460
  }

  // Last resort: fuzzy subsequence, only for queries long enough to be meaningful.
  if (q.length >= 3 && isSubsequence(q, f)) return 300

  return 0
}

// Combined relevance of a waypoint: the best of its name (full weight),
// description (half) and human type label (e.g. "Toilet", lighter still), plus a
// small nudge that favours shorter, more specific names when scores are close.
export function scoreWaypoint(
  query: string,
  name: string,
  description: string | undefined,
  typeLabel: string
): number {
  const q = normalize(query)
  if (!q) return 0
  const tokens = q.split(" ").filter(Boolean)

  const best = Math.max(
    scoreField(q, tokens, name),
    description ? scoreField(q, tokens, description) * 0.5 : 0,
    scoreField(q, tokens, typeLabel) * 0.4
  )
  if (best <= 0) return 0

  const nudge = Math.max(0, 40 - normalize(name).length) * 0.1
  return best + nudge
}

// Filter a venue's waypoints to those matching `query`, best match first.
export function rankWaypoints(
  query: string,
  waypoints: Waypoint[],
  typeLabelOf: (w: Waypoint) => string
): Waypoint[] {
  return waypoints
    .map((w) => ({ w, score: scoreWaypoint(query, w.name, w.description, typeLabelOf(w)) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.w.name.localeCompare(b.w.name))
    .map((x) => x.w)
}
