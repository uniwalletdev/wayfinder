import { Waypoint, FloorPlan, WaypointType, FloorNaming } from "./types"

// Generic, venue-agnostic presentation helpers for waypoints and floors. These
// used to live in `gosh-data.ts`, hard-wired to a single hospital; they are now
// shared by every venue so any mapped place can render the same way.

export const ALL_WAYPOINT_TYPES: WaypointType[] = [
  "ward", "department", "lift", "stairs", "toilet",
  "exit", "reception", "canteen", "pharmacy", "other",
]

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

// Full label for a floor. A venue can override the generic scheme with its own
// storey numbering (e.g. GOSH's "Level 2" ground floor); without one, floor 0
// is the Ground Floor, positives are Floor N and negatives are Basement N.
export function floorLabel(floor: number, naming?: FloorNaming): string {
  if (naming) return `${naming.word ?? "Level"} ${floor + naming.groundLevel}`
  if (floor === 0) return "Ground Floor"
  if (floor < 0) return `Basement ${Math.abs(floor)}`
  return `Floor ${floor}`
}

// Compact label for the floor rail. Mirrors floorLabel: with a venue scheme it
// uses the word's initial + level number (GOSH → "L2"…"L5"); otherwise G / N / BN.
export function floorShortLabel(floor: number, naming?: FloorNaming): string {
  if (naming) return `${(naming.word ?? "Level").charAt(0).toUpperCase()}${floor + naming.groundLevel}`
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
