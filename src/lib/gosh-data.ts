import { Waypoint, FloorPlan } from "./types"
import { DoorOpen, Cross, Pill, UtensilsCrossed, type LucideIcon } from "lucide-react"

// GOSH approximate center coordinates
export const GOSH_CENTER = { lat: 51.5225, lng: -0.1199 }

export const GOSH_WAYPOINTS: Waypoint[] = [
  // Ground Floor — coordinates derived from SVG room centres mapped to floor plan bounds
  { id: "ae-entrance",  name: "A&E Entrance",      type: "exit",      coordinates: { lat: 51.522829, lng: -0.120551 }, floor: 0, description: "Emergency department entrance" },
  { id: "stairs-1-gf", name: "Staircase 1",        type: "stairs",    coordinates: { lat: 51.522829, lng: -0.120143 }, floor: 0 },
  { id: "pharmacy-gf", name: "Pharmacy",           type: "pharmacy",  coordinates: { lat: 51.522829, lng: -0.119622 }, floor: 0, description: "Main pharmacy" },
  { id: "lift-b-gf",   name: "Lift B",             type: "lift",      coordinates: { lat: 51.522829, lng: -0.119236 }, floor: 0 },
  { id: "lift-a-gf",   name: "Lift A",             type: "lift",      coordinates: { lat: 51.522374, lng: -0.119878 }, floor: 0 },
  { id: "canteen-gf",  name: "Restaurant & Café",  type: "canteen",   coordinates: { lat: 51.522159, lng: -0.120551 }, floor: 0, description: "Patient and visitor restaurant" },
  { id: "toilet-gf",   name: "Toilets",            type: "toilet",    coordinates: { lat: 51.522159, lng: -0.120143 }, floor: 0 },
  { id: "reception",   name: "Main Reception",     type: "reception", coordinates: { lat: 51.522159, lng: -0.119622 }, floor: 0, description: "Main reception desk" },
  { id: "main-entrance", name: "Main Entrance",    type: "reception", coordinates: { lat: 51.522159, lng: -0.119236 }, floor: 0, description: "Great Ormond Street main entrance" },

  // Floor 1
  { id: "ward-1a",       name: "Ward 1A",             type: "ward",       coordinates: { lat: 51.522829, lng: -0.120346 }, floor: 1, description: "Haematology ward" },
  { id: "ward-1b",       name: "Ward 1B",             type: "ward",       coordinates: { lat: 51.522829, lng: -0.119431 }, floor: 1, description: "Oncology ward" },
  { id: "lift-a-f1",     name: "Lift A — Floor 1",    type: "lift",       coordinates: { lat: 51.522374, lng: -0.119878 }, floor: 1 },
  { id: "outpatients-1", name: "Outpatients Clinic 1",type: "department", coordinates: { lat: 51.522159, lng: -0.120346 }, floor: 1 },
  { id: "toilet-f1",     name: "Toilets — Floor 1",   type: "toilet",     coordinates: { lat: 51.522159, lng: -0.119431 }, floor: 1 },

  // Floor 2
  { id: "ward-2a",   name: "Ward 2A",          type: "ward",       coordinates: { lat: 51.522829, lng: -0.120346 }, floor: 2, description: "Cardiology ward" },
  { id: "ward-2b",   name: "Ward 2B",          type: "ward",       coordinates: { lat: 51.522829, lng: -0.119431 }, floor: 2, description: "Neurology ward" },
  { id: "lift-a-f2", name: "Lift A — Floor 2", type: "lift",       coordinates: { lat: 51.522374, lng: -0.119878 }, floor: 2 },
  { id: "xray",      name: "X-Ray & Imaging",  type: "department", coordinates: { lat: 51.522159, lng: -0.120346 }, floor: 2, description: "Radiology department" },
  { id: "toilet-f2", name: "Toilets — Floor 2",type: "toilet",     coordinates: { lat: 51.522159, lng: -0.119431 }, floor: 2 },

  // Floor 3
  { id: "ward-3a",   name: "Ward 3A",           type: "ward",       coordinates: { lat: 51.522829, lng: -0.120551 }, floor: 3, description: "Surgical ward" },
  { id: "ward-3b",   name: "Ward 3B",           type: "ward",       coordinates: { lat: 51.522829, lng: -0.120143 }, floor: 3, description: "Critical care" },
  { id: "ward-5b",   name: "Ward 5B",           type: "ward",       coordinates: { lat: 51.522829, lng: -0.119431 }, floor: 3, description: "General paediatrics" },
  { id: "lift-a-f3", name: "Lift A — Floor 3",  type: "lift",       coordinates: { lat: 51.522374, lng: -0.119878 }, floor: 3 },
  { id: "theatre",   name: "Operating Theatres",type: "department", coordinates: { lat: 51.522159, lng: -0.120346 }, floor: 3, description: "Surgical theatres" },
  { id: "toilet-f3", name: "Toilets — Floor 3", type: "toilet",     coordinates: { lat: 51.522159, lng: -0.119431 }, floor: 3 },
]

export const FLOOR_PLANS: FloorPlan[] = [
  { id: "gf", floor: 0, label: "Ground", imageUrl: "/floorplans/ground.svg", bounds: [[51.5218, -0.1208], [51.5232, -0.1190]] },
  { id: "f1", floor: 1, label: "Floor 1", imageUrl: "/floorplans/floor1.svg", bounds: [[51.5218, -0.1208], [51.5232, -0.1190]] },
  { id: "f2", floor: 2, label: "Floor 2", imageUrl: "/floorplans/floor2.svg", bounds: [[51.5218, -0.1208], [51.5232, -0.1190]] },
  { id: "f3", floor: 3, label: "Floor 3", imageUrl: "/floorplans/floor3.svg", bounds: [[51.5218, -0.1208], [51.5232, -0.1190]] },
]

// Build the list of floors that actually have data, rather than a fixed list.
// Combines floors that have a plan with any floor referenced by a waypoint, so
// that surveyed/custom locations on new floors automatically become selectable.
export function getAvailableFloors(waypoints: Waypoint[] = GOSH_WAYPOINTS): number[] {
  const floors = new Set<number>(FLOOR_PLANS.map((fp) => fp.floor))
  waypoints.forEach((w) => floors.add(w.floor))
  return [...floors].sort((a, b) => a - b)
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

// "Favourites" row shown on the idle sheet and search screen — Apple Maps'
// Home/Work shortcuts, adapted to the destinations visitors look for most.
export interface QuickAccessItem {
  waypointId: string
  label: string
  icon: LucideIcon
}

export const QUICK_ACCESS: QuickAccessItem[] = [
  { waypointId: "main-entrance", label: "Entrance", icon: DoorOpen },
  { waypointId: "ae-entrance", label: "A&E", icon: Cross },
  { waypointId: "pharmacy-gf", label: "Pharmacy", icon: Pill },
  { waypointId: "canteen-gf", label: "Café", icon: UtensilsCrossed },
]

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
