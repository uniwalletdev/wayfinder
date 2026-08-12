import type { Tone } from "./ui"
import type { CoverageTier } from "@/lib/admin/catalog"
import type { DemandResolution, VenueStatus } from "@/lib/admin/types"

// One place to decide what each state is called and how it is toned.
//
// Two reasons it lives apart from the components. First, consistency: "held for
// review" must read the same on the dashboard, the venue table and the venue
// page, or an operator has to learn three vocabularies for one thing. Second,
// plain English: the database says 'pending' and 'not_a_place' because columns
// need short values, but nobody administering a hospital map should have to
// translate a database enum in their head.

export function statusBadge(status: VenueStatus): { label: string; tone: Tone } {
  switch (status) {
    case "published":
      return { label: "Listed", tone: "good" }
    case "pending":
      return { label: "Held for review", tone: "warn" }
    case "suppressed":
      return { label: "Hidden", tone: "bad" }
  }
}

/** What the status actually does to a navigator's experience. */
export const STATUS_MEANING: Record<VenueStatus, string> = {
  published: "Offered in the app, as far as its own visibility setting allows.",
  pending:
    "Not listed anywhere in the app. Whoever created it can still open it by link — everyone else sees nothing.",
  suppressed: "Not reachable in the app at all, by link or otherwise. Kept in the database, and reversible.",
}

export function visibilityLabel(visibility: string): { label: string; tone: Tone; meaning: string } {
  switch (visibility) {
    case "public":
      return { label: "Public", tone: "info", meaning: "Listed in the venue picker for everyone." }
    case "unlisted":
      return { label: "Unlisted", tone: "neutral", meaning: "Not listed — reachable only by someone with the link." }
    default:
      return { label: "Private", tone: "neutral", meaning: "Not listed. Intended for the people who mapped it." }
  }
}

export function tierLabel(tier: CoverageTier): { label: string; tone: Tone; meaning: string } {
  switch (tier) {
    case "navigable":
      return {
        label: "Navigable",
        tone: "good",
        meaning: "Has floor plans and named places — someone can search a ward and be walked to it.",
      }
    case "sheet":
      return {
        label: "Plan only",
        tone: "info",
        meaning: "The site plan is placed on the map, but nothing on it is named yet.",
      }
    case "located":
      return { label: "Located pin", tone: "neutral", meaning: "A position on the map and nothing inside it." }
  }
}

export const RESOLUTIONS: { value: DemandResolution; label: string; description: string }[] = [
  { value: "mapped", label: "Now mapped", description: "The place exists and has been added to the venue." },
  { value: "not_a_place", label: "Not a place", description: "A name, a condition, a typo — nothing to map." },
  { value: "duplicate", label: "Already there", description: "The place is mapped under a different name." },
  { value: "wont_fix", label: "Leaving it", description: "Real, but deliberately not being mapped." },
]

export function resolutionLabel(resolution: DemandResolution | null): string {
  if (!resolution) return "Open"
  return RESOLUTIONS.find((r) => r.value === resolution)?.label ?? resolution
}

export const WAYPOINT_TYPES = [
  "ward",
  "department",
  "lift",
  "stairs",
  "toilet",
  "exit",
  "reception",
  "canteen",
  "pharmacy",
  "other",
] as const

export const VENUE_CATEGORIES = [
  "hospital",
  "mall",
  "airport",
  "station",
  "university",
  "office",
  "home",
  "other",
] as const

/** "not_a_place" → "Not a place". For values with no curated label. */
export function humanise(value: string): string {
  const spaced = value.replace(/[_.]/g, " ")
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}
