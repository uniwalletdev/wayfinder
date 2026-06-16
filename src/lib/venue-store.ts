import { Venue, Waypoint, SurveyTrail } from "./types"

// Client-side persistence for venues the user creates and the places they map
// inside them. Everything lives in localStorage for now — a later phase moves
// this behind accounts + a database so public venues are shareable and private
// ones are genuinely access-controlled rather than device-local.
//
// Layout:
//   wayfinder.userVenues                 -> Venue[]        (user-created venues)
//   wayfinder.activeVenueId              -> string         (last selected venue)
//   wayfinder.venue.<id>.waypoints       -> Waypoint[]     (points mapped in venue)
//   wayfinder.venue.<id>.trails          -> SurveyTrail[]  (walked breadcrumbs)

const VENUES_KEY = "wayfinder.userVenues"
const ACTIVE_KEY = "wayfinder.activeVenueId"
const wpKey = (venueId: string) => `wayfinder.venue.${venueId}.waypoints`
const trailKey = (venueId: string) => `wayfinder.venue.${venueId}.trails`
// GPS can't sense which floor you're on, so remember the last one per venue
// (set via the selector, a QR scan, or finishing a survey) across visits.
const floorKey = (venueId: string) => `wayfinder.venue.${venueId}.floor`

// Pre-multi-venue keys. Anything saved under these belonged to the single
// hard-coded venue, so we fold them into it the first time we load.
const LEGACY_WP_KEY = "wayfinder.customWaypoints"
const LEGACY_TRAILS_KEY = "wayfinder.surveyTrails"
const LEGACY_FLOOR_KEY = "wayfinder.currentFloor"

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    return parsed as T
  } catch {
    return fallback
  }
}

function writeJSON(key: string, value: unknown): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage may be unavailable (private mode, quota) — fail silently.
  }
}

export function loadUserVenues(): Venue[] {
  const v = readJSON<Venue[]>(VENUES_KEY, [])
  return Array.isArray(v) ? v : []
}

export function saveUserVenues(venues: Venue[]): void {
  writeJSON(VENUES_KEY, venues)
}

export function loadActiveVenueId(): string | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage.getItem(ACTIVE_KEY)
  } catch {
    return null
  }
}

export function saveActiveVenueId(id: string): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(ACTIVE_KEY, id)
  } catch {
    // ignore
  }
}

export function loadVenueWaypoints(venueId: string): Waypoint[] {
  const v = readJSON<Waypoint[]>(wpKey(venueId), [])
  return Array.isArray(v) ? v : []
}

export function saveVenueWaypoints(venueId: string, waypoints: Waypoint[]): void {
  writeJSON(wpKey(venueId), waypoints)
}

export function loadVenueTrails(venueId: string): SurveyTrail[] {
  const v = readJSON<SurveyTrail[]>(trailKey(venueId), [])
  return Array.isArray(v) ? v : []
}

export function saveVenueTrails(venueId: string, trails: SurveyTrail[]): void {
  writeJSON(trailKey(venueId), trails)
}

export function loadVenueFloor(venueId: string): number | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(floorKey(venueId))
    if (raw === null) return null
    const floor = parseInt(raw, 10)
    return Number.isFinite(floor) ? floor : null
  } catch {
    return null
  }
}

export function saveVenueFloor(venueId: string, floor: number): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(floorKey(venueId), String(floor))
  } catch {
    // Storage may be unavailable (private mode, quota) — fail silently.
  }
}

// One-time migration: move any pre-multi-venue custom waypoints/trails onto the
// default venue, then clear the legacy keys so this is a no-op afterwards.
export function migrateLegacyData(defaultVenueId: string): void {
  if (typeof window === "undefined") return
  try {
    const legacyWp = window.localStorage.getItem(LEGACY_WP_KEY)
    if (legacyWp && !window.localStorage.getItem(wpKey(defaultVenueId))) {
      window.localStorage.setItem(wpKey(defaultVenueId), legacyWp)
    }
    if (legacyWp) window.localStorage.removeItem(LEGACY_WP_KEY)

    const legacyTrails = window.localStorage.getItem(LEGACY_TRAILS_KEY)
    if (legacyTrails && !window.localStorage.getItem(trailKey(defaultVenueId))) {
      window.localStorage.setItem(trailKey(defaultVenueId), legacyTrails)
    }
    if (legacyTrails) window.localStorage.removeItem(LEGACY_TRAILS_KEY)

    const legacyFloor = window.localStorage.getItem(LEGACY_FLOOR_KEY)
    if (legacyFloor && !window.localStorage.getItem(floorKey(defaultVenueId))) {
      window.localStorage.setItem(floorKey(defaultVenueId), legacyFloor)
    }
    if (legacyFloor) window.localStorage.removeItem(LEGACY_FLOOR_KEY)
  } catch {
    // ignore
  }
}

// Remove a user-created venue and the data mapped inside it.
export function deleteUserVenue(venueId: string): void {
  if (typeof window === "undefined") return
  try {
    const remaining = loadUserVenues().filter((v) => v.id !== venueId)
    saveUserVenues(remaining)
    window.localStorage.removeItem(wpKey(venueId))
    window.localStorage.removeItem(trailKey(venueId))
    window.localStorage.removeItem(floorKey(venueId))
  } catch {
    // ignore
  }
}
