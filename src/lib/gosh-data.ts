import { Building, LocationType, MapLocation } from "./types"
import { getSite } from "./sites"

// Active site (GOSH by default). Swap the id here — or add a picker — to support
// additional sites; everything below is derived generically from the dataset.
const active = getSite()

export const ACTIVE_SITE = active.site
export const GOSH_CENTER = active.site.center
export const SITE_MAP = active.site.map

export const GOSH_BUILDINGS: Building[] = active.buildings
export const GOSH_LOCATIONS: MapLocation[] = active.locations
// Legacy name kept so existing imports keep resolving.
export const GOSH_WAYPOINTS: MapLocation[] = active.locations

const buildingById = new Map(active.buildings.map((b) => [b.id, b]))
export function getBuilding(id: string): Building | undefined {
  return buildingById.get(id)
}

/** Locations grouped by building id (directory order preserved). */
export function locationsByBuilding(): Map<string, MapLocation[]> {
  const m = new Map<string, MapLocation[]>()
  for (const l of active.locations) {
    const arr = m.get(l.buildingId) ?? []
    arr.push(l)
    m.set(l.buildingId, arr)
  }
  return m
}

export const WAYPOINT_TYPE_ICONS: Record<LocationType, string> = {
  ward: "🛏️",
  clinical: "🩺",
  "clinical-support": "🔬",
  "non-clinical-support": "🛎️",
  office: "🏢",
  storage: "📦",
  residential: "🏨",
  "teaching-research": "📚",
  changing: "🚿",
  theatres: "🔪",
  workshop: "🛠️",
  entrance: "🚪",
  other: "📍",
}

export const WAYPOINT_TYPE_LABELS: Record<LocationType, string> = {
  ward: "Ward",
  clinical: "Clinical",
  "clinical-support": "Clinical support",
  "non-clinical-support": "Support services",
  office: "Office",
  storage: "Storage",
  residential: "Residential",
  "teaching-research": "Teaching & research",
  changing: "Changing facilities",
  theatres: "Theatres",
  workshop: "Workshop",
  entrance: "Entrance",
  other: "Other",
}

/** Categories surfaced as filter chips in search (rest grouped under "More"). */
export const PRIMARY_CATEGORIES: LocationType[] = [
  "ward",
  "clinical",
  "clinical-support",
  "entrance",
  "office",
]
