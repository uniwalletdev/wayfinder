// Shapes the back office reads and renders. Kept apart from src/lib/types.ts —
// that file describes what the *app* navigates (a Venue has floor plans and
// waypoints because a map needs them); these describe what an *operator*
// reviews, which is mostly provenance and counts, and includes fields no
// navigator is ever shown.

export type VenueStatus = "published" | "pending" | "suppressed"

export type DemandResolution = "mapped" | "not_a_place" | "duplicate" | "wont_fix"

/** A shared venue as the moderation table shows it. */
export interface AdminVenue {
  id: string
  slug: string | null
  name: string
  subtitle: string | null
  category: string
  centerLat: number
  centerLng: number
  defaultZoom: number
  visibility: "public" | "unlisted" | "private"
  status: VenueStatus
  verified: boolean
  reviewNote: string | null
  reviewedAt: string | null
  reviewedBy: string | null
  createdAt: string
  updatedAt: string
  waypointCount: number
  signalCount: number
}

export interface AdminWaypoint {
  id: string
  venueId: string
  name: string
  type: string
  lat: number
  lng: number
  floor: number
  description: string | null
  createdAt: string
}

/** One search that found nothing, folded together with every repeat of it. */
export interface DemandRow {
  venueKey: string
  venueLabel: string
  query: string
  hits: number
  firstSeen: string
  lastSeen: string
  suggested: boolean
  resolution: DemandResolution | null
  resolvedAt: string | null
  resolvedBy: string | null
}

export interface AuditEntry {
  id: string
  actor: string
  action: string
  targetType: string | null
  targetId: string | null
  summary: string
  detail: Record<string, unknown>
  createdAt: string
}

/** One day's counts, for the sparklines and bar charts. */
export interface DayPoint {
  day: string // YYYY-MM-DD
  signals: number
  misses: number
  venues: number
}

export interface VenueActivity {
  venueKey: string
  venueLabel: string
  source: "shared" | "catalog" | "device" | "unknown"
  trails: number
  devices: number
  lastSeen: string
}

export interface Overview {
  venues: {
    total: number
    published: number
    pending: number
    suppressed: number
    verified: number
    listed: number
    newLast7: number
    emptyOfWaypoints: number
  }
  waypoints: { total: number }
  signals: { total: number; last24h: number; last7d: number; devices30d: number; venues30d: number }
  demand: { open: number; total: number; last7d: number }
  series: DayPoint[]
  topDemand: DemandRow[]
  recentVenues: AdminVenue[]
  recentAudit: AuditEntry[]
}

/** Reads either succeed, or say why not — pages render the reason, never a stack. */
export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; reason: "unconfigured" | "error"; message: string }

export const UNCONFIGURED: Result<never> = {
  ok: false,
  reason: "unconfigured",
  message: "No database is configured, so there is no pooled data to manage.",
}

/** What a Server Action hands back to the form that called it. */
export type ActionState = { ok: boolean; message: string } | null
