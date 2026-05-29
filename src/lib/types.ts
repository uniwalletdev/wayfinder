export interface Coordinates {
  lat: number
  lng: number
}

/**
 * A wayfinding site — e.g. a hospital, campus or large building complex.
 * The app is generic: GOSH is one site, but more can be registered (see lib/sites).
 */
export interface Site {
  id: string
  name: string
  shortName: string
  description?: string
  center: Coordinates
  defaultZoom: number
  brandColor: string
  /** Georeferenced site map image laid over the real-world map. */
  map: {
    imageUrl: string
    /** Leaflet bounds: [[south, west], [north, east]]. */
    bounds: [[number, number], [number, number]]
  }
}

/** A physical building within a site. */
export interface Building {
  id: string
  name: string
  fullName: string
  aliases: string[]
  coordinates: Coordinates
  /** true when the position was read off the official map; false = approximate. */
  precise: boolean
}

export type LocationType =
  | "ward"
  | "clinical"
  | "clinical-support"
  | "non-clinical-support"
  | "office"
  | "storage"
  | "residential"
  | "teaching-research"
  | "changing"
  | "theatres"
  | "workshop"
  | "entrance"
  | "other"

/** Access category for a location. */
export type AccessLevel = "public" | "staff" | "other"

/**
 * A ward, department, office or amenity. Coordinates resolve to the parent
 * building (room-level coordinates are not available in the source data),
 * so a location pin marks the correct building plus its floor/side.
 */
export interface MapLocation {
  id: string
  name: string
  type: LocationType
  /** Emoji used as the marker / list glyph. */
  icon: string
  buildingId: string
  building: string
  /** Normalised floor number (0 = ground), or null when unknown. */
  floor: number | null
  floorLabel: string
  /** Raw side/wing code from the directory (e.g. "E", "W", "B"), or "". */
  side: string
  sideLabel: string
  access: AccessLevel
  status: string
  description?: string
  coordinates: Coordinates
  qrCode?: string
}

// Backwards-compatible alias — older components referred to locations as Waypoints.
export type Waypoint = MapLocation
export type WaypointType = LocationType

export interface Route {
  steps: RouteStep[]
  totalDistance: number
  estimatedMinutes: number
  destination: MapLocation
}

export interface RouteStep {
  instruction: string
  distance: number
  heading: number
  waypoint?: MapLocation
}

export interface SurveyFrame {
  timestamp: number
  imageData: string
  coordinates: Coordinates
  heading: number
  floor: number
  annotation?: string
}

export interface NavigationState {
  currentPosition: Coordinates | null
  destination: MapLocation | null
  route: Route | null
  currentStepIndex: number
  isNavigating: boolean
  positionAccuracy: number
}
