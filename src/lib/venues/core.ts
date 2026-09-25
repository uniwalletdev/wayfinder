import { Venue, VenueCategory, VenueVisibility, Coordinates, AccessibilityInfo } from "../types"
import { GOSH_VENUE } from "./gosh"

// The venue helpers the app itself uses, kept apart from the registry of every
// seed venue (index.ts). The registry imports all 67 mapped hospitals; anything
// the client bundles must import this file instead, so that only the default
// venue ships up front and the rest load on demand (see catalog.ts).

// The venue the app opens into until the user picks or creates another.
export const DEFAULT_VENUE: Venue = GOSH_VENUE

// The floor a venue should open on: the ground floor when it has a plan for
// it, otherwise the lowest floor that does.
//
// The ground floor is where people arrive, so it is the floor to open on — and
// under a venue's own numbering it is still internal floor 0 (GOSH's "Level
// 2"). Opening on the lowest planned floor instead put GOSH on Level 1, a
// storey below its entrance, so the position dot started underground and every
// preview began with a lift ride the walker had not asked for.
//
// Not always 0, though. Southampton's Princess Anne is lettered A upward and
// only levels C to H have usable plans, so its storeys run 2 to 7 — opening it
// at floor 0 would show a venue with no floor plan at all, hence the fallback.
export function openingFloor(venue: Pick<Venue, "floorPlans">): number {
  const floors = venue.floorPlans.map((p) => p.floor)
  if (floors.length === 0) return 0
  return floors.includes(0) ? 0 : Math.min(...floors)
}

// URL-safe form of a place name. Shared with the server-side venue store so a
// device-local venue and a shared one slug the same way.
export function slugify(name: string): string {
  const base = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
  return base || "place"
}

export interface NewVenueInput {
  name: string
  category: VenueCategory
  center: Coordinates
  visibility: VenueVisibility
  subtitle?: string
  defaultZoom?: number
  accessibility?: AccessibilityInfo
}

// Build a user-created Venue. It starts with no base waypoints — these are added
// by surveying the place. `verified` is always false: only a server-side
// authority check (a later phase) can mark a public venue as verified.
export function createVenue(input: NewVenueInput): Venue {
  const id = `venue-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const now = new Date().toISOString()
  return {
    id,
    slug: `${slugify(input.name)}-${id.slice(-5)}`,
    name: input.name.trim(),
    subtitle: input.subtitle?.trim() || undefined,
    category: input.category,
    center: input.center,
    defaultZoom: input.defaultZoom ?? 18,
    floorPlans: [],
    waypoints: [],
    visibility: input.visibility,
    verified: false,
    accessibility: input.accessibility,
    quickAccess: [],
    createdAt: now,
    updatedAt: now,
  }
}
