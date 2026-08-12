import type { VenueStatus } from "./types"

// Whether a venue created through the app is listed straight away, or waits for
// somebody to look at it.
//
// The tension here is real and worth stating rather than resolving silently.
// POST /api/venues needs no account: that is what lets a ward clerk map their
// own department in ten minutes, and it is the reason the app has any coverage
// at all. It also means anything anyone types is, by default, offered to every
// user in the venue picker alongside Great Ormond Street.
//
// So the mode is a deployment decision, not a code one:
//
//   open (default) — a new venue is listed immediately. Preserves exactly the
//     behaviour the app had before the back office existed; an operator sees it
//     in the moderation queue afterwards and can hide it.
//
//   queue — a new venue is held. It is reachable by whoever created it (they
//     hold its link and its edit token) but appears in nobody's picker until an
//     administrator lists it. The right setting the moment the app is public.
//
// Default is `open` deliberately: adding this schema to a running deployment
// must not silently stop listing venues that a mapper is, at that moment, in the
// middle of creating.

export type ModerationMode = "open" | "queue"

export function moderationMode(): ModerationMode {
  const raw = (process.env.WAYFINDER_VENUE_MODERATION ?? "").trim().toLowerCase()
  return raw === "queue" || raw === "review" || raw === "hold" ? "queue" : "open"
}

/** The status a brand-new venue is written with. */
export function initialVenueStatus(): VenueStatus {
  return moderationMode() === "queue" ? "pending" : "published"
}
