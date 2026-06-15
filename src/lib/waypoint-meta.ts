import { Waypoint, FloorPlan, Coordinates } from "./types"

// Generic, venue-agnostic presentation helpers for waypoints and floors. These
// used to live in `gosh-data.ts`, hard-wired to a single hospital; they are now
// shared by every venue so any mapped place can render the same way.

export const WAYPOINT_TYPE_ICONS: Record<string, string> = {
  ward: "🏥",
  department: "🏢",
  lift: "🛗",
  stairs: "🪜",
  toilet: "🚻",
  exit: "🚪",
  reception: "💁",
  canteen: "🍽️",
  pharmacy: "💊",
  other: "📍",
}

export const WAYPOINT_TYPE_LABELS: Record<string, string> = {
  ward: "Ward",
  department: "Department",
  lift: "Lift",
  stairs: "Stairs",
  toilet: "Toilets",
  exit: "Exit / Entrance",
  reception: "Reception",
  canteen: "Café / Restaurant",
  pharmacy: "Pharmacy",
  other: "Other",
}

export function floorLabel(floor: number): string {
  if (floor === 0) return "Ground Floor"
  if (floor < 0) return `Basement ${Math.abs(floor)}`
  return `Floor ${floor}`
}

export function floorShortLabel(floor: number): string {
  if (floor === 0) return "G"
  if (floor < 0) return `B${Math.abs(floor)}`
  return String(floor)
}

// Build the list of floors that actually have data, rather than a fixed list.
// Combines floors that have a plan with any floor referenced by a waypoint, so
// that surveyed/custom locations on new floors automatically become selectable.
export function getAvailableFloors(floorPlans: FloorPlan[], waypoints: Waypoint[]): number[] {
  const floors = new Set<number>(floorPlans.map((fp) => fp.floor))
  waypoints.forEach((w) => floors.add(w.floor))
  return [...floors].sort((a, b) => a - b)
}

// Whether a position falls inside the venue's mapped building footprint (the
// union of its floor plan bounds). GPS gives no floor, but it does tell us
// indoors-vs-outdoors well enough to drive the 3D ⇄ 2D view switch. A positive
// marginMeters expands the footprint — callers use it as hysteresis so a
// jittery GPS fix at the building edge doesn't flap between the two states. A
// venue with no floor plans has no footprint, so this is always false there.
export function isInsideBuilding(c: Coordinates, floorPlans: FloorPlan[], marginMeters = 0): boolean {
  const dLat = marginMeters / 111320
  const dLng = marginMeters / (111320 * Math.cos((c.lat * Math.PI) / 180))
  return floorPlans.some(({ bounds: [[s, w], [n, e]] }) =>
    c.lat >= s - dLat && c.lat <= n + dLat && c.lng >= w - dLng && c.lng <= e + dLng
  )
}
