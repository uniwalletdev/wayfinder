import { Waypoint, SurveyTrail } from "./types"

// User-created waypoints (added via Survey Mode) and the walked breadcrumb
// trails are persisted in the browser so that areas you map yourself survive a
// reload instead of being discarded.
const STORAGE_KEY = "wayfinder.customWaypoints"
const TRAILS_KEY = "wayfinder.surveyTrails"
// GPS can't tell us the floor, so remember the last one the user was on
// (set via the floor selector, a QR scan, or finishing a survey) across visits.
const FLOOR_KEY = "wayfinder.currentFloor"

export function loadCustomWaypoints(): Waypoint[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as Waypoint[]) : []
  } catch {
    return []
  }
}

export function saveCustomWaypoints(waypoints: Waypoint[]): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(waypoints))
  } catch {
    // Storage may be unavailable (private mode, quota) — fail silently.
  }
}

export function loadSurveyTrails(): SurveyTrail[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(TRAILS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as SurveyTrail[]) : []
  } catch {
    return []
  }
}

export function saveSurveyTrails(trails: SurveyTrail[]): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(TRAILS_KEY, JSON.stringify(trails))
  } catch {
    // Storage may be unavailable (private mode, quota) — fail silently.
  }
}

export function loadLastFloor(): number | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(FLOOR_KEY)
    if (raw === null) return null
    const floor = parseInt(raw, 10)
    return Number.isFinite(floor) ? floor : null
  } catch {
    return null
  }
}

export function saveLastFloor(floor: number): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(FLOOR_KEY, String(floor))
  } catch {
    // Storage may be unavailable (private mode, quota) — fail silently.
  }
}
