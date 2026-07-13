export interface Coordinates {
  lat: number
  lng: number
}

export interface Waypoint {
  id: string
  name: string
  type: WaypointType
  coordinates: Coordinates
  floor: number
  description?: string
  qrCode?: string
  // Which side of the walking direction the place sits on, as read from the
  // survey footage. Drives which side of the corridor its room is drawn on in
  // the generated floor schematic. Absent when unknown.
  side?: "left" | "right" | "ahead"
  // Venue-authored arrival context, shown on the destination card once someone
  // is on their way. All optional — most waypoints won't have any of this.
  hours?: string
  arrivalNotes?: string
  typicalWait?: string
}

export type WaypointType =
  | "ward"
  | "department"
  | "lift"
  | "stairs"
  | "toilet"
  | "exit"
  | "reception"
  | "canteen"
  | "pharmacy"
  | "other"

// A fixed facility element placed at a precise point — the kind of thing a
// "proper" CAD/BIM plan carries as located symbols: plug sockets, data points,
// fire equipment, etc. Assets are NOT wayfinding destinations and never take
// part in routing or search; they render as a separate, toggleable overlay for
// facilities/estates views. Kept deliberately separate from Waypoint so mapping
// a socket can't accidentally become "navigate me to a socket".
export type AssetCategory =
  | "power"
  | "data"
  | "lighting"
  | "fire"
  | "plumbing"
  | "hvac"
  | "security"
  | "other"

export interface Asset {
  id: string
  name: string
  category: AssetCategory
  coordinates: Coordinates
  floor: number
  // Where it came from, e.g. the CAD layer/block it was read off.
  source?: string
}

export interface FloorPlan {
  id: string
  floor: number
  label: string
  imageUrl: string
  bounds: [[number, number], [number, number]]
}

// A mappable place. Replaces the single hard-coded hospital: anywhere — public
// (a mall, station, hospital) or private (an office, clinic, home) — is modelled
// as a Venue, which is what makes "map any place" possible.
export type VenueVisibility = "public" | "unlisted" | "private"

export type VenueCategory =
  | "hospital"
  | "mall"
  | "airport"
  | "station"
  | "university"
  | "office"
  | "home"
  | "other"

// Accessibility & safety facts a place may need to surface. Optional everywhere
// so a quick survey isn't blocked, but encouraged for public venues people rely on.
export interface AccessibilityInfo {
  stepFreeRoute?: boolean
  accessibleToilets?: boolean
  hearingLoop?: boolean
  notes?: string
}

// How a venue numbers its storeys for display. Most places use the generic
// Ground Floor / Floor N scheme, so they set nothing. Some number differently:
// Great Ormond Street Hospital's street-level main entrance is "Level 2" (the
// site slopes, with levels below it), so it sets { word: "Level", groundLevel: 2 }
// and its floors read Level 2 (the entrance) upward. This only changes the
// labels shown to people — internal floor indices stay 0-based for routing,
// geometry and floor plans.
export interface FloorNaming {
  // The word shown before the number, e.g. "Level". Defaults to "Level" when a
  // groundLevel is given.
  word?: string
  // The level number displayed for internal floor 0 (the entrance/ground floor).
  groundLevel: number
}

export interface Venue {
  id: string
  slug: string
  name: string
  // Optional second line, e.g. the full official name of the place.
  subtitle?: string
  category: VenueCategory
  center: Coordinates
  defaultZoom: number
  floorPlans: FloorPlan[]
  waypoints: Waypoint[]
  // Who can find and navigate this venue. Drives the "measures required
  // accordingly": discovery, consent, and (with accounts) access enforcement.
  visibility: VenueVisibility
  // Ownership/authority confirmed — public venues earn a "verified" badge.
  verified: boolean
  // Set once accounts exist; until then venues are anonymous/local.
  ownerId?: string
  accessibility?: AccessibilityInfo
  // Non-standard storey numbering (e.g. GOSH's "Level 2" ground floor). Absent
  // for venues that use the plain Ground Floor / Floor N scheme.
  floorNaming?: FloorNaming
  // Located facility fixtures (plug sockets, data points, fire equipment…),
  // typically read off a CAD plan. A separate overlay layer — not routable.
  assets?: Asset[]
  // The venue's own walkable corridor network (corridor centre-lines per
  // floor), in the same shape Survey Mode records. Routing merges these with
  // the user's walked trails so indoor routes follow the mapped corridors
  // instead of cutting through rooms. Unlike walked trails they are not drawn
  // on the map — the floor-plan image already shows the corridors.
  trails?: SurveyTrail[]
  // Waypoint names to surface as shortcuts in search.
  quickAccess?: string[]
  createdAt?: string
  updatedAt?: string
}

export interface Route {
  steps: RouteStep[]
  totalDistance: number
  estimatedMinutes: number
  floorChanges: number
  // The line to actually draw on the map: real street/footpath geometry
  // outdoors, or a connected multi-point indoor path. Always has ≥2 points.
  geometry: Coordinates[]
  mode: TravelMode
  // True when the path came from real street routing (Mapbox Directions),
  // false for indoor waypoint-to-waypoint paths.
  outdoor: boolean
}

export type TravelMode = "walking" | "cycling" | "driving"

// Floor-change strategy: always use a lift ("stepfree"), or allow stairs when
// they're the quicker option ("fastest").
export type RoutePreference = "fastest" | "stepfree"

export interface RouteStep {
  instruction: string
  distance: number
  heading: number
  waypoint?: Waypoint
  floorChange?: { from: number; to: number; via: "lift" | "stairs" }
}

export interface SurveyFrame {
  timestamp: number
  imageData: string
  coordinates: Coordinates
  heading: number
  floor: number
  annotation?: string
}

export interface SurveyTrail {
  id: string
  floor: number
  points: Coordinates[]
}

export interface NavigationState {
  currentPosition: Coordinates | null
  currentFloor: number
  destination: Waypoint | null
  route: Route | null
  currentStepIndex: number
  isNavigating: boolean
  positionAccuracy: number
  travelMode: TravelMode
}
