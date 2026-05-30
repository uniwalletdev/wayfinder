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

export type TransportMode = "walking" | "driving" | "cycling" | "wheelchair" | "transit"

export interface NavNode {
  id: string
  coordinates: Coordinates
  floor: number
  waypointId?: string
}

export interface NavEdge {
  from: string
  to: string
  accessible: boolean
  type: "corridor" | "stairs" | "lift"
}

export interface NavGraph {
  nodes: Record<string, NavNode>
  edges: NavEdge[]
}

export interface FloorPlan {
  id: string
  floor: number
  label: string
  imageUrl: string
  bounds: [[number, number], [number, number]]
}

export interface OutdoorStep {
  instruction: string
  distance: number
}

export interface OutdoorLeg {
  mode: TransportMode
  polyline: Coordinates[]
  distance: number
  duration: number
  steps: OutdoorStep[]
}

export interface Route {
  steps: RouteStep[]
  totalDistance: number
  estimatedMinutes: number
  floorChanges: number
  transportMode: TransportMode
  isMapped: boolean
  indoorPath: Coordinates[]
  outdoorLeg?: OutdoorLeg
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
