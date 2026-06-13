import { Venue } from "../types"

// Great Ormond Street Hospital — the first venue the app shipped with. It is now
// just one *seed* venue rather than the hard-coded universe: its center, floor
// plans and waypoints are data on this object, not constants sprinkled across
// the codebase. New public/private venues are layered alongside it at runtime.

export const GOSH_VENUE: Venue = {
  id: "gosh",
  slug: "gosh",
  name: "GOSH Wayfinder",
  subtitle: "Great Ormond Street Hospital",
  category: "hospital",
  center: { lat: 51.5225, lng: -0.1199 },
  defaultZoom: 18,
  visibility: "public",
  verified: true,
  accessibility: {
    stepFreeRoute: true,
    accessibleToilets: true,
    notes: "Lifts serve all mapped floors; step-free routes available throughout.",
  },
  quickAccess: ["Main Entrance", "A&E Entrance", "Restaurant & Café", "Pharmacy", "Ward 5B", "X-Ray & Imaging"],
  floorPlans: [
    { id: "gf", floor: 0, label: "Ground", imageUrl: "/floorplans/ground.svg", bounds: [[51.5218, -0.1208], [51.5232, -0.1190]] },
    { id: "f1", floor: 1, label: "Floor 1", imageUrl: "/floorplans/floor1.svg", bounds: [[51.5218, -0.1208], [51.5232, -0.1190]] },
    { id: "f2", floor: 2, label: "Floor 2", imageUrl: "/floorplans/floor2.svg", bounds: [[51.5218, -0.1208], [51.5232, -0.1190]] },
    { id: "f3", floor: 3, label: "Floor 3", imageUrl: "/floorplans/floor3.svg", bounds: [[51.5218, -0.1208], [51.5232, -0.1190]] },
  ],
  waypoints: [
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
  ],
}
