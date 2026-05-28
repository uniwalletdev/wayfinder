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
}

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

export interface NavigationState {
  currentPosition: Coordinates | null
  currentFloor: number
  destination: Waypoint | null
  route: Route | null
  currentStepIndex: number
  isNavigating: boolean
  positionAccuracy: number
}

export interface Venue {
  id: number
  name: string
  address?: string
  city?: string
  lat?: number
  lng?: number
  waypoint_count?: number
}
