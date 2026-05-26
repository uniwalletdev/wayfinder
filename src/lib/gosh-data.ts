import { Waypoint, FloorPlan } from "./types"

// GOSH approximate center coordinates
export const GOSH_CENTER = { lat: 51.5225, lng: -0.1199 }

export const GOSH_WAYPOINTS: Waypoint[] = [
  // Ground Floor
  { id: "main-entrance", name: "Main Entrance", type: "reception", coordinates: { lat: 51.5222, lng: -0.1201 }, floor: 0, description: "Great Ormond Street main entrance" },
  { id: "reception", name: "Main Reception", type: "reception", coordinates: { lat: 51.5223, lng: -0.1200 }, floor: 0, description: "Main reception desk" },
  { id: "pharmacy-gf", name: "Pharmacy", type: "pharmacy", coordinates: { lat: 51.5224, lng: -0.1198 }, floor: 0, description: "Main pharmacy" },
  { id: "lift-a-gf", name: "Lift A", type: "lift", coordinates: { lat: 51.5224, lng: -0.1199 }, floor: 0 },
  { id: "lift-b-gf", name: "Lift B", type: "lift", coordinates: { lat: 51.5225, lng: -0.1197 }, floor: 0 },
  { id: "stairs-1-gf", name: "Staircase 1", type: "stairs", coordinates: { lat: 51.5223, lng: -0.1202 }, floor: 0 },
  { id: "toilet-gf", name: "Toilets", type: "toilet", coordinates: { lat: 51.5222, lng: -0.1199 }, floor: 0 },
  { id: "canteen-gf", name: "Restaurant & Café", type: "canteen", coordinates: { lat: 51.5221, lng: -0.1200 }, floor: 0, description: "Patient and visitor restaurant" },
  { id: "ae-entrance", name: "A&E Entrance", type: "exit", coordinates: { lat: 51.5221, lng: -0.1202 }, floor: 0, description: "Emergency department entrance" },

  // Floor 1
  { id: "lift-a-f1", name: "Lift A — Floor 1", type: "lift", coordinates: { lat: 51.5224, lng: -0.1199 }, floor: 1 },
  { id: "ward-1a", name: "Ward 1A", type: "ward", coordinates: { lat: 51.5226, lng: -0.1197 }, floor: 1, description: "Haematology ward" },
  { id: "ward-1b", name: "Ward 1B", type: "ward", coordinates: { lat: 51.5227, lng: -0.1198 }, floor: 1, description: "Oncology ward" },
  { id: "outpatients-1", name: "Outpatients Clinic 1", type: "department", coordinates: { lat: 51.5225, lng: -0.1201 }, floor: 1 },
  { id: "toilet-f1", name: "Toilets — Floor 1", type: "toilet", coordinates: { lat: 51.5224, lng: -0.1202 }, floor: 1 },

  // Floor 2
  { id: "lift-a-f2", name: "Lift A — Floor 2", type: "lift", coordinates: { lat: 51.5224, lng: -0.1199 }, floor: 2 },
  { id: "ward-2a", name: "Ward 2A", type: "ward", coordinates: { lat: 51.5226, lng: -0.1195 }, floor: 2, description: "Cardiology ward" },
  { id: "ward-2b", name: "Ward 2B", type: "ward", coordinates: { lat: 51.5227, lng: -0.1196 }, floor: 2, description: "Neurology ward" },
  { id: "xray", name: "X-Ray & Imaging", type: "department", coordinates: { lat: 51.5225, lng: -0.1200 }, floor: 2, description: "Radiology department" },
  { id: "toilet-f2", name: "Toilets — Floor 2", type: "toilet", coordinates: { lat: 51.5223, lng: -0.1201 }, floor: 2 },

  // Floor 3
  { id: "lift-a-f3", name: "Lift A — Floor 3", type: "lift", coordinates: { lat: 51.5224, lng: -0.1199 }, floor: 3 },
  { id: "ward-3a", name: "Ward 3A", type: "ward", coordinates: { lat: 51.5228, lng: -0.1198 }, floor: 3, description: "Surgical ward" },
  { id: "ward-3b", name: "Ward 3B", type: "ward", coordinates: { lat: 51.5229, lng: -0.1197 }, floor: 3, description: "Critical care" },
  { id: "ward-5b", name: "Ward 5B", type: "ward", coordinates: { lat: 51.5230, lng: -0.1196 }, floor: 3, description: "General paediatrics" },
  { id: "theatre", name: "Operating Theatres", type: "department", coordinates: { lat: 51.5228, lng: -0.1200 }, floor: 3, description: "Surgical theatres" },
  { id: "toilet-f3", name: "Toilets — Floor 3", type: "toilet", coordinates: { lat: 51.5226, lng: -0.1202 }, floor: 3 },
]

export const FLOOR_PLANS: FloorPlan[] = [
  { id: "gf", floor: 0, label: "Ground", imageUrl: "/floorplans/ground.svg", bounds: [[51.5218, -0.1208], [51.5232, -0.1190]] },
  { id: "f1", floor: 1, label: "Floor 1", imageUrl: "/floorplans/floor1.svg", bounds: [[51.5218, -0.1208], [51.5232, -0.1190]] },
  { id: "f2", floor: 2, label: "Floor 2", imageUrl: "/floorplans/floor2.svg", bounds: [[51.5218, -0.1208], [51.5232, -0.1190]] },
  { id: "f3", floor: 3, label: "Floor 3", imageUrl: "/floorplans/floor3.svg", bounds: [[51.5218, -0.1208], [51.5232, -0.1190]] },
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
