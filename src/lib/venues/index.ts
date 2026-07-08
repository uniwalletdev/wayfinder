import { Venue, VenueCategory, VenueVisibility, Coordinates, AccessibilityInfo } from "../types"
import { GOSH_VENUE } from "./gosh"
import { ST_GEORGES_VENUE } from "./st-georges"

// Registry of venues the app knows about. Seed venues ship with the build;
// user-created venues (added via "Map a place") are layered on top of these at
// runtime and passed in via the `extra` argument so this module stays free of
// browser/storage concerns.

export const SEED_VENUES: Venue[] = [GOSH_VENUE, ST_GEORGES_VENUE]

// The venue the app opens into until the user picks or creates another.
export const DEFAULT_VENUE: Venue = GOSH_VENUE

export function getVenueBySlug(slug: string, extra: Venue[] = []): Venue | undefined {
  return [...SEED_VENUES, ...extra].find((v) => v.slug === slug)
}

export function getVenueById(id: string, extra: Venue[] = []): Venue | undefined {
  return [...SEED_VENUES, ...extra].find((v) => v.id === id)
}

function slugify(name: string): string {
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

// Public venues are discoverable by anyone. Unlisted/private venues are
// deliberately excluded here — they surface only to people with the link or an
// explicit grant (enforced for real once accounts land in a later phase).
export function listPublicVenues(extra: Venue[] = []): Venue[] {
  return [...SEED_VENUES, ...extra].filter((v) => v.visibility === "public")
}
