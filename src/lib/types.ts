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

export interface FloorPlan {
  id: string
  floor: number
  label: string
  imageUrl: string
  bounds: [[number, number], [number, number]]
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
