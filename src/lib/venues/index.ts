import { Venue } from "../types"
import { GOSH_VENUE } from "./gosh"

// Registry of venues the app knows about. Seed venues ship with the build;
// user-created venues (added via "Map a place") are layered on top of these at
// runtime and passed in via the `extra` argument so this module stays free of
// browser/storage concerns.

export const SEED_VENUES: Venue[] = [GOSH_VENUE]

// The venue the app opens into until the user picks or creates another.
export const DEFAULT_VENUE: Venue = GOSH_VENUE

export function getVenueBySlug(slug: string, extra: Venue[] = []): Venue | undefined {
  return [...SEED_VENUES, ...extra].find((v) => v.slug === slug)
}

// Public venues are discoverable by anyone. Unlisted/private venues are
// deliberately excluded here — they surface only to people with the link or an
// explicit grant (enforced for real once accounts land in a later phase).
export function listPublicVenues(extra: Venue[] = []): Venue[] {
  return [...SEED_VENUES, ...extra].filter((v) => v.visibility === "public")
}
