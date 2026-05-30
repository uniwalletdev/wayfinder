// Venue-agnostic display helpers — icon and label maps for WaypointType.
// All actual GOSH venue data now lives in src/data/gosh-venue.ts.

export const WAYPOINT_TYPE_ICONS: Record<string, string> = {
  ward:       "🏥",
  department: "🏢",
  lift:       "🛗",
  stairs:     "🪜",
  toilet:     "🚻",
  exit:       "🚪",
  reception:  "💁",
  canteen:    "🍽️",
  pharmacy:   "💊",
  other:      "📍",
}

export const WAYPOINT_TYPE_LABELS: Record<string, string> = {
  ward:       "Ward",
  department: "Department",
  lift:       "Lift",
  stairs:     "Stairs",
  toilet:     "Toilets",
  exit:       "Exit / Entrance",
  reception:  "Reception",
  canteen:    "Café / Restaurant",
  pharmacy:   "Pharmacy",
  other:      "Other",
}
