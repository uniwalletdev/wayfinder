import type { Venue, Waypoint, FloorNaming } from "./types"
import { scoreWaypoint } from "./search"
import { WAYPOINT_TYPE_LABELS, floorLabel } from "./waypoint-meta"

// Search for a place across every seed venue at once.
//
// The app's own search is scoped to the open venue, and the client no longer
// downloads the other venues' interiors (see venues/catalog.ts), so "Kangaroo
// Ward" typed at the wrong hospital cannot be found on the phone. The server
// still has every venue, so it answers instead: /api/search builds this index
// once and ranks with the same scorer the in-venue search uses, and the app
// offers the hits as "At other hospitals", switching venue on selection.

export interface CrossVenueHit {
  venueId: string
  venueName: string
  waypoint: Pick<Waypoint, "id" | "name" | "type" | "floor" | "description">
  typeLabel: string
  floorLabel: string
}

interface Entry {
  venueId: string
  venueName: string
  // The venue's country, so a visitor is only offered hospitals in theirs.
  country?: string
  naming?: FloorNaming
  w: Waypoint
}

export interface CrossVenueIndex {
  entries: Entry[]
}

// Only public venues with an interior take part: a private venue is not
// discoverable, and a directory pin has nothing to find.
export function buildCrossVenueIndex(venues: Venue[]): CrossVenueIndex {
  const entries: Entry[] = []
  for (const v of venues) {
    if (v.visibility !== "public") continue
    for (const w of v.waypoints) entries.push({ venueId: v.id, venueName: v.name, country: v.country, naming: v.floorNaming, w })
  }
  return { entries }
}

// At most this many hits from one venue, so a hospital with ten "Ward" rows
// does not crowd out the ward with that name somewhere else.
const PER_VENUE = 3

export function searchAcrossVenues(
  index: CrossVenueIndex,
  query: string,
  opts: { exclude?: string; limit?: number; country?: string } = {}
): CrossVenueHit[] {
  const q = query.trim()
  if (q.length < 2) return []
  const limit = opts.limit ?? 8
  const scored: { e: Entry; score: number }[] = []
  for (const e of index.entries) {
    if (opts.exclude && e.venueId === opts.exclude) continue
    if (opts.country && e.country && e.country !== opts.country) continue
    const score = scoreWaypoint(q, e.w.name, e.w.description, WAYPOINT_TYPE_LABELS[e.w.type])
    if (score > 0) scored.push({ e, score })
  }
  scored.sort((a, b) => b.score - a.score || a.e.w.name.localeCompare(b.e.w.name) || a.e.venueName.localeCompare(b.e.venueName))
  const perVenue = new Map<string, number>()
  const out: CrossVenueHit[] = []
  for (const { e } of scored) {
    const n = perVenue.get(e.venueId) ?? 0
    if (n >= PER_VENUE) continue
    perVenue.set(e.venueId, n + 1)
    out.push({
      venueId: e.venueId,
      venueName: e.venueName,
      waypoint: { id: e.w.id, name: e.w.name, type: e.w.type, floor: e.w.floor, description: e.w.description },
      typeLabel: WAYPOINT_TYPE_LABELS[e.w.type],
      floorLabel: floorLabel(e.w.floor, e.naming),
    })
    if (out.length >= limit) break
  }
  return out
}
